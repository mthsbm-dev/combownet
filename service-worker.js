/* service-worker.js */

// Persistenter Zähler
let unreadCount = 0;

// Helper: Badge persistent speichern
function saveUnreadCount(count) {
  try {
    const db = indexedDB.open('combow-messenger');
    db.onsuccess = () => {
      const store = db.result.transaction(['badge'], 'readwrite').objectStore('badge');
      store.put({ id: 'unread', count: count }, 'unread');
    };
    db.onerror = () => {
      // Fallback auf localStorage wenn IndexedDB fehlschlägt
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'setUnreadCount', count: count });
        });
      });
    };
  } catch (e) {
    console.log('IndexedDB nicht verfügbar');
  }
}

// Helper: Badge abrufen
async function loadUnreadCount() {
  return new Promise((resolve) => {
    try {
      const db = indexedDB.open('combow-messenger');
      db.onsuccess = () => {
        const store = db.result.transaction(['badge'], 'readonly').objectStore('badge');
        const req = store.get('unread');
        req.onsuccess = () => {
          resolve(req.result ? req.result.count : 0);
        };
      };
      db.onerror = () => resolve(0);
    } catch (e) {
      resolve(0);
    }
  });
}

// IndexedDB initialisieren
self.addEventListener('install', event => {
  event.waitUntil(
    new Promise((resolve) => {
      const db = indexedDB.open('combow-messenger');
      db.onupgradeneeded = () => {
        if (!db.result.objectStoreNames.contains('badge')) {
          db.result.createObjectStore('badge');
        }
      };
      db.onsuccess = () => resolve();
    })
  );
  self.skipWaiting();
});

// Push empfangen
self.addEventListener("push", event => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } 
    catch(err) { data = { body: event.data.text() }; }
  }

  event.waitUntil(
    (async () => {
      unreadCount = await loadUnreadCount();
      unreadCount++;
      saveUnreadCount(unreadCount);

      const options = {
        body: data.body || "Neue Nachricht",
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: "new-message",
        data: { url: "/", unreadCount: unreadCount }
      };

      // Notification anzeigen
      await self.registration.showNotification(data.title || "Combow Messenger", options);

      // Badge setzen (Chrome/Android/iOS)
      if ('setAppBadge' in self) {
        self.setAppBadge(unreadCount).catch(()=>{});
      }
    })()
  );
});

// Klick auf Notification
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      // Zähler zurücksetzen und speichern
      unreadCount = 0;
      saveUnreadCount(0);
      
      if ('setAppBadge' in self) { self.setAppBadge(0).catch(()=>{}); }
      if ('clearAppBadge' in self) { self.clearAppBadge().catch(()=>{}); }

      const clientList = await clients.matchAll({ type:"window", includeUncontrolled:true });
      if (clientList.length > 0) { clientList[0].focus(); } 
      else { clients.openWindow("/"); }
    })()
  );
});

// SW aktivieren
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });

// Nachrichten von der App empfangen
self.addEventListener('message', event => {
  if (event.data.type === 'setBadge') {
    unreadCount = event.data.count;
    saveUnreadCount(unreadCount);
    if ('setAppBadge' in self) {
      if (unreadCount > 0) {
        self.setAppBadge(unreadCount).catch(()=>{});
      } else {
        self.clearAppBadge?.().catch(()=>{});
      }
    }
  } else if (event.data.type === 'clearBadge') {
    unreadCount = 0;
    saveUnreadCount(0);
    if ('clearAppBadge' in self) { self.clearAppBadge().catch(()=>{}); }
    if ('setAppBadge' in self) { self.setAppBadge(0).catch(()=>{}); }
  }
});
