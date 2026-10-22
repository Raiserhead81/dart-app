// Kleine DOM-Helfer
export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function icon(id, cls = 'ic') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', cls);
  s.innerHTML = `<use href="#${id}"></use>`;
  return s;
}

export const fmt = (x, digits) => {
  if (x == null || Number.isNaN(x)) return '-';
  const n = typeof x === 'number' ? x : parseFloat(x);
  const s = digits != null ? n.toFixed(digits) : String(n);
  return s.replace('.', ',');
};

export const pct = (x) => (x == null ? '-' : x + '%');

export function toast(msg, ms = 2600) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', style: 'position:fixed;left:50%;bottom:calc(var(--nav-h) + 18px);transform:translateX(-50%);background:#0d3320;color:#e8dfc8;border:1px solid #2f4034;padding:11px 18px;border-radius:12px;font-weight:700;z-index:90;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.style.display = 'none'; }, ms);
}

export function download(name, text, mime = 'application/json') {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: mime })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function todayISO() { return new Date().toISOString(); }

export function uid() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
