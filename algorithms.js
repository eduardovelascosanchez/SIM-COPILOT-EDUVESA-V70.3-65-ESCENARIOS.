const phase=(title,instruction,prompt="",vitals={})=>({title,instruction,prompt,vitals});

function nrpSequence(){
  return [
    phase("Preparación prenatal","Realizar asesoramiento prenatal, reunión informativa del equipo, asignación de funciones y comprobación del equipo.","Confirmar plan de manejo del cordón umbilical."),
    phase("Nacimiento y evaluación rápida","Iniciar el plan del cordón. Valorar: ¿gestación a término?, ¿buen tono?, ¿respira o llora?","Si todas son sí: piel con piel, atención de rutina, temperatura normal y evaluación continuada."),
    phase("Pasos iniciales dentro del primer minuto","Calentar y mantener temperatura normal, secar, posicionar, estimular y despejar la vía aérea solo si es necesario.","Reevaluar respiración y frecuencia cardiaca."),
    phase("Decisión respiratoria y FC","Determinar si existe jadeo, boqueo, apnea o FC menor de 100/min.","Si hay dificultad respiratoria o cianosis persistente con FC ≥100: pulsioxímetro, oxígeno si es necesario y considerar CPAP."),
    phase("Ventilación a presión positiva","Administrar ventilaciones, colocar pulsioxímetro y considerar monitor cardiaco.","La prioridad es obtener movimiento torácico y aumento de la FC.",{spo2:65,hr:90,rr:20,etco2:18}),
    phase("Acciones correctivas de ventilación","Si la FC sigue menor de 100/min, realizar acciones correctivas; considerar intubación o mascarilla laríngea y utilizar monitor cardiaco.","No avanzar a compresiones hasta confirmar ventilación efectiva.",{spo2:72,hr:80,rr:24,etco2:22}),
    phase("FC menor de 60/min","Con ventilación efectiva y FC menor de 60/min: intubar o colocar mascarilla laríngea, iniciar compresiones torácicas coordinadas 3:1, usar oxígeno al 100% y obtener acceso CVU o IO.","Reevaluar FC después de compresiones coordinadas y ventilación.",{spo2:62,hr:50,sys:45,dia:25,rr:0,etco2:14,rhythm:"Bradicardia"}),
    phase("Adrenalina y causas reversibles","Si la FC permanece menor de 60/min: administrar adrenalina por CVU o IO cada 3 a 5 minutos; considerar hipovolemia y neumotórax.","Continuar ventilación efectiva y compresiones mientras se corrigen causas.",{spo2:70,hr:75,sys:52,dia:30,rr:12,etco2:20,rhythm:"Bradicardia"}),
    phase("Cuidados posreanimación","Mantener temperatura y glucosa, titular oxígeno por objetivos preductales, vigilar respiración y perfusión, comunicar con la familia y realizar debriefing del equipo.","Objetivos de SpO₂: 2 min 65–70%; 3 min 70–75%; 4 min 75–80%; 5 min 80–85%; 10 min 85–95%.",{spo2:90,hr:130,sys:65,dia:40,rr:40,etco2:35,rhythm:"Sinusal"})
  ];
}

function respiratorySequence(s){
  const id=s.id.toLowerCase();
  let specific="Aplicar tratamiento específico según el tipo de insuficiencia respiratoria.";
  if(id.includes("croup")) specific="Para crup: adrenalina nebulizada y corticosteroide; evitar agitar al paciente.";
  else if(id.includes("anaphyl")) specific="Para anafilaxia: adrenalina IM, oxígeno, acceso IV/IO y líquidos con reevaluación.";
  else if(id.includes("asthma")) specific="Para asma: albuterol y corticosteroide; reconocer fatiga o tórax silencioso.";
  else if(id.includes("bronchiol")) specific="Para bronquiolitis: aspiración cuando esté indicada y soporte respiratorio; considerar estudios adicionales según el caso.";
  else if(id.includes("fbao")) specific="Para obstrucción por cuerpo extraño: maniobras de desobstrucción apropiadas y RCP si pierde respuesta.";
  return [
    phase("Liderazgo y valoración primaria","Asignar funciones, usar comunicación efectiva y dirigir valoración de vía aérea, respiración, circulación, discapacidad y exposición, incluidos signos vitales."),
    phase("Oxigenación y monitorización","Administrar oxígeno según necesidad, colocar monitor cardiaco y pulsioxímetro.","La TA debe registrarse y reevaluarse junto con FC, SpO₂ y FR."),
    phase("Reconocer el problema respiratorio","Identificar signos del tipo de enfermedad respiratoria y clasificar como dificultad respiratoria o insuficiencia respiratoria."),
    phase("Tratamiento específico",specific),
    phase("Soporte ventilatorio","Declarar indicaciones para ventilación con bolsa-mascarilla y para soporte adicional de vía aérea o ventilación.","Verificar que la ventilación sea efectiva."),
    phase("Acceso y reevaluación","Obtener acceso IV o IO cuando corresponda y reevaluar la respuesta después de cada tratamiento."),
    phase("Escalamiento y debriefing","Solicitar apoyo experto para vía aérea avanzada o ventilación mecánica cuando esté indicado y revisar los puntos críticos del caso.")
  ];
}

function shockSequence(s){
  const id=s.id.toLowerCase();
  let fluid="Administrar cristaloide isotónico con reevaluación frecuente.";
  let cause="Tratar la causa del choque y definir objetivos terapéuticos.";
  if(id.includes("cardiogenic")||id.includes("myocard")){
    fluid="Administrar lentamente 5–10 mL/kg de cristaloide isotónico en 10–20 minutos; detener si empeoran estertores, hepatomegalia o dificultad respiratoria.";
    cause="Solicitar cardiología y considerar fármacos inotrópicos o vasoactivos.";
  }else if(id.includes("obstruct")||id.includes("pneumo")||id.includes("tampon")){
    fluid="Si es necesario, administrar 5–20 mL/kg de cristaloide isotónico en 10–20 minutos.";
    cause="Aplicar tratamiento causal inmediato: descompresión del neumotórax, manejo de taponamiento u otra causa obstructiva; usar DOPE si el paciente intubado se deteriora.";
  }else if(id.includes("septic")||id.includes("distribut")||id.includes("mening")){
    fluid="Administrar 10–20 mL/kg de cristaloide isotónico con reevaluación cuidadosa; iniciar vasoactivo en choque refractario a líquidos.";
    cause="Administrar antibióticos tempranos, idealmente dentro de la primera hora tras identificar choque séptico.";
  }else if(id.includes("anaphyl")){
    fluid="Administrar 20 mL/kg de cristaloide isotónico en 5–20 minutos con reevaluación.";
    cause="Administrar adrenalina IM y tratar vía aérea, respiración y circulación.";
  }else if(id.includes("hypovol")||id.includes("dehydrat")||id.includes("hemorr")){
    fluid="Administrar 20 mL/kg de cristaloide isotónico: aproximadamente 10 minutos si hipotenso y 20 minutos si compensado; repetir según respuesta.";
    cause="Controlar pérdidas o hemorragia y considerar hemoderivados cuando corresponda.";
  }
  return [
    phase("Liderazgo y ABCDE","Asignar funciones, mantener comunicación efectiva y dirigir valoración ABCDE con signos vitales."),
    phase("Oxígeno y monitorización","Administrar oxígeno, colocar monitor cardiaco, pulsioxímetro y medir TA."),
    phase("Identificación y clasificación","Identificar signos del tipo de choque y clasificarlo como compensado o hipotensivo."),
    phase("Acceso vascular","Establecer acceso IV o IO y preparar los tratamientos indicados."),
    phase("Reanimación con líquidos",fluid,"Reevaluar durante y después de cada bolo; detener si aparecen signos de insuficiencia cardiaca."),
    phase("Tratamiento causal",cause),
    phase("Reevaluación","Reevaluar perfusión, estado mental, pulsos, llenado capilar, TA, diuresis y respuesta a cada tratamiento."),
    phase("Conclusión y debriefing","Declarar los objetivos terapéuticos alcanzados y las habilidades que requieren remediación.")
  ];
}

function bradySequence(){
  return [
    phase("Valoración y reconocimiento","Asignar funciones, realizar ABCDE e identificar bradicardia asociada con compromiso cardiopulmonar."),
    phase("Ventilación y oxígeno","Iniciar ventilación con bolsa-mascarilla y oxígeno al 100% cuando exista compromiso respiratorio."),
    phase("Monitorización","Colocar monitor cardiaco y pulsioxímetro; registrar TA."),
    phase("Reevaluación inicial","Reevaluar FC y perfusión sistémica después de iniciar ventilación."),
    phase("RCP de alta calidad","Si la FC es menor de 60/min con mala perfusión pese a oxigenación y ventilación, iniciar compresiones y ventilación de alta calidad."),
    phase("Acceso y adrenalina","Obtener acceso IV o IO y preparar adrenalina 0.01 mg/kg IV/IO de la concentración 0.1 mg/mL."),
    phase("Reevaluación y causas","Reevaluar la respuesta e identificar causas potenciales de bradicardia.")
  ];
}

function svtSequence(){
  return [
    phase("ABCDE y estabilidad","Asignar funciones, realizar ABCDE, tomar signos vitales y determinar si existe perfusión adecuada o compromiso cardiopulmonar."),
    phase("Monitor, SpO₂ y oxígeno","Colocar monitor cardiaco y pulsioxímetro; administrar oxígeno suplementario."),
    phase("Identificar el ritmo","Identificar taquicardia de complejo estrecho y distinguir taquicardia sinusal de TSV."),
    phase("Maniobras vagales","Si el paciente está estable, realizar maniobras vagales apropiadas."),
    phase("Acceso y adenosina","Obtener acceso IV/IO y administrar la primera dosis de adenosina; repetir la segunda si está indicada."),
    phase("Cardioversión sincronizada","Si existe inestabilidad o falla el tratamiento, realizar cardioversión sincronizada a 0.5–1 J/kg; aumentar 0.5–1 J/kg hasta un máximo de 2 J/kg."),
    phase("Reevaluación y consulta","Reevaluar la respuesta y solicitar consulta experta cuando corresponda.")
  ];
}

function shockableArrestSequence(){
  return [
    phase("Reconocer el paro","Asignar funciones, identificar paro cardiaco e iniciar RCP de alta calidad inmediatamente."),
    phase("Monitor y ritmo","Colocar parches o electrodos, activar monitor/desfibrilador e identificar FV o TV sin pulso."),
    phase("Primera descarga","Desfibrilar de forma segura a 2 J/kg."),
    phase("RCP inmediata","Después de cada descarga, reanudar inmediatamente RCP comenzando con compresiones."),
    phase("Acceso y adrenalina","Obtener acceso IV/IO y administrar adrenalina en los intervalos indicados."),
    phase("Segunda descarga","Administrar segunda descarga a 4 J/kg; dosis posteriores 4–10 J/kg sin exceder 10 J/kg ni la dosis adulta del desfibrilador."),
    phase("Antiarrítmico","Administrar amiodarona o lidocaína en el momento apropiado."),
    phase("Persistencia y causas reversibles","Continuar ciclos, considerar dosis adicionales y buscar causas reversibles (H y T).")
  ];
}

function nonShockableArrestSequence(){
  return [
    phase("Reconocer el paro","Asignar funciones, identificar paro cardiaco e iniciar RCP de alta calidad inmediatamente."),
    phase("Monitor y ritmo","Colocar parches o electrodos, activar monitor/desfibrilador e identificar asistolia o AESP."),
    phase("Acceso y adrenalina","Obtener acceso IV/IO y administrar adrenalina en los intervalos indicados."),
    phase("Ciclos de RCP","Mantener RCP de alta calidad y revisar el ritmo aproximadamente cada 2 minutos, minimizando interrupciones."),
    phase("Causas reversibles","Identificar y tratar al menos tres causas reversibles de AESP o asistolia."),
    phase("ROSC o continuación","Si retorna la circulación, iniciar cuidados posparo; si no, continuar el algoritmo y reevaluar.")
  ];
}

function genericPalsSequence(s){
  const id=s.id.toLowerCase();
  if(id.includes("brady")) return bradySequence();
  if(id.includes("svt")||id.includes("tachy")||id.includes("vt-pulse")) return svtSequence();
  if(id.includes("vf")||id.includes("pulseless-vt")) return shockableArrestSequence();
  if(id.includes("pea")||id.includes("asyst")||id.includes("arrest")) return nonShockableArrestSequence();
  if(["shock","septic","hypovol","hemorr","cardiogenic","myocard","pneumo","tampon","anaphyl","mening","neurogenic"].some(k=>id.includes(k))) return shockSequence(s);
  if(["respir","asthma","bronchiol","croup","fbao","opioid","drowning","airway","sickle"].some(k=>id.includes(k))) return respiratorySequence(s);
  return [
    phase("Liderazgo y ABCDE","Asignar funciones, utilizar comunicación efectiva y realizar valoración ABCDE con signos vitales."),
    phase("Monitorización","Administrar oxígeno según necesidad, colocar monitor, pulsioxímetro y medir TA."),
    phase("Identificar el problema","Reconocer la fisiología predominante y la gravedad."),
    phase("Intervención prioritaria","Aplicar el tratamiento prioritario del escenario."),
    phase("Reevaluación","Reevaluar al paciente después de cada intervención y escalar el tratamiento."),
    phase("Conclusión y debriefing","Documentar resultados, identificar oportunidades y realizar debriefing.")
  ];
}

export function buildSequence(scenario,program){return program==="NRP"?nrpSequence():genericPalsSequence(scenario)}
export function currentPhase(session){const seq=session?.sequence||[];return seq[Math.min(session?.phaseIndex||0,Math.max(0,seq.length-1))]||null}
function mergeVitals(v,target={}){Object.entries(target).forEach(([key,value])=>{if(value!==undefined)v[key]=value})}
export function advancePhase(session){if(!session?.sequence?.length)return null;session.phaseIndex=Math.min(session.sequence.length-1,(session.phaseIndex||0)+1);const p=currentPhase(session);mergeVitals(session.vitals,p.vitals);return p}
export function injectScenarioError(session,message="Intervención crítica omitida o incorrecta"){if(!session)return;session.criticalErrors=(session.criticalErrors||0)+1;const v=session.vitals;v.spo2=Math.max(0,(v.spo2||0)-6);v.sys=Math.max(0,(v.sys||0)-8);v.dia=Math.max(0,(v.dia||0)-5);v.etco2=Math.max(0,(v.etco2||0)-4);if(["Bradicardia","Asistolia","AESP"].includes(v.rhythm))v.hr=Math.max(0,(v.hr||0)-8);else v.hr=Math.min(280,(v.hr||0)+12);return message}
export function injectScenarioTrick(session){if(!session)return "Evento inesperado";const program=session.meta?.program,id=session.scenario.id.toLowerCase(),v=session.vitals;let event="El paciente no responde como se esperaba; el equipo debe reevaluar ABCDE.";if(program==="NRP"){const options=["No hay movimiento torácico: revisar sello, posición, secreciones, apertura de boca, presión y vía aérea alternativa.","La FC disminuye súbitamente pese a VPP: considerar ventilación ineficaz o neumotórax.","El pulsioxímetro no muestra señal confiable: verificar ubicación preductal y perfusión."];event=options[(session.trickIndex||0)%options.length];session.trickIndex=(session.trickIndex||0)+1;v.spo2=Math.max(30,(v.spo2||60)-8);v.hr=Math.max(40,(v.hr||90)-15);v.etco2=Math.max(5,(v.etco2||18)-6)}else if(id.includes("shock")||id.includes("septic")||id.includes("hypovol")||id.includes("cardiogenic")){event="Después del bolo aparecen estertores o hepatomegalia: detener líquidos y reevaluar posible insuficiencia cardiaca.";v.spo2=Math.max(70,(v.spo2||92)-7);v.rr=Math.min(70,(v.rr||30)+10)}else if(id.includes("respir")||id.includes("asthma")||id.includes("croup")||id.includes("bronchiol")){event="El paciente se fatiga y disminuye la entrada de aire: valorar insuficiencia respiratoria y soporte ventilatorio inmediato.";v.spo2=Math.max(55,(v.spo2||90)-10);v.rr=Math.max(6,(v.rr||40)-12);v.etco2=Math.min(75,(v.etco2||40)+12)}else if(id.includes("svt")||id.includes("tachy")||id.includes("vt")){event="El paciente pierde perfusión durante la taquicardia: cambiar a la rama inestable y preparar cardioversión sincronizada.";v.sys=Math.max(45,(v.sys||75)-15);v.dia=Math.max(25,(v.dia||40)-10)}else if(id.includes("vf")||id.includes("pea")||id.includes("asyst")||id.includes("arrest")){event="El ETCO₂ cae y la RCP parece ineficaz: revisar calidad de compresiones, ventilación y causas reversibles.";v.etco2=Math.max(4,(v.etco2||15)-7)}return event}
export function sessionSnapshot(session){if(!session)return null;const p=currentPhase(session);return{scenario:{id:session.scenario.id,title:session.scenario.title,patient:session.scenario.patient},meta:session.meta,vitals:{...session.vitals},elapsed:session.elapsed,phaseIndex:session.phaseIndex||0,phaseCount:session.sequence?.length||0,phase:p,criticalErrors:session.criticalErrors||0,instructorDecision:session.instructorDecision||"",deterioration:!!session.deterioration}}
