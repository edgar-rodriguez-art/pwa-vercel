// public/sw.js
const CACHE_NAME = 'pwa-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
  // Agrega otros recursos (CSS, imágenes, etc.) si los tienes
];

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Función para abrir IndexedDB en el SW
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pwa-db', 1);
    request.onerror = () => reject('Error al abrir IndexedDB en SW');
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingData')) {
        db.createObjectStore('pendingData', { autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
  });
}

// Función para sincronizar los datos offline en el SW
async function syncData() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingData', 'readwrite');
    const store = tx.objectStore('pendingData');
    const getAll = store.getAll();
    getAll.onsuccess = async () => {
      const offlineData = getAll.result;
      if (offlineData.length) {
        for (const text of offlineData) {
          try {
            await fetch('/api/save', { 
              method: 'POST',
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text })
            });
          } catch (err) {
            console.error('Error durante la sincronización en SW:', err);
          }
        }
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          console.log('Datos offline sincronizados y limpiados.');
          // Muestra una notificación push indicando la sincronización exitosa
          self.registration.showNotification('Sincronización completada', {
            body: 'Tus datos se han actualizado en línea en MongoDB.',
            icon: '/icons/icon-192x192.png'  // (Opcional) Icono para la notificación
          });
          resolve();
        };
        clearRequest.onerror = () => reject('Error al limpiar datos offline en SW');
      } else {
        resolve();
      }
    };
    getAll.onerror = () => reject('Error al obtener datos offline en SW');
  });
}

// Escucha el evento de Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'syncData') {
    event.waitUntil(syncData());
  }
});
