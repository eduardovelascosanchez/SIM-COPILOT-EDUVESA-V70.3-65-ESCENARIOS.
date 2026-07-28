const $=id=>document.getElementById(id);

const CONFIG={
  hr:{input:"manualHr",label:"Frecuencia cardiaca",short:"FC",unit:"lpm",step:5,min:0,max:300,presets:[0,40,60,80,100,120,150,180,220,260]},
  spo2:{input:"manualSpo2",label:"Saturación de oxígeno",short:"SpO₂",unit:"%",step:1,min:0,max:100,presets:[0,50,60,70,80,85,90,94,98,100]},
  rr:{input:"manualRr",label:"Frecuencia respiratoria",short:"FR",unit:"rpm",step:2,min:0,max:100,presets:[0,6,10,15,20,25,30,40,50,60,80]},
  etco2:{input:"manualEtco2",label:"CO₂ al final de la espiración",short:"ETCO₂",unit:"mmHg",step:2,min:0,max:100,presets:[0,5,10,15,20,25,30,35,40,50,60,70]}
};

const BP_PRESETS=[
  [0,0,"Sin pulso"],[45,25,"45/25"],[50,30,"50/30"],[60,35,"60/35"],
  [70,40,"70/40"],[80,45,"80/45"],[90,55,"90/55"],[100,60,"100/60"],
  [110,70,"110/70"],[120,80,"120/80"],[140,90,"140/90"]
];

function clamp(value,min,max){
  const number=Number(value);
  if(!Number.isFinite(number))return min;
  return Math.min(max,Math.max(min,Math.round(number)));
}

function triggerInput(input){
  input.dispatchEvent(new Event("input",{bubbles:true}));
  input.dispatchEvent(new Event("change",{bubbles:true}));
}

function applyNow(){
  const button=$("applyVitalsBtn");
  if(button&&!button.disabled)button.click();
}

function setField(config,value,apply=true){
  const input=$(config.input);
  if(!input)return;
  input.value=clamp(value,config.min,config.max);
  triggerInput(input);
  refreshDisplays();
  if(apply)applyNow();
}

function changeField(key,direction){
  const config=CONFIG[key],input=$(config.input);
  if(!config||!input)return;
  setField(config,(Number(input.value)||0)+(direction*config.step));
}

function setBloodPressure(sys,dia,apply=true){
  const sysInput=$("manualSys"),diaInput=$("manualDia");
  if(!sysInput||!diaInput)return;
  sysInput.value=clamp(sys,0,220);
  diaInput.value=clamp(dia,0,160);
  triggerInput(sysInput);triggerInput(diaInput);
  refreshDisplays();
  if(apply)applyNow();
}

function changeBloodPressure(direction){
  const sys=Number($("manualSys")?.value)||0;
  const dia=Number($("manualDia")?.value)||0;
  setBloodPressure(sys+(direction*5),dia+(direction*3));
}

function vitalCard(key,config){
  const options=config.presets.map(value=>`<option value="${value}">${value} ${config.unit}</option>`).join("");
  return `<article class="vital-control-card" data-vital="${key}">
    <div class="vital-control-heading"><div><small>${config.label}</small><strong>${config.short}</strong></div><span>${config.unit}</span></div>
    <div class="vital-stepper">
      <button type="button" class="vital-step-btn" data-vital-step="${key}" data-direction="-1" aria-label="Disminuir ${config.label}">−</button>
      <output id="quick-${key}-value">—</output>
      <button type="button" class="vital-step-btn" data-vital-step="${key}" data-direction="1" aria-label="Aumentar ${config.label}">+</button>
    </div>
    <label class="vital-preset-label">Valor preseleccionado
      <select data-vital-preset="${key}"><option value="">Seleccionar…</option>${options}</select>
    </label>
    <p class="vital-step-note">Cambio rápido: ±${config.step} ${config.unit}</p>
  </article>`;
}

function injectPanel(){
  const controls=$("instructorControls");
  if(!controls||$("quickVitalsPanel"))return;
  const panel=document.createElement("section");
  panel.id="quickVitalsPanel";
  panel.className="quick-vitals-panel";
  panel.innerHTML=`
    <div class="heading">
      <div><p class="eyebrow">CONTROL RÁPIDO DEL MONITOR</p><h3>Subir, bajar o preseleccionar signos vitales</h3></div>
      <span class="chip">Aplicación inmediata</span>
    </div>
    <p class="muted">Cada botón o preselección actualiza inmediatamente el monitor local o el monitor enlazado al dispositivo del instructor.</p>
    <div class="quick-vitals-grid">${Object.entries(CONFIG).map(([key,config])=>vitalCard(key,config)).join("")}
      <article class="vital-control-card bp-control-card">
        <div class="vital-control-heading"><div><small>Presión arterial no invasiva</small><strong>TA</strong></div><span>mmHg</span></div>
        <div class="vital-stepper">
          <button type="button" class="vital-step-btn" data-bp-direction="-1" aria-label="Disminuir presión arterial">−</button>
          <output id="quick-bp-value">—/—</output>
          <button type="button" class="vital-step-btn" data-bp-direction="1" aria-label="Aumentar presión arterial">+</button>
        </div>
        <label class="vital-preset-label">TA preseleccionada
          <select id="bpPreset"><option value="">Seleccionar…</option>${BP_PRESETS.map(([sys,dia,label])=>`<option value="${sys}/${dia}">${label} mmHg</option>`).join("")}</select>
        </label>
        <p class="vital-step-note">Cambio rápido: ±5/3 mmHg</p>
      </article>
    </div>
    <div class="quick-vitals-actions">
      <button id="applyQuickVitalsBtn" type="button" class="btn primary">Aplicar todos los valores</button>
      <button id="syncQuickVitalsBtn" type="button" class="btn">Actualizar lectura</button>
    </div>`;
  const manualGrid=controls.querySelector(".grid3");
  controls.insertBefore(panel,manualGrid||controls.firstChild);
}

function refreshDisplays(){
  Object.entries(CONFIG).forEach(([key,config])=>{
    const output=$(`quick-${key}-value`),input=$(config.input);
    if(output&&input)output.textContent=`${input.value||0}`;
  });
  const bp=$("quick-bp-value"),sys=$("manualSys"),dia=$("manualDia");
  if(bp&&sys&&dia)bp.textContent=`${sys.value||0}/${dia.value||0}`;
}

function bindControls(){
  document.querySelectorAll("[data-vital-step]").forEach(button=>button.addEventListener("click",()=>changeField(button.dataset.vitalStep,Number(button.dataset.direction))));
  document.querySelectorAll("[data-vital-preset]").forEach(select=>select.addEventListener("change",()=>{
    if(select.value!=="")setField(CONFIG[select.dataset.vitalPreset],Number(select.value));
    select.value="";
  }));
  document.querySelectorAll("[data-bp-direction]").forEach(button=>button.addEventListener("click",()=>changeBloodPressure(Number(button.dataset.bpDirection))));
  $("bpPreset")?.addEventListener("change",event=>{
    if(!event.target.value)return;
    const [sys,dia]=event.target.value.split("/").map(Number);
    setBloodPressure(sys,dia);
    event.target.value="";
  });
  $("applyQuickVitalsBtn")?.addEventListener("click",applyNow);
  $("syncQuickVitalsBtn")?.addEventListener("click",refreshDisplays);
  ["manualHr","manualSpo2","manualSys","manualDia","manualRr","manualEtco2"].forEach(id=>$(id)?.addEventListener("input",refreshDisplays));
}

export function setupVitalsControl(){
  injectPanel();
  bindControls();
  refreshDisplays();
  const dialog=$("instructorDialog");
  dialog?.addEventListener("toggle",refreshDisplays);
  setInterval(()=>{
    if(dialog?.open)refreshDisplays();
  },500);
  return{refresh:refreshDisplays,setField,setBloodPressure};
}
