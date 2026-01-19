/* service-worker.js */

// Persistenter Zähler (wird beim SW-Start auf 0 gesetzt)
let unreadCount = 0;

// Push empfangen
self.addEventListener("push", event => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } 
    catch(err) { data = { body: event.data.text() }; }
  }

  unreadCount++;

  const options = {
    body: data.body || "Neue Nachricht",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: "new-message",
    data: { url: "/" }
  };

  event.waitUntil(
    (async () => {
      // Notification anzeigen
      await self.registration.showNotification(data.title || "Combow Messenger", options);

      // Chrome/Android Badge setzen
      if ('setAppBadge' in navigator) {
        navigator.setAppBadge(unreadCount).catch(()=>{});
      }
    })()
  );
});

// Klick auf Notification
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      // Zähler zurücksetzen
      unreadCount = 0;
      if ('clearAppBadge' in navigator) { navigator.clearAppBadge().catch(()=>{}); }

      const clientList = await clients.matchAll({ type:"window", includeUncontrolled:true });
      if (clientList.length > 0) { clientList[0].focus(); } 
      else { clients.openWindow("/"); }
    })()
  );
});

// SW installieren und aktivieren
self.addEventListener("install", event => { self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
