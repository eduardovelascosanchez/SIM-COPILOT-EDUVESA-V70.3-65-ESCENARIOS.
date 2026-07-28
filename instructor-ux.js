const $=id=>document.getElementById(id);

function openDialog(id){
  const dialog=$(id);
  if(dialog&&!dialog.open)dialog.showModal();
}

function setRoleLabel(label){
  const badge=$("roleBadge");
  if(badge)badge.textContent=label;
}

function updateNetworkStatus(){
  const badge=$("networkStatus");
  if(!badge)return;
  const online=navigator.onLine;
  badge.textContent=online?"En línea":"Sin conexión";
  badge.classList.toggle("online",online);
  badge.classList.toggle("offline",!online);
}

function setupMonitorMode(){
  const button=$("monitorModeBtn");
  if(!button)return;
  button.addEventListener("click",()=>{
    const active=document.body.classList.toggle("monitor-only");
    button.textContent=active?"Salir de modo monitor":"Modo monitor";
    button.setAttribute("aria-pressed",active?"true":"false");
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&document.body.classList.contains("monitor-only")){
      document.body.classList.remove("monitor-only");
      button.textContent="Modo monitor";
      button.setAttribute("aria-pressed","false");
    }
  });
}

function setupRoleButtons(actions){
  $("roleMonitorBtn")?.addEventListener("click",()=>{
    setRoleLabel("Monitor del curso");
    actions.openSetup?.();
  });
  $("roleLocalBtn")?.addEventListener("click",()=>{
    setRoleLabel("Práctica local");
    actions.openSetup?.();
  });
  $("roleInstructorBtn")?.addEventListener("click",()=>{
    setRoleLabel("Instructor remoto");
    $("instructorBtn")?.click();
  });
  $("quickGuideBtn")?.addEventListener("click",()=>openDialog("guideDialog"));
  $("installGuideBtn")?.addEventListener("click",()=>openDialog("installDialog"));
  $("openScenarioLibraryBtn")?.addEventListener("click",()=>actions.openSetup?.());
}

export function setupScenarioBrowser(config){
  const search=$("scenarioSearch"),container=$("scenarioCards"),count=$("scenarioVisibleCount");
  if(!search||!container)return{render:()=>{}};
  function render(){
    const query=search.value.trim().toLowerCase();
    const scenarios=config.getFilteredScenarios();
    const visible=scenarios.filter(item=>{
      const haystack=`${item.title} ${item.patient} ${item.narrative} ${item.difficulty}`.toLowerCase();
      return !query||haystack.includes(query);
    });
    if(count)count.textContent=`${visible.length} escenario${visible.length===1?"":"s"}`;
    if(!visible.length){container.innerHTML='<div class="scenario-empty">No se encontraron escenarios con esos criterios.</div>';return}
    const selected=config.getSelectedId();
    container.innerHTML=visible.map(item=>`<button type="button" class="scenario-card ${item.id===selected?"selected":""}" data-scenario-id="${item.id}"><strong>${item.title}</strong><small>${item.patient}</small><div class="scenario-meta"><span>${item.difficulty}</span><span>${config.getProgram()}</span></div></button>`).join("");
    container.querySelectorAll("[data-scenario-id]").forEach(button=>button.addEventListener("click",()=>{
      config.onSelect(button.dataset.scenarioId);
      render();
    }));
  }
  search.addEventListener("input",render);
  return{render};
}

export function setupInstructorUX(actions={}){
  setupRoleButtons(actions);
  setupMonitorMode();
  updateNetworkStatus();
  window.addEventListener("online",updateNetworkStatus);
  window.addEventListener("offline",updateNetworkStatus);
  document.querySelectorAll("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>button.closest("dialog")?.close()));
  return{setRoleLabel,openDialog};
}