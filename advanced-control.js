import{addLog}from"./clinical-engine.js";
import{buildSequence,currentPhase,advancePhase,injectScenarioError,injectScenarioTrick,sessionSnapshot}from"./algorithms.js";
import{setupRemoteControl}from"./remote-control.js";

const $=id=>document.getElementById(id);

function injectUi(){
  if(!$("remoteSessionBtn")){
    const btn=document.createElement("button");
    btn.id="remoteSessionBtn";
    btn.className="btn";
    btn.type="button";
    btn.textContent="Instructor remoto";
    const voice=$("voiceBtn");
    voice?.parentElement?.insertBefore(btn,voice);
  }

  if(!$("facilitatorBar")){
    const bar=document.createElement("div");
    bar.id="facilitatorBar";
    bar.className="facilitator-bar hidden";
    bar.innerHTML='<span><b>Control instructor</b> · fase <span id="quickPhaseCount">1/1</span></span><div><button id="quickAdvanceBtn" class="btn primary" type="button">Avanzar fase</button><button id="quickErrorBtn" class="btn danger" type="button">Error crítico</button><button id="quickTrickBtn" class="btn warning" type="button">Evento / truco</button></div>';
    const grid=document.querySelector("#simView .simgrid");
    grid?.parentElement?.insertBefore(bar,grid);
  }

  if(!$("algorithmCard")){
    const patient=document.querySelector("#simView .simgrid > aside.panel.form");
    const card=document.createElement("div");
    card.id="algorithmCard";
    card.className="algorithm-card";
    card.innerHTML='<div class="heading"><span class="eyebrow">SECUENCIA ACTUAL</span><span id="phaseCount" class="chip">1/1</span></div><h3 id="phaseTitle">Valoración inicial</h3><p id="phaseInstruction"></p><div id="phasePrompt" class="algorithm-prompt"></div>';
    patient?.insertBefore(card,$("goalCount")?.parentElement||null);
  }

  const controls=$("instructorControls");
  if(controls&&!$("remoteControlBox")){
    const box=document.createElement("section");
    box.id="remoteControlBox";
    box.className="remote-box";
    box.innerHTML=`
      <div class="heading">
        <div><p class="eyebrow">DOS DISPOSITIVOS</p><h3>Conexión remota</h3></div>
        <span id="remoteStatus" class="chip">Sin conectar</span>
      </div>
      <div id="remoteBrowserWarning" class="remote-warning hidden"></div>
      <div id="monitorRemoteSetup" class="remote-step">
        <p class="remote-step-number">1</p>
        <div>
          <h4>Dispositivo del monitor</h4>
          <p class="muted">Inicia el escenario en la pantalla principal y pulsa el botón. El código solo existe mientras esa pantalla permanece abierta.</p>
          <button id="createRemoteRoomBtn" type="button" class="btn primary">Crear sesión en monitor</button>
          <button id="copyRemoteLinkBtn" type="button" class="btn" disabled>Compartir enlace del instructor</button>
          <div class="remote-code"><small>Código generado</small><b id="remoteRoomCode">—</b></div>
        </div>
      </div>
      <div id="instructorRemoteSetup" class="remote-step">
        <p class="remote-step-number">2</p>
        <div>
          <h4>Dispositivo del instructor</h4>
          <p class="muted">Escribe exactamente el código generado por el monitor. Debe tener el formato <b>SIM-AB12CD</b>; no escribas nombres como “EduvesaSim”.</p>
          <label>Código de la sesión
            <input id="remoteRoomInput" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="10" placeholder="SIM-AB12CD">
          </label>
          <button id="connectRemoteBtn" type="button" class="btn">Conectar al monitor</button>
          <p id="remoteHelp" class="remote-help">Primero crea la sesión en el dispositivo principal.</p>
        </div>
      </div>`;
    controls.prepend(box);

    const seq=document.createElement("section");
    seq.className="instructor-sequence";
    seq.innerHTML='<div class="heading"><div><p class="eyebrow">SECUENCIA DEL CASO</p><h3 id="instructorPhaseTitle">Sin escenario activo</h3></div><span id="instructorPhaseCount" class="chip">0/0</span></div><p id="instructorPhaseInstruction" class="muted"></p><p><button id="advancePhaseBtn" type="button" class="btn primary">Avanzar fase</button> <button id="scenarioErrorBtn" type="button" class="btn danger">Error crítico</button> <button id="scenarioTrickBtn" type="button" class="btn warning">Evento / truco</button></p>';
    box.after(seq);
  }
}

export function setupAdvancedControl(api){
  injectUi();
  let lastSession=null;
  let autoConnectStarted=false;

  function ensureSequence(session){
    if(!session)return;
    if(!session.sequence||!session.sequence.length){
      session.sequence=buildSequence(session.scenario,session.meta?.program);
      session.phaseIndex=0;
      session.trickIndex=0;
      addLog(session,`SECUENCIA INICIADA: ${currentPhase(session)?.title||"Valoración"}`,"phase");
    }
  }

  function renderPhase(snapshot=null){
    const session=api.getSession();
    if(session)ensureSequence(session);
    const phase=session?currentPhase(session):snapshot?.phase;
    const index=session?(session.phaseIndex||0):(snapshot?.phaseIndex||0);
    const count=session?(session.sequence?.length||0):(snapshot?.phaseCount||0);
    if($("phaseTitle"))$("phaseTitle").textContent=phase?.title||"Sin fase";
    if($("phaseInstruction"))$("phaseInstruction").textContent=phase?.instruction||"";
    if($("phasePrompt"))$("phasePrompt").textContent=phase?.prompt||"";
    if($("phaseCount"))$("phaseCount").textContent=count?`${index+1}/${count}`:"0/0";
    if($("quickPhaseCount"))$("quickPhaseCount").textContent=count?`${index+1}/${count}`:"0/0";
    if($("instructorPhaseTitle"))$("instructorPhaseTitle").textContent=phase?.title||"Sin escenario activo";
    if($("instructorPhaseInstruction"))$("instructorPhaseInstruction").textContent=phase?.instruction||"";
    if($("instructorPhaseCount"))$("instructorPhaseCount").textContent=count?`${index+1}/${count}`:"0/0";
  }

  function populateRemote(snapshot){
    const vitals=snapshot?.vitals||{};
    [["manualHr","hr"],["manualSpo2","spo2"],["manualSys","sys"],["manualDia","dia"],["manualRr","rr"],["manualEtco2","etco2"]].forEach(([id,key])=>{
      if($(id))$(id).value=vitals[key]??0;
    });
    if($("rhythmSelect"))$("rhythmSelect").value=vitals.rhythm||"Sinusal";
    if($("decisionSelect"))$("decisionSelect").value=snapshot?.instructorDecision||"";
    renderPhase(snapshot);
    if($("toggleDeteriorationBtn"))$("toggleDeteriorationBtn").textContent=snapshot?.deterioration?"Detener deterioro":"Iniciar deterioro";
  }

  function renderAndSend(){
    api.render();
    renderPhase();
    const session=api.getSession();
    if(session)remote.sendSnapshot(sessionSnapshot(session));
  }

  function setRhythm(session,rhythm){
    session.vitals.rhythm=rhythm;
    if(["Asistolia","FV"].includes(rhythm))Object.assign(session.vitals,{hr:0,sys:0,dia:0});
    else if(rhythm==="AESP")Object.assign(session.vitals,{hr:70,sys:0,dia:0});
    else if(rhythm==="TSV")session.vitals.hr=220;
    else if(rhythm==="TV")session.vitals.hr=190;
    else if(rhythm==="Bradicardia")session.vitals.hr=50;
    else if(rhythm==="Sinusal"&&session.vitals.hr<60)session.vitals.hr=110;
  }

  function command(name,payload={}){
    if(remote.isRemoteInstructor())return remote.sendCommand(name,payload)||api.toast("El instructor remoto no está conectado.");
    const session=api.getSession();
    if(!session)return api.toast("No hay un escenario activo en el monitor.");
    ensureSequence(session);
    if(name==="setVitals"){
      Object.assign(session.vitals,payload);
      addLog(session,"Instructor modificó FC, SpO₂, TA, FR y ETCO₂","instructor");
    }
    if(name==="setRhythm"){
      setRhythm(session,payload.rhythm);
      addLog(session,`Ritmo activado: ${payload.rhythm}`,"instructor");
    }
    if(name==="toggleDeterioration"){
      session.deterioration=!session.deterioration;
      addLog(session,session.deterioration?"Deterioro iniciado":"Deterioro detenido","instructor");
    }
    if(name==="manualCriticalError"){
      session.criticalErrors++;
      addLog(session,`ERROR CRÍTICO: ${payload.message}`,"critical");
    }
    if(name==="setDecision"){
      session.instructorDecision=payload.decision||"";
      addLog(session,`Decisión del instructor: ${payload.decision||"Automática"}`,"instructor");
    }
    if(name==="advancePhase"){
      const phase=advancePhase(session);
      addLog(session,`FASE AVANZADA: ${phase?.title||"fase final"}`,"phase");
      api.toast(phase?.title||"Fase final");
    }
    if(name==="scenarioError"){
      const message=injectScenarioError(session);
      addLog(session,`ERROR / EVOLUCIÓN DESFAVORABLE: ${message}`,"critical");
      api.toast("Se activó deterioro por error");
    }
    if(name==="scenarioTrick"){
      const event=injectScenarioTrick(session);
      addLog(session,`EVENTO SORPRESA: ${event}`,"trick");
      api.toast("Evento sorpresa activado");
    }
    if(name==="finish"){
      api.finish();
      return;
    }
    renderAndSend();
  }

  const remote=setupRemoteControl({
    onCommand:(name,payload)=>command(name,payload),
    onSnapshot:populateRemote,
    onRequestSnapshot:renderAndSend,
    onNotice:message=>{
      api.toast(message);
      if($("remoteBrowserWarning")&&/Safari|Chrome|WhatsApp|navegador interno/i.test(message)){
        $("remoteBrowserWarning").textContent=message;
        $("remoteBrowserWarning").classList.remove("hidden");
      }
    },
    onStatus:(text,state)=>{
      if($("connectionBadge"))$("connectionBadge").textContent=state==="connected"?"Remoto conectado":text.includes("Esperando")?"Esperando instructor":"Local";
      if($("remoteHelp"))$("remoteHelp").textContent=text;
      if($("connectRemoteBtn"))$("connectRemoteBtn").disabled=state==="pending"||state==="connected";
      if(state==="connected"&&api.getSession())api.toast("Instructor remoto conectado");
    },
    onRoom:id=>{
      api.toast(`Código remoto: ${id}`);
      if($("copyRemoteLinkBtn"))$("copyRemoteLinkBtn").disabled=false;
      if($("remoteHelp"))$("remoteHelp").textContent="Comparte el enlace o escribe este código en el segundo dispositivo. Mantén el monitor abierto.";
      renderAndSend();
    }
  });

  if(remote.instructorMode){
    $("monitorRemoteSetup")?.classList.add("hidden");
    if($("remoteHelp"))$("remoteHelp").textContent="Desbloquea el panel. La aplicación conectará automáticamente con el código del enlace.";
  }

  $("remoteSessionBtn").onclick=()=>$("instructorBtn").click();
  $("createRemoteRoomBtn").onclick=()=>api.getSession()?remote.createMonitorRoom():api.toast("Inicia primero un escenario en el monitor.");
  $("connectRemoteBtn").onclick=()=>remote.connectInstructor($("remoteRoomInput").value);
  $("copyRemoteLinkBtn").onclick=async()=>api.toast(await remote.shareInstructorLink()?"Enlace listo para compartir":"Primero crea una sesión remota");

  $("remoteRoomInput")?.addEventListener("input",event=>{
    event.target.value=event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,10);
    if($("connectRemoteBtn"))$("connectRemoteBtn").disabled=false;
  });
  $("remoteRoomInput")?.addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();remote.connectInstructor(event.currentTarget.value)}
  });

  $("advancePhaseBtn").onclick=()=>command("advancePhase");
  $("scenarioErrorBtn").onclick=()=>command("scenarioError");
  $("scenarioTrickBtn").onclick=()=>command("scenarioTrick");
  $("quickAdvanceBtn").onclick=()=>command("advancePhase");
  $("quickErrorBtn").onclick=()=>command("scenarioError");
  $("quickTrickBtn").onclick=()=>command("scenarioTrick");

  const localApply=$("applyVitalsBtn").onclick;
  $("applyVitalsBtn").onclick=()=>remote.isRemoteInstructor()?command("setVitals",{hr:+$("manualHr").value,spo2:+$("manualSpo2").value,sys:+$("manualSys").value,dia:+$("manualDia").value,rr:+$("manualRr").value,etco2:+$("manualEtco2").value,rhythm:$("rhythmSelect").value}):localApply?.();
  const localRhythm=$("rhythmSelect").onchange;
  $("rhythmSelect").onchange=event=>remote.isRemoteInstructor()?command("setRhythm",{rhythm:event.target.value}):localRhythm?.call($("rhythmSelect"),event);
  const localDeterioration=$("toggleDeteriorationBtn").onclick;
  $("toggleDeteriorationBtn").onclick=event=>remote.isRemoteInstructor()?command("toggleDeterioration"):localDeterioration?.call(event.currentTarget,event);
  const localDecision=$("decisionSelect").onchange;
  $("decisionSelect").onchange=event=>remote.isRemoteInstructor()?command("setDecision",{decision:event.target.value}):localDecision?.call($("decisionSelect"),event);
  const localFinish=$("instructorFinishBtn").onclick;
  $("instructorFinishBtn").onclick=event=>remote.isRemoteInstructor()?command("finish"):localFinish?.call(event.currentTarget,event);

  $("unlockBtn").addEventListener("click",()=>setTimeout(()=>{
    if($("instructorControls").classList.contains("hidden"))return;
    if(api.getSession())$("facilitatorBar").classList.remove("hidden");
    if(remote.instructorMode&&remote.autoRoom&&!autoConnectStarted){
      autoConnectStarted=true;
      remote.connectInstructor(remote.autoRoom);
    }
  },100));

  setInterval(()=>{
    const session=api.getSession();
    if(session!==lastSession){
      lastSession=session;
      if(session){ensureSequence(session);renderAndSend()}
    }else if(session){
      renderPhase();
      remote.sendSnapshot(sessionSnapshot(session));
    }
  },1000);

  if(remote.instructorMode)setTimeout(()=>{
    $("instructorBtn").click();
    api.toast("Introduce el PIN. La conexión con el monitor se iniciará automáticamente.");
  },350);

  return{command,renderPhase,populateRemote};
}