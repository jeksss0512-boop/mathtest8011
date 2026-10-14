const session = JSON.parse(localStorage.getItem("trigChatbotLastSession") || "null");
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvValue(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

if (session) {
  $("#empty-state").classList.add("hidden");
  $("#log-content").classList.remove("hidden");
  $("#session-summary").innerHTML = Object.entries({
    student_id: session.student_id,
    session_id: session.session_id,
    problem_id: session.problem_id,
    status: session.status,
    prototype_live: session.prototype_live,
    started_at: session.started_at,
    ended_at: session.ended_at,
  }).map(([key, value]) => `<div class="summary-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  $("#message-table").innerHTML = session.messages.map((message) => `
    <tr><td>${message.message_order}</td><td>${escapeHtml(message.speaker)}</td><td>${escapeHtml(message.message_text)}</td><td>${escapeHtml(message.responds_to_message_id || "-")}</td><td>${escapeHtml(message.timestamp)}</td></tr>`).join("");
  $("#request-table").innerHTML = (session.ai_requests || []).map((request) => `
    <tr><td>${escapeHtml(request.status)}</td><td>${escapeHtml(request.attempt_count)}</td><td>${escapeHtml(request.source_message_id)}</td><td>${escapeHtml(request.error_code || "-")}</td><td>${escapeHtml(request.ended_at || request.started_at)}</td></tr>`).join("");
  $("#raw-json").textContent = JSON.stringify(session, null, 2);
  $("#json-button").addEventListener("click", () => download(`${session.session_id}.json`, JSON.stringify(session, null, 2), "application/json;charset=utf-8"));
  $("#csv-button").addEventListener("click", () => {
    const headers = ["student_id", "session_id", "problem_id", "problem_version", "message_id", "message_number", "message_order", "speaker", "message_text", "responds_to_message_id", "rationality_type", "timestamp", "prompt_version", "model_version", "prototype_live"];
    const rows = session.messages.map((message) => [session.student_id, session.session_id, session.problem_id, session.problem_version, message.message_id, message.message_number, message.message_order, message.speaker, message.message_text, message.responds_to_message_id, message.rationality_type, message.timestamp, session.prompt_version, session.model_version, message.prototype_live]);
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
    download(`${session.session_id}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  });
}
