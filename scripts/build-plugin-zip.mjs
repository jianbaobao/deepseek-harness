// 将 examples/hello-plugin 打包为 release/example-plugin.zip
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { zipStore } = require('./zip-utils.cjs');

const srcDir = path.resolve('examples/hello-plugin');
const outFile = path.resolve('release/example-plugin.zip');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

function walk(dir, prefix) {
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const fp = path.join(dir, n);
    const rel = prefix + n;
    if (fs.statSync(fp).isDirectory()) out.push(...walk(fp, rel + '/'));
    else out.push({ name: 'plugins/' + rel, data: fs.readFileSync(fp) });
  }
  return out;
}
const entries = walk(srcDir, 'hello-plugin/');
fs.writeFileSync(outFile, zipStore(entries));
console.log('已生成 ' + outFile + ' （' + entries.length + ' 个文件）');
