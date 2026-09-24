import { h, toast } from '../lib/ui.js';
import { icon } from '../lib/icons.js';

export default {
  id: 'settings',
  title: '设置',
  async mount(root, ctx) {
    let disposed = false;
    const api = ctx.api;
    let settings = await api.invoke('settings:get');
    const appInfo = await api.invoke('app:info');

    const builtinTools = [
      ['run_command', '执行命令'],
      ['read_file', '读取文件'],
      ['write_file', '写入文件'],
      ['list_dir', '列目录'],
      ['grep', '搜索文本'],
      ['web_fetch', '抓取网页'],
      ['get_project_info', '项目概览']
    ];

    // 控件
    const fBaseUrl = h('input', { class: 'input', value: settings.provider.baseUrl });
    const fApiKey = h('input', { class: 'input', type: 'password', value: settings.provider.apiKey, placeholder: 'sk-…' });
    const showKeyBtn = h('button', { class: 'btn small', text: '显示' });
    showKeyBtn.addEventListener('click', () => { fApiKey.type = fApiKey.type === 'password' ? 'text' : 'password'; showKeyBtn.textContent = fApiKey.type === 'password' ? '显示' : '隐藏'; });
    const fModel = h('input', { class: 'input', list: 'model-list', value: settings.provider.model });
    const fTemp = h('input', { class: 'input', type: 'range', min: '0', max: '2', step: '0.1', value: String(settings.provider.temperature) });
    const tempVal = h('span', { class: 'badge', text: settings.provider.temperature });
    fTemp.addEventListener('input', () => { tempVal.textContent = fTemp.value; });
    const fMaxTokens = h('input', { class: 'input', type: 'number', value: settings.provider.maxTokens, min: '256', step: '256' });
    const fPrompt = h('textarea', { class: 'textarea', style: 'min-height:110px', value: settings.provider.systemPrompt });
    const fRounds = h('input', { class: 'input', type: 'number', value: settings.agent.maxToolRounds, min: '1', max: '30' });
    const fTimeout = h('input', { class: 'input', type: 'number', value: settings.agent.shellTimeoutMs, min: '1000', step: '1000' });
    const fTheme = h('select', { class: 'select' }, [
      h('option', { value: 'dark', text: '深色' }),
      h('option', { value: 'light', text: '浅色' })
    ]);
    fTheme.value = settings.appearance.theme;
    const fFontSize = h('input', { class: 'input', type: 'number', value: settings.appearance.fontSize, min: '11', max: '20' });
    const fSkillsDir = h('input', { class: 'input', value: settings.paths.skillsDir || '', placeholder: '默认：用户数据目录/skills' });
    const fPluginsDir = h('input', { class: 'input', value: settings.paths.pluginsDir || '', placeholder: '默认：用户数据目录/plugins' });
    const fProxy = h('input', { class: 'input', value: settings.network.proxy || '', placeholder: '可选：http://127.0.0.1:7890' });

    const autoChecks = {};
    const autoWrap = h('div', {});
    for (const [name, label] of builtinTools) {
      const ck = h('input', { type: 'checkbox' });
      ck.checked = settings.agent.autoApprove.includes(name);
      autoChecks[name] = ck;
      autoWrap.appendChild(h('div', { class: 'check-row' }, [ck, h('label', { text: label + '（' + name + '）' })]));
    }
    const askWrite = h('input', { type: 'checkbox' });
    askWrite.checked = settings.agent.askBeforeWrite !== false;

    const save = async () => {
      const patch = {
        provider: {
          baseUrl: fBaseUrl.value.trim() || 'https://api.deepseek.com',
          apiKey: fApiKey.value.trim(),
          model: fModel.value.trim() || 'deepseek-chat',
          temperature: parseFloat(fTemp.value),
          maxTokens: parseInt(fMaxTokens.value, 10) || 8192,
          systemPrompt: fPrompt.value
        },
        agent: {
          maxToolRounds: parseInt(fRounds.value, 10) || 12,
          shellTimeoutMs: parseInt(fTimeout.value, 10) || 60000,
          autoApprove: Object.entries(autoChecks).filter(([, c]) => c.checked).map(([n]) => n),
          askBeforeWrite: askWrite.checked
        },
        appearance: {
          theme: fTheme.value,
          fontSize: parseInt(fFontSize.value, 10) || 14
        },
        paths: {
          skillsDir: fSkillsDir.value.trim(),
          pluginsDir: fPluginsDir.value.trim()
        },
        network: {
          proxy: fProxy.value.trim()
        }
      };
      const merged = await api.invoke('settings:set', patch);
      settings = merged;
      applyTheme();
      ctx.refreshStatus();
      toast('设置已保存', 'ok');
    };

    function applyTheme() {
      const dark = settings.appearance.theme !== 'light';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }

    function section(title, body) {
      return h('div', { class: 'settings-section' }, [
        h('h3', { text: title }),
        h('div', { class: 'section-body' }, body)
      ]);
    }

    function field(label, input, hint) {
      const wrap = h('div', { class: 'field' }, [h('label', { text: label }), input]);
      if (hint) wrap.appendChild(h('div', { class: 'hint', text: hint }));
      return wrap;
    }

    root.innerHTML = '';
    root.appendChild(h('div', { class: 'view-header' }, [
      h('div', { class: 'view-title', text: '设置' }),
      h('div', { class: 'view-sub', text: '模型、界面与数据配置' }),
      h('div', { class: 'view-actions' }, [h('button', { class: 'btn primary', onclick: save, text: '保存设置' })])
    ]));
    const scroll = h('div', { class: 'settings-scroll' });

    scroll.appendChild(section('模型服务', [
      field('API 地址 (Base URL)', fBaseUrl, 'OpenAI 兼容接口，默认 DeepSeek：https://api.deepseek.com'),
      field('API Key', h('div', { class: 'row' }, [fApiKey, showKeyBtn]), '可在 platform.deepseek.com 申请，保存在本机'),
      field('模型', h('div', {}, [
        fModel,
        h('datalist', { id: 'model-list' }, [
          h('option', { value: 'deepseek-chat' }),
          h('option', { value: 'deepseek-reasoner' }),
          h('option', { value: 'deepseek-v3' }),
          h('option', { value: 'deepseek-r1' })
        ])
      ])),
      h('div', { class: 'row' }, [
        field('温度', h('div', { class: 'row' }, [fTemp, tempVal])),
        field('最大输出 tokens', fMaxTokens)
      ]),
      field('系统提示词', fPrompt, 'AI 的角色设定与行为约束')
    ]));

    scroll.appendChild(section('智能体', [
      h('div', { class: 'row' }, [
        field('最大工具轮次', fRounds),
        field('命令超时 (ms)', fTimeout)
      ]),
      field('自动批准的工具（无需询问直接执行）', autoWrap, '未勾选的工具每次调用都会弹窗请你确认'),
      h('div', { class: 'check-row' }, [askWrite, h('label', { text: '写入文件前询问我' })])
    ]));

    scroll.appendChild(section('外观', [
      h('div', { class: 'row' }, [
        field('主题', fTheme),
        field('字号', fFontSize)
      ])
    ]));

    scroll.appendChild(section('数据与路径', [
      field('技能目录', fSkillsDir, '留空使用默认目录'),
      field('插件目录', fPluginsDir, '留空使用默认目录'),
      field('网络代理', fProxy, '可选，用于访问 MCP 或抓取网页'),
      h('div', { class: 'field' }, [
        h('label', { text: '数据目录' }),
        h('div', { class: 'row' }, [
          h('input', { class: 'input', value: appInfo.dataDir, readonly: '' }),
          h('button', { class: 'btn', onclick: () => api.invoke('shell:openPath', appInfo.dataDir) }, [icon('folder', 'nav-ico'), h('span', { text: '打开' })])
        ])
      ])
    ]));

    scroll.appendChild(section('关于', [
      h('div', { class: 'check-row' }, [h('span', { text: 'DeepSeek Harness Desktop v' + appInfo.version + '（' + appInfo.platform + '）' })]),
      h('div', { class: 'check-row' }, [
        h('button', { class: 'btn small', onclick: () => api.invoke('shell:openExternal', 'https://github.com/jianbaobao/deepseek-harness-desktop') }, [icon('external', 'nav-ico'), h('span', { text: '项目主页' })]),
        h('button', { class: 'btn small', onclick: () => api.invoke('shell:openExternal', 'https://platform.deepseek.com') }, [icon('external', 'nav-ico'), h('span', { text: 'DeepSeek 开放平台' })]),
        h('button', { class: 'btn small', onclick: () => api.invoke('shell:openExternal', 'https://github.com/deepseek-ai/deepseek-harness') }, [icon('external', 'nav-ico'), h('span', { text: '上游 deepseek-harness' })])
      ])
    ]));

    root.appendChild(scroll);
    applyTheme();
    return () => { disposed = true; };
  }
};
