import{getScenarios,findScenario}from"./scenarios.js";
import{createSession,performAction,tickSession,calculateResult,formatTime,addLog}from"./clinical-engine.js";
import{startMonitor,startHeroMonitor}from"./monitor.js";
import{setupInstructor}from"./instructor.js";
import{downloadReport,printReport}from"./reports.js";
import{setupPWA}from"./pwa.js";
import{setupAdvancedControl}from"./advanced-control.js";
import{setupVoiceControl}from"./voice-control.js";
import{buildStructuredDebrief,renderStructuredDebrief}from"./debriefing-engine.js";
import{setupVitalsControl}from"./vitals-control.js";
import{setupInstructorUX,setupScenarioBrowser}from"./instructor-ux.js";

const $=id=>document.getElementById(id);
let session=null;
let timerId=null;
let charged=false;
let voiceController=null;
let finishing=false;
let scenarioBrowser=null;

function view(id){
  document.querySelectorAll(".view").forEach(item=>item.classList.remove("active"));
  $(id)?.classList.add("active");
  window.scrollTo(0,0);
}

function openSetup(){
  view("setupView");
  scenarioBrowser?.render();
}

function toast(message){
  const element=$("toast");
  if(!element)return;
  element.textContent=message;
  element.classList.add("show");
  setTimeout(()=>element.classList.remove("show"),2400);
}

function filteredScenarios(){
  const program=$("programSelect").value;
  const difficulty=$("difficultySelect").value;
  const all=getScenarios(program);
  const filtered=all.filter(item=>item.difficulty===difficulty);
  return filtered.length?filtered:all;
}

function options(){
  const scenarios=filteredScenarios();
  const previous=$("scenarioSelect").value;
  $("scenarioSelect").innerHTML=scenarios.map(item=>`<option value="${item.id}">${item.title}</option>`).join("");
  if(scenarios.some(item=>item.id===previous))$("scenarioSelect").value=previous;
  preview();
  scenarioBrowser?.render();
}

function preview(){
  const scenario=findScenario($("programSelect").value,$("scenarioSelect").value);
  if(!scenario)return;
  $("scenarioPreview").innerHTML=`<b>${scenario.title}</b><br>${scenario.patient}<br><span class="muted">${scenario.narrative}</span>`;
  $("patientWeight").value=scenario.weight;
  scenarioBrowser?.render();
}

function vitals(){
  if(!session)return;
  const values=session.vitals;
  $("hrValue").textContent=$("hrBottom").textContent=values.hr;
  $("spo2Value").textContent=$("spo2Bottom").textContent=values.spo2;
  $("bpValue").textContent=values.sys?`${values.sys}/${values.dia}`:"—/—";
  $("rrValue").textContent=values.rr;
  $("etco2Value").textContent=values.etco2;
  if($("etco2Bottom"))$("etco2Bottom").textContent=values.etco2;
  $("rhythmLabel").textContent=values.rhythm;
}

function goals(){
  if(!session)return;
  const items=session.scenario.goals;
  $("goalCount").textContent=`${session.completed.size}/${items.length}`;
  $("goalProgress").value=session.completed.size/items.length*100;
  $("goalList").innerHTML=items.map(item=>`<div class="goal ${session.completed.has(item)?"done":""}">${session.completed.has(item)?"✓ ":""}${item}</div>`).join("");
}

function log(){
  if(!session)return;
  $("logList").innerHTML=session.log.map(item=>`<div><b>${item.time}</b><br>${item.action}</div>`).join("");
}

function actions(){
  $("interventionGrid").innerHTML=session.scenario.actions.map(action=>`<button class="btn action" data-a="${action}">${action}</button>`).join("");
  document.querySelectorAll(".action").forEach(button=>button.addEventListener("click",()=>{
    const correct=performAction(session,button.dataset.a);
    button.disabled=true;
    if(correct)button.classList.add("primary");
    vitals();goals();log();
  }));
}

function startTimer(){
  clearInterval(timerId);
  timerId=setInterval(()=>{
    tickSession(session);
    $("timer").textContent=formatTime(session.elapsed);
    vitals();
  },1000);
}

function bindDebriefNotes(){
  $("debriefInstructorNotes")?.addEventListener("input",event=>{if(session?.debriefing)session.debriefing.instructorNotes=event.target.value});
  $("debriefTeamCommitment")?.addEventListener("input",event=>{if(session?.debriefing)session.debriefing.teamCommitment=event.target.value});
}

async function finish(){
  if(!session||finishing)return;
  finishing=true;
  session.running=false;
  clearInterval(timerId);
  document.body.classList.remove("monitor-only");
  if($("monitorModeBtn")){ $("monitorModeBtn").textContent="Modo monitor";$("monitorModeBtn").setAttribute("aria-pressed","false") }
  toast("Cerrando caso y preparando debriefing…");
  let voiceData={entries:[],text:"",audioUrl:"",recognitionSupported:false};
  try{voiceData=await voiceController?.stopAndFinalize?.()||voiceController?.getData?.()||voiceData}catch{}
  session.voiceData=voiceData;
  const result=calculateResult(session);
  session.debriefing=buildStructuredDebrief(session,result,voiceData);
  $("finalScore").textContent=result.score;
  $("scoreRing").style.background=`conic-gradient(var(--primary) ${result.score*3.6}deg,#173244 0deg)`;
  $("resultTitle").textContent=result.decision;
  $("resultSummary").textContent=`${session.completed.size} de ${session.scenario.goals.length} objetivos completados. Debriefing generado con ${session.debriefing.metrics.voiceUtterances} frases transcritas y ${session.log.length} eventos.`;
  $("decisionBadge").textContent=session.instructorDecision?"Decisión del instructor":"Evaluación automática";
  $("debriefing").innerHTML=renderStructuredDebrief(session.debriefing,session,voiceData);
  $("metricGrid").innerHTML=`<div>Puntuación<br><b>${result.score}</b></div><div>Duración<br><b>${formatTime(session.elapsed)}</b></div><div>Errores críticos<br><b>${session.criticalErrors}</b></div>`;
  bindDebriefNotes();
  view("resultView");
  finishing=false;
}

$("startFlowBtn").addEventListener("click",openSetup);
document.querySelectorAll("[data-go-home]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();view("homeView")}));
$("generatorBtn").addEventListener("click",()=>$("generatorDialog").showModal());
$("programSelect").addEventListener("change",options);
$("difficultySelect").addEventListener("change",options);
$("scenarioSelect").addEventListener("change",preview);

scenarioBrowser=setupScenarioBrowser({
  getFilteredScenarios:filteredScenarios,
  getSelectedId:()=>$("scenarioSelect").value,
  getProgram:()=>$("programSelect").value,
  onSelect:id=>{$("scenarioSelect").value=id;preview()}
});

$("setupForm").addEventListener("submit",event=>{
  event.preventDefault();
  const program=$("programSelect").value;
  const scenario=findScenario(program,$("scenarioSelect").value);
  if(!scenario)return toast("Selecciona un escenario válido.");
  voiceController?.resetSession?.();
  session=createSession(scenario,{program,instructor:$("instructorName").value,team:$("teamName").value,weight:+$("patientWeight").value});
  $("simProgram").textContent=program;
  $("simTitle").textContent=scenario.title;
  $("patientLabel").textContent=scenario.patient;
  $("caseNarrative").textContent=scenario.narrative;
  $("timer").textContent="00:00";
  vitals();goals();actions();log();
  view("simView");
  startTimer();
});

$("pauseBtn").addEventListener("click",()=>{
  if(!session)return;
  session.paused=!session.paused;
  $("pauseBtn").textContent=session.paused?"Reanudar":"Pausar";
  addLog(session,session.paused?"Escenario pausado":"Escenario reanudado");
  log();
});

$("finishBtn").addEventListener("click",finish);
$("newSessionBtn").addEventListener("click",()=>{voiceController?.resetSession?.();session=null;openSetup()});
$("energyRange").addEventListener("input",event=>$("joules").textContent=event.target.value);
$("chargeBtn").addEventListener("click",()=>{charged=true;$("shockBtn").disabled=false;toast("Desfibrilador cargado")});
$("shockBtn").addEventListener("click",()=>{if(charged&&session){charged=false;$("shockBtn").disabled=true;performAction(session,`Desfibrilar a ${$("energyRange").value} J/kg`);vitals();log();toast("Descarga simulada")}});
$("addNoteBtn").addEventListener("click",()=>$("noteDialog").showModal());
$("noteForm").addEventListener("submit",event=>{event.preventDefault();if(session)addLog(session,"NOTA: "+$("noteText").value);$("noteText").value="";$("noteDialog").close();log()});
$("generatorForm").addEventListener("submit",event=>{event.preventDefault();$("generatedScenario").classList.remove("hidden");$("generatedScenario").innerHTML=`<b>${$("genProgram").value} · ${$("genDifficulty").value}</b><br>Paciente: ${$("genPatient").value}<br>Problema: ${$("genProblem").value}<br><br>Objetivos: evaluación primaria, reconocimiento, roles, intervención y reevaluación.`});
$("downloadReportBtn").addEventListener("click",()=>session&&downloadReport(session,calculateResult(session)));
$("printBtn").addEventListener("click",()=>session&&printReport(session,calculateResult(session)));

setupInstructor({getSession:()=>session,onVitals:()=>{vitals();log()},onFinish:finish,onToast:toast});
setupAdvancedControl({getSession:()=>session,render:()=>{vitals();goals();log()},finish,toast});
setupVitalsControl();
setupInstructorUX({openSetup});
voiceController=setupVoiceControl({toast,onTranscript:(text,recognized)=>{if(session&&!recognized){addLog(session,`VOZ ESCUCHADA: ${text}`,"voice");log()}},onRecognized:text=>toast(`Comando de voz: ${text}`)});

options();
startHeroMonitor();
startMonitor(()=>session);
setupPWA();