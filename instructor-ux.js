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

function expandScenarioLibrary(){
  const container=$("scenarioCards"),toggle=$("scenarioToggleBtn");
  container?.classList.remove("is-collapsed");
  if(toggle){toggle.textContent="Ocultar escenarios";toggle.setAttribute("aria-expanded","true")}
}

function setupRoleButtons(actions){
  $("roleMonitorBtn")?.addEventListener("click",()=>{
    setRoleLabel("Monitor del curso");
    actions.openSetup?.();
    setTimeout(expandScenarioLibrary,0);
  });
  $("roleLocalBtn")?.addEventListener("click",()=>{
    setRoleLabel("Práctica local");
    actions.openSetup?.();
    setTimeout(expandScenarioLibrary,0);
  });
  $("roleInstructorBtn")?.addEventListener("click",()=>{
    setRoleLabel("Instructor remoto");
    $("instructorBtn")?.click();
  });
  $("quickGuideBtn")?.addEventListener("click",()=>openDialog("guideDialog"));
  $("installGuideBtn")?.addEventListener("click",()=>openDialog("installDialog"));
  $("openScenarioLibraryBtn")?.addEventListener("click",()=>{
    actions.openSetup?.();
    setTimeout(()=>{
      expandScenarioLibrary();
      $("scenarioSearch")?.focus();
    },0);
  });
}

function applyUrlAction(actions){
  const params=new URLSearchParams(location.search);
  if(params.get("instructor")==="1")setRoleLabel("Instructor remoto");
  if(params.get("action")==="setup"){
    setRoleLabel("Monitor del curso");
    setTimeout(()=>{
      actions.openSetup?.();
      expandScenarioLibrary();
    },120);
  }
}

function normalize(value=""){
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

export function setupScenarioBrowser(config){
  const search=$("scenarioSearch");
  const container=$("scenarioCards");
  const count=$("scenarioVisibleCount");
  const toggle=$("scenarioToggleBtn");
  if(!search||!container)return{render:()=>{},expand:()=>{}};

  let collapsed=false;

  function setCollapsed(next){
    collapsed=!!next;
    container.classList.toggle("is-collapsed",collapsed);
    if(toggle){
      toggle.textContent=collapsed?"Mostrar escenarios":"Ocultar escenarios";
      toggle.setAttribute("aria-expanded",collapsed?"false":"true");
    }
  }

  function render(){
    const query=normalize(search.value.trim());
    const source=config.getFilteredScenarios?.();
    const scenarios=Array.isArray(source)?source:[];
    const visible=scenarios.filter(item=>{
      const haystack=normalize(`${item.title} ${item.patient} ${item.narrative} ${item.difficulty} ${config.getProgram?.()||""}`);
      return !query||haystack.includes(query);
    });

    if(count)count.textContent=`${visible.length} de ${scenarios.length} escenarios`;

    if(!visible.length){
      container.innerHTML='<div class="scenario-empty">No se encontraron escenarios. Selecciona “Todas” las dificultades o borra la búsqueda.</div>';
      return;
    }

    const selected=config.getSelectedId?.();
    container.innerHTML=visible.map(item=>`<button type="button" class="scenario-card ${item.id===selected?"selected":""}" data-scenario-id="${item.id}" aria-pressed="${item.id===selected?"true":"false"}"><strong>${item.title}</strong><small>${item.patient}</small><p>${item.narrative}</p><div class="scenario-meta"><span>${item.difficulty}</span><span>${config.getProgram?.()||""}</span></div></button>`).join("");

    container.querySelectorAll("[data-scenario-id]").forEach(button=>button.addEventListener("click",()=>{
      config.onSelect?.(button.dataset.scenarioId);
      container.querySelectorAll(".scenario-card").forEach(card=>{
        const active=card===button;
        card.classList.toggle("selected",active);
        card.setAttribute("aria-pressed",active?"true":"false");
      });
    }));
  }

  search.addEventListener("input",render);
  toggle?.addEventListener("click",()=>setCollapsed(!collapsed));
  setCollapsed(false);

  return{render,expand:()=>setCollapsed(false),collapse:()=>setCollapsed(true)};
}

export function setupInstructorUX(actions={}){
  setupRoleButtons(actions);
  setupMonitorMode();
  updateNetworkStatus();
  applyUrlAction(actions);
  window.addEventListener("online",updateNetworkStatus);
  window.addEventListener("offline",updateNetworkStatus);
  document.querySelectorAll("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>button.closest("dialog")?.close()));
  return{setRoleLabel,openDialog};
}