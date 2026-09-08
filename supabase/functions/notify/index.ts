// 접속 / 잠금해제 알림 → Discord
//
// 웹훅 URL 은 이 파일에도 저장소에도 없다. Supabase secret 으로만 주입한다:
//   npx supabase secrets set DISCORD_WEBHOOK_URL="..." --project-ref <ref>
//
// 개인정보는 보내지 않는다. Discord 로 나가는 것은 "종류 + 시각" 뿐이다.
// IP 는 호출 제한에만 쓰고, 원본은 어디에도 남기지 않는다 —
// SHA-256 앞 8바이트만 객체 '이름'으로 쓰이고 1분 뒤 폐기된다.
//
// 제한을 메모리(Map)로 두면 동작하지 않는다. Edge Function 은 요청마다
// 새 isolate 로 뜰 수 있어서 카운터가 매번 초기화된다. 그래서 Storage 의
// "이미 있으면 409" 성질을 원자적 카운터로 쓴다: 슬롯 0..N-1 을 차례로
// 만들어 보고, 전부 이미 있으면 그 분(分)의 몫을 다 쓴 것이다.

const WEBHOOK = Deno.env.get("DISCORD_WEBHOOK_URL");
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BUCKET = "notify-rl";
const MAX_HITS = 4;    // 같은 IP 분당 허용 횟수
const MAX_GLOBAL = 20; // 전체 분당 허용 횟수 (분산 스팸 방어)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const sbHeaders = () => ({
  Authorization: `Bearer ${SB_KEY}`,
  apikey: SB_KEY,
});

async function fingerprint(ip: string): Promise<string> {
  // 원본 IP 는 보관하지 않는다 — 앞 8바이트 해시만 객체 이름으로 쓴다
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("woon:" + ip),
  );
  return Array.from(new Uint8Array(buf).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  await fetch(`${SB_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: BUCKET, id: BUCKET, public: false }),
  }).catch(() => {});
  bucketReady = true; // 이미 있으면 409 — 어느 쪽이든 준비된 것으로 본다
}

// 슬롯 하나를 원자적으로 선점한다. 성공 = 내가 만듦, 중복 = 이미 있음.
//
// 주의: Storage 는 중복일 때 HTTP 409 가 아니라 HTTP 400 을 주고,
// 본문에만 {"statusCode":"409", "code":"KeyAlreadyExists"} 를 담는다.
// 상태코드만 보면 중복을 놓치고 제한이 통째로 무력화된다.
async function claim(path: string): Promise<"got" | "taken" | "error"> {
  const res = await fetch(
    `${SB_URL}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: { ...sbHeaders(), "Content-Type": "text/plain" },
      body: "1",
    },
  ).catch(() => null);
  if (!res) return "error";
  if (res.ok) return "got";
  const txt = await res.text().catch(() => "");
  if (res.status === 409 || txt.includes("AlreadyExists")) return "taken";
  return "error";
}

// key 에 대해 이번 분(分)의 몫이 남았는지 본다.
async function allowed(key: string, max: number, minute: number) {
  for (let slot = 0; slot < max; slot++) {
    const r = await claim(`${key}/${minute}/${slot}`);
    if (r === "got") return { ok: true, first: slot === 0 };
    if (r === "error") return { ok: true, first: false }; // 저장소 장애 시 통과
  }
  return { ok: false, first: false };
}

// 이번 분의 첫 호출일 때만, 그 key 의 지난 분 흔적을 지운다.
async function sweep(key: string, minute: number) {
  const prefixes: string[] = [];
  for (let m = minute - 3; m < minute; m++) {
    for (let s = 0; s < Math.max(MAX_HITS, MAX_GLOBAL); s++) {
      prefixes.push(`${key}/${m}/${s}`);
    }
  }
  await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const type = (body as { type?: unknown } | null)?.type;
  if (type !== "visit" && type !== "unlock") {
    return json({ error: "bad type" }, 400);
  }

  const minute = Math.floor(Date.now() / 60_000);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";

  if (SB_URL && SB_KEY) {
    await ensureBucket();

    const g = await allowed("all", MAX_GLOBAL, minute);
    if (g.first) await sweep("all", minute);
    if (!g.ok) return json({ ok: true, skipped: "global" });

    const fp = await fingerprint(ip);
    const p = await allowed(fp, MAX_HITS, minute);
    if (p.first) await sweep(fp, minute);
    if (!p.ok) return json({ ok: true, skipped: "rate" });
  }

  if (!WEBHOOK) return json({ ok: true, skipped: "no webhook" });

  const when = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const content = type === "unlock"
    ? `封 해제 — 비공개 구역 열람\n${when}`
    : `기록부 열람\n${when}`;

  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch {
    // 전달 실패는 조용히 넘긴다
  }
  return json({ ok: true });
});
