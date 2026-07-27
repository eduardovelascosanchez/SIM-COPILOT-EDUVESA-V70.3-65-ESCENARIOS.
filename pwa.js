let deferredPrompt=null;
export function setupPWA(){
  const installButton=document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredPrompt=event;installButton?.classList.remove("hidden")});
  if(installButton)installButton.onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installButton.classList.add("hidden")};
  if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
}