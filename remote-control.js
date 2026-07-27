let peer=null;
let connection=null;
let role="local";
let roomId="";
let latestSnapshot=null;
let options={};

function setStatus(text,state=""){
  const el=document.getElementById("remoteStatus");
  if(el){el.textContent=text;el.dataset.state=state}
  options.onStatus?.(text,state);
}
function attachConnection(conn,mode){
  connection=conn;role=mode;
  conn.on("open",()=>{setStatus(mode==="monitor"?"Instructor conectado":"Conectado al monitor","connected");if(mode==="monitor")options.onRequestSnapshot?.()});
  conn.on("data",data=>{
    if(!data||typeof data!=="object")return;
    if(mode==="monitor"&&data.type==="command")options.onCommand?.(data.command,data.payload||{});
    if(mode==="instructor"&&data.type==="snapshot"){latestSnapshot=data.snapshot;options.onSnapshot?.(latestSnapshot)}
    if(data.type==="notice")options.onNotice?.(data.message||"");
  });
  conn.on("close",()=>setStatus("Conexión cerrada","closed"));
  conn.on("error",err=>setStatus(`Error: ${err.type||err.message}`,"error"));
}
function randomRoom(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let code="SIM-";
  crypto.getRandomValues(new Uint8Array(6)).forEach(n=>code+=chars[n%chars.length]);return code;
}
function loadPeerJS(){
  if(window.Peer)return Promise.resolve();
  return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
}
export async function createMonitorRoom(){
  try{await loadPeerJS()}catch{setStatus("No se pudo cargar conexión remota","error");return}
  if(peer&&!peer.destroyed)peer.destroy();roomId=randomRoom();setStatus("Creando sesión…","pending");
  peer=new window.Peer(roomId,{debug:1});
  peer.on("open",id=>{roomId=id;const code=document.getElementById("remoteRoomCode");if(code)code.textContent=id;const input=document.getElementById("remoteRoomInput");if(input)input.value=id;setStatus("Esperando instructor","waiting");options.onRoom?.(id,buildInstructorLink(id))});
  peer.on("connection",conn=>attachConnection(conn,"monitor"));peer.on("error",err=>setStatus(`Error: ${err.type||err.message}`,"error"));
}
export async function connectInstructor(code){
  try{await loadPeerJS()}catch{setStatus("No se pudo cargar conexión remota","error");return}
  const clean=(code||"").trim().toUpperCase();if(!clean){options.onNotice?.("Introduce el código de la sesión.");return}
  if(peer&&!peer.destroyed)peer.destroy();roomId=clean;setStatus("Conectando…","pending");peer=new window.Peer(undefined,{debug:1});
  peer.on("open",()=>attachConnection(peer.connect(clean,{reliable:true,metadata:{role:"instructor"}}),"instructor"));peer.on("error",err=>setStatus(`Error: ${err.type||err.message}`,"error"));
}
export function sendCommand(command,payload={}){if(role!=="instructor"||!connection?.open)return false;connection.send({type:"command",command,payload});return true}
export function sendSnapshot(snapshot){latestSnapshot=snapshot;if(role==="monitor"&&connection?.open){connection.send({type:"snapshot",snapshot});return true}return false}
export function isRemoteInstructor(){return role==="instructor"}
export function buildInstructorLink(id=roomId){const url=new URL(location.href);url.search="";url.searchParams.set("v","70.5");url.searchParams.set("instructor","1");url.searchParams.set("room",id);return url.toString()}
export async function copyInstructorLink(){if(!roomId)return false;try{await navigator.clipboard.writeText(buildInstructorLink(roomId));return true}catch{return false}}
export function setupRemoteControl(config={}){options=config;const params=new URLSearchParams(location.search),room=params.get("room");if(room){const input=document.getElementById("remoteRoomInput");if(input)input.value=room.toUpperCase()}return{createMonitorRoom,connectInstructor,sendCommand,sendSnapshot,copyInstructorLink,isRemoteInstructor,autoRoom:room,instructorMode:params.get("instructor")==="1"}}
