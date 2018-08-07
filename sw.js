var staticCacheName = "mws-restaurant"

self.addEventListener('install', (event) => {
 event.waitUntil(
   caches.open(staticCacheName).then((cache) => {
     return cache.addAll([
       '/',
       '/index.html',
       '/restaurant.html',
       '/css/styles.css',
       '/js/dbhelper.js',
       '/js/main.js',
       '/js/restaurant_info.js',
       '/img/',
       '/img/1.jpg',
       '/img/2.jpg',
       '/img/3.jpg',
       '/img/4.jpg',
       '/img/5.jpg',
       '/img/6.jpg',
       '/img/7.jpg',
       '/img/8.jpg',
       '/img/9.jpg',
       '/img/10.jpg',
     ]).then(() => {
      console.log('Finished caching all files!');
     }).catch((error) => {
      console.log('Caching threw an error: ', error);
     })
   })
 );
});

self.addEventListener('activate', (event) => {
  console.log('Activating service worker...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          cacheName.startsWith('mws-') && cacheName != staticCacheName;
        }).map(cacheName => caches.delete(cacheName))
      ).then(() => console.log('Activated service worker!'))
    })
  )
});

self.addEventListener('fetch', (event) => {
  // Do not use service worker for the Google Maps API or restaurants API
  if (event.request.url.indexOf('maps.googleapis.com') !== -1 || event.request.url.indexOf('/restaurants/') !== -1) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;

      let fetchRequest = event.request.clone();

      return fetch(fetchRequest).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        let responseToCache = response.clone();

        caches.open(staticCacheName).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
    })
    // caches.open(staticCacheName).then((cache) => {
    //   return cache.match(event.request).then((response) => {
    //     return response || fetch(event.request).then((response) => {
    //       if (response.status === 404) {
    //         console.log(`You're offline!`);
    //         return;
    //       }
    //       cache.put(event.request, response.clone());
    //       return response;
    //     });
    //   });
    // })
  );
});