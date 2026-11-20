const V='sudoku-squad-v1',FILES=['./','index.html','engine.js','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(caches.match(e.request).then(c=>{const n=fetch(e.request).then(r=>{caches.open(V).then(ch=>ch.put(e.request,r.clone()));return r;}).catch(()=>c);return c||n;}));
});
