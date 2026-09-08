# 雲 — 인물 기록부

정적 페이지. `build.py` 가 로컬 원문(`*.txt`)을 읽어 `index.html` 을 생성한다.

## 빌드

```
python3 -m venv venv && venv/bin/pip install cryptography
venv/bin/python build.py
```

빌드에 필요한 로컬 파일 (모두 `.gitignore`, 저장소에 올리지 않는다):

| 파일 | 내용 |
|---|---|
| `content.txt` 외 `*.txt` | 본문 원문 |
| `gate.pw` | 비공개 구역 비밀번호 (또는 환경변수 `WOON_GATE_PW`) |
| `secret.txt` | 계정·인증 링크·확인 답변 등 비공개 값 |

저장소에는 생성물(`index.html`)과 빌드 스크립트만 올라간다. 빌드 스크립트에는
비밀번호도 비공개 값도 평문으로 들어 있지 않다.

## 비공개 구역

"아래는 비공개 사항입니다." 이후 구역(非說 / 연락 가능한 계정 / 성인인증 /
통합문서 확인 질문)은 **AES-GCM 으로 암호화되어** `index.html` 에 암호문으로만
실린다. 비밀번호에서 PBKDF2-HMAC-SHA256(31만 회, 랜덤 salt)으로 키를 유도하며,
평문은 저장소·배포본·개발자도구 어디에도 남지 않는다.

성공하면 유도된 키(비밀번호 원문이 아님)를 `localStorage` 에 버전 키로 저장해
재방문 시 자동 복호화한다.

### 비밀번호를 바꾸려면

`build.py` 의 `GATE_PASSWORD` 를 새 값으로 고치고 `GATE_VERSION` 을 `woon-gate-v2`
로 올린 뒤 다시 빌드한다. 버전이 바뀌면 기존 기기에 저장된 키가 무효가 되어
모든 기기에서 다시 입력하게 된다.

## 열람자 표시

`config.js` 의 Supabase URL / anon key 로 동작한다. 비워두면 표시가 조용히
사라지고 페이지는 그대로 동작한다.
