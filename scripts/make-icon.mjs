// 生成应用图标（零依赖 + pngjs）
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const SIZE = 1024;
const R = 200; // 圆角半径

function makeCanvas(size) {
  const png = new PNG({ width: size, height: size });
  const scale = size / SIZE;
  const grad = (y) => {
    // 垂直渐变：顶部 #4D6BFE —— 底部 #7B4DFB（DeepSeek 蓝紫）
    const t = y / SIZE;
    const r = Math.round(77 + (123 - 77) * t);
    const g = Math.round(107 + (77 - 107) * t);
    const b = Math.round(254 + (251 - 254) * t);
    return [r, g, b];
  };
  const inRoundRect = (x, y) => {
    const rx = R * scale, ry = R * scale, w = size, h = size;
    const cx = Math.min(Math.max(x, rx), w - rx);
    const cy = Math.min(Math.max(y, ry), h - ry);
    const dx = x - cx, dy = y - cy;
    return dx * dx / (rx * rx) + dy * dy / (ry * ry) <= 1;
  };
  // "H" 字形参数（按 1024 设计，缩放）
  const t = scale;
  const bar = 128 * t;             // 竖杆宽
  const gap = 340 * t;             // 中间留空
  const top = 200 * t;
  const bottom = 824 * t;
  const midTop = 462 * t;
  const midBottom = 562 * t;
  const x1 = 210 * t, x2 = 614 * t;
  // 文字底部高光条
  const glowY = 862 * t, glowH = 14 * t, glowGap = 150 * t;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let idx = (size * y + x) << 2;
      if (!inRoundRect(x + 0.5, y + 0.5)) {
        png.data[idx + 3] = 0;
        continue;
      }
      const [r, g, b] = grad(y + 0.5);
      let cr = r, cg = g, cb = b;
      // H：左竖杆
      const leftBar = x >= x1 && x <= x1 + bar && y >= top && y <= bottom;
      // 右竖杆
      const rightBar = x >= x2 && x <= x2 + bar && y >= top && y <= bottom;
      // 横杆
      const midBar = y >= midTop && y <= midBottom && x >= x1 && x <= x2 + bar;
      // 高光条
      const glow = y >= glowY && y <= glowY + glowH && x >= glowGap && x <= SIZE * t - glowGap;
      if (leftBar || rightBar || midBar || glow) {
        const a = 0.94;
        cr = Math.round(255 * (1 - a) + r * a);
        cg = Math.round(255 * (1 - a) + g * a);
        cb = Math.round(255 * (1 - a) + b * a);
      }
      png.data[idx] = cr; png.data[idx + 1] = cg; png.data[idx + 2] = cb; png.data[idx + 3] = 255;
    }
  }
  return png;
}

function pngBuffer(size) {
  return PNG.sync.write(makeCanvas(size));
}

// ICO：PNG 条目（Vista+ 支持）
function makeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  const bodies = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    bodies.push(buf);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...bodies]);
}

const buildDir = path.resolve('build');
fs.mkdirSync(buildDir, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const pngs = sizes.map((s) => ({ size: s, buf: pngBuffer(s) }));
fs.writeFileSync(path.join(buildDir, 'icon.png'), pngs.find((p) => p.size === 1024).buf);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), makeIco(pngs));
console.log('已生成 build/icon.png (1024) 与 build/icon.ico (多尺寸)');
