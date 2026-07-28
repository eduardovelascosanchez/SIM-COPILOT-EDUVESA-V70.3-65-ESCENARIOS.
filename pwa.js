let deferredPrompt=null;

const $=id=>document.getElementById(id);

function isStandalone(){
  return window.matchMedia?.("(display-mode: standalone)").matches||window.navigator.standalone===true;
}

function platformName(){
  const ua=navigator.userAgent||"";
  if(/iPhone|iPad|iPod/i.test(ua))return"iOS";
  if(/Android/i.test(ua))return"Android";
  if(/Windows/i.test(ua))return"Windows";
  if(/Macintosh|Mac OS X/i.test(ua))return"Mac";
  return"este dispositivo";
}

function updateInstallUI(message=""){
  const installed=isStandalone();
  const mainButton=$("installBtn");
  const nativeButton=$("nativeInstallBtn");
  const area=$("nativeInstallArea");
  if(installed){
    if(mainButton){mainButton.textContent="App instalada";mainButton.disabled=true}
    if(nativeButton){nativeButton.textContent="Aplicación instalada";nativeButton.disabled=true}
    if(area)area.innerHTML="<b>SimCopilot ya está instalado.</b> Puedes abrirlo desde la pantalla de inicio, Dock o menú de aplicaciones.";
    return;
  }
  if(mainButton){mainButton.textContent="Instalar app";mainButton.disabled=false}
  if(nativeButton){nativeButton.disabled=false;nativeButton.textContent=deferredPrompt?"Instalar ahora":"Ver instrucciones de instalación"}
  if(area)area.innerHTML=message||`<b>${platformName()}:</b> ${deferredPrompt?"la instalación directa está disponible.":"sigue las instrucciones correspondientes que aparecen debajo."}`;
}

async function requestInstall(){
  if(isStandalone()){updateInstallUI();return}
  if(deferredPrompt){
    deferredPrompt.prompt();
    const choice=await deferredPrompt.userChoice;
    deferredPrompt=null;
    updateInstallUI(choice.outcome==="accepted"?"Instalación aceptada. El acceso aparecerá en tu dispositivo.":"La instalación fue cancelada. Puedes intentarlo nuevamente.");
    return;
  }
  const dialog=$("installDialog");
  if(dialog&&!dialog.open)dialog.showModal();
  updateInstallUI();
}

export function setupPWA(){
  const installButton=$("installBtn");
  const nativeButton=$("nativeInstallBtn");
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPrompt=event;
    updateInstallUI("<b>Instalación disponible:</b> pulsa “Instalar ahora” para agregar SimCopilot como aplicación.");
  });
  window.addEventListener("appinstalled",()=>{
    deferredPrompt=null;
    updateInstallUI("<b>Instalación completada.</b>");
  });
  installButton?.addEventListener("click",requestInstall);
  nativeButton?.addEventListener("click",requestInstall);
  updateInstallUI();
  if("serviceWorker"in navigator){
    window.addEventListener("load",async()=>{
      try{
        const registration=await navigator.serviceWorker.register("./sw.js");
        registration.update?.();
      }catch(error){
        console.warn("No se pudo registrar el modo instalable/offline",error);
      }
    });
  }
}