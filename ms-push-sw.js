/* MathSpace Stage 26: push-only service worker; no fetch or offline interception. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = String(data.title || 'MathSpace').slice(0, 160);
  const body = String(data.body || 'Нове сповіщення').slice(0, 300);
  const url = new URL('./#/t/lessons', self.registration.scope).href;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: new URL('mathspace-192.png', self.registration.scope).href,
    badge: new URL('mathspace-192.png', self.registration.scope).href,
    tag: data.id ? 'ms-'+String(data.id) : undefined,
    data: { url }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const dest = event.notification.data?.url || new URL('./', self.registration.scope).href;
  event.waitUntil((async () => {
    const clientsFound = await clients.matchAll({type:'window',includeUncontrolled:true});
    const inScope = clientsFound.find(c => c.url.startsWith(self.registration.scope));
    if (inScope) { await inScope.navigate(dest); return inScope.focus(); }
    return clients.openWindow(dest);
  })());
});
