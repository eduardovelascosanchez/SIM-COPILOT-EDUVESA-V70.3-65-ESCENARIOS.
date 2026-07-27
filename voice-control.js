const $=id=>document.getElementById(id);
let stream=null;
let recorder=null;
let recognition=null;
let chunks=[];
let listening=false;
let recognitionSupported=false;
let restartRecognition=false;
let options={};
let transcriptEntries=[];
let sessionStartedAt=0;
let audioUrl="";
let audioType="";
let finalizeResolver=null;

function normalize(text=""){
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9ñ\s]/g," ").replace(/\s+/g," ").trim();
}
function timeStamp(){
  const seconds=Math.max(0,Math.round((Date.now()-(sessionStartedAt||Date.now()))/1000));
  return`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
}
function getVoiceData(){
  return{entries:transcriptEntries.map(item=>({...item})),text:transcriptEntries.map(item=>item.text).join(" ").trim(),audioUrl,audioType,recognitionSupported,recordingAvailable:!!audioUrl};
}
function setStatus(text,state="idle"){
  const el=$("voiceStatus");
  if(el){el.textContent=text;el.dataset.state=state}
  const btn=$("voiceBtn");
  if(btn){btn.textContent=listening?"Detener voz":"Voz";btn.setAttribute("aria-pressed",listening?"true":"false")}
  const startStop=$("voiceStartStopBtn");
  if(startStop)startStop.textContent=listening?"Detener micrófono":"Iniciar micrófono";
}
function appendTranscript(text,final=false){
  const el=$("voiceTranscript");
  if(final){
    const entry={time:timeStamp(),text};
    transcriptEntries.push(entry);
    if(el){const line=document.createElement("div");line.className="voice-line";line.innerHTML=`<time>${entry.time}</time><span>${text}</span>`;el.prepend(line)}
  }else if($("voiceInterim"))$("voiceInterim").textContent=text;
}
function commandTokens(action){
  const stop=new Set(["administrar","realizar","iniciar","colocar","preparar","obtener","evaluar","reconocer","considerar","segun","paciente","respuesta","frecuencia"]);
  return normalize(action).split(" ").filter(word=>word.length>=4&&!stop.has(word));
}
function findActionButton(text){
  const spoken=normalize(text),buttons=[...document.querySelectorAll("#interventionGrid .action:not(:disabled)")];let best=null,bestScore=0;
  for(const button of buttons){
    const action=button.dataset.a||button.textContent||"",normalizedAction=normalize(action);
    if(spoken.includes(normalizedAction)||normalizedAction.includes(spoken))return button;
    const tokens=commandTokens(action),hits=tokens.filter(token=>spoken.includes(token)).length,score=tokens.length?hits/tokens.length:0;
    if(hits>=1&&score>bestScore){best=button;bestScore=score}
  }
  return bestScore>=0.34?best:null;
}
function executeVoiceCommand(text){
  const spoken=normalize(text);if(!spoken)return false;
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
  for(const item of direct){if(item.phrases.some(phrase=>spoken.includes(phrase))){const target=$(item.id);if(target&&!target.disabled){target.click();options.onRecognized?.(text);return true}}}
  const action=findActionButton(text);if(action){action.click();options.onRecognized?.(action.dataset.a||action.textContent);return true}return false;
}
function setupRecognition(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;recognitionSupported=!!SpeechRecognition;if(!recognitionSupported)return;
  recognition=new SpeechRecognition();recognition.lang="es-MX";recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
  recognition.onstart=()=>setStatus("Escuchando, transcribiendo y grabando…","recording");
  recognition.onspeechstart=()=>setStatus("Voz detectada…","speech");
  recognition.onresult=event=>{
    let interim="";
    for(let i=event.resultIndex;i<event.results.length;i++){
      const result=event.results[i],transcript=result[0]?.transcript?.trim()||"";
      if(result.isFinal){appendTranscript(transcript,true);if($("voiceInterim"))$("voiceInterim").textContent="";const recognized=executeVoiceCommand(transcript);options.onTranscript?.(transcript,recognized);setStatus(recognized?`Comando reconocido: ${transcript}`:`Escuchado: ${transcript}`,recognized?"success":"recording")}else interim+=transcript+" ";
    }
    if(interim.trim())appendTranscript(interim.trim(),false);
  };
  recognition.onerror=event=>{
    const map={"not-allowed":"Permiso de micrófono denegado.","service-not-allowed":"El servicio de reconocimiento está bloqueado.","no-speech":"No se detectó voz. Intenta hablar más cerca del micrófono.","audio-capture":"No se encontró un micrófono disponible.","network":"El reconocimiento de voz necesita conexión a internet en este navegador."};
    setStatus(map[event.error]||`Error de reconocimiento: ${event.error}`,"error");if(["not-allowed","service-not-allowed","audio-capture"].includes(event.error))restartRecognition=false;
  };
  recognition.onend=()=>{if(listening&&restartRecognition)setTimeout(()=>{try{recognition.start()}catch{}},350);else if(listening)setStatus("Grabando audio; reconocimiento detenido.","warning")};
}
function selectMimeType(){
  if(!window.MediaRecorder)return"";const types=["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg;codecs=opus"];return types.find(type=>MediaRecorder.isTypeSupported?.(type))||"";
}
function finishRecording(){
  if(audioUrl)URL.revokeObjectURL(audioUrl);
  if(chunks.length){const blob=new Blob(chunks,{type:recorder?.mimeType||"audio/webm"});audioType=blob.type;audioUrl=URL.createObjectURL(blob);const audio=$("voicePlayback"),link=$("voiceDownload");if(audio){audio.src=audioUrl;audio.classList.remove("hidden")}if(link){link.href=audioUrl;link.download=`simcopilot-voz-${Date.now()}.${blob.type.includes("mp4")?"m4a":"webm"}`;link.classList.remove("hidden")}}
  const resolve=finalizeResolver;finalizeResolver=null;resolve?.(getVoiceData());
}
function startRecorder(){
  if(!stream||!window.MediaRecorder)return false;chunks=[];const mimeType=selectMimeType();try{recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined)}catch{recorder=new MediaRecorder(stream)}
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};recorder.onstop=finishRecording;recorder.start(500);return true;
}
async function requestMicrophone(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Este navegador no permite acceder al micrófono.");stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});return stream;
}
async function startVoice(){
  if(listening)return;setStatus("Solicitando permiso al micrófono…","pending");
  try{await requestMicrophone();if(!sessionStartedAt)sessionStartedAt=Date.now();listening=true;const recording=startRecorder();if(recognitionSupported&&recognition){restartRecognition=true;try{recognition.start()}catch{setStatus(recording?"Grabando audio; el reconocimiento ya estaba activo.":"Reconocimiento ya activo.","warning")}}else setStatus(recording?"Grabando audio. Este navegador no admite transcripción automática.":"El navegador no admite grabación ni reconocimiento.","warning");options.onStart?.()}catch(error){listening=false;const message=error.name==="NotAllowedError"?"Permiso de micrófono denegado. Actívalo en la configuración del sitio.":error.name==="NotFoundError"?"No se encontró un micrófono.":error.message||"No fue posible iniciar el micrófono.";setStatus(message,"error");options.toast?.(message)}
}
function stopVoice(){
  if(!listening)return Promise.resolve(getVoiceData());listening=false;restartRecognition=false;try{recognition?.stop()}catch{}stream?.getTracks().forEach(track=>track.stop());stream=null;setStatus("Finalizando grabación…","pending");
  return new Promise(resolve=>{finalizeResolver=resolve;if(recorder&&recorder.state!=="inactive")recorder.stop();else finishRecording();setTimeout(()=>{if(finalizeResolver){const pending=finalizeResolver;finalizeResolver=null;pending(getVoiceData())}},1500)}).then(data=>{setStatus("Grabación finalizada. El audio y la conversación se usarán en el debriefing.","success");options.onStop?.(data);return data});
}
function resetSession(){
  if(listening)stopVoice();transcriptEntries=[];sessionStartedAt=Date.now();chunks=[];if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=""}audioType="";
  if($("voiceTranscript"))$("voiceTranscript").innerHTML="";if($("voiceInterim"))$("voiceInterim").textContent="";if($("voicePlayback")){ $("voicePlayback").removeAttribute("src");$("voicePlayback").classList.add("hidden") }if($("voiceDownload"))$("voiceDownload").classList.add("hidden");setStatus("Micrófono inactivo.","idle");
}
function injectPanel(){
  if($("voicePanel"))return;const panel=document.createElement("section");panel.id="voicePanel";panel.className="voice-panel panel hidden";panel.innerHTML='<div class="heading"><div><p class="eyebrow">CONTROL POR VOZ</p><h3>Micrófono, grabación y comandos</h3></div><button id="closeVoicePanel" type="button" class="btn" aria-label="Cerrar panel de voz">×</button></div><div id="voiceStatus" class="voice-status" data-state="idle">Micrófono inactivo.</div><div id="voiceInterim" class="voice-interim"></div><div id="voiceTranscript" class="voice-transcript"></div><div class="voice-actions"><button id="voiceStartStopBtn" type="button" class="btn primary">Iniciar micrófono</button><audio id="voicePlayback" class="hidden" controls></audio><a id="voiceDownload" class="btn hidden">Descargar grabación</a></div><p class="muted">La conversación transcrita y la cronología se integrarán automáticamente al debriefing al cerrar el caso. Comandos sugeridos: “administrar oxígeno”, “iniciar compresiones”, “administrar adrenalina”, “avanzar fase”, “evento sorpresa” o “finalizar escenario”.</p>';
  const toolbar=document.querySelector("#simView>.heading");toolbar?.insertAdjacentElement("afterend",panel);$("closeVoicePanel").onclick=()=>panel.classList.add("hidden");$("voiceStartStopBtn").onclick=()=>listening?stopVoice():startVoice();
}
export function setupVoiceControl(config={}){
  options=config;injectPanel();setupRecognition();const button=$("voiceBtn");if(button)button.onclick=()=>{$("voicePanel").classList.remove("hidden");if(listening)stopVoice();else startVoice()};window.addEventListener("beforeunload",()=>{if(listening)stopVoice()});
  return{start:startVoice,stop:stopVoice,stopAndFinalize:stopVoice,resetSession,getData:getVoiceData,isListening:()=>listening,isRecognitionSupported:()=>recognitionSupported};
}
