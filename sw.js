const CACHE="simcopilot-v70-3";
const ASSETS=["./","./index.html","./manifest.webmanifest","./css/styles.css","./js/app.js","./js/scenarios.js","./js/monitor.js","./js/clinical-engine.js","./js/instructor.js","./js/reports.js","./js/pwa.js","./assets/icons/icon-192.png","./assets/icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>caches.match("./index.html")))));