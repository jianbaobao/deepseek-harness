// 轻量安全的 Markdown 渲染器（先转义再转换，仅支持常见语法）
const BCK = String.fromCharCode(96);

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const INLINE_CODE_RE = new RegExp(BCK + '([^' + BCK + '\\n]+)' + BCK, 'g');

function inline(text) {
  let t = esc(text);
  t = t.replace(INLINE_CODE_RE, (m, c) => '<code>' + c + '</code>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, url) => '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return t;
}

const FENCE_RE = new RegExp('^\\s*' + BCK + BCK + BCK + '([\\w+-]*)\\s*$');

export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeLang = '';
  let codeBuf = [];
  let listType = null;
  let tableBuf = null;

  const flushList = () => {
    if (listType) { out.push('</' + listType + '>'); listType = null; }
  };
  const flushTable = () => {
    if (tableBuf) {
      out.push('<table><thead><tr>' + tableBuf.head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>');
      for (const row of tableBuf.rows) out.push('<tr>' + row.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      out.push('</tbody></table>');
      tableBuf = null;
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const codeMatch = FENCE_RE.exec(line);
    if (codeMatch) {
      if (!inCode) {
        flushList(); flushTable();
        inCode = true;
        codeLang = codeMatch[1];
        codeBuf = [];
      } else {
        inCode = false;
        out.push('<pre><code class="lang-' + esc(codeLang || 'text') + '">' + esc(codeBuf.join('\n')) + '</code></pre>');
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    if (/^\s*\|/.test(line)) {
      flushList();
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (!tableBuf) {
        tableBuf = { head: cells, rows: [] };
      } else if (/^[\s:|-]+$/.test(line.replace(/\|/g, ''))) {
        // 分隔行，忽略
      } else {
        tableBuf.rows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      const lvl = h[1].length;
      out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
      continue;
    }
    const bq = /^\s*>\s?(.*)$/.exec(line);
    if (bq) {
      flushList();
      out.push('<blockquote>' + inline(bq[1]) + '</blockquote>');
      continue;
    }
    const hr = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.exec(line);
    if (hr) {
      flushList();
      out.push('<hr>');
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== 'ul') { flushList(); out.push('<ul>'); listType = 'ul'; }
      out.push('<li>' + inline(ul[1]) + '</li>');
      continue;
    }
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== 'ol') { flushList(); out.push('<ol>'); listType = 'ol'; }
      out.push('<li>' + inline(ol[2]) + '</li>');
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    out.push('<p>' + inline(line) + '</p>');
  }
  if (inCode) out.push('<pre><code class="lang-' + esc(codeLang || 'text') + '">' + esc(codeBuf.join('\n')) + '</code></pre>');
  flushList();
  flushTable();
  return out.join('\n');
}
