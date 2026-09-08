// 접속 / 잠금해제 알림 → Discord
//
// 웹훅 URL 은 이 파일에도 저장소에도 없다. Supabase secret 으로만 주입한다:
//   npx supabase secrets set DISCORD_WEBHOOK_URL="..." --project-ref <ref>
//
// 개인정보는 보내지 않는다. Discord 로 나가는 것은 "종류 + 시각" 뿐이며,
// IP 는 분당 호출 제한에만 쓰고 해시로만 메모리에 두었다가 버린다.

const WEBHOOK = Deno.env.get("DISCORD_WEBHOOK_URL");

const WINDOW_MS = 60_000;   // 1분
const MAX_HITS = 4;         // 같은 IP 기준 분당 허용 횟수
const hits = new Map<string, number[]>();

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

async function fingerprint(ip: string): Promise<string> {
  // 원본 IP 는 보관하지 않는다 — 앞 8바이트 해시만 잠깐 메모리에 둔다
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("woon:" + ip),
  );
  return Array.from(new Uint8Array(buf).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function allowed(key: string): boolean {
  const now = Date.now();
  const prev = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX_HITS) {
    hits.set(key, prev);
    return false;
  }
  prev.push(now);
  hits.set(key, prev);
  if (hits.size > 5000) hits.clear();   // 메모리 상한
  return true;
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

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  if (!allowed(await fingerprint(ip))) return json({ ok: true, skipped: true });

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
