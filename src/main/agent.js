'use strict';
// 智能体运行循环：流式对话 + 工具调用（含 MCP / 插件工具）+ 审批
const crypto = require('crypto');
const { getSettings } = require('./settings');
const sessions = require('./sessions');
const builtinTools = require('./tools');
const mcp = require('./mcp');
const skills = require('./skills');
const plugins = require('./plugins');

const runs = new Map(); // runId -> AbortController

function newRunId() {
  return crypto.randomBytes(6).toString('hex');
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return { _raw: s }; }
}

async function streamChat(messages, defs, signal, onDelta) {
  const s = getSettings().provider;
  if (!s.apiKey) throw new Error('尚未配置 API Key，请在「设置」中填写 DeepSeek API Key。');
  const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const body = {
    model: s.model,
    messages,
    stream: true,
    temperature: s.temperature,
    max_tokens: s.maxTokens || 8192
  };
  if (defs && defs.length) body.tools = defs;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.apiKey },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch (e) { /* 忽略 */ }
    throw new Error('API 请求失败（' + res.status + '）：' + detail);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
  let reasoning = '';
  const toolCalls = new Map();
  let finish = 'stop';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { finish = 'stop'; continue; }
      let j;
      try { j = JSON.parse(data); } catch (e) { continue; }
      const ch = j.choices && j.choices[0];
      if (!ch) continue;
      const delta = ch.delta || {};
      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        if (onDelta) onDelta({ type: 'reasoning', text: delta.reasoning_content });
      }
      if (delta.content) {
        content += delta.content;
        if (onDelta) onDelta({ type: 'text', text: delta.content });
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index || 0;
          let rec = toolCalls.get(idx);
          if (!rec) { rec = { id: tc.id || '', name: '', args: '' }; toolCalls.set(idx, rec); }
          if (tc.id) rec.id = tc.id;
          if (tc.function) {
            if (tc.function.name) rec.name += tc.function.name;
            if (tc.function.arguments) rec.args += tc.function.arguments;
          }
        }
      }
      if (ch.finish_reason) finish = ch.finish_reason;
    }
  }
  const calls = [...toolCalls.values()].map((c) => ({ ...c, parsedArgs: safeParse(c.args || '{}') }));
  return { content, reasoning, toolCalls: calls, finish };
}

function buildSystemPrompt(project) {
  const s = getSettings();
  let p = s.provider.systemPrompt;
  p += '\n\n【当前项目】名称：' + project.name + '，根目录：' + project.path;
  const skillCtx = skills.buildSkillContext();
  if (skillCtx) p += '\n\n【可用技能】\n' + skillCtx;
  const mcpDefs = mcp.getMcpToolDefinitions();
  if (mcpDefs.length) {
    p += '\n\n【MCP 外部工具】已连接 ' + mcp.listServers().filter((x) => x.status === 'running').length + ' 个 MCP 服务器，相关工具（名称以 mcp__ 开头）会在必要时调用。';
  }
  return p;
}

function toApiMessages(session) {
  const msgs = session.messages || [];
  const recent = msgs.slice(-60);
  const out = [];
  for (const m of recent) {
    if (m.role === 'user') {
      let c = m.content;
      if (typeof c !== 'string') c = JSON.stringify(c);
      out.push({ role: 'user', content: String(c).slice(0, 20000) });
    } else if (m.role === 'assistant') {
      const a = { role: 'assistant', content: String(m.content || '').slice(0, 20000) };
      if (m.toolCalls && m.toolCalls.length) {
        a.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.parsedArgs || {}) }
        }));
      }
      out.push(a);
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: String(m.resultText || '').slice(0, 20000) });
    }
  }
  return out;
}

async function executeToolCall(call, projectPath) {
  const name = call.name;
  if (name.startsWith('mcp__')) {
    const m = /^mcp__(.+?)__(.+)$/.exec(name);
    if (!m) throw new Error('无效的 MCP 工具名');
    const r = await mcp.callTool(m[1], m[2], call.parsedArgs);
    return r;
  }
  if (name.startsWith('plugin__')) {
    const r = await plugins.callPluginTool(name, call.parsedArgs);
    return { ok: true, text: typeof r === 'string' ? r : JSON.stringify(r) };
  }
  const r = await builtinTools.execute(name, call.parsedArgs, { projectPath, onExternal: async () => { throw new Error('未注册工具：' + name); } });
  return { ok: true, text: JSON.stringify(r, null, 2) };
}

function needsApproval(call) {
  const s = getSettings();
  const auto = (s.agent.autoApprove || []);
  if (auto.includes(call.name)) return false;
  if (call.name === 'write_file' && s.agent.askBeforeWrite === false) return false;
  return true;
}

async function runAgent(project, session, userText, emit) {
  const runId = newRunId();
  const ctrl = new AbortController();
  runs.set(runId, ctrl);

  session.messages = session.messages || [];
  session.messages.push({ role: 'user', content: userText, ts: Date.now() });
  sessions.save(session);
  emit({ type: 'user-message', runId, content: userText });

  const settings = getSettings();
  const maxRounds = Math.max(1, settings.agent.maxToolRounds || 12);

  try {
    for (let round = 0; round < maxRounds; round++) {
      emit({ type: 'round', runId, round: round + 1 });
      const defs = [
        ...builtinTools.buildToolDefinitions(),
        ...mcp.getMcpToolDefinitions(),
        ...plugins.getPluginToolDefinitions()
      ];
      const apiMessages = [{ role: 'system', content: buildSystemPrompt(project) }, ...toApiMessages(session)];
      const result = await streamChat(apiMessages, defs, ctrl.signal, (evt) => emit({ ...evt, runId }));
      const assistantMsg = {
        role: 'assistant',
        content: result.content,
        reasoning: result.reasoning,
        ts: Date.now()
      };
      if (result.toolCalls && result.toolCalls.length) {
        assistantMsg.toolCalls = result.toolCalls.map((c) => ({ id: c.id, name: c.name, parsedArgs: c.parsedArgs }));
      }
      session.messages.push(assistantMsg);
      if (!result.toolCalls || !result.toolCalls.length) break;

      // 执行工具
      for (const call of result.toolCalls) {
        const callId = crypto.randomBytes(4).toString('hex');
        let decision = 'allow';
        if (needsApproval(call)) {
          decision = await new Promise((resolve) => {
            const key = runId + ':' + callId;
            const timer = setTimeout(() => { approvals.delete(key); resolve('deny'); }, 180000);
            approvals.set(key, (d) => { clearTimeout(timer); resolve(d); });
            emit({ type: 'approval', runId, callId, call: { name: call.name, args: call.parsedArgs } });
          });
        }
        if (decision !== 'allow') {
          session.messages.push({ role: 'tool', toolCallId: call.id, resultText: '用户拒绝了该操作。', ts: Date.now() });
          emit({ type: 'tool-result', runId, callId, name: call.name, status: 'denied', result: '用户拒绝了该操作。' });
          continue;
        }
        emit({ type: 'tool-start', runId, callId, name: call.name, args: call.parsedArgs });
        const started = Date.now();
        try {
          const r = await executeToolCall(call, project.path);
          const text = typeof r.text === 'string' ? r.text : JSON.stringify(r);
          session.messages.push({ role: 'tool', toolCallId: call.id, resultText: text, ts: Date.now() });
          emit({ type: 'tool-result', runId, callId, name: call.name, status: r.ok === false ? 'failed' : 'done', result: text.slice(0, 60000), ms: Date.now() - started });
        } catch (e) {
          const text = '工具执行失败：' + e.message;
          session.messages.push({ role: 'tool', toolCallId: call.id, resultText: text, ts: Date.now() });
          emit({ type: 'tool-result', runId, callId, name: call.name, status: 'failed', result: text, ms: Date.now() - started });
        }
      }
      sessions.save(session);
    }
    sessions.save(session);
    emit({ type: 'done', runId });
  } catch (e) {
    if (e.name === 'AbortError') {
      session.messages.push({ role: 'system', content: '（已停止）', ts: Date.now() });
      sessions.save(session);
      emit({ type: 'stopped', runId });
    } else {
      emit({ type: 'error', runId, message: e.message });
      throw e;
    }
  } finally {
    runs.delete(runId);
  }
  return session;
}

const approvals = new Map(); // key -> fn(decision)

function approve(runId, callId, decision) {
  const key = runId + ':' + callId;
  const fn = approvals.get(key);
  if (fn) {
    approvals.delete(key);
    fn(decision);
    return true;
  }
  return false;
}

function stop(runId) {
  const ctrl = runs.get(runId);
  if (ctrl) ctrl.abort();
  return !!ctrl;
}

module.exports = { runAgent, approve, stop, runs };
