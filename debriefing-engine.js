const escapeHtml=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const normalize=value=>String(value??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const unique=list=>[...new Set(list.filter(Boolean))];
const countMatches=(text,terms)=>terms.reduce((sum,term)=>sum+(text.match(new RegExp(term,"g"))||[]).length,0);

function evidenceLabel(count,positive,negative){return count>0?positive:negative}
function formatTime(seconds=0){return`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}
function listHtml(items,empty="Sin elementos documentados."){return items.length?`<ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>`:`<p class="debrief-empty">${escapeHtml(empty)}</p>`}

export function buildStructuredDebrief(session,result,voiceData={}){
  const transcript=Array.isArray(voiceData.entries)?voiceData.entries:[];
  const transcriptText=transcript.map(item=>item.text||"").join(" ").trim();
  const normalizedTranscript=normalize(transcriptText);
  const log=[...(session.log||[])].slice().reverse();
  const goals=session.scenario.goals||[];
  const completed=[...(session.completed||[])];
  const missing=goals.filter(goal=>!session.completed.has(goal));
  const phaseCount=session.sequence?.length||0;
  const phaseReached=phaseCount?Math.min((session.phaseIndex||0)+1,phaseCount):0;
  const criticalEvents=log.filter(item=>/ERROR CRÍTICO|ERROR \/ EVOLUCIÓN|EVENTO SORPRESA/i.test(item.action||""));
  const voiceWordCount=transcriptText?transcriptText.split(/\s+/).filter(Boolean).length:0;

  const leadershipCount=countMatches(normalizedTranscript,["lider","asigna","tu haces","encargate","equipo","roles"]);
  const closedLoopCount=countMatches(normalizedTranscript,["confirmo","recibido","repito","correcto","entendido","verificado"]);
  const reevaluationCount=countMatches(normalizedTranscript,["reevalu","revis","frecuencia cardiaca","saturacion","presion arterial","pulso","respuesta"]);
  const anticipationCount=countMatches(normalizedTranscript,["prepar","anticip","si no mejora","siguiente paso","considerar","listo"]);
  const safetyCount=countMatches(normalizedTranscript,["despejen","todos fuera","seguro","dosis","peso","confirmar"]);

  const strengths=[];
  if(completed.length)strengths.push(`Se documentaron ${completed.length} intervenciones objetivo: ${completed.slice(0,4).join(", ")}${completed.length>4?"…":""}.`);
  if(leadershipCount>0)strengths.push("La conversación contiene evidencia de liderazgo o asignación de funciones.");
  if(closedLoopCount>0)strengths.push("Se identificaron expresiones compatibles con comunicación de circuito cerrado.");
  if(reevaluationCount>0)strengths.push("El equipo verbalizó reevaluación o seguimiento de la respuesta clínica.");
  if(anticipationCount>0)strengths.push("Se verbalizaron preparación y anticipación de pasos posteriores.");
  if(safetyCount>0)strengths.push("Se identificaron expresiones relacionadas con seguridad, verificación o confirmación.");
  if(!criticalEvents.length)strengths.push("No se registraron errores críticos durante la sesión.");

  const opportunities=[];
  if(missing.length)opportunities.push(`Objetivos no documentados: ${missing.join(", ")}.`);
  if(criticalEvents.length)opportunities.push(`Se registraron ${criticalEvents.length} eventos críticos o evoluciones desfavorables que deben revisarse sin enfoque punitivo.`);
  if(transcript.length&&!leadershipCount)opportunities.push("No se encontró evidencia verbal clara de asignación de funciones; conviene definir líder y responsabilidades al inicio.");
  if(transcript.length&&!closedLoopCount)opportunities.push("No se identificó comunicación de circuito cerrado; se recomienda ordenar, confirmar y verificar cada intervención crítica.");
  if(transcript.length&&!reevaluationCount)opportunities.push("La conversación no evidenció reevaluación explícita después de las intervenciones.");
  if(phaseCount&&phaseReached<phaseCount)opportunities.push(`La simulación alcanzó la fase ${phaseReached} de ${phaseCount}; revisar los pasos algorítmicos pendientes.`);
  if(!transcript.length)opportunities.push("No hubo transcripción automática disponible; el análisis conversacional se limita a la cronología registrada. La grabación puede revisarse manualmente.");

  const communicationFindings=[
    evidenceLabel(leadershipCount,"Liderazgo/asignación de roles: evidenciado en la conversación.","Liderazgo/asignación de roles: no evidenciado en la transcripción."),
    evidenceLabel(closedLoopCount,"Circuito cerrado: evidenciado mediante confirmaciones o repeticiones.","Circuito cerrado: no evidenciado en la transcripción."),
    evidenceLabel(reevaluationCount,"Conciencia situacional: se verbalizaron reevaluaciones o cambios clínicos.","Conciencia situacional: no se documentó reevaluación verbal explícita."),
    evidenceLabel(anticipationCount,"Anticipación: se verbalizaron preparación o siguientes pasos.","Anticipación: no se identificaron planes contingentes explícitos."),
    evidenceLabel(safetyCount,"Seguridad: se verbalizaron verificaciones, dosis o despeje.","Seguridad: no se identificaron expresiones explícitas de verificación.")
  ];

  const questions=[
    "¿Cómo se sintió el equipo durante el caso y cuál fue el momento de mayor carga cognitiva?",
    "¿Qué hallazgo cambió la prioridad clínica y cómo se comunicó al resto del equipo?",
    "¿Qué intervención produjo la respuesta esperada y qué evidencia utilizaron para confirmarla?",
    "¿Dónde se perdió tiempo, información o coordinación?",
    "¿Qué harían igual y qué cambiarían en el siguiente caso?"
  ];

  const takeaways=unique([
    missing[0]?`Priorizar y verbalizar: ${missing[0]}.`:"Mantener la secuencia algorítmica y reevaluar después de cada intervención.",
    closedLoopCount?"Conservar la comunicación de circuito cerrado.":"Usar órdenes dirigidas por nombre, confirmación y verificación del resultado.",
    reevaluationCount?"Continuar comunicando cambios de FC, SpO₂, TA, FR y perfusión.":"Anunciar en voz alta los cambios clínicos y la respuesta a cada tratamiento."
  ]);

  const transcriptEvidence=transcript.length?transcript.map(item=>`${item.time||"--:--"} — ${item.text}`).join("\n"):"Sin transcripción automática.";
  const timelineEvidence=log.length?log.map(item=>`${item.time||"--:--"} — ${item.action}`).join("\n"):"Sin eventos registrados.";

  return{
    generatedAt:new Date().toISOString(),
    score:result.score,
    decision:result.decision,
    transcriptAvailable:transcript.length>0,
    audioAvailable:!!voiceData.audioUrl,
    transcript,
    transcriptText,
    transcriptEvidence,
    timelineEvidence,
    metrics:{voiceUtterances:transcript.length,voiceWords:voiceWordCount,completed:completed.length,totalGoals:goals.length,phaseReached,phaseCount,criticalEvents:criticalEvents.length},
    strengths,
    opportunities,
    communicationFindings,
    questions,
    takeaways,
    instructorNotes:"",
    teamCommitment:""
  };
}

export function renderStructuredDebrief(debrief,session,voiceData={}){
  const metrics=debrief.metrics;
  const audio=voiceData.audioUrl?`<audio class="debrief-audio" controls src="${escapeHtml(voiceData.audioUrl)}"></audio>`:"<p class=\"debrief-empty\">No hay archivo de audio disponible.</p>";
  const transcriptRows=debrief.transcript.length?debrief.transcript.map(item=>`<div class="transcript-row"><time>${escapeHtml(item.time||"--:--")}</time><span>${escapeHtml(item.text)}</span></div>`).join(""):"<p class=\"debrief-empty\">No hubo transcripción automática. Revise la grabación y complete las notas del instructor.</p>";
  return`<div class="structured-debrief">
    <section class="debrief-callout"><p class="eyebrow">DEBRIEFING ESTRUCTURADO</p><h3>${escapeHtml(session.scenario.title)}</h3><p>Análisis automatizado local basado en la transcripción disponible, la cronología de acciones, los objetivos del escenario y los eventos del instructor. No sustituye el juicio del facilitador.</p></section>
    <div class="debrief-metrics"><div><small>Frases transcritas</small><b>${metrics.voiceUtterances}</b></div><div><small>Objetivos</small><b>${metrics.completed}/${metrics.totalGoals}</b></div><div><small>Fases</small><b>${metrics.phaseReached}/${metrics.phaseCount||"—"}</b></div><div><small>Errores críticos</small><b>${metrics.criticalEvents}</b></div></div>
    <section><h3>1. Reacciones</h3><p>El facilitador debe iniciar preguntando cómo se sintió el equipo, qué resultó más difícil y qué emociones influyeron en las decisiones. La aplicación no infiere emociones a partir del audio.</p></section>
    <section><h3>2. Descripción compartida del caso</h3><p>Escenario: <b>${escapeHtml(session.scenario.title)}</b>. Paciente: ${escapeHtml(session.scenario.patient)}. Duración: ${formatTime(session.elapsed)}. Resultado: <b>${escapeHtml(debrief.decision)}</b> con ${debrief.score}/100.</p><p>${escapeHtml(session.scenario.narrative)}</p></section>
    <section><h3>3. Fortalezas observadas</h3>${listHtml(debrief.strengths,"No se documentaron fortalezas suficientes; revisar la grabación con el equipo.")}</section>
    <section><h3>4. Análisis clínico y algorítmico</h3>${listHtml(debrief.opportunities,"No se identificaron oportunidades principales.")}</section>
    <section><h3>5. Comunicación y trabajo en equipo</h3>${listHtml(debrief.communicationFindings)}</section>
    <section><h3>6. Preguntas para la conversación del debriefing</h3>${listHtml(debrief.questions)}</section>
    <section><h3>7. Mensajes para llevar</h3>${listHtml(debrief.takeaways)}</section>
    <section><h3>8. Plan de mejora</h3><label>Conclusión del instructor<textarea id="debriefInstructorNotes" rows="4" placeholder="Registre la interpretación del facilitador, factores de sistema y prioridades de remediación."></textarea></label><label>Compromiso del equipo<textarea id="debriefTeamCommitment" rows="3" placeholder="Ej. En el siguiente caso asignaremos roles antes de iniciar y reevaluaremos después de cada intervención."></textarea></label></section>
    <details open><summary>9. Grabación y conversación transcrita</summary>${audio}<div class="transcript-evidence">${transcriptRows}</div></details>
    <details><summary>10. Cronología completa del escenario</summary><pre class="evidence-pre">${escapeHtml(debrief.timelineEvidence)}</pre></details>
  </div>`;
}
