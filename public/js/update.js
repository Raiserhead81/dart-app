// PWA-Auto-Update: /VERSION pollen, bei Aenderung alle Caches leeren + SW-Update + reload.

export function startUpdateWatcher(intervalMs = 60000) {
  let known = null;
  async function check(manual = false) {
    try {
      const res = await fetch('/VERSION', { cache: 'no-store' });
      const v = (await res.text()).trim();
      if (known == null) { known = v; return; }
      if (v !== known) {
        known = v;
        await applyUpdate();
      }
    } catch (e) { /* offline: still */ }
  }
  async function applyUpdate() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.update().catch(() => {});
          reg.waiting && reg.waiting.postMessage('SKIP_WAITING');
        }
      }
    } catch (e) { /* egal */ }
    location.reload();
  }
  setInterval(check, intervalMs);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  check();
}
