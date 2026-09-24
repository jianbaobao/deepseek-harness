// 一键发布脚本：创建仓库、推送代码、发布安装包到 GitHub Releases
// 用法：
//   GITHUB_TOKEN=ghp_xxx node scripts/publish.mjs v1.0.0
// 说明：需要具有 repo 权限的 GitHub Personal Access Token（https://github.com/settings/tokens）
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) { console.error('请先设置 GITHUB_TOKEN 环境变量（GitHub PAT，需 repo 权限）'); process.exit(1); }
const version = process.argv[2] || 'v1.0.0';
const owner = process.env.GITHUB_REPO_OWNER || 'jianbaobao';
const repo = process.env.GITHUB_REPO_NAME || 'deepseek-harness-desktop';
const api = 'https://api.github.com';

async function apiCall(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'dsh-publish', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(method + ' ' + url.split('/api.github.com')[1] + ' -> ' + res.status + ' ' + t.slice(0, 300));
  }
  return res.status === 204 ? null : res.json();
}

console.log('==> 1/4 检查/创建仓库 ' + owner + '/' + repo);
try { await apiCall('GET', api + '/repos/' + owner + '/' + repo); console.log('    仓库已存在'); }
catch (e) {
  await apiCall('POST', api + '/user/repos', { name: repo, description: 'DeepSeek Harness Desktop 中文桌面客户端：项目/会话/MCP/Skill/插件/设置', private: false });
  console.log('    仓库已创建');
}

console.log('==> 2/4 推送代码');
try { execSync('git remote remove origin', { stdio: 'ignore' }); } catch (e) { /* 忽略 */ }
execSync('git remote add origin https://x-access-token:' + token + '@github.com/' + owner + '/' + repo + '.git');
try {
  execSync('git -c credential.helper= push -u origin master', { stdio: 'inherit' });
} catch (e) {
  console.error('    推送失败（可能无新提交）：', e.message.split('\n')[0]);
}
execSync('git remote remove origin', { stdio: 'ignore' });
execSync('git remote add origin https://github.com/' + owner + '/' + repo + '.git');

console.log('==> 3/4 创建 Release ' + version);
let notes = '';
try { notes = fs.readFileSync(path.resolve('RELEASE_NOTES.md'), 'utf8'); } catch (e) { notes = 'DeepSeek Harness Desktop ' + version + ' 发布。'; }
let rel;
try { rel = await apiCall('POST', api + '/repos/' + owner + '/' + repo + '/releases', { tag_name: version, name: 'DeepSeek Harness Desktop ' + version, body: notes, draft: false, prerelease: false }); }
catch (e) {
  // 可能已存在，尝试取现有 release 并删除后重建
  console.log('    创建失败，尝试复用：' + e.message.split('\n')[0]);
  const existing = await apiCall('GET', api + '/repos/' + owner + '/' + repo + '/releases/tags/' + version);
  await apiCall('DELETE', api + '/repos/' + owner + '/' + repo + '/releases/' + existing.id);
  rel = await apiCall('POST', api + '/repos/' + owner + '/' + repo + '/releases', { tag_name: version, name: 'DeepSeek Harness Desktop ' + version, body: notes, draft: false, prerelease: false });
}
const uploadUrl = rel.upload_url.replace('{?name,label}', '');
console.log('==> 4/4 上传安装包与技能包');
const assets = [];
for (const dir of ['dist', 'release']) {
  if (!fs.existsSync(dir)) continue;
  for (const n of fs.readdirSync(dir)) {
    const ext = path.extname(n).toLowerCase();
    if (['.exe', '.msi', '.dmg', '.appimage', '.deb', '.zip', '.rpm'].includes(ext)) {
      assets.push(path.join(dir, n));
    }
  }
}
for (const f of assets) {
  const buf = fs.readFileSync(f);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), path.basename(f));
  const res = await fetch(uploadUrl + '?name=' + encodeURIComponent(path.basename(f)), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'dsh-publish', Accept: 'application/vnd.github+json' },
    body: fd
  });
  if (!res.ok) console.log('    上传失败：' + path.basename(f) + ' ' + res.status);
  else console.log('    已上传：' + path.basename(f) + ' (' + (buf.length / 1048576).toFixed(1) + ' MB)');
}
console.log('发布完成：https://github.com/' + owner + '/' + repo + '/releases/tag/' + version);
