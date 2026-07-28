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
  scenarioBrowser?.expand?.();
  scenarioBrowser?.render?.();
}

function toast(message){
  const element=$("toast");
  if(!element)return;
  element.textContent=message;
  element.classList.add("show");
  setTimeout(()=>element.classList.remove("show"),2400);
}

function filteredScenarios(){
  const program=$("programSelect")?.value||"PALS";
  const difficulty=$("difficultySelect")?.value||"Todas";
  const all=getScenarios(program)||[];
  if(difficulty==="Todas")return all;
  const filtered=all.filter(item=>item.difficulty===difficulty);
  return filtered.length?filtered:all;
}

function options(){
  const select=$("scenarioSelect");
  if(!select)return;
  const scenarios=filteredScenarios();
  const previous=select.value;
  select.innerHTML=scenarios.map(item=>`<option value="${item.id}">${item.title}</option>`).join("");
  if(scenarios.some(item=>item.id===previous))select.value=previous;
  preview();
  scenarioBrowser?.render?.();
}

function preview(){
  const program=$("programSelect")?.value||"PALS";
  const selected=$("scenarioSelect")?.value;
  const scenario=findScenario(program,selected);
  if(!scenario)return;
  if($("scenarioPreview"))$("scenarioPreview").innerHTML=`<b>${scenario.title}</b><br>${scenario.patient}<br><span class="muted">${scenario.narrative}</span>`;
  if($("patientWeight"))$("patientWeight").value=scenario.weight;
  scenarioBrowser?.render?.();
}

function vitals(){
  if(!session)return;
  const values=session.vitals;
  if($("hrValue"))$("hrValue").textContent=values.hr;
  if($("hrBottom"))$("hrBottom").textContent=values.hr;
  if($("spo2Value"))$("spo2Value").textContent=values.spo2;
  if($("spo2Bottom"))$("spo2Bottom").textContent=values.spo2;
  if($("bpValue"))$("bpValue").textContent=values.sys?`${values.sys}/${values.dia}`:"—/—";
  if($("rrValue"))$("rrValue").textContent=values.rr;
  if($("etco2Value"))$("etco2Value").textContent=values.etco2;
  if($("etco2Bottom"))$("etco2Bottom").textContent=values.etco2;
  if($("rhythmLabel"))$("rhythmLabel").textContent=values.rhythm;
}

function goals(){
  if(!session)return;
  const items=session.scenario.goals;
  if($("goalCount"))$("goalCount").textContent=`${session.completed.size}/${items.length}`;
  if($("goalProgress"))$("goalProgress").value=session.completed.size/items.length*100;
  if($("goalList"))$("goalList").innerHTML=items.map(item=>`<div class="goal ${session.completed.has(item)?"done":""}">${session.completed.has(item)?"✓ ":""}${item}</div>`).join("");
}

function log(){
  if(!session||!$("logList"))return;
  $("logList").innerHTML=session.log.map(item=>`<div><b>${item.time}</b><br>${item.action}</div>`).join("");
}

function actions(){
  const container=$("interventionGrid");
  if(!session||!container)return;
  container.innerHTML=session.scenario.actions.map(action=>`<button class="btn action" data-a="${action}">${action}</button>`).join("");
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
    if(!session)return;
    tickSession(session);
    if($("timer"))$("timer").textContent=formatTime(session.elapsed);
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
  if($("finalScore"))$("finalScore").textContent=result.score;
  if($("scoreRing"))$("scoreRing").style.background=`conic-gradient(var(--primary) ${result.score*3.6}deg,#173244 0deg)`;
  if($("resultTitle"))$("resultTitle").textContent=result.decision;
  if($("resultSummary"))$("resultSummary").textContent=`${session.completed.size} de ${session.scenario.goals.length} objetivos completados. Debriefing generado con ${session.debriefing.metrics.voiceUtterances} frases transcritas y ${session.log.length} eventos.`;
  if($("decisionBadge"))$("decisionBadge").textContent=session.instructorDecision?"Decisión del instructor":"Evaluación automática";
  if($("debriefing"))$("debriefing").innerHTML=renderStructuredDebrief(session.debriefing,session,voiceData);
  if($("metricGrid"))$("metricGrid").innerHTML=`<div>Puntuación<br><b>${result.score}</b></div><div>Duración<br><b>${formatTime(session.elapsed)}</b></div><div>Errores críticos<br><b>${session.criticalErrors}</b></div>`;
  bindDebriefNotes();
  view("resultView");
  finishing=false;
}

$("startFlowBtn")?.addEventListener("click",openSetup);
document.querySelectorAll("[data-go-home]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();view("homeView")}));
$("generatorBtn")?.addEventListener("click",()=>$("generatorDialog")?.showModal());
$("programSelect")?.addEventListener("change",options);
$("difficultySelect")?.addEventListener("change",options);
$("scenarioSelect")?.addEventListener("change",preview);

scenarioBrowser=setupScenarioBrowser({
  getFilteredScenarios:filteredScenarios,
  getSelectedId:()=>$("scenarioSelect")?.value||"",
  getProgram:()=>$("programSelect")?.value||"PALS",
  onSelect:id=>{if($("scenarioSelect"))$("scenarioSelect").value=id;preview()}
});

$("setupForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  const program=$("programSelect")?.value||"PALS";
  const scenario=findScenario(program,$("scenarioSelect")?.value);
  if(!scenario)return toast("Selecciona un escenario válido.");
  voiceController?.resetSession?.();
  session=createSession(scenario,{program,instructor:$("instructorName")?.value||"",team:$("teamName")?.value||"",weight:+($("patientWeight")?.value||scenario.weight)});
  if($("simProgram"))$("simProgram").textContent=program;
  if($("simTitle"))$("simTitle").textContent=scenario.title;
  if($("patientLabel"))$("patientLabel").textContent=scenario.patient;
  if($("caseNarrative"))$("caseNarrative").textContent=scenario.narrative;
  if($("timer"))$("timer").textContent="00:00";
  vitals();goals();actions();log();
  view("simView");
  startTimer();
});

$("pauseBtn")?.addEventListener("click",()=>{
  if(!session)return;
  session.paused=!session.paused;
  $("pauseBtn").textContent=session.paused?"Reanudar":"Pausar";
  addLog(session,session.paused?"Escenario pausado":"Escenario reanudado");
  log();
});

$("finishBtn")?.addEventListener("click",finish);
$("newSessionBtn")?.addEventListener("click",()=>{voiceController?.resetSession?.();session=null;openSetup()});
$("energyRange")?.addEventListener("input",event=>{if($("joules"))$("joules").textContent=event.target.value});
$("chargeBtn")?.addEventListener("click",()=>{charged=true;if($("shockBtn"))$("shockBtn").disabled=false;toast("Desfibrilador cargado")});
$("shockBtn")?.addEventListener("click",()=>{if(charged&&session){charged=false;$("shockBtn").disabled=true;performAction(session,`Desfibrilar a ${$("energyRange")?.value||2} J/kg`);vitals();log();toast("Descarga simulada")}});
$("addNoteBtn")?.addEventListener("click",()=>$("noteDialog")?.showModal());
$("noteForm")?.addEventListener("submit",event=>{event.preventDefault();if(session)addLog(session,"NOTA: "+($("noteText")?.value||""));if($("noteText"))$("noteText").value="";$("noteDialog")?.close();log()});
$("generatorForm")?.addEventListener("submit",event=>{event.preventDefault();if($("generatedScenario")){ $("generatedScenario").classList.remove("hidden");$("generatedScenario").innerHTML=`<b>${$("genProgram")?.value||""} · ${$("genDifficulty")?.value||""}</b><br>Paciente: ${$("genPatient")?.value||""}<br>Problema: ${$("genProblem")?.value||""}<br><br>Objetivos: evaluación primaria, reconocimiento, roles, intervención y reevaluación.` }});
$("downloadReportBtn")?.addEventListener("click",()=>session&&downloadReport(session,calculateResult(session)));
$("printBtn")?.addEventListener("click",()=>session&&printReport(session,calculateResult(session)));

setupInstructor({getSession:()=>session,onVitals:()=>{vitals();log()},onFinish:finish,onToast:toast});
setupAdvancedControl({getSession:()=>session,render:()=>{vitals();goals();log()},finish,toast});
setupVitalsControl();
setupInstructorUX({openSetup});
voiceController=setupVoiceControl({toast,onTranscript:(text,recognized)=>{if(session&&!recognized){addLog(session,`VOZ ESCUCHADA: ${text}`,"voice");log()}},onRecognized:text=>toast(`Comando de voz: ${text}`)});

options();
startHeroMonitor();
startMonitor(()=>session);
setupPWA();