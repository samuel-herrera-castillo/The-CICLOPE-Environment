/* A.R.I.A — Service Worker opcional
   Habilita el modo OFFLINE COMPLETO de los mapas.
   Subir este archivo junto a index.html (mismo directorio). Es opcional:
   sin él la app funciona igual, pero los mapas solo quedan cacheados
   por la caché normal del navegador. */

var TILE_CACHE = 'aria_map_tiles_v1';
var APP_CACHE  = 'aria_app_v1';

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e){
  var url = e.request.url;

  // Tiles de OpenStreetMap → cache-first (disponibles sin conexión)
  if (url.indexOf('tile.openstreetmap.org') > -1) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(cache){
        return cache.match(e.request).then(function(hit){
          if (hit) return hit;
          return fetch(e.request).then(function(res){
            try { cache.put(e.request, res.clone()); } catch(err){}
            return res;
          }).catch(function(){ return hit; });
        });
      })
    );
    return;
  }

  // La propia app (mismo origen) → cache-first para que abra sin conexión
  if (e.request.method === 'GET' && url.indexOf(self.location.origin) === 0) {
    e.respondWith(
      caches.open(APP_CACHE).then(function(cache){
        return cache.match(e.request).then(function(hit){
          var net = fetch(e.request).then(function(res){
            try { cache.put(e.request, res.clone()); } catch(err){}
            return res;
          }).catch(function(){ return hit; });
          return hit || net;
        });
      })
    );
  }
});
