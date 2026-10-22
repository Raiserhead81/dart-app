// Manueller Update-Check (Button in den Einstellungen).
export async function startManualUpdateCheck() {
  const { default: toast } = { default: (m) => alert(m) };
  try {
    const res = await fetch('/VERSION', { cache: 'no-store' });
    const v = (await res.text()).trim();
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) {
      await reg.update().catch(() => {});
      if (reg.waiting) {
        if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
        reg.waiting.postMessage('SKIP_WAITING');
        location.reload();
        return;
      }
    }
    toast('Alles aktuell (Version ' + v + ')');
  } catch (e) {
    toast('Update-Check fehlgeschlagen');
  }
}
