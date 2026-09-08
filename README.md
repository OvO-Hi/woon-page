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

## 접속 / 잠금해제 알림

`supabase/functions/notify` (Edge Function)가 Discord 웹훅으로 중계한다.
웹훅 URL은 함수의 secret 에만 있고 저장소·클라이언트 코드 어디에도 없다.

Discord 로 나가는 것은 **종류와 시각뿐**이다. IP·위치·기기 정보는 보내지 않으며,
IP 는 호출 제한에만 쓰인다 — 원본은 어디에도 남지 않고 SHA-256 앞 8바이트만
쓰인다.

### 남용 방지

제한은 같은 IP **4회/분**, 전체 **20회/분**(분산 스팸 방어) 두 겹이다.
payload 는 `type` 이 `visit`/`unlock` 인 POST 만 받는다.

카운터를 함수 메모리(`Map`)에 두면 **동작하지 않는다.** Edge Function 은
요청마다 새 isolate 로 뜰 수 있어 매번 0 으로 초기화된다. 그래서 Storage 버킷
`notify-rl` 의 "같은 이름은 두 번 못 만든다"를 원자적 카운터로 쓴다:
`<키>/<분>/<슬롯 0..N-1>` 을 차례로 만들어 보고 전부 이미 있으면 그 분의 몫을
다 쓴 것이다. 버킷은 함수가 처음 호출될 때 스스로 만들고, 지난 분의 객체는
그 다음 분 첫 호출 때 지운다. 저장되는 값은 IP 해시 8바이트가 전부다.

> Storage 는 중복일 때 HTTP 409 가 아니라 **HTTP 400** 을 주고 본문에만
> `{"statusCode":"409","code":"KeyAlreadyExists"}` 를 담는다. 상태코드만 보면
> 중복을 놓쳐 제한이 통째로 무력화되니 본문을 봐야 한다.

### 배포

```
npx supabase login
npx supabase secrets set DISCORD_WEBHOOK_URL="<웹훅 URL>" --project-ref <ref>
npx supabase functions deploy notify --project-ref <ref>
```

### 내 기기에서 알림 끄기

브라우저 콘솔에서 한 줄:

```js
localStorage.setItem('woon-owner','1')   // 끄기
localStorage.removeItem('woon-owner')    // 다시 켜기
```

방문 알림은 세션당 1회(`sessionStorage`), 잠금해제 알림은 비밀번호를 직접
입력해 성공했을 때만 보낸다(저장된 키로 자동 해제될 때는 보내지 않는다).
전송 실패는 조용히 무시되어 페이지 동작에 영향이 없다.
