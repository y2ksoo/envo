# Envo — 영단어 학습 앱

책 페이지 사진이나 JSON 파일로 단어를 추가하고, Anki 방식으로 복습하며, 스펠링 퀴즈와 Claude AI 대화 연습을 할 수 있는 가족용 자체 호스팅 웹앱입니다.

## 기능

### 단어 추가
- **사진으로 추가**: 책 페이지를 촬영하면 Claude Vision이 단어를 자동 추출
- **JSON으로 추가**: 단어 목록 파일을 업로드하여 일괄 추가
- **직접 입력**: 단어, 품사, 정의, 예문, 유사어, 반의어를 수동 입력

### 단어장
- 전체 단어 목록을 한 줄 컴팩트 형식으로 표시 (단어 + 정의 미리보기)
- 단어 세트별 탭 필터로 주차별 단어만 모아보기
- 클릭하면 정의 / 예문 / 유사어 / 반의어 / 학습 통계 펼쳐보기
- 단어에서 바로 세트에 추가 가능

### 단어 세트 (주차별 관리)
- 주차 단위로 단어 세트 생성 및 관리
- 세트 단위로 복습 또는 퀴즈 시작
- 세트에 단어장 단어를 자유롭게 추가 / 제거

### 복습 (Anki 방식)
- **SM-2 알고리즘**: Anki와 동일한 간격 반복 스케줄링
- 복습 버튼: Again / Hard / Good / Easy (4단계)
- **복습 방식 선택**:
  - 오늘 예정 — 오늘 복습 예정인 카드만
  - 전체 복습 — 날짜 무관하게 전체 단어 복습
  - 핵심 복습 — 마지막 복습에서 Again/Hard였던 단어만
- 복습 범위를 전체 또는 특정 단어 세트로 지정 가능
- 완료 후 어려운 단어 수를 강조 표시, 바로 핵심 복습 연결

### 스펠링 퀴즈
- 정의를 보고 단어 스펠링을 직접 입력 (최대 20문제)
- 퀴즈 범위를 전체 또는 단어 세트 단위로 선택
- 마지막 결과가 자동 저장되어 다음 방문 시 이전 점수 확인 가능
- 틀린 단어만 추려서 다시 퀴즈 가능

### 영어 대화 연습
- Claude AI와 자유 영어 대화
- 문법 오류 자동 교정 및 설명 제공

### 다중 사용자
- 로그인 없이 사용자 선택만으로 전환
- 사용자별 독립적인 단어장, 세트, 학습 진도, 퀴즈 기록

## 기술 스택

| 영역 | 기술 |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, SQLite |
| Frontend | React 18, TypeScript, Vite |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| 배포 | Raspberry Pi 5, systemd, nginx |

## 개발 환경 실행 (로컬 테스트)

### 사전 요구사항
- Python 3.11+
- Node.js 18+
- Anthropic API 키

### 1. 환경 설정

```bash
cd backend
cp .env.example .env
```

`.env` 파일에서 API 키 입력:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. 개발 서버 실행

```bash
./scripts/dev.sh
```

| 주소 | 용도 |
|---|---|
| http://localhost:5173 | 앱 (브라우저) |
| http://localhost:8000/docs | API 문서 (Swagger) |
| http://192.168.x.x:5173 | 같은 Wi-Fi의 다른 기기 |

## Home Assistant (hassio) 배포

### 1. 애드온 패키지 생성 (개발 PC에서)

```bash
./scripts/setup.sh --hassio
```

`hassio-addon-pkg/` 폴더가 생성됩니다.

### 2. HA에 복사

HA에서 **SSH** 또는 **Samba** 애드온을 먼저 활성화한 뒤:

```bash
# SSH 방식
scp -r hassio-addon-pkg root@<HA_IP>:/addons/envo

# Samba 방식: 네트워크 드라이브의 addons/ 폴더에 envo/ 폴더로 복사
```

### 3. HA UI에서 설치

1. **설정 → 애드온 → 애드온 스토어 → ⋮ → 로컬 애드온 확인**
2. `Envo 영단어 학습` 찾아 **[설치]** (Docker 빌드, 5~10분 소요)
3. **[설정]** 탭에서 Anthropic API 키 입력
4. **[시작]** → `http://<HA_IP>:8000` 으로 접속

> 데이터(DB, 업로드 파일)는 HA의 `/data/envo/`에 영구 저장됩니다.

---

## 라즈베리파이 배포

### 1. 파일 복사

```bash
scp -r /path/to/envo pi@raspberrypi.local:~/envo
```

### 2. API 키 설정

```bash
# 라즈베리파이에서
nano /home/pi/envo/backend/.env
```

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=sqlite:////home/pi/envo/data/envo.db
UPLOAD_DIR=/home/pi/envo/backend/uploads
```

### 3. 설치 스크립트 실행

```bash
chmod +x ~/envo/scripts/setup.sh
~/envo/scripts/setup.sh

# 다른 경로에 설치하려면:
~/envo/scripts/setup.sh /home/myuser/envo
```

설치 완료 후 `http://라즈베리파이_IP` 로 접속합니다.

### 운영 명령어

```bash
# 서비스 상태 확인
sudo systemctl status envo-backend

# 로그 보기
sudo journalctl -u envo-backend -f

# 재시작
sudo systemctl restart envo-backend
```

### 백업 자동화 (선택)

```bash
# crontab 등록 - 매일 새벽 3시 백업
crontab -e
# 추가: 0 3 * * * /home/pi/envo/scripts/backup.sh
```

## JSON 파일 형식

단어 추가 → JSON 파일 탭에서 업로드할 파일 형식입니다.

**간단 형식**
```json
["ephemeral", "resilient", "meticulous", "eloquent"]
```

**상세 형식 (권장)**
```json
[
  {
    "word": "ephemeral",
    "part_of_speech": "adjective",
    "definition": "lasting for only a short time",
    "example_sentence": "Fame is ephemeral, but great work endures.",
    "synonyms": ["transient", "fleeting", "momentary"],
    "antonyms": ["permanent", "lasting", "enduring"]
  },
  {
    "word": "resilient",
    "part_of_speech": "adjective",
    "definition": "able to recover quickly from difficulties",
    "example_sentence": "She was resilient enough to bounce back."
  }
]
```

지원하는 키: `word` (필수), `definition` / `meaning` / `desc`, `part_of_speech` / `pos`, `example_sentence` / `example`, `synonyms`, `antonyms`

## 프로젝트 구조

```
envo/
├── backend/
│   ├── main.py              # FastAPI 앱, React 정적 파일 서빙
│   ├── sm2.py               # SM-2 간격 반복 알고리즘
│   ├── claude_client.py     # Claude API (OCR, 대화, 문법 교정)
│   ├── models.py            # SQLAlchemy 모델
│   ├── schemas.py           # Pydantic 스키마
│   ├── config.py            # 환경 설정
│   ├── database.py          # DB 연결, 테이블 생성, 마이그레이션
│   └── routers/
│       ├── users.py         # 사용자 관리
│       ├── cards.py         # 단어장 CRUD
│       ├── review.py        # 복습 세션 (SM-2, 복습 모드)
│       ├── word_sets.py     # 단어 세트 관리
│       ├── uploads.py       # 사진 업로드, OCR
│       └── conversation.py  # 대화 세션, 스트리밍
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── HomePage.tsx           # 대시보드, 빠른 메뉴
│       │   ├── UsersPage.tsx          # 사용자 관리
│       │   ├── ReviewPage.tsx         # 플래시카드 복습 (모드 선택)
│       │   ├── UploadPage.tsx         # 단어 추가 (사진/JSON/수동)
│       │   ├── VocabularyPage.tsx     # 단어장 (세트 필터, 컴팩트 뷰)
│       │   ├── WordSetsPage.tsx       # 단어 세트 목록
│       │   ├── WordSetDetailPage.tsx  # 세트 상세, 단어 추가/제거
│       │   ├── QuizPage.tsx           # 스펠링 퀴즈
│       │   ├── ConversationPage.tsx   # 대화 목록
│       │   └── ChatPage.tsx           # 실시간 대화
│       ├── api/client.ts    # API 클라이언트
│       └── types/index.ts   # TypeScript 타입
├── scripts/
│   ├── dev.sh               # 로컬 개발 서버
│   ├── setup.sh             # 라즈베리파이 설치
│   └── backup.sh            # DB 백업
├── systemd/
│   └── envo-backend.service # systemd 서비스 설정
└── nginx/
    └── envo.conf            # nginx 리버스 프록시 설정
```

## API 주요 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/users/{id}/cards` | 단어장 조회 |
| GET | `/api/users/{id}/review/session?mode=scheduled\|all\|hard` | 복습 카드 |
| GET | `/api/users/{id}/word-sets` | 단어 세트 목록 |
| POST | `/api/users/{id}/word-sets/{sid}/cards` | 세트에 단어 추가 |

개발 서버 실행 후 http://localhost:8000/docs 에서 Swagger UI로 모든 API를 확인하고 직접 테스트할 수 있습니다.

## 데이터베이스

SQLite 파일 위치:
- 로컬 개발: `backend/data/envo.db`
- 라즈베리파이: `/home/pi/envo/data/envo.db`

DB 직접 조회:
```bash
sqlite3 backend/data/envo.db
sqlite> .tables
sqlite> SELECT * FROM users;
sqlite> SELECT word, definition FROM words LIMIT 10;
sqlite> SELECT name, card_count FROM word_sets;
```
