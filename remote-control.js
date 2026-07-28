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
  if(type==="peer-unavailable")return "No se encontró el monitor. En el dispositivo principal pulsa ‘Crear sesión en monitor’ y usa exactamente el código SIM-XXXXXX que aparezca. Mantén abierta esa pantalla.";
  if(type==="unavailable-id")return "El código de sesión ya estaba ocupado. Se generará un código nuevo.";
  if(type==="network"||type==="server-error"||type==="socket-error"||type==="socket-closed")return "No fue posible registrar la sesión. Revisa Internet y abre la página directamente en Safari o Chrome, no dentro de WhatsApp.";
  if(type==="browser-incompatible")return "Este navegador no admite la conexión remota. Abre el enlace directamente en Safari o Chrome.";
  if(type==="connection-timeout")return "El monitor no respondió. Verifica que la sesión siga abierta y que ambos dispositivos tengan Internet.";
  if(type==="registration-timeout")return "No se pudo registrar el código en el servidor. Revisa Internet, abre la página directamente en Safari o Chrome y vuelve a pulsar el botón.";
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

function loadPeerJS(){
  if(window.Peer)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-peerjs="true"]');
    if(existing){
      if(window.Peer){resolve();return}
      existing.addEventListener("load",resolve,{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script=document.createElement("script");
    script.dataset.peerjs="true";
    script.src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
    script.onload=resolve;
    script.onerror=reject;
    document.head.appendChild(script);
  });
}

function createPeer(id){
  const options={
    host:"0.peerjs.com",
    port:443,
    path:"/",
    secure:true,
    key:"peerjs",
    debug:1,
    config:{iceServers:[
      {urls:"stun:stun.l.google.com:19302"},
      {urls:"stun:stun1.l.google.com:19302"}
    ]}
  };
  return id?new window.Peer(id,options):new window.Peer(options);
}

function showProvisionalCode(code){
  const codeEl=document.getElementById("remoteRoomCode");
  if(codeEl)codeEl.textContent=code;
  const input=document.getElementById("remoteRoomInput");
  if(input)input.value=code;
  const share=document.getElementById("copyRemoteLinkBtn");
  if(share)share.disabled=true;
}

export async function createMonitorRoom(attempt=0){
  try{await loadPeerJS()}catch{
    setStatus(friendlyError({type:"browser-incompatible"}),"error");
    return false;
  }
  clearConnectionTimers();
  if(connection){try{connection.close()}catch{}connection=null}
  if(peer&&!peer.destroyed)peer.destroy();
  roomId=randomRoom();
  role="monitor";
  showProvisionalCode(roomId);
  setStatus(`Registrando ${roomId}… espera la confirmación “Esperando instructor”.`,"pending");
  peer=createPeer(roomId);
  registrationTimer=setTimeout(()=>{
    if(!peer?.open)setStatus(friendlyError({type:"registration-timeout"}),"error");
  },12000);
  peer.on("open",async id=>{
    if(registrationTimer)clearTimeout(registrationTimer);
    registrationTimer=null;
    roomId=id;
    showProvisionalCode(id);
    const share=document.getElementById("copyRemoteLinkBtn");
    if(share)share.disabled=false;
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
  try{await loadPeerJS()}catch{
    setStatus(friendlyError({type:"browser-incompatible"}),"error");
    return false;
  }
  const clean=(code||"").trim().toUpperCase();
  if(!ROOM_PATTERN.test(clean)){
    setStatus("Código inválido. Debe comenzar con SIM- y contener 6 caracteres, por ejemplo SIM-AB12CD. No escribas un nombre libre.","error");
    options.onNotice?.("Usa el código generado por el dispositivo del monitor.");
    return false;
  }
  if(isEmbeddedBrowser())options.onNotice?.("Para una conexión estable, abre esta página directamente en Safari o Chrome; evita el navegador interno de WhatsApp.");
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
  if(role==="monitor"&&connection?.open){
    connection.send({type:"snapshot",snapshot});
    return true;
  }
  return false;
}

export function isRemoteInstructor(){return role==="instructor"}
export function isMonitorRole(){return role==="monitor"}
export function getRoomId(){return roomId}

export function buildInstructorLink(id=roomId){
  const url=new URL(location.href);
  url.search="";
  url.searchParams.set("v","70.10");
  url.searchParams.set("instructor","1");
  url.searchParams.set("room",id);
  return url.toString();
}

export async function shareInstructorLink(){
  if(!roomId||!ROOM_PATTERN.test(roomId))return false;
  const url=buildInstructorLink(roomId);
  try{
    if(navigator.share){
      await navigator.share({title:"SimCopilot EDUVESA — Panel instructor",text:`Código de sesión: ${roomId}`,url});
      return true;
    }
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
  if(room){
    const input=document.getElementById("remoteRoomInput");
    if(input)input.value=room;
  }
  if(isEmbeddedBrowser())setTimeout(()=>options.onNotice?.("Estás abriendo SimCopilot desde un navegador interno. Para usar dos dispositivos, abre el enlace en Safari o Chrome."),700);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&role==="monitor"&&peer?.disconnected&&!peer.destroyed){
      try{peer.reconnect()}catch{}
    }
  });
  return{createMonitorRoom,connectInstructor,sendCommand,sendSnapshot,copyInstructorLink,shareInstructorLink,isRemoteInstructor,isMonitorRole,getRoomId,autoRoom:room,instructorMode:params.get("instructor")==="1"};
}