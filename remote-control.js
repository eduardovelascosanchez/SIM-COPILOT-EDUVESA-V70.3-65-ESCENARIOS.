let peer=null;
let connection=null;
let role="local";
let roomId="";
let latestSnapshot=null;
let options={};
let connectTimer=null;
let retryTimer=null;
let registrationTimer=null;
let wakeLock=null;

const ROOM_PATTERN=/^SIM-[A-Z2-9]{6}$/;

function setStatus(text,state=""){
  const el=document.getElementById("remoteStatus");
  if(el){el.textContent=text;el.dataset.state=state}
  const help=document.getElementById("remoteHelp");
  if(help)help.textContent=text;
  options.onStatus?.(text,state);
}

function friendlyError(err){
  const type=err?.type||err?.message||"unknown";
  if(type==="peer-unavailable")return "No se encontró el monitor. Verifica que el código esté activo y que la pantalla principal permanezca abierta.";
  if(type==="unavailable-id")return "El código ya estaba ocupado. Se generará otro automáticamente.";
  if(type==="network"||type==="server-error"||type==="socket-error"||type==="socket-closed")return "No fue posible registrar la sesión. Revisa Internet y abre la página directamente en Safari o Chrome.";
  if(type==="browser-incompatible")return "Este navegador no admite la conexión remota. Abre el enlace directamente en Safari o Chrome.";
  if(type==="connection-timeout")return "El monitor no respondió. Verifica que siga abierto y conectado a Internet.";
  if(type==="registration-timeout")return "El código se generó, pero no pudo activarse en el servidor. Revisa Internet y vuelve a intentarlo.";
  if(type==="library-timeout")return "El código se generó, pero no se pudo cargar el módulo de conexión. Recarga la página en Safari o Chrome.";
  return `Error de conexión: ${type}`;
}

function isEmbeddedBrowser(){
  const ua=navigator.userAgent||"";
  return /WhatsApp|FBAN|FBAV|Instagram|Line\//i.test(ua)||(/iPhone|iPad|iPod/i.test(ua)&&/AppleWebKit/i.test(ua)&&!/Safari/i.test(ua));
}

async function requestWakeLock(){
  try{if("wakeLock"in navigator)wakeLock=await navigator.wakeLock.request("screen")}catch{}
}

function clearConnectionTimers(){
  if(connectTimer)clearTimeout(connectTimer);
  if(retryTimer)clearTimeout(retryTimer);
  if(registrationTimer)clearTimeout(registrationTimer);
  connectTimer=null;
  retryTimer=null;
  registrationTimer=null;
}

function attachConnection(conn,mode){
  clearConnectionTimers();
  connection=conn;
  role=mode;
  connectTimer=setTimeout(()=>{
    if(!conn.open){
      try{conn.close()}catch{}
      setStatus(friendlyError({type:"connection-timeout"}),"error");
    }
  },12000);
  conn.on("open",()=>{
    clearConnectionTimers();
    setStatus(mode==="monitor"?"Instructor conectado":"Conectado al monitor","connected");
    if(mode==="monitor")options.onRequestSnapshot?.();
  });
  conn.on("data",data=>{
    if(!data||typeof data!=="object")return;
    if(mode==="monitor"&&data.type==="command")options.onCommand?.(data.command,data.payload||{});
    if(mode==="instructor"&&data.type==="snapshot"){
      latestSnapshot=data.snapshot;
      options.onSnapshot?.(latestSnapshot);
    }
    if(data.type==="notice")options.onNotice?.(data.message||"");
  });
  conn.on("close",()=>setStatus("Conexión cerrada. Puedes volver a conectar con el mismo código mientras el monitor siga abierto.","closed"));
  conn.on("error",err=>setStatus(friendlyError(err),"error"));
}

function randomRoom(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code="SIM-";
  const bytes=new Uint8Array(6);
  crypto.getRandomValues(bytes);
  bytes.forEach(n=>code+=chars[n%chars.length]);
  return code;
}

function showCode(code,active=false){
  const codeEl=document.getElementById("remoteRoomCode");
  if(codeEl){
    codeEl.textContent=code;
    codeEl.dataset.active=active?"true":"false";
  }
  const input=document.getElementById("remoteRoomInput");
  if(input)input.value=code;
  const share=document.getElementById("copyRemoteLinkBtn");
  if(share)share.disabled=!active;
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=src;
    script.async=true;
    script.dataset.peerjs="true";
    const timer=setTimeout(()=>{script.remove();reject(new Error("library-timeout"))},7000);
    script.onload=()=>{clearTimeout(timer);window.Peer?resolve():reject(new Error("library-timeout"))};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error("library-timeout"))};
    document.head.appendChild(script);
  });
}

async function loadPeerJS(){
  if(window.Peer)return;
  const existing=[...document.querySelectorAll('script[data-peerjs="true"]')];
  existing.forEach(node=>node.remove());
  const sources=[
    "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js",
    "https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js"
  ];
  let lastError=null;
  for(const src of sources){
    try{await loadScript(src);return}catch(error){lastError=error}
  }
  throw lastError||new Error("library-timeout");
}

function createPeer(id){
  const peerOptions={
    debug:1,
    config:{iceServers:[
      {urls:"stun:stun.l.google.com:19302"},
      {urls:"stun:stun1.l.google.com:19302"}
    ]}
  };
  return id?new window.Peer(id,peerOptions):new window.Peer(undefined,peerOptions);
}

export async function createMonitorRoom(attempt=0){
  clearConnectionTimers();
  if(connection){try{connection.close()}catch{}connection=null}
  if(peer&&!peer.destroyed)peer.destroy();

  roomId=randomRoom();
  role="monitor";
  showCode(roomId,false);
  setStatus(`Código generado: ${roomId}. Activando conexión…`,"pending");

  try{
    await loadPeerJS();
  }catch(error){
    setStatus(friendlyError(error),"error");
    return false;
  }

  try{
    peer=createPeer(roomId);
  }catch(error){
    setStatus(friendlyError(error),"error");
    return false;
  }

  registrationTimer=setTimeout(()=>{
    if(!peer?.open)setStatus(friendlyError({type:"registration-timeout"}),"error");
  },12000);

  peer.on("open",async id=>{
    if(registrationTimer)clearTimeout(registrationTimer);
    registrationTimer=null;
    roomId=id;
    showCode(id,true);
    setStatus("Esperando instructor. El código ya está activo; mantén esta pantalla abierta.","waiting");
    await requestWakeLock();
    options.onRoom?.(id,buildInstructorLink(id));
  });

  peer.on("connection",conn=>attachConnection(conn,"monitor"));
  peer.on("disconnected",()=>{
    setStatus("Reconectando el monitor…","pending");
    try{peer.reconnect()}catch{}
  });
  peer.on("error",err=>{
    if(registrationTimer)clearTimeout(registrationTimer);
    registrationTimer=null;
    if(err?.type==="unavailable-id"&&attempt<2){
      setStatus("Generando otro código…","pending");
      retryTimer=setTimeout(()=>createMonitorRoom(attempt+1),500);
      return;
    }
    setStatus(friendlyError(err),"error");
  });
  return true;
}

function connectAttempt(clean,attempt=0){
  if(peer&&!peer.destroyed)peer.destroy();
  setStatus(attempt?`Reintentando conexión ${attempt+1}/3…`:"Buscando el monitor…","pending");
  peer=createPeer();
  peer.on("open",()=>{
    const conn=peer.connect(clean,{reliable:true,serialization:"json",metadata:{role:"instructor"}});
    attachConnection(conn,"instructor");
  });
  peer.on("error",err=>{
    if(err?.type==="peer-unavailable"&&attempt<2){
      setStatus("El monitor aún no responde. Reintentando…","pending");
      retryTimer=setTimeout(()=>connectAttempt(clean,attempt+1),1800*(attempt+1));
      return;
    }
    setStatus(friendlyError(err),"error");
  });
}

export async function connectInstructor(code){
  const clean=(code||"").trim().toUpperCase();
  if(!ROOM_PATTERN.test(clean)){
    setStatus("Código inválido. Debe comenzar con SIM- y contener 6 caracteres, por ejemplo SIM-AB12CD.","error");
    options.onNotice?.("Usa el código generado por el dispositivo del monitor.");
    return false;
  }
  if(isEmbeddedBrowser())options.onNotice?.("Abre esta página directamente en Safari o Chrome; evita el navegador interno de WhatsApp.");
  setStatus(`Preparando conexión con ${clean}…`,"pending");
  try{await loadPeerJS()}catch(error){setStatus(friendlyError(error),"error");return false}
  clearConnectionTimers();
  roomId=clean;
  role="instructor";
  connectAttempt(clean,0);
  return true;
}

export function sendCommand(command,payload={}){
  if(role!=="instructor"||!connection?.open)return false;
  connection.send({type:"command",command,payload});
  return true;
}

export function sendSnapshot(snapshot){
  latestSnapshot=snapshot;
  if(role==="monitor"&&connection?.open){connection.send({type:"snapshot",snapshot});return true}
  return false;
}

export function isRemoteInstructor(){return role==="instructor"}
export function isMonitorRole(){return role==="monitor"}
export function getRoomId(){return roomId}

export function buildInstructorLink(id=roomId){
  const url=new URL(location.href);
  url.search="";
  url.searchParams.set("v","70.11");
  url.searchParams.set("instructor","1");
  url.searchParams.set("room",id);
  return url.toString();
}

export async function shareInstructorLink(){
  if(!roomId||!ROOM_PATTERN.test(roomId))return false;
  const url=buildInstructorLink(roomId);
  try{
    if(navigator.share){await navigator.share({title:"SimCopilot EDUVESA — Panel instructor",text:`Código de sesión: ${roomId}`,url});return true}
    await navigator.clipboard.writeText(url);
    return true;
  }catch{return false}
}

export async function copyInstructorLink(){
  if(!roomId||!ROOM_PATTERN.test(roomId))return false;
  try{await navigator.clipboard.writeText(buildInstructorLink(roomId));return true}catch{return false}
}

export function setupRemoteControl(config={}){
  options=config;
  const params=new URLSearchParams(location.search);
  const room=(params.get("room")||"").trim().toUpperCase();
  if(room){const input=document.getElementById("remoteRoomInput");if(input)input.value=room}
  if(isEmbeddedBrowser())setTimeout(()=>options.onNotice?.("Estás abriendo SimCopilot desde un navegador interno. Para usar dos dispositivos, abre el enlace en Safari o Chrome."),700);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&role==="monitor"&&peer?.disconnected&&!peer.destroyed){try{peer.reconnect()}catch{}}
  });
  return{createMonitorRoom,connectInstructor,sendCommand,sendSnapshot,copyInstructorLink,shareInstructorLink,isRemoteInstructor,isMonitorRole,getRoomId,autoRoom:room,instructorMode:params.get("instructor")==="1"};
}