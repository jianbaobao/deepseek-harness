// Assemble a portable dsh install directory from locally packed tarballs.
//
// Why this shape: dsh is a Node ESM CLI with heavy runtime dynamic import()
// and native addons, so it cannot be compiled to a single executable. The
// portable build is the next best thing to a Reasonix-style install artifact:
// a self-contained node_modules (no symlinks, unlike the pnpm workspace) with
// every @deepseek-ai/* package pinned to the fork's own tarballs — registry
// versions may be newer and must not leak in.
//
// Usage: node scripts/package-portable.mjs [repo-root] [output-dir] [--node-dir <dir>]
//   repo-root  default: repository root (derived from this file's location)
//   output-dir default: <repo-root>/dist/portable
//   --node-dir <dir>  optional: a prepared Node.js runtime directory that is
//                     copied to <output-dir>/node/ so the launchers run against
//                     the bundled runtime instead of requiring a system Node.
//                     Windows layout: node.exe at the runtime root; Unix
//                     layout: bin/node (matching official node distributions).
// Requires: dist/tgz/*.tgz (see scripts/pack-all-tgz.sh), npm >= 9.
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const repoRoot = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
const tgzDir = join(repoRoot, 'dist', 'tgz')
const outDir = resolve(process.argv[3] ?? join(repoRoot, 'dist', 'portable'))
const nodeFlagIndex = process.argv.indexOf('--node-dir')
const nodeDir = nodeFlagIndex >= 0 ? process.argv[nodeFlagIndex + 1] : undefined

if (!existsSync(tgzDir) || readdirSync(tgzDir).length === 0) {
  console.error(`no tarballs in ${tgzDir}; run scripts/pack-all-tgz.sh first`)
  process.exit(1)
}

// Read name+version from each tarball (pnpm pack stores package/package.json).
function tgzMeta(file) {
  const out = execSync(`tar -xOf "${file}" package/package.json`, {
    cwd: tgzDir, encoding: 'utf8',
  }).trim()
  const pkg = JSON.parse(out)
  return { name: pkg.name, version: pkg.version }
}

const tarballs = readdirSync(tgzDir).filter(f => f.endsWith('.tgz')).sort()
const metas = new Map()
for (const f of tarballs) {
  try {
    const m = tgzMeta(f)
    metas.set(m.name, { file: f, version: m.version })
  } catch (e) {
    console.warn(`skip meta for ${f}: ${e.message}`)
  }
}
console.log(`mapped ${metas.size} packages from ${tarballs.length} tarballs`)

const entry = metas.has('@deepseek-ai/dsh') ? '@deepseek-ai/dsh' : [...metas.keys()].find(n => n.endsWith('/dsh'))
if (!entry) throw new Error('entry @deepseek-ai/dsh not found in tarballs')
const entryVersion = metas.get(entry).version

// file: specs must be relative to the install directory (npm's cwd).
const relTgz = (name) => `file:${relative(outDir, join(tgzDir, metas.get(name).file)).replace(/\\/g, '/')}`
const dependencies = {}
for (const name of metas.keys()) dependencies[name] = relTgz(name)

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'package.json'), JSON.stringify({
  name: 'dsh-portable',
  version: entryVersion,
  type: 'module',
  private: true,
  dependencies,
}, null, 2))

console.log(`npm install ${metas.size} local tarballs into ${outDir} ...`)
execSync('npm install --omit=dev --no-audit --no-fund --loglevel=error', { cwd: outDir, stdio: 'inherit' })

// Verify every local package resolved to the local tarball version.
const nm = join(outDir, 'node_modules')
let mismatch = 0
for (const [name, meta] of metas) {
  const p = join(nm, ...name.split('/'), 'package.json')
  if (!existsSync(p)) { console.warn(`NOT INSTALLED: ${name}`); continue }
  const installed = JSON.parse(readFileSync(p, 'utf8')).version
  if (installed !== meta.version) {
    console.warn(`VERSION MISMATCH ${name}: local ${meta.version} vs installed ${installed}`)
    mismatch++
  }
}
if (mismatch > 0) {
  console.error(`${mismatch} package(s) resolved to non-local versions; aborting`)
  process.exit(1)
}
console.log(`all ${metas.size} packages at local versions`)

// Entry bin stays inside node_modules/@deepseek-ai/dsh/lib/bin.js (its
// ../package.json version lookup depends on that layout); launchers reference
// it there.
const binSrc = join(nm, ...entry.split('/'), 'lib', 'bin.js')
if (!existsSync(binSrc)) throw new Error('entry bin missing: ' + binSrc)

const relEntryBin = relative(outDir, binSrc).replace(/\\/g, '/')
const bundledNode = nodeDir !== undefined && existsSync(nodeDir)

// Launchers prefer the bundled runtime (node/ in the install directory) and
// fall back to a system node when no runtime was bundled.
writeFileSync(join(outDir, 'dsh.cmd'),
  `@echo off\r\n` +
  `setlocal\r\n` +
  `set "DSH_NODE=%~dp0node\\node.exe"\r\n` +
  `if exist "%DSH_NODE%" (\r\n` +
  `  "%DSH_NODE%" "%~dp0${relEntryBin}" %*\r\n` +
  `) else (\r\n` +
  `  node "%~dp0${relEntryBin}" %*\r\n` +
  `)\r\n`)
writeFileSync(join(outDir, 'dsh'),
  `#!/usr/bin/env sh\n` +
  `DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\n` +
  `if [ -x "$DIR/node/bin/node" ]; then\n` +
  `  exec "$DIR/node/bin/node" "$DIR/${relEntryBin}" "$@"\n` +
  `fi\n` +
  `exec node "$DIR/${relEntryBin}" "$@"\n`)

if (bundledNode) {
  cpSync(nodeDir, join(outDir, 'node'), { recursive: true })
  console.log('bundled Node runtime from ' + nodeDir + ' into ' + join(outDir, 'node'))
}

writeFileSync(join(outDir, 'README.txt'),
  `DeepSeek Harness portable build (${entry}@${entryVersion})\r\n` +
  `\r\n` +
  (bundledNode
    ? `Includes a bundled Node.js runtime — no system Node required.\r\n`
    : `Requires Node.js >= 22.19 on PATH.\r\n`) +
  `Run dsh.cmd (Windows) or ./dsh (Unix). The dsh web/headless profiles auto-initialize on first use.\r\n`)
console.log('portable assembly done at ' + outDir)
