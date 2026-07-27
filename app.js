import{getScenarios,findScenario}from"./scenarios.js";
import{createSession,performAction,tickSession,calculateResult,formatTime,addLog}from"./clinical-engine.js";
import{startMonitor,startHeroMonitor}from"./monitor.js";
import{setupInstructor}from"./instructor.js";
import{downloadReport,printReport}from"./reports.js";
import{setupPWA}from"./pwa.js";
import{setupAdvancedControl}from"./advanced-control.js";
import{setupVoiceControl}from"./voice-control.js";
import{buildStructuredDebrief,renderStructuredDebrief}from"./debriefing-engine.js";
const $=id=>document.getElementById(id);
let session=null,timerId=null,charged=false,voiceController=null,finishing=false;
function view(id){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(id).classList.add("active");scrollTo(0,0)}
function toast(m){$("toast").textContent=m;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function options(){const p=$("programSelect").value,d=$("difficultySelect").value,a=getScenarios(p),f=a.filter(x=>x.difficulty===d),l=f.length?f:a;$("scenarioSelect").innerHTML=l.map(x=>`<option value="${x.id}">${x.title}</option>`).join("");preview()}
function preview(){const s=findScenario($("programSelect").value,$("scenarioSelect").value);if(!s)return;$("scenarioPreview").innerHTML=`<b>${s.patient}</b><br>${s.narrative}`;$("patientWeight").value=s.weight}
function vitals(){if(!session)return;const v=session.vitals;$("hrValue").textContent=$("hrBottom").textContent=v.hr;$("spo2Value").textContent=$("spo2Bottom").textContent=v.spo2;$("bpValue").textContent=v.sys?`${v.sys}/${v.dia}`:"—";$("rrValue").textContent=v.rr;$("etco2Value").textContent=v.etco2;$("rhythmLabel").textContent=v.rhythm}
function goals(){if(!session)return;const g=session.scenario.goals;$("goalCount").textContent=`${session.completed.size}/${g.length}`;$("goalProgress").value=session.completed.size/g.length*100;$("goalList").innerHTML=g.map(x=>`<div class="goal ${session.completed.has(x)?"done":""}">${session.completed.has(x)?"✓ ":""}${x}</div>`).join("")}
function log(){if(session)$("logList").innerHTML=session.log.map(e=>`<div><b>${e.time}</b><br>${e.action}</div>`).join("")}
function actions(){$("interventionGrid").innerHTML=session.scenario.actions.map(a=>`<button class="btn action" data-a="${a}">${a}</button>`).join("");document.querySelectorAll(".action").forEach(b=>b.onclick=()=>{const ok=performAction(session,b.dataset.a);b.disabled=true;b.classList.add(ok?"primary":"");vitals();goals();log()})}
function startTimer(){clearInterval(timerId);timerId=setInterval(()=>{tickSession(session);$("timer").textContent=formatTime(session.elapsed);vitals()},1000)}
function bindDebriefNotes(){
  const instructor=$("debriefInstructorNotes"),commitment=$("debriefTeamCommitment");
  if(instructor)instructor.addEventListener("input",event=>{if(session?.debriefing)session.debriefing.instructorNotes=event.target.value});
  if(commitment)commitment.addEventListener("input",event=>{if(session?.debriefing)session.debriefing.teamCommitment=event.target.value});
}
async function finish(){
  if(!session||finishing)return;finishing=true;session.running=false;clearInterval(timerId);toast("Cerrando caso y preparando debriefing…");
  let voiceData={entries:[],text:"",audioUrl:"",recognitionSupported:false};
  try{voiceData=await voiceController?.stopAndFinalize?.()||voiceController?.getData?.()||voiceData}catch{}
  session.voiceData=voiceData;
  const r=calculateResult(session);
  session.debriefing=buildStructuredDebrief(session,r,voiceData);
  $("finalScore").textContent=r.score;
  $("scoreRing").style.background=`conic-gradient(var(--primary) ${r.score*3.6}deg,#173244 0deg)`;
  $("resultTitle").textContent=r.decision;
  $("resultSummary").textContent=`${session.completed.size} de ${session.scenario.goals.length} objetivos completados. Debriefing generado con ${session.debriefing.metrics.voiceUtterances} frases transcritas y ${session.log.length} eventos.`;
  $("decisionBadge").textContent=session.instructorDecision?"Decisión del instructor":"Evaluación automática";
  $("debriefing").innerHTML=renderStructuredDebrief(session.debriefing,session,voiceData);
  $("metricGrid").innerHTML=`<div>Puntuación<br><b>${r.score}</b></div><div>Duración<br><b>${formatTime(session.elapsed)}</b></div><div>Errores críticos<br><b>${session.criticalErrors}</b></div>`;
  bindDebriefNotes();view("resultView");finishing=false;
}
$("startFlowBtn").onclick=()=>view("setupView");
document.querySelectorAll("[data-go-home]").forEach(x=>x.onclick=e=>{e.preventDefault();view("homeView")});
$("generatorBtn").onclick=()=>$("generatorDialog").showModal();
$("programSelect").onchange=options;$("difficultySelect").onchange=options;$("scenarioSelect").onchange=preview;
$("setupForm").onsubmit=e=>{e.preventDefault();const p=$("programSelect").value,s=findScenario(p,$("scenarioSelect").value);voiceController?.resetSession?.();session=createSession(s,{program:p,instructor:$("instructorName").value,team:$("teamName").value,weight:+$("patientWeight").value});$("simProgram").textContent=p;$("simTitle").textContent=s.title;$("patientLabel").textContent=s.patient;$("caseNarrative").textContent=s.narrative;$("timer").textContent="00:00";vitals();goals();actions();log();view("simView");startTimer()};
$("pauseBtn").onclick=()=>{if(session){session.paused=!session.paused;$("pauseBtn").textContent=session.paused?"Reanudar":"Pausar";addLog(session,session.paused?"Escenario pausado":"Escenario reanudado");log()}};
$("finishBtn").onclick=finish;$("newSessionBtn").onclick=()=>{voiceController?.resetSession?.();session=null;view("setupView")};
$("energyRange").oninput=e=>$("joules").textContent=e.target.value;$("chargeBtn").onclick=()=>{charged=true;$("shockBtn").disabled=false;toast("Desfibrilador cargado")};$("shockBtn").onclick=()=>{if(charged&&session){charged=false;$("shockBtn").disabled=true;performAction(session,`Desfibrilar a ${$("energyRange").value} J/kg`);vitals();log();toast("Descarga simulada")}};
$("addNoteBtn").onclick=()=>$("noteDialog").showModal();$("noteForm").onsubmit=e=>{e.preventDefault();if(session)addLog(session,"NOTA: "+$("noteText").value);$("noteText").value="";$("noteDialog").close();log()};
$("generatorForm").onsubmit=e=>{e.preventDefault();$("generatedScenario").classList.remove("hidden");$("generatedScenario").innerHTML=`<b>${$("genProgram").value} · ${$("genDifficulty").value}</b><br>Paciente: ${$("genPatient").value}<br>Problema: ${$("genProblem").value}<br><br>Objetivos: evaluación primaria, reconocimiento, roles, intervención y reevaluación.`};
$("downloadReportBtn").onclick=()=>session&&downloadReport(session,calculateResult(session));$("printBtn").onclick=()=>session&&printReport(session,calculateResult(session));
setupInstructor({getSession:()=>session,onVitals:()=>{vitals();log()},onFinish:finish,onToast:toast});
setupAdvancedControl({getSession:()=>session,render:()=>{vitals();goals();log()},finish,toast});
voiceController=setupVoiceControl({toast,onTranscript:(text,recognized)=>{if(session&&!recognized){addLog(session,`VOZ ESCUCHADA: ${text}`,"voice");log()}},onRecognized:text=>toast(`Comando de voz: ${text}`)});
options();startHeroMonitor();startMonitor(()=>session);setupPWA();
