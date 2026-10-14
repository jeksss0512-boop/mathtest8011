const PROBLEM = {
  problemId: "TRIG_138_01",
  problemVersion: "v1.0",
  text: "오른쪽 직각삼각형 ABC에서 ∠A와 ∠C의 삼각비의 값을 각각 구하시오.",
  conditions: "∠B=90°, AB=24, BC=7, AC=25",
};

const STORAGE_KEYS = { draft: "trigChatbotDraft", last: "trigChatbotLastSession" };
const state = { session: null, nextPromptIndex: 0, busy: false };
const $ = (selector) => document.querySelector(selector);
const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(state.session));
    setSaveStatus("임시 저장됨", "success");
    return true;
  } catch (error) {
    setSaveStatus("저장 실패 - 다시 시도해 주세요", "failure");
    return false;
  }
}

function saveLastSession() {
  try {
    localStorage.setItem(STORAGE_KEYS.last, JSON.stringify(state.session));
    localStorage.removeItem(STORAGE_KEYS.draft);
    return true;
  } catch {
    setSaveStatus("저장 실패 - 다시 시도해 주세요", "failure");
    return false;
  }
}

function setSaveStatus(text, className = "") {
  const element = $("#save-status");
  element.textContent = text;
  element.className = `save-status ${className}`.trim();
}

function createSession(studentId) {
  return {
    session_id: makeId("SES"),
    student_id: studentId,
    problem_id: PROBLEM.problemId,
    problem_version: PROBLEM.problemVersion,
    started_at: now(),
    ended_at: null,
    status: "in_progress",
    end_reason: null,
    prototype_live: "live",
    prompt_version: "triangle-chat-live-v1.0",
    model_version: "gpt-6-luna",
    messages: [],
    ai_requests: [],
  };
}

function addMessage({ speaker, text, rationalityType = null, respondsTo = null, requestId = null, prototypeLive = state.session.prototype_live }) {
  const message = {
    message_id: makeId("MSG"),
    session_id: state.session.session_id,
    message_number: state.session.messages.length + 1,
    message_order: state.session.messages.length + 1,
    speaker,
    message_text: text,
    responds_to_message_id: respondsTo,
    rationality_type: speaker === "ai" ? rationalityType : null,
    timestamp: now(),
    prototype_live: prototypeLive,
    client_event_id: makeId("EVT"),
    ai_request_id: requestId,
  };
  state.session.messages.push(message);
  return message;
}

function renderMessages() {
  $("#message-list").innerHTML = state.session.messages.map((message) => `
    <article class="message ${message.speaker}">
      <div class="message-label">${message.speaker === "student" ? "나의 생각" : "질문"}</div>
      <p>${escapeHtml(message.message_text)}</p>
    </article>`).join("");
  const list = $("#message-list");
  list.scrollTop = list.scrollHeight;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function showActivity() {
  $("#start-screen").classList.add("hidden");
  $("#end-screen").classList.add("hidden");
  $("#activity-screen").classList.remove("hidden");
  renderMessages();
  updateInputPrompt();
}

function updateInputPrompt() {
  const hasAiQuestion = state.session.messages.some((message) => message.speaker === "ai");
  $("#message-label").textContent = hasAiQuestion
    ? "질문을 읽고, 지금의 생각이나 풀이 이유를 적어 주세요."
    : "문제를 읽고, 먼저 살펴볼 각이나 변을 자유롭게 적어 주세요.";
  $("#send-button").textContent = hasAiQuestion ? "응답 저장" : "생각 저장";
}

function beginActivity(studentId, existingSession = null) {
  state.session = existingSession || createSession(studentId);
  if (!Array.isArray(state.session.ai_requests)) state.session.ai_requests = [];
  endConfirmationRequested = false;
  $("#end-button").textContent = "활동 종료";
  showActivity();
  saveDraft();
}

function showEndScreen(status, message) {
  $("#activity-screen").classList.add("hidden");
  $("#start-screen").classList.add("hidden");
  $("#end-screen").classList.remove("hidden");
  $("#end-title").textContent = status === "completed" ? "활동이 종료되었습니다" : "활동이 중단되었습니다";
  $("#end-message").textContent = message;
  $("#end-summary").innerHTML = `
    <div class="summary-row"><span>학생 ID</span><strong>${escapeHtml(state.session.student_id)}</strong></div>
    <div class="summary-row"><span>대화 수</span><strong>${state.session.messages.length}개</strong></div>
    <div class="summary-row"><span>저장 상태</span><strong>${status === "completed" ? "저장 완료" : "중단 기록 저장"}</strong></div>`;
}

function finishActivity(status = "completed") {
  if (state.busy || !state.session || state.session.status !== "in_progress") return;
  state.busy = true;
  $("#end-button").disabled = true;
  state.session.status = status;
  state.session.end_reason = status === "completed" ? "student_completed" : "student_abandoned";
  state.session.ended_at = now();
  const saved = saveDraft() && saveLastSession();
  if (!saved) {
    state.session.status = "error";
    state.session.end_reason = "local_save_failed";
    setSaveStatus("저장 실패 - 활동을 닫지 말고 연구자에게 알려 주세요", "failure");
    showEndScreen("abandoned", "저장에 실패했습니다. 화면을 닫지 말고 연구자에게 알려 주세요.");
  } else {
    showEndScreen(status, status === "completed" ? "대화 기록이 임시 저장되었습니다. 연구자 로그 화면에서 확인할 수 있습니다." : "중단 상태가 임시 저장되었습니다.");
  }
  state.busy = false;
}

async function requestLiveQuestion(studentMessage) {
  const request = {
    request_id: makeId("REQ"),
    client_request_id: makeId("EVT"),
    source_message_id: studentMessage.message_id,
    status: "started",
    attempt_count: 0,
    started_at: now(),
    ended_at: null,
    prototype_live: "live",
    prompt_version: state.session.prompt_version,
    model_version: state.session.model_version,
  };
  state.session.ai_requests.push(request);
  saveDraft();
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_request_id: request.client_request_id,
        problem: PROBLEM,
        messages: state.session.messages.slice(-8).map(({ speaker, message_text }) => ({ speaker, message_text })),
      }),
    });
    const result = await response.json();
    request.attempt_count = result.attempt_count || 1;
    request.ended_at = result.ended_at || now();
    request.server_request_id = result.request_id || null;
    request.response_id = result.response_id || null;
    request.status = result.ok ? "succeeded" : "failed";
    request.error_code = result.ok ? null : result.error_code;
    request.error_message = result.ok ? null : result.error_message;
    request.rationality_type = result.ok ? result.rationality_type : null;
    if (!result.ok) throw new Error(result.error_message || "AI 질문을 만들지 못했습니다.");
    state.session.prompt_version = result.prompt_version;
    state.session.model_version = result.model_version;
    state.session.prototype_live = "live";
    return result;
  } catch (error) {
    request.status = "failed";
    request.ended_at = request.ended_at || now();
    request.error_code = request.error_code || "client_request_error";
    request.error_message = request.error_message || error.message;
    saveDraft();
    throw error;
  }
}

$("#start-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const studentId = $("#student-id").value.trim();
  if (!studentId) {
    $("#start-error").textContent = "학생 ID를 입력해 주세요.";
    $("#student-id").focus();
    return;
  }
  $("#start-error").textContent = "";
  beginActivity(studentId);
});

$("#message-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  const text = $("#message-input").value.trim();
  if (!text) {
    $("#message-error").textContent = "생각이나 응답을 한 문장 이상 적어 주세요.";
    $("#message-input").focus();
    return;
  }
  $("#message-error").textContent = "";
  state.busy = true;
  $("#send-button").disabled = true;
  const previous = state.session.messages.at(-1);
  const canRetrySameStudentMessage = previous?.speaker === "student" && previous.message_text === text;
  const studentMessage = canRetrySameStudentMessage
    ? previous
    : addMessage({ speaker: "student", text, respondsTo: previous?.speaker === "ai" ? previous.message_id : null });
  if (!saveDraft()) {
    $("#send-button").disabled = false;
    state.busy = false;
    return;
  }
  $("#message-input").value = "";
  try {
    const result = await requestLiveQuestion(studentMessage);
    addMessage({
      speaker: "ai",
      text: result.question,
      rationalityType: result.rationality_type,
      respondsTo: studentMessage.message_id,
      requestId: result.request_id,
      prototypeLive: "live",
    });
    setSaveStatus("AI 질문과 대화가 저장됨", "success");
  } catch (error) {
    $("#message-error").textContent = "AI 질문을 준비하지 못했습니다. 가상 질문으로 대신하지 않았습니다. 잠시 후 같은 응답을 다시 제출해 주세요.";
    setSaveStatus("AI 질문 저장 실패 - 재시도 필요", "failure");
  }
  saveDraft();
  renderMessages();
  updateInputPrompt();
  $("#send-button").disabled = false;
  state.busy = false;
});

let endConfirmationRequested = false;

$("#end-button").addEventListener("click", () => {
  if (!endConfirmationRequested) {
    endConfirmationRequested = true;
    $("#end-button").textContent = "저장 후 종료 확인";
    $("#save-status").textContent = "한 번 더 누르면 현재 대화를 저장하고 종료합니다.";
    return;
  }
  finishActivity();
});

$("#new-activity-button").addEventListener("click", () => {
  state.session = null;
  state.nextPromptIndex = 0;
  $("#end-screen").classList.add("hidden");
  $("#start-screen").classList.remove("hidden");
  $("#student-id").value = "";
  $("#draft-notice").classList.add("hidden");
});

const draft = localStorage.getItem(STORAGE_KEYS.draft);
if (draft) {
  try {
    const parsed = JSON.parse(draft);
    if (parsed?.status === "in_progress") {
      $("#draft-notice").textContent = "이전에 진행하던 활동이 있습니다. 학생 ID를 입력한 뒤 이어할 수 있습니다.";
      $("#draft-notice").classList.remove("hidden");
      $("#resume-draft-button").classList.remove("hidden");
      $("#resume-draft-button").addEventListener("click", () => beginActivity(parsed.student_id, parsed));
    }
  } catch {
    localStorage.removeItem(STORAGE_KEYS.draft);
  }
}
