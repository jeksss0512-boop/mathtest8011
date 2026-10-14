# 삼각비 생각 나누기 프로토타입

연구용 AI 챗봇의 화면 흐름과 연구 로그 형태를 확인하기 위한 최소 프로토타입입니다.

## 실행

프로젝트 폴더에서 로컬 서버를 실행합니다.

```powershell
python -m http.server 8765
```

학생 화면:

`http://127.0.0.1:8765/app/trig-chatbot/index.html`

연구자 로그 화면:

`http://127.0.0.1:8765/app/trig-chatbot/researcher.html`

## 현재 기능

- 가명 학생 ID 입력
- 삼각비 문제 1개와 PDF에서 확인한 그림 표시
- 학생 첫 생각과 후속 응답 입력
- 실제 AI가 만드는 질문 1개씩 표시
- 활동 종료와 저장 상태 안내
- 브라우저 `localStorage` 임시 저장
- 연구자용 JSON·CSV 내보내기
- 학생 화면에서 연구용 메타데이터 숨김
- 활동 종료 중복 클릭 방지
- AI 요청별 성공·실패·재시도 횟수 기록

## 현재 연결 방식

- 브라우저는 `/api/chat` 서버 경로만 호출합니다.
- 서버 경로가 OpenAI Responses API를 호출합니다.
- 기본 모델은 `gpt-6-luna`이며 `OPENAI_MODEL` 환경변수로 바꿀 수 있습니다.
- API 키는 `OPENAI_API_KEY` 서버 환경변수에서만 읽습니다.
- AI 응답이 실패하면 가상 질문으로 대신하지 않습니다.
- 실제 AI 질문은 `prototype_live: "live"`로 저장합니다.
- `prompt_version`, `model_version`, `timestamp`, `rationality_type`을 함께 저장합니다.

## 로컬 실행

API 키 값을 파일이나 채팅에 기록하지 않습니다. 키를 안전한 환경변수로 설정한 뒤 실행합니다.

```powershell
$env:OPENAI_API_KEY = "여기에 직접 입력"
npm run dev
```

학생 화면: `http://127.0.0.1:8767/app/trig-chatbot/index.html`

연구자 로그 화면: `http://127.0.0.1:8767/app/trig-chatbot/researcher.html`

## 아직 연결하지 않은 것

- Supabase 데이터베이스
- 로그인과 연구자 권한
- 실제 연구 운영용 개인정보 보호 체계

키가 설정되지 않거나 AI 요청이 실패하면 화면에 오류를 표시하고 AI 질문을 저장하지 않습니다. 실제 연구자료가 아닌 가상 ID로만 연결 테스트를 진행해야 합니다.
