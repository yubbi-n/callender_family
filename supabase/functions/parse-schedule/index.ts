// 근무표 사진 → 날짜별 근무 코드.
// Supabase 대시보드 → Edge Functions 에 "parse-schedule" 이름으로 이 파일 내용을 붙여넣어 배포해요.
// 필요한 비밀값: ANTHROPIC_API_KEY (Edge Functions → Secrets)
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SCHEMA = {
  type: "object",
  properties: {
    year: { type: "integer" },
    month: { type: "integer" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: { day: { type: "integer" }, code: { type: "string" } },
        required: ["day", "code"],
        additionalProperties: false,
      },
    },
    legend: {
      type: "array",
      items: {
        type: "object",
        properties: { code: { type: "string" }, count: { type: "integer" } },
        required: ["code", "count"],
        additionalProperties: false,
      },
    },
    note: { type: "string" },
  },
  required: ["year", "month", "days", "legend", "note"],
  additionalProperties: false,
};

type Code = { code: string; name?: string; is_off?: boolean };

function instructions(year: number, month: number, codes: Code[]) {
  const off = codes.find((c) => c.is_off)?.code || "OFF";
  const known = codes.length
    ? codes.map((c) => `${c.code}${c.name ? ` (${c.name})` : ""}${c.is_off ? " = day off" : ""}`).join(", ")
    : "none yet";
  return `This image is a screenshot of a monthly calendar from a work-schedule app. It shows ONE person's shifts.
Read the shift code written in each date cell of the main month.

Rules:
- Only include dates of the main month. Ignore greyed-out dates from the previous or next month.
- The shift code is the short label inside the cell (for example D, E, N, OFF, S, 주, 야, 휴). Ignore date numbers, holiday names, memos and personal notes.
- If a cell shows an icon that means a day off (clover, leaf, house, an "off" badge, etc.), use "${off}".
- If a date cell has no shift at all, leave that day out.
- This person's known codes: ${known}. Use these exact spellings when the image matches them. Otherwise return the code exactly as shown (at most 4 characters, Latin letters in uppercase).
- If the image has a legend or summary that counts each code for the month (for example "D 8  E 2  N 3"), return those counts in "legend". Otherwise return an empty array.
- year and month: read them from the calendar header. If they are not visible, use ${year} and ${month}.
- note: one short sentence in Korean about anything you were unsure of (unreadable or ambiguous cells). Use an empty string if everything was clear.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply("ok");
  if (req.method !== "POST") return reply({ error: "POST만 받아요" }, 405);

  // 가족에 연결된 기기에서 온 요청인지 확인해요 (아무나 크레딧을 쓰지 못하게).
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  const who = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/my_session`, {
    method: "POST",
    headers: { Authorization: auth, apikey, "Content-Type": "application/json" },
    body: "{}",
  });
  const session = who.ok ? await who.json() : null;
  if (!session || !session.member_id) return reply({ error: "가족에 연결된 기기에서만 쓸 수 있어요" }, 401);

  let body: { image?: string; media_type?: string; year?: number; month?: number; codes?: Code[] };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "요청 형식이 잘못됐어요" }, 400);
  }
  const { image, media_type = "image/jpeg", codes = [] } = body;
  const now = new Date();
  const year = Number(body.year) || now.getFullYear();
  const month = Number(body.month) || now.getMonth() + 1;
  if (!image || image.length > 6_000_000) return reply({ error: "사진이 없거나 너무 커요" }, 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(media_type)) return reply({ error: "JPG·PNG 사진만 올릴 수 있어요" }, 400);

  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: image } },
            { type: "text", text: instructions(year, month, codes.slice(0, 20)) },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return reply({ error: "이 사진은 인식할 수 없어요" }, 422);
    if (response.stop_reason === "max_tokens") return reply({ error: "인식 결과가 너무 길어요. 한 달 화면만 올려주세요" }, 422);
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return reply({ error: "인식 결과가 비어 있어요" }, 502);

    const out = JSON.parse(text.text);
    const last = new Date(Date.UTC(out.year, out.month, 0)).getUTCDate();
    const fix = (c: string) => String(c).trim().slice(0, 4).replace(/[a-z]/g, (ch) => ch.toUpperCase());
    out.days = (out.days as { day: number; code: string }[])
      .filter((d) => Number.isInteger(d.day) && d.day >= 1 && d.day <= last && String(d.code).trim())
      .map((d) => ({ day: d.day, code: fix(d.code) }));
    out.legend = (out.legend as { code: string; count: number }[]).map((l) => ({ code: fix(l.code), count: l.count }));
    return reply(out);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return reply({ error: "서버의 Claude API 키가 올바르지 않아요" }, 500);
    if (e instanceof Anthropic.RateLimitError) return reply({ error: "요청이 많아요. 잠시 뒤에 다시 해주세요" }, 429);
    if (e instanceof Anthropic.BadRequestError) return reply({ error: "인식 요청이 거절됐어요: " + e.message }, 400);
    if (e instanceof Anthropic.APIError) return reply({ error: `Claude API 오류 (${e.status})` }, 502);
    if (e instanceof SyntaxError) return reply({ error: "인식 결과를 읽지 못했어요. 다시 시도해주세요" }, 502);
    return reply({ error: "알 수 없는 오류: " + String(e) }, 500);
  }
});
