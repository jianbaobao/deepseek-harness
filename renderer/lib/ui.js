// UI 工具函数
export function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v);
    }
  }
  if (children !== undefined && children !== null) {
    if (Array.isArray(children)) children.forEach((c) => { if (typeof c === 'string') el.appendChild(document.createTextNode(c)); else if (c) el.appendChild(c); });
    else if (typeof children === 'string') el.textContent = children;
    else el.appendChild(children);
  }
  return el;
}

export function toast(msg, type) {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: 'toast ' + (type || ''), text: msg });
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2200);
  setTimeout(() => el.remove(), 2600);
}

export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function modal({ title, body, actions, width }) {
  const mask = h('div', { class: 'modal-mask' });
  const box = h('div', { class: 'modal' });
  if (width) box.style.width = width;
  const head = h('div', { class: 'modal-head' }, [h('span', { text: title })]);
  const close = h('button', { class: 'close', html: '&#10005;', title: '关闭' });
  close.addEventListener('click', () => mask.remove());
  head.appendChild(close);
  const bodyEl = h('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  box.appendChild(head);
  box.appendChild(bodyEl);
  if (actions && actions.length) {
    const foot = h('div', { class: 'modal-foot' });
    for (const a of actions) foot.appendChild(a);
    box.appendChild(foot);
  }
  mask.appendChild(box);
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.remove(); });
  document.body.appendChild(mask);
  return mask;
}

export function confirmDialog(title, text, onYes) {
  const yes = h('button', { class: 'btn danger', text: '确认' });
  const no = h('button', { class: 'btn', text: '取消' });
  const body = h('div', { text });
  const mask = modal({ title, body, actions: [no, yes], width: '420px' });
  yes.addEventListener('click', () => { mask.remove(); onYes(); });
  no.addEventListener('click', () => mask.remove());
}

export function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板', 'ok')).catch(() => toast('复制失败', 'err'));
}

// 给渲染出的 pre 代码块附加复制按钮
export function attachCopyButtons(scope) {
  const pres = scope.querySelectorAll('pre > code');
  pres.forEach((code) => {
    const pre = code.parentElement;
    if (pre.querySelector('.copy-btn')) return;
    const btn = h('button', { class: 'copy-btn', text: '复制' });
    btn.addEventListener('click', () => copyText(code.textContent));
    pre.appendChild(btn);
  });
}
