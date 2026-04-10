# Envo — 영어 학습 앱

책 페이지 사진이나 JSON 파일로 단어를 추가하고, Anki 방식으로 복습하며, Claude AI와 영어 대화 연습을 할 수 있는 가족용 자체 호스팅 웹앱입니다.

## 기능

### 단어 암기 (Anki 방식)
- **사진으로 추가**: 책 페이지를 촬영하면 Claude Vision이 단어를 자동 추출
- **JSON으로 추가**: 단어 목록 파일을 업로드하여 일괄 추가
- **직접 입력**: 단어, 품사, 정의, 예문을 수동 입력
- **SM-2 알고리즘**: Anki와 동일한 간격 반복 스케줄링 (Again / Hard / Good / Easy)

### 영어 대화 연습
- Claude AI와 자유 영어 대화
- 암기한 단어를 포커스 단어로 설정하면 대화 중 자연스럽게 활용
- 문법 오류 자동 교정 및 설명 제공

### 다중 사용자
- 로그인 없이 사용자 선택만으로 전환
- 사용자별 독립적인 단어장과 학습 진도

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
    "example_sentence": "Fame is ephemeral, but great work endures."
  },
  {
    "word": "resilient",
    "part_of_speech": "adjective",
    "definition": "able to recover quickly from difficulties",
    "example_sentence": "She was resilient enough to bounce back."
  }
]
```

지원하는 키: `word` (필수), `definition` / `meaning` / `desc`, `part_of_speech` / `pos`, `example_sentence` / `example`

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
│   ├── database.py          # DB 연결, 테이블 생성
│   └── routers/
│       ├── users.py         # 사용자 관리
│       ├── cards.py         # 단어장 CRUD
│       ├── review.py        # 복습 세션 (SM-2)
│       ├── uploads.py       # 사진 업로드, OCR
│       └── conversation.py  # 대화 세션, 스트리밍
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── HomePage.tsx        # 대시보드, 사용자 관리
│       │   ├── ReviewPage.tsx      # 플래시카드 복습
│       │   ├── UploadPage.tsx      # 단어 추가 (사진/JSON/수동)
│       │   ├── VocabularyPage.tsx  # 단어장 조회
│       │   ├── ConversationPage.tsx # 대화 목록
│       │   └── ChatPage.tsx        # 실시간 대화
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

## API 문서

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
```
