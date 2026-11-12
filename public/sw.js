// Minimal service worker so the app can be installed to the home screen.
// Always goes to the network, so your numbers are never stale.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(
        () => new Response('<h2 style="font-family:sans-serif;text-align:center;margin-top:40vh">You are offline</h2>', { headers: { 'Content-Type': 'text/html' } })
      )
    );
  }
});
