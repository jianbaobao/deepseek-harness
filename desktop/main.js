// DeepSeek Harness Desktop — Reasonix-style desktop shell.
// Bundles dsh (web profile) as a compressed tarball; on first launch it is
// extracted to the per-user data dir, then the bundled Node runtime boots the
// dsh web server and a BrowserWindow opens on it. Closing the window shuts
// the dsh process down.
//
// Smoke test:  DSH_DESKTOP_SMOKE=1 electron .   (loads, prints, exits)
'use strict'

const { app, BrowserWindow, clipboard, desktopCapturer, dialog, Menu, shell } = require('electron')
const { spawn, execFileSync } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')

const PORT = 3080
const SMOKE = process.env.DSH_DESKTOP_SMOKE === '1'

// Custom workspace: settings.json at userData root ({"workspace": "D:\\code\\demo"})
// or the DSH_DESKTOP_WORKSPACE environment variable. Falls back to the bundle dir.
function resolveWorkspace() {
  const envWs = process.env.DSH_DESKTOP_WORKSPACE
  if (envWs && fs.existsSync(envWs)) return envWs
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8'))
    if (typeof cfg.workspace === 'string' && fs.existsSync(cfg.workspace)) return cfg.workspace
  } catch { /* no settings file yet */ }
  return undefined
}

function resourcesDir() {
  if (process.env.DSH_DESKTOP_RESOURCES_DIR) return process.env.DSH_DESKTOP_RESOURCES_DIR
  return path.join(process.resourcesPath || path.join(__dirname, 'resources'))
}

// The extracted dsh bundle lives under the per-user data dir.
function bundleDir() {
  return path.join(app.getPath('userData'), 'dsh-bundle')
}

function bundleReady(dir) {
  return fs.existsSync(path.join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
}

function extractBundle(dir) {
  const archive = path.join(resourcesDir(), 'dsh-bundle.tar.gz')
  if (!fs.existsSync(archive)) throw new Error(`缺少 dsh 运行时压缩包: ${archive}`)
  fs.mkdirSync(dir, { recursive: true })
  // Use Windows' built-in bsdtar (accepts D: paths); GNU tar from Git
  // Bash would misparse drive-letter paths as remote hosts.
  const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar'
  // stdio ignore: GUI apps have no console handles for inherited streams
  execFileSync(tar, ['-xzf', archive, '-C', dir], { stdio: 'ignore' })
}

function resolveNode(dir) {
  const bundled = path.join(dir, 'node', process.platform === 'win32' ? 'node.exe' : path.join('bin', 'node'))
  return fs.existsSync(bundled) ? bundled : 'node'
}

let dshProcess = null

function startDsh(dir) {
  const node = resolveNode(dir)
  const bin = path.join(dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const dshHome = path.join(app.getPath('userData'), 'dsh-home')
  fs.mkdirSync(dshHome, { recursive: true })
  const workspace = resolveWorkspace()
  dshProcess = spawn(node, [bin, '--profile', 'web', '--port', String(PORT)], {
    cwd: workspace || dir,
    stdio: 'inherit',
    // windowsHide keeps the bundled node.exe console window from flashing on Windows
    windowsHide: true,
    env: { ...process.env, DSH_HOME: dshHome },
  })
  dshProcess.on('exit', (code) => {
    if (app.isQuitting) return
    app.exit(code ?? 0)
  })
}

function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/', timeout: 1500 }, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`dsh web 未在 ${timeoutMs}ms 内启动 (http://127.0.0.1:${PORT})`))
          return
        }
        setTimeout(check, 500)
      })
      req.on('timeout', () => { req.destroy() })
    }
    check()
  })
}

function killDsh() {
  if (!dshProcess || dshProcess.killed) return
  try {
    if (process.platform === 'win32') {
      // Kill the full tree so the web worker child does not outlive the window
      execFileSync('taskkill', ['/PID', String(dshProcess.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      try { process.kill(-dshProcess.pid, 'SIGTERM') } catch { /* group may not exist */ }
      dshProcess.kill()
    }
  } catch { /* already gone */ }
  dshProcess = null
}

// ---- Stats panel (balance + session info) ---------------------------------

// ---- Global tools configuration (settings.yaml "ui-tools" namespace) --------
// Persisted so mirror-acceleration and security-audit apply session-to-session.

function toolsSettingsPath() {
  return path.join(app.getPath('userData'), 'dsh-home', 'settings.yaml')
}

// Read the ui-tools global flags; returns sane defaults when missing/corrupt.
function readToolsConfig() {
  const cfg = { mirrorAcceleration: true, securityAudit: true }
  try {
    const raw = fs.readFileSync(toolsSettingsPath(), 'utf8')
    const m = raw.match(/ui-tools:\s*([\s\S]*?)(?:^\w|\z)/m)
    if (m) {
      const block = m[1]
      const mirror = block.match(/mirrorAcceleration:\s*(true|false)/)
      const audit = block.match(/securityAudit:\s*(true|false)/)
      if (mirror) cfg.mirrorAcceleration = mirror[1] === 'true'
      if (audit) cfg.securityAudit = audit[1] === 'true'
    }
  } catch { /* no settings file yet */ }
  return cfg
}

// Rewrite the ui-tools namespace in settings.yaml (comment-preserving best-effort).
function writeToolsConfig(next) {
  try {
    const file = toolsSettingsPath()
    let raw = ''
    try { raw = fs.readFileSync(file, 'utf8') } catch { /* new file */ }
    // Strip any existing ui-tools block.
    raw = raw.replace(/ui-tools:[\s\S]*?(?:^\w+|\z)/m, '').replace(/\n{3,}/g, '\n\n')
    const block = 'ui-tools:\n  mirrorAcceleration: ' + next.mirrorAcceleration + '\n  securityAudit: ' + next.securityAudit + '\n'
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, raw.trimEnd() + (raw.trimEnd() ? '\n\n' : '') + block)
  } catch (e) {
    console.error('writeToolsConfig failed:', e)
  }
}

// Verbatim mirror URL (mirror-acceleration enabled) or plain GitHub URL.
function pluginCloneUrl(repo, cfg) {
  if (cfg.mirrorAcceleration) {
    return 'https://ghfast.top/https://github.com/' + repo
  }
  return 'https://github.com/' + repo
}

// Resolve the DeepSeek API key: env first, then the dsh settings.yaml.
function resolveApiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  try {
    const yaml = fs.readFileSync(path.join(app.getPath('userData'), 'dsh-home', 'settings.yaml'), 'utf8')
    // settings.yaml may hold `apiKey: sk-...` under an llm/deepseek block; plain regex scan.
    const m = yaml.match(/(?:apiKey|api_key|key)\s*[:=]\s*["']?(sk-[A-Za-z0-9_-]+)/)
    if (m) return m[1]
  } catch { /* no settings file */ }
  return undefined
}

// Query the DeepSeek account balance: GET https://api.deepseek.com/user/balance
async function queryBalance(apiKey) {
  const res = await fetch('https://api.deepseek.com/user/balance', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`balance API HTTP ${res.status}`)
  const data = await res.json()
  if (!data.balance_infos || data.balance_infos.length === 0) return { available: false, balance: '—' }
  const total = data.balance_infos
    .map(i => Number(i.total_balance || 0))
    .reduce((a, b) => a + b, 0)
  return { available: data.is_available !== false, balance: total.toFixed(2) }
}

// Query the dsh web session stats via the /api RPC channel (best-effort).
async function querySessionStats() {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/stats.describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rpcId: 'desktop-stats', payload: {} }),
  })
  if (!res.ok) throw new Error(`stats RPC HTTP ${res.status}`)
  const data = await res.json()
  const value = data && data.result && data.result.value
  if (!value) throw new Error('stats RPC: no value in response')
  return value
}

function statsPanelHtml(stats) {
  const item = (label, value) => `<div class="item"><span>${label}</span><b>${value}</b></div>`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
    body{margin:0;padding:14px 18px;background:#0f1115;color:#e6e6e6;font:13px/1.8 "Microsoft YaHei",system-ui,sans-serif}
    .bar{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding-bottom:10px;border-bottom:1px solid #1c2027}
    .bar .item{display:flex;align-items:center;gap:6px}
    .bar span{color:#8a93a3}.bar b{font-weight:600;color:#4d9fff}
    .detail{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}
    .detail .item{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #161a20;padding:3px 0}
    .detail span{color:#8a93a3}
    .err{color:#ff6b6b;margin-top:8px}
    .hint{margin-top:10px;color:#5b6270;font-size:12px}
  </style></head><body>
    <div class="bar">
      ${item('模型', stats.model || '—')}
      ${item('工作区', stats.workspace || '—')}
      ${item('余额', stats.balance)}
      ${item('版本', stats.version)}
    </div>
    <div class="detail">
      ${item('会话轮数', String(stats.rounds ?? '—'))}
      ${item('Tokens', stats.tokensTotal != null ? Number(stats.tokensTotal).toLocaleString() : '—')}
      ${item('命中率', stats.cacheHitRate != null ? stats.cacheHitRate + '%' : '—')}
      ${item('费用估算', stats.costEstimateCny != null ? '¥' + stats.costEstimateCny : '—')}
      ${item('生成速度', '<span id="speed">—</span>')}
    </div>
    ${stats.balanceError ? `<div class="err">余额：${stats.balanceError}</div>` : ''}
    <div class="hint">Ctrl+Shift+D 刷新。生成速度按 Tokens 增量/时间实时估算。</div>
    <script>
      let lastTokens = null, lastTime = null
      async function pollSpeed() {
        try {
          const res = await fetch('http://127.0.0.1:${PORT}/api/stats.describe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rpcId: 'panel-speed', payload: {} }),
          })
          const data = await res.json()
          const total = data && data.result && data.result.value && data.result.value.tokens
            ? data.result.value.tokens.total : null
          const now = Date.now()
          if (typeof total === 'number' && lastTokens != null && lastTime != null) {
            const dt = (now - lastTime) / 1000
            if (dt >= 1) {
              const rate = Math.round((total - lastTokens) / dt)
              document.getElementById('speed').textContent = rate >= 0 ? rate + ' t/s' : '—'
            }
          }
          lastTokens = total; lastTime = now
        } catch { /* dsh may be mid-boot */ }
      }
      setInterval(pollSpeed, 2000)
    </script>
  </body></html>`
}

async function openStatsPanel() {
  const stats = {
    version: app.getVersion(),
    workspace: process.env.DSH_DESKTOP_WORKSPACE || '—',
    model: '—',
    rounds: undefined,
    tokensTotal: undefined,
    cacheHitRate: undefined,
    costEstimateCny: undefined,
    balance: '—',
    balanceError: undefined,
  }

  // session stats via RPC (best-effort; dsh may be mid-boot)
  try {
    const s = await querySessionStats()
    stats.model = s.model || '—'
    stats.workspace = s.workspace || stats.workspace
    stats.rounds = s.rounds
    if (s.tokens) stats.tokensTotal = s.tokens.total
    if (s.cacheHitRate != null) stats.cacheHitRate = s.cacheHitRate
    if (s.costEstimateCny != null) stats.costEstimateCny = s.costEstimateCny
  } catch (e) {
    stats.model = stats.model
  }

  const apiKey = resolveApiKey()
  if (apiKey) {
    try {
      const r = await queryBalance(apiKey)
      stats.balance = `¥${r.balance}`
    } catch (e) {
      stats.balanceError = e.message
    }
  } else {
    stats.balanceError = '未配置 DeepSeek API Key（设置 → 模型，或环境变量 DEEPSEEK_API_KEY）'
  }

  const panel = new BrowserWindow({
    width: 520, height: 300, title: 'DeepSeek Harness 统计',
    autoHideMenuBar: true, resizable: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  panel.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(statsPanelHtml(stats)))
}

// ---- Plugin Center (browse GitHub dsh-plugin repos + security signals) -------

// Public GitHub mirror used to accelerate release/raw downloads when the
// official endpoint is slow or blocked; falls back to the official source.
const GITHUB_MIRROR = 'https://ghfast.top/https://github.com'

// One-time in-memory OSV cache (bounded) — OSV API is unauthenticated.
const osvCache = new Map()

// Query the OSV vulnerability database for an npm package; returns a list of
// advisory IDs (empty when none / offline / unknown package).
async function checkOsv(moduleName) {
  if (osvCache.has(moduleName)) return osvCache.get(moduleName)
  try {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name: moduleName, ecosystem: 'npm' } }),
    })
    if (!res.ok) throw new Error('osv http ' + res.status)
    const data = await res.json()
    const vulns = (data.vulns || []).length
    osvCache.set(moduleName, vulns)
    return vulns
  } catch {
    osvCache.set(moduleName, 0)
    return 0
  }
}

function pluginCenterHtml(list, cfg) {
  const auditOn = !cfg || cfg.securityAudit !== false
  const card = (r) => {
    const riskBadges = []
    if (!auditOn) riskBadges.push('<span class="tag">安全审计已关闭</span>')
    if (r.fork) riskBadges.push('<span class="tag warn">fork 分叉</span>')
    if (r.archived) riskBadges.push('<span class="tag danger">已归档</span>')
    if (!r.forks_count && !r.stargazers_count) riskBadges.push('<span class="tag">新仓库</span>')
    const riskHtml = riskBadges.length ? riskBadges.join(' ') : '<span class="tag good">官方/活跃</span>'
    // Mirror-accelerated clone command when the global toggle is on.
    const repo = r.html_url.replace('https://github.com/', '')
    const mirror = pluginCloneUrl(repo, { mirrorAcceleration: !cfg ? true : cfg.mirrorAcceleration !== false })
    return `<div class="card">
      <div class="head">
        <a href="${r.html_url}" target="_blank" rel="noopener">${r.full_name}</a>
        ${riskHtml}
      </div>
      <div class="desc">${(r.description || '暂无描述').slice(0, 90)}</div>
      <div class="meta">
        <span>⭐ ${r.stargazers_count}</span>
        <span>⑂ ${r.forks_count}</span>
        <span class="updated">更新 ${(r.updated_at || '').slice(0, 10)}</span>
      </div>
      <div class="cmd">
        <code>git clone ${mirror}</code>
        <button class="copy" data-cmd="git clone ${mirror}">复制</button>
      </div>
    </div>`
  }
  const rows = Array.isArray(list) && list.length
    ? list.map(card).join('')
    : '<div class="empty">未获取到插件列表（请检查网络）</div>'
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
    body{margin:0;padding:14px 18px;background:#0f1115;color:#e6e6e6;font:13px/1.6 "Microsoft YaHei",system-ui,sans-serif}
    h1{font-size:15px;margin:0 0 10px;color:#4d9fff}
    .hint{color:#5b6270;font-size:12px;margin-bottom:10px}
    .card{border:1px solid #1c2027;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#12151b}
    .card a{color:#4d9fff;font-weight:600;text-decoration:none}
    .desc{color:#9aa2b1;margin-top:4px}
    .meta{display:flex;gap:14px;color:#7a8394;font-size:12px;margin-top:6px}
    .updated{margin-left:auto}
    .tag{font-size:11px;padding:1px 6px;border-radius:9px;margin-left:6px}
    .tag.good{background:#12341f;color:#4ade80}
    .tag.warn{background:#3a2d12;color:#fbbf24}
    .tag.danger{background:#3a1414;color:#f87171}
    .tag{background:#232a35;color:#b6bfcc}
    .empty{color:#7a8394;text-align:center;padding:30px 0}
    .err{color:#f87171;margin-top:8px}
    .cmd{display:flex;gap:8px;align-items:center;margin-top:8px}
    code{background:#0b0e12;border:1px solid #232a35;border-radius:5px;padding:3px 8px;font-size:11px;color:#9aa2b1;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    button.copy{background:#1d4ed8;border:none;color:#fff;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:12px}
    button.copy:active{background:#1e40af}
  </style></head><body>
    <h1>DeepSeek Harness 插件中心</h1>
    <div class="hint">浏览 GitHub #dsh-plugin 主题插件 · 加速访问 · 安全风险提示。下载/镜像脚本见说明。</div>
    ${rows}
    <div id="err"></div>
    <script>
      document.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('copy')) {
          const cmd = e.target.getAttribute('data-cmd')
          if (cmd) { navigator.clipboard.writeText(cmd); e.target.textContent = '已复制' }
        }
      })
    </script>
  </body></html>`
}

async function openPluginCenter() {
  const toolsCfg = readToolsConfig()
  let repos = []
  // Fetch the GitHub topic via the public mirror first, then official fallback.
  const fetchList = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error('http ' + res.status)
    const data = await res.json()
    return data.items || []
  }
  try {
    const url = 'https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=stars&per_page=20'
    repos = await fetchList(url)
  } catch {
    try {
      const mirrorUrl = 'https://ghfast.top/https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=stars&per_page=20'
      repos = await fetchList(mirrorUrl)
    } catch (e) {
      // surface as empty list; panel says check network
    }
  }

  const panel = new BrowserWindow({
    width: 760, height: 640, title: 'DeepSeek Harness 插件中心',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  panel.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pluginCenterHtml(repos, toolsCfg)))
}

// Take a full-screen screenshot, save it to Pictures and copy to clipboard.
// The saved image can be referenced in a conversation (read_image tool) and
// understood by a vision-capable model (e.g. a pi-ai vision model).
async function takeScreenshot(win) {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })
    if (sources.length === 0) return
    const image = sources[0].thumbnail
    const dir = path.join(app.getPath('pictures'), 'DeepSeek Harness')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`)
    fs.writeFileSync(file, image.toPNG())
    clipboard.writeImage(image)
    await dialog.showMessageBox(win, {
      type: 'info',
      message: '截图已保存',
      detail: `${file}\n\n已复制到剪贴板。在对话中可通过图片/附件引用它，由视觉模型识别内容。`,
      buttons: ['打开目录', '好的'],
    }).then(({ response }) => {
      if (response === 0) shell.openPath(dir)
    })
  } catch (e) {
    console.error('screenshot failed:', e)
  }
}

// OTA update check: compare against the GitHub Release latest.json in the
// background (never blocks startup); prompt when a newer version exists.
const RELEASES_URL = 'https://github.com/jianbaobao/deepseek-harness/releases/latest'
const LATEST_JSON_URL = `${RELEASES_URL}/download/latest.json`

async function checkForUpdates(win, manual = false) {
  try {
    const res = await fetch(LATEST_JSON_URL)
    if (!res.ok) { if (manual) await dialog.showMessageBox(win, { type: 'info', message: '检查更新失败', detail: `HTTP ${res.status}，请检查网络。` }); return }
    const latest = await res.json()
    const current = app.getVersion()
    const hasUpdate = typeof latest.version === 'string' && latest.version !== current
    if (!hasUpdate) {
      if (manual) await dialog.showMessageBox(win, { type: 'info', title: '已是最新版本', message: '当前已是最新版本', detail: `当前版本：${current}` })
      return
    }
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${latest.version}`,
      detail: `当前版本：${current}\n是否前往下载页？`,
      buttons: ['去下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) shell.openExternal(RELEASES_URL)
  } catch { if (manual) await dialog.showMessageBox(win, { type: 'info', title: '检查更新失败', message: '无法连接 GitHub，请稍后重试。' }) /* background: stay silent */ }
}

// Build the application menu, including a "工具" menu that exposes the stats
// panel, plugin center and the global mirror/audit toggles (persisted).
function buildToolsMenu(win) {
  const menu = Menu.buildFromTemplate([
    { role: 'fileMenu', label: '文件' },
    {
      label: '工具',
      submenu: [
        { label: '检查更新 (OTA 升级)', click: () => void checkForUpdates(win, true) },
        { type: 'separator' },
        { label: '统计面板 (会话/余额/命中率/费用/速度)', click: () => void openStatsPanel() },
        { type: 'separator' },
        { label: '插件中心 (浏览/镜像/审计)', click: () => void openPluginCenter() },
        { type: 'separator' },
        {
          label: '镜像加速', type: 'checkbox', checked: readToolsConfig().mirrorAcceleration,
          click: (item) => { const c = readToolsConfig(); c.mirrorAcceleration = item.checked; writeToolsConfig(c) },
        },
        {
          label: '安全审计 (插件 OSV 漏洞检查)', type: 'checkbox', checked: readToolsConfig().securityAudit,
          click: (item) => { const c = readToolsConfig(); c.securityAudit = item.checked; writeToolsConfig(c) },
        },
      ],
    },
    { role: 'editMenu', label: '编辑' },
    { role: 'viewMenu', label: '视图' },
    { role: 'windowMenu', label: '窗口' },
  ])
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(async () => {
  // Open the window immediately with a loading page so the app feels fast;
  // the dsh web server boots in the background and we switch over when ready.
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'DeepSeek Harness',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  buildToolsMenu(win)
  win.loadFile(path.join(__dirname, 'loading.html'))
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('closed', () => {
    app.isQuitting = true
    killDsh()
  })

  const dir = bundleDir()
  try {
    if (!bundleReady(dir)) extractBundle(dir)
  } catch (e) {
    if (SMOKE) { console.error('EXTRACT FAILED:', e.stack || e.message); app.exit(1); return }
    dialog.showErrorBox('DeepSeek Harness', `无法准备 dsh 运行时: ${e.message}`)
    app.exit(1)
    return
  }
  if (!bundleReady(dir)) {
    dialog.showErrorBox('DeepSeek Harness', 'dsh 运行时解压后仍不完整，请重新安装。')
    app.exit(1)
    return
  }

  startDsh(dir)
  try {
    await waitForServer(60000)
  } catch (e) {
    if (SMOKE) { console.error('SERVER FAILED:', e.stack || e.message); app.exit(1); return }
    dialog.showErrorBox('DeepSeek Harness', String(e.message || e))
    app.exit(1)
    return
  }

  if (SMOKE) {
    console.log(`SMOKE OK: dsh web served at http://127.0.0.1:${PORT}`)
    app.exit(0)
    return
  }

  win.loadURL(`http://127.0.0.1:${PORT}`)

  // Ctrl+Shift+S: full-screen screenshot; Ctrl+Shift+D: stats panel
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || !input.shift) return
    const key = input.key.toLowerCase()
    if (key === 's') {
      event.preventDefault()
      void takeScreenshot(win)
    } else if (key === 'd') {
      event.preventDefault()
      void openStatsPanel()
    } else if (key === 'p') {
      event.preventDefault()
      void openPluginCenter()
    }
  })

  // Background update check (after the window is visible; never blocks boot)
  setTimeout(() => { void checkForUpdates(win) }, 4000)
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  app.isQuitting = true
  killDsh()
})
