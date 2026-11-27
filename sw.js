// sw.js - lets the game show real system notifications (Android Chrome needs a service worker for this)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    if(list.length) return list[0].focus();
    return self.clients.openWindow('./');
  }));
});
