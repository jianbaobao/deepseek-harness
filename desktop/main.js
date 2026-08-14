// DeepSeek Harness Desktop — Reasonix-style desktop shell.
// Bundles dsh (web profile) as a compressed tarball; on first launch it is
// extracted to the per-user data dir, then the bundled Node runtime boots the
// dsh web server and a BrowserWindow opens on it. Closing the window shuts
// the dsh process down.
//
// Smoke test:  DSH_DESKTOP_SMOKE=1 electron .   (loads, prints, exits)
'use strict'

const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn, execFileSync } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')

const PORT = 3080
const SMOKE = process.env.DSH_DESKTOP_SMOKE === '1'

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
  dshProcess = spawn(node, [bin, '--profile', 'web', '--port', String(PORT)], {
    cwd: dir,
    stdio: 'inherit',
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
  if (dshProcess && !dshProcess.killed) {
    try { dshProcess.kill() } catch { /* ignore */ }
  }
}

app.whenReady().then(async () => {
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

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'DeepSeek Harness',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(`http://127.0.0.1:${PORT}`)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('closed', () => {
    app.isQuitting = true
    killDsh()
  })
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  app.isQuitting = true
  killDsh()
})
