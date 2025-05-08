// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // Solicitar permiso de notificaciones si es necesario
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        console.log('Permiso de notificaciones:', permission);
      });
    }
  
    const statusDiv = document.getElementById('status');
    const form = document.getElementById('data-form');
    const dataInput = document.getElementById('data-input');
    const dataList = document.getElementById('data-list');
    const installBtn = document.getElementById('installBtn');
    let deferredPrompt; // para capturar el evento beforeinstallprompt
  
    // Actualiza el estado de conectividad
    function updateOnlineStatus() {
      if (navigator.onLine) {
        statusDiv.textContent = 'Conectado a Internet';
        statusDiv.style.backgroundColor = '#d4edda';
        statusDiv.style.color = '#155724';
        // Sincroniza datos pendientes al reconectar
        syncOfflineData();
      } else {
        statusDiv.textContent = 'Sin conexión a Internet';
        statusDiv.style.backgroundColor = '#f8d7da';
        statusDiv.style.color = '#721c24';
      }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  
    // Función para abrir IndexedDB
    function openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('pwa-db', 1);
        request.onerror = () => reject('Error al abrir IndexedDB');
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('pendingData')) {
            db.createObjectStore('pendingData', { autoIncrement: true });
          }
        };
        request.onsuccess = (event) => resolve(event.target.result);
      });
    }
  
    // Guarda datos en IndexedDB
    async function saveOfflineDataIndexedDB(text) {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('pendingData', 'readwrite');
        const store = tx.objectStore('pendingData');
        const request = store.add(text);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error al guardar los datos en IndexedDB');
      });
    }
  
    // Agrega un dato a la lista en pantalla
    function addDataToList(data) {
      const li = document.createElement('li');
      li.textContent = `${data.text} (${new Date(data.date).toLocaleString()})`;
      dataList.appendChild(li);
    }
  
    // Envía datos al servidor (endpoint en /api/save)
    async function sendData(text) {
      try {
        const response = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const result = await response.json();
        if (result.success) {
          addDataToList(result.data);
          return true;
        }
      } catch (error) {
        console.error('Error al enviar datos:', error);
        return false;
      }
    }
  
    async function syncOfflineData() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('pendingData', 'readwrite');
          const store = tx.objectStore('pendingData');
          const getAll = store.getAll();
      
          getAll.onsuccess = () => {
            const offlineData = getAll.result;
            if (offlineData.length > 0) {
              const promises = offlineData.map((text) => sendData(text));
              Promise.all(promises)
                .then(() => {
                  const clearTx = db.transaction('pendingData', 'readwrite');
                  const clearStore = clearTx.objectStore('pendingData');
                  const clearRequest = clearStore.clear();
                  clearRequest.onsuccess = () => {
                    console.log('Datos offline sincronizados y limpiados.');
                    resolve();
                  };
                  clearRequest.onerror = () => reject('Error al limpiar datos offline');
                })
                .catch(err => {
                  console.error('Error al enviar algunos datos offline:', err);
                  reject(err);
                });
            } else {
              resolve(); // No hay datos que sincronizar
            }
          };
      
          getAll.onerror = () => reject('Error al obtener datos offline');
        });
      }
      
  
    // Registra Background Sync en el Service Worker
    function registerBackgroundSync() {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.sync.register('syncData')
            .then(() => console.log('Background Sync registrado'))
            .catch(err => console.error('Error al registrar Background Sync', err));
        });
      }
    }
  
    // Maneja el envío del formulario
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = dataInput.value.trim();
      if (!text) return;
      if (navigator.onLine) {
        await sendData(text);
      } else {
        await saveOfflineDataIndexedDB(text);
        addDataToList({ text, date: Date.now() });
        registerBackgroundSync();
      }
      dataInput.value = '';
    });
  
    // Captura el evento beforeinstallprompt para la instalación de la app
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // Previene la instalación automática
      deferredPrompt = e;
      installBtn.style.display = 'block'; // Muestra el botón de instalación
    });
  
    // Manejador del botón de instalación personalizado
    installBtn.addEventListener('click', async () => {
      installBtn.style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`El usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación.`);
        deferredPrompt = null;
      }
    });
  });
  