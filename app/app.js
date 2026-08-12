const questions = [
  {
    itemId: "ITEM_01",
    type: "객관식",
    typeCode: "multiple_choice",
    text: "방정식 3x + 5 = 17에서 x의 값은 무엇인가요?",
    choices: ["2", "3", "4", "5"],
    answer: "4",
    points: 1,
  },
  {
    itemId: "ITEM_02",
    type: "객관식",
    typeCode: "multiple_choice",
    text: "방정식 2(x - 3) = 10에서 x의 값은 무엇인가요?",
    choices: ["2", "5", "8", "13"],
    answer: "8",
    points: 1,
  },
  {
    itemId: "ITEM_03",
    type: "단답형",
    typeCode: "short_answer",
    text: "방정식 5x - 7 = 18에서 x의 값을 입력하세요.",
    answer: "5",
    points: 1,
  },
];

const state = {
  studentId: "",
  attemptId: "",
  startedAt: "",
  questionStartedAt: [],
  answers: {},
};

const $ = (selector) => document.querySelector(selector);
const formatDate = (date) => new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "medium",
}).format(date);
const isoNow = () => new Date().toISOString();
const createId = (prefix) => `${prefix}_${Date.now().toString(36).toUpperCase()}`;

function renderQuestions() {
  $("#question-list").innerHTML = questions.map((question, index) => {
    const choices = question.choices
      ? `<div class="choice-list">${question.choices.map((choice) => `
        <label class="choice-label">
          <input type="radio" name="question-${index}" value="${choice}" />
          <span>${choice}</span>
        </label>`).join("")}</div>`
      : `<input class="short-answer" type="number" inputmode="numeric" data-question-index="${index}" placeholder="답을 숫자로 입력하세요" />`;

    return `<article class="question-card" data-question-card="${index}">
      <div class="question-number">문항 ${index + 1} · ${question.type} · ${question.points}점</div>
      <p class="question-text">${question.text}</p>
      ${choices}
    </article>`;
  }).join("");

  state.questionStartedAt = questions.map(() => Date.now());
}

function getAnswer(index) {
  const question = questions[index];
  if (question.choices) {
    return document.querySelector(`input[name="question-${index}"]:checked`)?.value || "";
  }
  return document.querySelector(`[data-question-index="${index}"]`)?.value.trim() || "";
}

function collectAttempt() {
  const submittedAt = new Date();
  const responses = questions.map((question, index) => {
    const studentAnswer = getAnswer(index);
    const isCorrect = studentAnswer !== "" && studentAnswer === question.answer;
    const timeSpentSec = Math.max(1, Math.round((Date.now() - state.questionStartedAt[index]) / 1000));
    return {
      response_id: `RESP_${String(index + 1).padStart(4, "0")}`,
      attempt_id: state.attemptId,
      item_id: question.itemId,
      item_type: question.typeCode,
      student_answer: studentAnswer || null,
      correct_answer: question.answer,
      is_correct: isCorrect,
      score: isCorrect ? question.points : 0,
      time_spent_sec: timeSpentSec,
      answered_at: submittedAt.toISOString(),
    };
  });

  return {
    attempt: {
      attempt_id: state.attemptId,
      student_id: state.studentId,
      test_id: "TEST_DEMO_01",
      started_at: state.startedAt,
      submitted_at: submittedAt.toISOString(),
      status: "submitted",
      total_score: responses.reduce((total, response) => total + response.score, 0),
      max_score: questions.reduce((total, question) => total + question.points, 0),
    },
    responses,
  };
}

function renderResult(data) {
  $("#total-score").textContent = data.attempt.total_score;
  $("#result-message").textContent = `${data.attempt.student_id} 학생의 제출이 저장되었습니다. 총 ${data.attempt.total_score}점을 받았습니다.`;

  $("#result-table-body").innerHTML = data.responses.map((response, index) => `
    <tr>
      <td>${index + 1}번</td>
      <td>${response.item_type === "multiple_choice" ? "객관식" : "단답형"}</td>
      <td>${response.student_answer ?? "미응답"}</td>
      <td>${response.correct_answer}</td>
      <td class="${response.is_correct ? "correct" : "incorrect"}">${response.is_correct ? "정답" : response.student_answer ? "오답" : "미응답"}</td>
      <td>${response.score}</td>
      <td>${response.time_spent_sec}초</td>
    </tr>`).join("");

  $("#attempt-data").innerHTML = Object.entries(data.attempt).map(([key, value]) => `
    <div class="data-pill"><span>${key}</span><strong>${value}</strong></div>`).join("");

  $("#data-table-body").innerHTML = data.responses.map((response) => `
    <tr>
      <td>${response.response_id}</td>
      <td>${response.item_id}</td>
      <td>${response.student_answer ?? "null"}</td>
      <td>${response.is_correct}</td>
      <td>${response.score}</td>
      <td>${response.time_spent_sec}</td>
      <td>${formatDate(new Date(response.answered_at))}</td>
    </tr>`).join("");
  $("#raw-json").textContent = JSON.stringify(data, null, 2);
}

$("#start-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const studentId = $("#student-id").value.trim();
  if (!studentId) {
    $("#start-error").textContent = "학생 ID를 입력해 주세요.";
    $("#student-id").focus();
    return;
  }
  state.studentId = studentId;
  state.attemptId = createId("ATTEMPT");
  state.startedAt = isoNow();
  $("#active-student-id").textContent = studentId;
  $("#start-screen").classList.add("hidden");
  $("#result-screen").classList.add("hidden");
  $("#test-screen").classList.remove("hidden");
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#submit-button").addEventListener("click", () => {
  const unanswered = questions.map((_, index) => index).filter((index) => !getAnswer(index));
  if (unanswered.length) {
    $("#submit-warning").textContent = `아직 답하지 않은 문항이 있습니다: ${unanswered.map((index) => index + 1).join(", ")}번. 그래도 제출하려면 제출 버튼을 한 번 더 눌러 주세요.`;
    $("#submit-warning").classList.remove("hidden");
    if (!$("#submit-button").dataset.confirmed) {
      $("#submit-button").dataset.confirmed = "true";
      return;
    }
  }

  const result = collectAttempt();
  localStorage.setItem("lastMathTestAttempt", JSON.stringify(result));
  renderResult(result);
  $("#test-screen").classList.add("hidden");
  $("#result-screen").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#restart-button").addEventListener("click", () => {
  $("#result-screen").classList.add("hidden");
  $("#test-screen").classList.add("hidden");
  $("#start-screen").classList.remove("hidden");
  $("#student-id").value = "";
  $("#start-error").textContent = "";
  $("#submit-warning").classList.add("hidden");
  $("#submit-button").dataset.confirmed = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
