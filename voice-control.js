const $=id=>document.getElementById(id);
let stream=null;
let recorder=null;
let recognition=null;
let chunks=[];
let listening=false;
let recognitionSupported=false;
let restartRecognition=false;
let options={};

function normalize(text=""){
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ").trim();
}

function setStatus(text,state="idle"){
  const el=$("voiceStatus");
  if(el){el.textContent=text;el.dataset.state=state}
  const btn=$("voiceBtn");
  if(btn){btn.textContent=listening?"Detener voz":"Voz";btn.setAttribute("aria-pressed",listening?"true":"false")}
}

function appendTranscript(text,final=false){
  const el=$("voiceTranscript");
  if(!el)return;
  if(final){
    const line=document.createElement("div");
    line.className="voice-line";
    line.textContent=text;
    el.prepend(line);
  }else{
    $("voiceInterim").textContent=text;
  }
}

function commandTokens(action){
  const stop=new Set(["administrar","realizar","iniciar","colocar","preparar","obtener","evaluar","reconocer","considerar","segun","paciente","respuesta","frecuencia"]);
  return normalize(action).split(" ").filter(word=>word.length>=4&&!stop.has(word));
}

function findActionButton(text){
  const spoken=normalize(text);
  const buttons=[...document.querySelectorAll("#interventionGrid .action:not(:disabled)")];
  let best=null,bestScore=0;
  for(const button of buttons){
    const action=button.dataset.a||button.textContent||"";
    const normalizedAction=normalize(action);
    if(spoken.includes(normalizedAction)||normalizedAction.includes(spoken))return button;
    const tokens=commandTokens(action);
    const hits=tokens.filter(token=>spoken.includes(token)).length;
    const score=tokens.length?hits/tokens.length:0;
    if(hits>=1&&score>bestScore){best=button;bestScore=score}
  }
  return bestScore>=0.34?best:null;
}

function executeVoiceCommand(text){
  const spoken=normalize(text);
  if(!spoken)return false;
  const direct=[
    {phrases:["avanzar fase","siguiente fase","avanza escenario"],id:"quickAdvanceBtn"},
    {phrases:["evento truco","activar truco","evento sorpresa"],id:"quickTrickBtn"},
    {phrases:["error critico","registrar error"],id:"quickErrorBtn"},
    {phrases:["pausar escenario","pausa"],id:"pauseBtn"},
    {phrases:["reanudar escenario","reanuda"],id:"pauseBtn"},
    {phrases:["finalizar escenario","terminar escenario"],id:"finishBtn"},
    {phrases:["cargar desfibrilador","cargar"],id:"chargeBtn"},
    {phrases:["descarga","desfibrilar"],id:"shockBtn"}
  ];
  for(const item of direct){
    if(item.phrases.some(phrase=>spoken.includes(phrase))){
      const target=$(item.id);
      if(target&&!target.disabled){target.click();options.onRecognized?.(text);return true}
    }
  }
  const action=findActionButton(text);
  if(action){action.click();options.onRecognized?.(action.dataset.a||action.textContent);return true}
  return false;
}

function setupRecognition(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognitionSupported=!!SpeechRecognition;
  if(!recognitionSupported)return;
  recognition=new SpeechRecognition();
  recognition.lang="es-MX";
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.maxAlternatives=3;
  recognition.onstart=()=>setStatus("Escuchando y grabando…","recording");
  recognition.onspeechstart=()=>setStatus("Voz detectada…","speech");
  recognition.onresult=event=>{
    let interim="";
    for(let i=event.resultIndex;i<event.results.length;i++){
      const result=event.results[i];
      const transcript=result[0]?.transcript?.trim()||"";
      if(result.isFinal){
        appendTranscript(transcript,true);
        $("voiceInterim").textContent="";
        const recognized=executeVoiceCommand(transcript);
        options.onTranscript?.(transcript,recognized);
        setStatus(recognized?`Comando reconocido: ${transcript}`:`Escuchado: ${transcript}`,recognized?"success":"recording");
      }else interim+=transcript+" ";
    }
    if(interim.trim())appendTranscript(interim.trim(),false);
  };
  recognition.onerror=event=>{
    const map={"not-allowed":"Permiso de micrófono denegado.","service-not-allowed":"El servicio de reconocimiento está bloqueado.","no-speech":"No se detectó voz. Intenta hablar más cerca del micrófono.","audio-capture":"No se encontró un micrófono disponible.","network":"El reconocimiento de voz necesita conexión a internet en este navegador."};
    setStatus(map[event.error]||`Error de reconocimiento: ${event.error}`,"error");
    if(["not-allowed","service-not-allowed","audio-capture"].includes(event.error))restartRecognition=false;
  };
  recognition.onend=()=>{
    if(listening&&restartRecognition){
      setTimeout(()=>{try{recognition.start()}catch{}},350);
    }else if(listening)setStatus("Grabando audio; reconocimiento detenido.","warning");
  };
}

function selectMimeType(){
  if(!window.MediaRecorder)return "";
  const types=["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg;codecs=opus"];
  return types.find(type=>MediaRecorder.isTypeSupported?.(type))||"";
}

function startRecorder(){
  if(!stream||!window.MediaRecorder)return false;
  chunks=[];
  const mimeType=selectMimeType();
  try{recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined)}catch{recorder=new MediaRecorder(stream)}
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
  recorder.onstop=()=>{
    if(!chunks.length)return;
    const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});
    const url=URL.createObjectURL(blob);
    const audio=$("voicePlayback");
    const link=$("voiceDownload");
    if(audio){audio.src=url;audio.classList.remove("hidden")}
    if(link){link.href=url;link.download=`simcopilot-voz-${Date.now()}.${blob.type.includes("mp4")?"m4a":"webm"}`;link.classList.remove("hidden")}
  };
  recorder.start(500);
  return true;
}

async function requestMicrophone(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Este navegador no permite acceder al micrófono.");
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  return stream;
}

async function startVoice(){
  if(listening)return;
  setStatus("Solicitando permiso al micrófono…","pending");
  try{
    await requestMicrophone();
    listening=true;
    const recording=startRecorder();
    if(recognitionSupported&&recognition){
      restartRecognition=true;
      try{recognition.start()}catch{setStatus(recording?"Grabando audio; el reconocimiento ya estaba activo.":"Reconocimiento ya activo.","warning")}
    }else{
      setStatus(recording?"Grabando audio. Este navegador no admite transcripción automática.":"El navegador no admite grabación ni reconocimiento.","warning");
    }
    options.onStart?.();
  }catch(error){
    listening=false;
    const message=error.name==="NotAllowedError"?"Permiso de micrófono denegado. Actívalo en la configuración del sitio.":error.name==="NotFoundError"?"No se encontró un micrófono.":error.message||"No fue posible iniciar el micrófono.";
    setStatus(message,"error");
    options.toast?.(message);
  }
}

function stopVoice(){
  if(!listening)return;
  listening=false;
  restartRecognition=false;
  try{recognition?.stop()}catch{}
  if(recorder&&recorder.state!=="inactive")recorder.stop();
  stream?.getTracks().forEach(track=>track.stop());
  stream=null;
  setStatus("Grabación finalizada. Puedes reproducirla o descargarla.","success");
  options.onStop?.();
}

function injectPanel(){
  if($("voicePanel"))return;
  const panel=document.createElement("section");
  panel.id="voicePanel";
  panel.className="voice-panel panel hidden";
  panel.innerHTML='<div class="heading"><div><p class="eyebrow">CONTROL POR VOZ</p><h3>Micrófono y comandos</h3></div><button id="closeVoicePanel" type="button" class="btn" aria-label="Cerrar panel de voz">×</button></div><div id="voiceStatus" class="voice-status" data-state="idle">Micrófono inactivo.</div><div id="voiceInterim" class="voice-interim"></div><div id="voiceTranscript" class="voice-transcript"></div><div class="voice-actions"><button id="voiceStartStopBtn" type="button" class="btn primary">Iniciar micrófono</button><audio id="voicePlayback" class="hidden" controls></audio><a id="voiceDownload" class="btn hidden">Descargar grabación</a></div><p class="muted">Comandos sugeridos: “administrar oxígeno”, “iniciar compresiones”, “administrar adrenalina”, “avanzar fase”, “evento sorpresa” o “finalizar escenario”.</p>';
  const toolbar=document.querySelector("#simView>.heading");
  toolbar?.insertAdjacentElement("afterend",panel);
  $("closeVoicePanel").onclick=()=>panel.classList.add("hidden");
  $("voiceStartStopBtn").onclick=()=>listening?stopVoice():startVoice();
}

export function setupVoiceControl(config={}){
  options=config;
  injectPanel();
  setupRecognition();
  const button=$("voiceBtn");
  if(button)button.onclick=()=>{
    $("voicePanel").classList.remove("hidden");
    if(listening)stopVoice();else startVoice();
  };
  window.addEventListener("beforeunload",()=>{if(listening)stopVoice()});
  return{start:startVoice,stop:stopVoice,isListening:()=>listening,isRecognitionSupported:()=>recognitionSupported};
}
