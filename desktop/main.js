// DeepSeek Harness Desktop — Reasonix-style desktop shell.
// Bundles dsh (web profile) as a compressed tarball; on first launch it is
// extracted to the per-user data dir, then the bundled Node runtime boots the
// dsh web server and a BrowserWindow opens on it. Closing the window shuts
// the dsh process down.
//
// Smoke test:  DSH_DESKTOP_SMOKE=1 electron .   (loads, prints, exits)
'use strict'

const { app, BrowserWindow, clipboard, desktopCapturer, dialog, shell } = require('electron')
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

async function checkForUpdates(win) {
  try {
    const res = await fetch(LATEST_JSON_URL)
    if (!res.ok) return
    const latest = await res.json()
    if (typeof latest.version !== 'string' || latest.version === app.getVersion()) return
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${latest.version}`,
      detail: `当前版本：${app.getVersion()}\n是否前往下载页？`,
      buttons: ['去下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) shell.openExternal(RELEASES_URL)
  } catch { /* offline or transient failure: stay silent */ }
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
