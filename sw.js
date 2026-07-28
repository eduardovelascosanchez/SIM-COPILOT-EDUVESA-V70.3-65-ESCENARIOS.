const CACHE="simcopilot-v71-2";
const ASSETS=["./","./index.html","./manifest.webmanifest","./styles.css","./remote-fix.css","./vitals-control.css","./instructor-ux.css","./app.js","./scenarios.js","./monitor.js","./clinical-engine.js","./instructor.js","./reports.js","./pwa.js","./algorithms.js","./remote-control.js","./advanced-control.js","./vitals-control.js","./instructor-ux.js","./voice-control.js","./debriefing-engine.js","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  const networkFirst=event.request.mode==="navigate"||["script","style","document"].includes(event.request.destination);
  if(networkFirst){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  })));
});