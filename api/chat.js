const MODEL_VERSION = process.env.OPENAI_MODEL || "gpt-6-luna";
const PROMPT_VERSION = "triangle-chat-live-v1.0";
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 15000;

const SYSTEM_PROMPT = `당신은 중학교 3학년 삼각비 문제를 함께 생각하는 수학교육 연구용 튜터입니다.

규칙:
1. 학생에게 질문 하나만 출력합니다.
2. 정답, 완성된 풀이, 다음 계산 결과, 식의 완성을 직접 제공하지 않습니다.
3. 학생의 최근 응답과 이전 대화 맥락을 고려합니다.
4. 질문은 epistemic, teleological, communicative 중 하나만 선택합니다.
5. 학생의 오답을 맞다고 인정하지 않습니다. 근거를 다시 살펴보게 합니다.
6. 학생이 모르겠다고 하면 정답을 주지 말고 문제의 각, 변, 관계를 작게 살펴보게 합니다.
7. 모호하거나 무관한 입력이면 문제와 연결되는 한 가지 관찰을 요청합니다.
8. 이전 질문을 그대로 반복하지 않습니다.
9. 반드시 JSON 하나만 출력합니다. 형식은 {"rationality_type":"...","question":"..."}입니다.
10. question에는 학생에게 보여 줄 한국어 질문 한 문장만 넣습니다. 연구용 용어와 메타데이터는 넣지 않습니다.`;

function makeRequestId() {
  return `REQ_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0 && retryAfter <= 10) return retryAfter * 1000;
  return 350 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
}

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseQuestion(text) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    throw Object.assign(new Error("AI 응답이 JSON 형식이 아닙니다."), { code: "invalid_ai_output" });
  }
  const validTypes = new Set(["epistemic", "teleological", "communicative"]);
  if (!validTypes.has(parsed?.rationality_type) || typeof parsed?.question !== "string" || !parsed.question.trim()) {
    throw Object.assign(new Error("AI 응답에 필요한 질문 정보가 없습니다."), { code: "invalid_ai_output" });
  }
  if (parsed.question.includes("\n") || parsed.question.split("?").length > 2) {
    throw Object.assign(new Error("AI 응답이 질문 하나 규칙을 지키지 않았습니다."), { code: "invalid_ai_output" });
  }
  if (/(정답은|답은|완성된 풀이|계산 결과는|따라서 .*입니다)/.test(parsed.question)) {
    throw Object.assign(new Error("AI 응답이 정답 제공 금지 규칙을 위반했습니다."), { code: "invalid_ai_output" });
  }
  return { rationality_type: parsed.rationality_type, question: parsed.question.trim() };
}

function buildInput({ problem, messages }) {
  const transcript = (messages || []).slice(-8).map((message) => {
    const speaker = message.speaker === "ai" ? "이전 질문" : "학생 발화";
    return `${speaker}: ${message.message_text}`;
  }).join("\n");
  return `문제: ${problem?.text || ""}\n조건: ${problem?.conditions || ""}\n최근 대화:\n${transcript || "아직 대화가 없습니다."}\n\n위 맥락을 바탕으로 다음 질문 하나를 JSON으로 작성하세요.`;
}

async function callOpenAI(payload) {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error("서버에 OPENAI_API_KEY가 설정되지 않았습니다."), { code: "missing_api_key", status: 503 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_VERSION,
        instructions: SYSTEM_PROMPT,
        input: buildInput(payload),
        max_output_tokens: 180,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function handleChatRequest(payload) {
  const requestId = makeRequestId();
  const startedAt = new Date().toISOString();
  let attemptsUsed = 0;
  let lastError = { code: "unknown_error", message: "AI 질문을 만들지 못했습니다." };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    attemptsUsed = attempt;
    try {
      const response = await callOpenAI(payload);
      if (!response.ok) {
        let errorData = null;
        try { errorData = await response.json(); } catch { /* keep generic error */ }
        const code = errorData?.error?.code || (response.status === 429 ? "rate_limit_exceeded" : "api_error");
        lastError = { code, message: "AI 서버가 요청을 처리하지 못했습니다.", status: response.status };
        if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status)) {
          await wait(retryDelay(response, attempt));
          continue;
        }
        break;
      }
      const data = await response.json();
      const parsed = parseQuestion(extractOutputText(data));
      return {
        ok: true,
        request_id: requestId,
        response_id: data.id || null,
        attempt_count: attempt,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        prototype_live: "live",
        prompt_version: PROMPT_VERSION,
        model_version: MODEL_VERSION,
        ...parsed,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = { code: "timeout", message: "AI 응답 시간이 초과되었습니다." };
      } else {
        lastError = { code: error?.code || "network_error", message: error?.message || "AI 질문을 만들지 못했습니다." };
      }
      if (attempt < MAX_ATTEMPTS && ["network_error", "timeout"].includes(lastError.code)) {
        await wait(350 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 150));
        continue;
      }
      break;
    }
  }
  return {
    ok: false,
    request_id: requestId,
    attempt_count: attemptsUsed,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    prototype_live: "live",
    prompt_version: PROMPT_VERSION,
    model_version: MODEL_VERSION,
    error_code: lastError.code,
    error_message: lastError.message,
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error_code: "method_not_allowed" });
    return;
  }
  const result = await handleChatRequest(req.body || {});
  res.status(result.ok ? 200 : (result.error_code === "missing_api_key" ? 503 : 502)).json(result);
}

module.exports = handler;
module.exports.handleChatRequest = handleChatRequest;
