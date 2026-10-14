const PROBLEM = {
  problemId: "TRIG_138_01",
  problemVersion: "v1.0",
  text: "오른쪽 직각삼각형 ABC에서 ∠A와 ∠C의 삼각비의 값을 각각 구하시오.",
};

const EXAMPLE_PROMPTS = [
  { text: "∠A를 기준으로 보았을 때, 길이 7인 변은 어떤 위치의 변인가요?", type: "epistemic" },
  { text: "이 계산은 ∠A와 ∠C 중 어느 각의 어떤 삼각비를 구하기 위한 것인가요?", type: "teleological" },
  { text: "‘반대쪽’이라고 한 변을 A, B, C의 점 이름을 사용해 다시 말해 볼 수 있나요?", type: "communicative" },
];

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
    prototype_live: "prototype",
    prompt_version: "example-rule-v1.0",
    model_version: "example-rule",
    messages: [],
  };
}

function addMessage({ speaker, text, rationalityType = null, respondsTo = null }) {
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
    prototype_live: "prototype",
    client_event_id: makeId("EVT"),
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
  state.nextPromptIndex = Math.min(
    state.session.messages.filter((message) => message.speaker === "ai").length,
    EXAMPLE_PROMPTS.length,
  );
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
  const saved = saveDraft();
  if (!saved) {
    state.session.status = "error";
    state.session.end_reason = "local_save_failed";
    showEndScreen("abandoned", "저장에 실패했습니다. 화면을 닫지 말고 연구자에게 알려 주세요.");
  } else {
    localStorage.setItem(STORAGE_KEYS.last, JSON.stringify(state.session));
    localStorage.removeItem(STORAGE_KEYS.draft);
    showEndScreen(status, status === "completed" ? "대화 기록이 임시 저장되었습니다. 연구자 로그 화면에서 확인할 수 있습니다." : "중단 상태가 임시 저장되었습니다.");
  }
  state.busy = false;
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

$("#message-form").addEventListener("submit", (event) => {
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
  addMessage({ speaker: "student", text, respondsTo: previous?.speaker === "ai" ? previous.message_id : null });
  if (!saveDraft()) {
    $("#send-button").disabled = false;
    state.busy = false;
    return;
  }
  $("#message-input").value = "";
  const prompt = EXAMPLE_PROMPTS[state.nextPromptIndex];
  if (prompt) {
    const studentMessage = state.session.messages.at(-1);
    addMessage({ speaker: "ai", text: prompt.text, rationalityType: prompt.type, respondsTo: studentMessage.message_id });
    state.nextPromptIndex += 1;
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
