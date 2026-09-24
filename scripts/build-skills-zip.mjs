// 将 resources/skills-bundle 打包为 release/skills-pack.zip
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { zipStore } = require('./zip-utils.cjs');

const srcDir = path.resolve('resources/skills-bundle');
const outFile = path.resolve('release/skills-pack.zip');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const entries = fs.readdirSync(srcDir)
  .filter((f) => f.endsWith('.md') || f.endsWith('.yaml'))
  .map((f) => ({ name: 'skills/' + f, data: fs.readFileSync(path.join(srcDir, f)) }));

fs.writeFileSync(outFile, zipStore(entries));
console.log('已生成 ' + outFile + ' （' + entries.length + ' 个技能）');
