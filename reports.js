const fmt=seconds=>`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
const esc=value=>String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function debriefText(session){
  const d=session.debriefing;if(!d)return["Debriefing no generado."];
  return[
    "DEBRIEFING ESTRUCTURADO","","FORTALEZAS",...d.strengths.map(item=>`- ${item}`),"",
    "OPORTUNIDADES DE MEJORA",...d.opportunities.map(item=>`- ${item}`),"",
    "COMUNICACIÓN Y TRABAJO EN EQUIPO",...d.communicationFindings.map(item=>`- ${item}`),"",
    "PREGUNTAS GUÍA",...d.questions.map(item=>`- ${item}`),"",
    "MENSAJES PARA LLEVAR",...d.takeaways.map(item=>`- ${item}`),"",
    `CONCLUSIÓN DEL INSTRUCTOR: ${d.instructorNotes||"No registrada"}`,
    `COMPROMISO DEL EQUIPO: ${d.teamCommitment||"No registrado"}`,"",
    "CONVERSACIÓN TRANSCRITA",d.transcriptEvidence||"Sin transcripción automática."
  ];
}
function finalVitals(session){
  const v=session.vitals||{};
  return`FC ${v.hr??"—"} lpm | SpO₂ ${v.spo2??"—"}% | TA ${v.sys??"—"}/${v.dia??"—"} mmHg | FR ${v.rr??"—"} rpm | ETCO₂ ${v.etco2??"—"} mmHg`;
}
export function downloadReport(session,result){
  const lines=[
    "SIMCOPILOT EDUVESA V7.1.0","Reporte completo de simulación y debriefing","",
    `Instructor: ${session.meta.instructor||"No registrado"}`,
    `Equipo: ${session.meta.team||"No registrado"}`,
    `Programa: ${session.meta.program||"No registrado"}`,
    `Escenario: ${session.scenario.title}`,
    `Paciente: ${session.scenario.patient}`,
    `Duración: ${fmt(session.elapsed)}`,
    `Puntuación: ${result.score}/100`,
    `Decisión: ${result.decision}`,
    `Errores críticos: ${session.criticalErrors||0}`,
    `Signos vitales finales: ${finalVitals(session)}`,
    "",...debriefText(session),"","CRONOLOGÍA COMPLETA",
    ...(session.log||[]).slice().reverse().map(item=>`${item.time} — ${item.action}`)
  ];
  const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}),link=document.createElement("a");
  link.href=URL.createObjectURL(blob);link.download=`simcopilot-debriefing-${Date.now()}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);
}
export function printReport(session,result){
  const d=session.debriefing||{};
  const list=items=>items?.length?`<ul>${items.map(item=>`<li>${esc(item)}</li>`).join("")}</ul>`:"<p>No documentado.</p>";
  const transcript=d.transcript?.length?d.transcript.map(item=>`<tr><td>${esc(item.time)}</td><td>${esc(item.text)}</td></tr>`).join(""):'<tr><td colspan="2">Sin transcripción automática.</td></tr>';
  const timeline=(session.log||[]).slice().reverse().map(item=>`<li>${esc(item.time)} — ${esc(item.action)}</li>`).join("");
  const windowRef=open("","_blank");
  windowRef.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte SimCopilot</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.45;color:#17222b}h1,h2{color:#0c5264}section{margin:24px 0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #b9c5ca;padding:7px;text-align:left;vertical-align:top}.meta th{width:190px}</style></head><body>
  <h1>SimCopilot EDUVESA V7.1.0</h1><p>Reporte completo de simulación y debriefing estructurado</p>
  <table class="meta"><tr><th>Instructor</th><td>${esc(session.meta.instructor||"No registrado")}</td></tr><tr><th>Equipo</th><td>${esc(session.meta.team||"No registrado")}</td></tr><tr><th>Programa</th><td>${esc(session.meta.program||"")}</td></tr><tr><th>Escenario</th><td>${esc(session.scenario.title)}</td></tr><tr><th>Duración</th><td>${fmt(session.elapsed)}</td></tr><tr><th>Puntuación</th><td>${result.score}/100</td></tr><tr><th>Decisión</th><td>${esc(result.decision)}</td></tr><tr><th>Signos vitales finales</th><td>${esc(finalVitals(session))}</td></tr></table>
  <section><h2>Fortalezas</h2>${list(d.strengths)}</section><section><h2>Oportunidades de mejora</h2>${list(d.opportunities)}</section><section><h2>Comunicación y trabajo en equipo</h2>${list(d.communicationFindings)}</section><section><h2>Preguntas guía</h2>${list(d.questions)}</section><section><h2>Mensajes para llevar</h2>${list(d.takeaways)}</section>
  <section><h2>Conclusión del instructor</h2><p>${esc(d.instructorNotes||"No registrada")}</p><h2>Compromiso del equipo</h2><p>${esc(d.teamCommitment||"No registrado")}</p></section>
  <section><h2>Conversación transcrita</h2><table><tr><th>Tiempo</th><th>Contenido</th></tr>${transcript}</table></section>
  <section><h2>Cronología</h2><ol>${timeline}</ol></section>
  <p><small>Análisis automatizado local. Debe ser revisado y contextualizado por el facilitador.</small></p></body></html>`);
  windowRef.document.close();windowRef.focus();setTimeout(()=>windowRef.print(),300);
}