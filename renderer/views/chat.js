import { h, toast, fmtTime, attachCopyButtons } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { renderMarkdown } from '../lib/markdown.js';

export default {
  id: 'chat',
  title: '会话',
  async mount(root, ctx) {
    const projectId = ctx.state.currentProjectId;
    if (!projectId) {
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'empty-tip', style: 'margin-top:80px' }, [
        h('div', { text: '请先选择一个项目' }),
        h('div', { style: 'margin-top:14px' }, [h('button', { class: 'btn primary', onclick: () => ctx.navigate('projects'), text: '前往项目列表' })])
      ]));
      return () => {};
    }

    let disposed = false;
    let sessions = [];
    let session = null;
    let running = false;
    let currentRunId = null;
    const toolCards = new Map(); // callId -> element
    let stream = null; // { wrapper, mdEl, mdRaw, reasoningEl, reasoningRaw, mdTimer }
    let scrollPinned = true;

    const api = ctx.api;

    // ===== DOM 骨架 =====
    root.innerHTML = '';
    const layout = h('div', { class: 'chat-layout' });
    const panel = h('div', { class: 'session-panel' });
    const chatMain = h('div', { class: 'chat-main' });
    layout.appendChild(panel);
    layout.appendChild(chatMain);
    root.appendChild(layout);

    // 会话面板
    const panelHead = h('div', { class: 'session-panel-head' }, [
      h('div', { class: 'view-title', text: '会话' }),
      h('button', { class: 'btn small primary', style: 'margin-left:auto', onclick: newSession }, [icon('plus', 'nav-ico'), h('span', { text: '新建' })])
    ]);
    const sessionListEl = h('div', { class: 'session-list' });
    panel.appendChild(panelHead);
    panel.appendChild(sessionListEl);

    // 聊天主区
    const chatHeader = h('div', { class: 'view-header' }, [
      h('div', { class: 'view-title', id: 'chat-title', text: '会话' }),
      h('div', { class: 'view-sub', id: 'chat-sub' }),
      h('div', { class: 'view-actions' }, [
        h('button', { class: 'btn small', onclick: () => ctx.api.invoke('shell:openPath', ctx.state.currentProject.path) }, [icon('folder', 'nav-ico'), h('span', { text: '项目目录' })])
      ])
    ]);
    const scrollEl = h('div', { class: 'chat-scroll' });
    const emptyEl = h('div', { class: 'chat-empty', text: '开始新的对话吧 —— 描述你的任务，AI 会调用工具帮你完成' });
    scrollEl.appendChild(emptyEl);

    const composerWrap = h('div', { class: 'composer-wrap' });
    const textarea = h('textarea', { placeholder: '输入消息，Enter 发送，Shift+Enter 换行（AI 可调用工具：命令/文件/搜索/MCP）' });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
    textarea.addEventListener('input', () => { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px'; });
    const sendBtn = h('button', { class: 'btn primary', onclick: send }, [icon('play', 'nav-ico'), h('span', { text: '发送' })]);
    const stopBtn = h('button', { class: 'btn stop-btn', style: 'display:none', onclick: stopRun }, [icon('stop', 'nav-ico'), h('span', { text: '停止' })]);
    const composer = h('div', { class: 'composer' }, [
      textarea,
      h('div', { class: 'composer-bar' }, [
        h('span', { class: 'composer-hint', text: '工具调用会在会话中实时展示' }),
        h('div', { class: 'spacer' }),
        stopBtn,
        sendBtn
      ])
    ]);
    composerWrap.appendChild(composer);

    chatMain.appendChild(chatHeader);
    chatMain.appendChild(scrollEl);
    chatMain.appendChild(composerWrap);

    scrollEl.addEventListener('scroll', () => {
      const near = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 80;
      scrollPinned = near;
    });

    function scrollBottom() {
      if (scrollPinned) scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    // ===== 会话列表 =====
    async function refreshSessions(selectId) {
      if (disposed) return;
      sessions = await api.invoke('sessions:list', projectId);
      sessionListEl.innerHTML = '';
      for (const s of sessions) {
        const item = h('div', { class: 'session-item' + (s.id === selectId || (session && s.id === session.id) ? ' active' : '') }, [
          h('div', { class: 'si-title', text: s.title }),
          h('div', { class: 'si-meta', text: fmtTime(s.updatedAt) + ' · ' + s.messageCount + ' 条' })
        ]);
        item.addEventListener('click', () => loadSession(s.id));
        sessionListEl.appendChild(item);
      }
    }

    async function newSession() {
      if (running) { toast('请先停止当前任务', 'err'); return; }
      const s = await api.invoke('sessions:create', projectId);
      session = s;
      currentRunId = null;
      await refreshSessions(s.id);
      renderMessages([]);
      setTitle(s.title);
    }

    async function loadSession(id) {
      if (running) { toast('请先停止当前任务', 'err'); return; }
      const s = await api.invoke('sessions:load', id);
      if (!s) return;
      session = s;
      await refreshSessions(id);
      renderMessages(s.messages || []);
      setTitle(s.title);
    }

    function setTitle(t) {
      const el = document.getElementById('chat-title');
      if (el) el.textContent = t || '会话';
      const sub = document.getElementById('chat-sub');
      if (sub) sub.textContent = ctx.state.currentProject ? ctx.state.currentProject.name + ' · ' + ctx.state.currentProject.path : '';
    }

    // ===== 消息渲染 =====
    function renderMessages(messages) {
      scrollEl.innerHTML = '';
      toolCards.clear();
      stream = null;
      if (!messages || !messages.length) {
        scrollEl.appendChild(h('div', { class: 'chat-empty', text: '开始新的对话吧 —— 描述你的任务，AI 会调用工具帮你完成' }));
        return;
      }
      for (const m of messages) {
        if (m.role === 'user') appendUserMsg(m.content, m.ts);
        else if (m.role === 'assistant') {
          const w = appendAssistantMsg();
          if (m.reasoning) {
            const rb = getReasoningBlock(w);
            rb.body.textContent = m.reasoning;
          }
          if (m.content) {
            w.md.innerHTML = renderMarkdown(m.content);
            attachCopyButtons(w.md);
          }
          if (m.toolCalls) {
            for (const tc of m.toolCalls) {
              addToolCard(w, tc.id || tc.name, tc.name, tc.parsedArgs || {}, 'done');
            }
          }
        } else if (m.role === 'tool') {
          // 结果已在工具卡片内展示；此处无需额外渲染
        }
      }
      scrollPinned = true;
      scrollBottom();
    }

    function appendUserMsg(content, ts) {
      if (scrollEl.querySelector('.chat-empty')) scrollEl.querySelector('.chat-empty').remove();
      const box = h('div', { class: 'msg' });
      const bubble = h('div', { class: 'msg-user', text: content });
      const time = h('div', { class: 'msg-time', text: fmtTime(ts) });
      box.appendChild(bubble);
      box.appendChild(time);
      scrollEl.appendChild(box);
      scrollBottom();
      return box;
    }

    function appendAssistantMsg() {
      if (scrollEl.querySelector('.chat-empty')) scrollEl.querySelector('.chat-empty').remove();
      const box = h('div', { class: 'msg msg-assistant' });
      const wrapper = h('div', { class: 'md-body' });
      box.appendChild(wrapper);
      scrollEl.appendChild(box);
      const rec = { box, md: wrapper, mdRaw: '', reasoningEl: null, reasoningRaw: '', reasoningOpen: false, mdTimer: null };
      return rec;
    }

    function ensureStream() {
      if (stream) return stream;
      stream = appendAssistantMsg();
      return stream;
    }

    function getReasoningBlock(w) {
      if (!w.reasoningEl) {
        const block = h('div', { class: 'reasoning-block' });
        const toggle = h('button', { class: 'reasoning-toggle', text: '▸ 思考过程' });
        const body = h('div', { class: 'reasoning-body' });
        toggle.addEventListener('click', () => {
          block.classList.toggle('open');
          toggle.textContent = block.classList.contains('open') ? '▾ 思考过程' : '▸ 思考过程';
          scrollBottom();
        });
        block.appendChild(toggle);
        block.appendChild(body);
        w.box.insertBefore(block, w.md);
        w.reasoningEl = { block, body };
      }
      return w.reasoningEl;
    }

    function addToolCard(w, callId, name, args, status) {
      const card = h('div', { class: 'tool-card' });
      const head = h('div', { class: 'tool-card-head' });
      const nameEl = h('span', { class: 'tc-name', text: name });
      const statusEl = h('span', { class: 'tc-status' });
      head.appendChild(icon('box', 'nav-ico'));
      head.appendChild(nameEl);
      head.appendChild(statusEl);
      const body = h('div', { class: 'tool-card-body' });
      const argsPre = h('div', { class: 'tool-args', text: safeJson(args) });
      body.appendChild(argsPre);
      const resultPre = h('div', { class: 'tool-result' });
      card.appendChild(head);
      card.appendChild(body);
      w.box.appendChild(card);
      const rec = { card, head, statusEl, body, resultPre, approval: null };
      toolCards.set(callId, rec);
      setToolStatus(rec, status);
      return rec;
    }

    function setToolStatus(rec, status, text) {
      if (!rec) return;
      rec.statusEl.innerHTML = '';
      if (status === 'running') {
        rec.statusEl.appendChild(h('span', { class: 'badge warn', text: '运行中…' }));
      } else if (status === 'done') {
        rec.statusEl.appendChild(h('span', { class: 'badge ok', text: '✓ 成功' }));
        rec.resultPre.classList.add('ok');
      } else if (status === 'failed') {
        rec.statusEl.appendChild(h('span', { class: 'badge err', text: '✗ 失败' }));
        rec.resultPre.classList.add('err');
      } else if (status === 'denied') {
        rec.statusEl.appendChild(h('span', { class: 'badge warn', text: '已拒绝' }));
        rec.resultPre.classList.add('err');
      } else {
        rec.statusEl.appendChild(h('span', { class: 'badge', text: status || '' }));
      }
      if (text !== undefined) rec.resultPre.textContent = text;
    }

    function safeJson(o) {
      try { return JSON.stringify(o, null, 2); } catch (e) { return String(o); }
    }

    // ===== 发送与流式 =====
    async function send() {
      const text = textarea.value.trim();
      if (!text || running) return;
      if (!session) {
        session = await api.invoke('sessions:create', projectId);
        await refreshSessions(session.id);
      }
      setRunning(true);
      currentRunId = null;
      // 先本地显示用户消息
      appendUserMsg(text, Date.now());
      textarea.value = '';
      textarea.style.height = 'auto';
      const res = await api.invoke('agent:start', { projectId, sessionId: session.id, text });
      if (!res.ok) {
        setRunning(false);
        toast(res.error || '发送失败', 'err');
        return;
      }
      session.id = res.sessionId;
      await refreshSessions(session.id);
    }

    function setRunning(v) {
      running = v;
      sendBtn.style.display = v ? 'none' : '';
      stopBtn.style.display = v ? '' : 'none';
      if (v) sendBtn.disabled = true;
      else sendBtn.disabled = false;
    }

    async function stopRun() {
      if (currentRunId) await api.invoke('agent:stop', currentRunId);
    }

    function finishStream() {
      if (stream) {
        stream.md.innerHTML = renderMarkdown(stream.mdRaw);
        attachCopyButtons(stream.md);
        if (stream.reasoningEl) stream.reasoningEl.body.textContent = stream.reasoningRaw;
        stream = null;
      }
      scrollBottom();
    }

    // ===== Agent 事件处理 =====
    ctx.state.agentHandler = (evt) => {
      if (disposed) return;
      switch (evt.type) {
        case 'user-message':
          appendUserMsg(evt.content, Date.now());
          break;
        case 'reasoning': {
          const w = ensureStream();
          w.reasoningRaw += evt.text;
          const rb = getReasoningBlock(w);
          rb.body.textContent = w.reasoningRaw;
          if (!w.reasoningOpen) { w.reasoningOpen = true; rb.block.classList.add('open'); rb.block.querySelector('.reasoning-toggle').textContent = '▾ 思考过程'; }
          scrollBottom();
          break;
        }
        case 'text': {
          const w = ensureStream();
          w.mdRaw += evt.text;
          if (!w.mdTimer) {
            w.mdTimer = setTimeout(() => {
              if (!stream) return;
              stream.md.innerHTML = renderMarkdown(stream.mdRaw);
              scrollBottom();
            }, 80);
          }
          break;
        }
        case 'tool-start': {
          const w = ensureStream();
          const rec = addToolCard(w, evt.callId, evt.name, evt.args, 'running');
          toolCards.set(evt.callId, rec);
          scrollBottom();
          break;
        }
        case 'tool-result': {
          const rec = toolCards.get(evt.callId);
          if (rec) {
            setToolStatus(rec, evt.status, typeof evt.result === 'string' ? evt.result : safeJson(evt.result));
            if (rec.approval) { rec.approval.remove(); rec.approval = null; }
            scrollBottom();
          }
          break;
        }
        case 'approval': {
          const w = ensureStream();
          let rec = toolCards.get(evt.callId);
          if (!rec) {
            rec = addToolCard(w, evt.callId, evt.call.name, evt.call.args, 'running');
            toolCards.set(evt.callId, rec);
          }
          const bar = h('div', { class: 'approval-bar' }, [
            h('span', { class: 'txt', text: '⚠ 需要你的批准：' + evt.call.name }),
            h('div', { class: 'btns' }, [
              h('button', { class: 'btn small danger', onclick: () => { api.invoke('agent:approve', evt.runId, evt.callId, 'deny'); setToolStatus(rec, 'denied'); bar.remove(); }, text: '拒绝' }),
              h('button', { class: 'btn small primary', onclick: () => { api.invoke('agent:approve', evt.runId, evt.callId, 'allow'); bar.remove(); }, text: '允许' })
            ])
          ]);
          rec.approval = bar;
          rec.card.appendChild(bar);
          scrollBottom();
          break;
        }
        case 'done':
          finishStream();
          setRunning(false);
          currentRunId = null;
          refreshSessions(session ? session.id : undefined);
          break;
        case 'stopped':
          finishStream();
          setRunning(false);
          currentRunId = null;
          toast('已停止', 'ok');
          refreshSessions();
          break;
        case 'error':
          finishStream();
          setRunning(false);
          toast(evt.message || '发生错误', 'err');
          break;
        case 'round':
          break;
        default:
          break;
      }
    };

    // ===== 初始化 =====
    await refreshSessions();
    // 默认加载最近会话或新建
    if (sessions.length) {
      await loadSession(sessions[0].id);
    } else {
      session = await api.invoke('sessions:create', projectId);
      await refreshSessions(session.id);
      renderMessages([]);
      setTitle(session.title);
    }

    return () => {
      disposed = true;
      if (stream && stream.mdTimer) clearTimeout(stream.mdTimer);
      ctx.state.agentHandler = null;
    };
  }
};
