// Supabase Edge Function: verify-photo
// 배포: supabase functions deploy verify-photo
// 시크릿 설정: supabase secrets set GEMINI_API_KEY=<your_key>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 사용자당 하루 최대 AI 호출 횟수
const MAX_DAILY_USER_CALLS = 20;
// 요청 본문 최대 크기: 8MB (base64 기준 ~6MB 이미지)
const MAX_BODY_BYTES = 8 * 1024 * 1024;

type VerifyTypeKey =
  | "step_walk" | "run_scenery" | "quote_photo"
  | "book_cover" | "celeb_pose" | "location_photo";

interface VerifyTypeData {
  label: string;
  desc: string;
  checklist: string[];
  rejectReasons: string[];
}

const VERIFY_TYPES: Record<VerifyTypeKey, VerifyTypeData> = {
  step_walk: {
    label: "걷기 인증",
    desc: "만보기 화면을 캡처해서 인증해요",
    checklist: ["걸음 수 숫자 가독성", "오늘 날짜 표시 확인", "5,000보 이상 달성 여부", "공식 앱 화면 여부"],
    rejectReasons: ["걸음 수 숫자가 보이지 않음", "날짜를 확인할 수 없음", "5,000보 미만", "캡처가 아닌 재촬영 의심"],
  },
  run_scenery: {
    label: "러닝 풍경",
    desc: "러닝하면서 찍은 최애 풍경을 공유해요",
    checklist: ["야외 환경 확인", "러닝 흔적(앱·복장) 확인", "자연광 또는 충분한 밝기", "실내가 아닌 외부 공간"],
    rejectReasons: ["실내에서 찍은 사진", "러닝 흔적이 전혀 없음", "너무 어두워서 장소 불명", "이전에 올린 사진과 동일"],
  },
  quote_photo: {
    label: "인상 문장",
    desc: "오늘 곱씹게 되는 문장을 사진으로 남겨요",
    checklist: ["텍스트 선명도 (블러 없음)", "문장 전체 가독성", "출처(책·노트) 확인", "한국어·영어 텍스트 인식"],
    rejectReasons: ["글자가 흐릿하거나 초점 없음", "문장이 잘려서 내용 파악 불가", "빛 반사로 텍스트 안 보임", "텍스트가 아닌 다른 콘텐츠"],
  },
  book_cover: {
    label: "책 표지",
    desc: "지금 읽고 있는 책 표지를 찍어요",
    checklist: ["책 제목 가독성", "저자명 확인", "표지 전체 노출 여부", "실물 책 또는 전자책 화면"],
    rejectReasons: ["제목 또는 저자가 잘림", "너무 멀리서 찍어 글자 안 보임", "조명 부족으로 표지 불분명", "이미 오늘 인증한 동일 표지"],
  },
  celeb_pose: {
    label: "포즈 인증",
    desc: "오늘의 지정 포즈로 사진을 찍어요",
    checklist: ["포즈 유사도 (지정 포즈와 비교)", "얼굴 노출 여부", "전신·상반신 확인", "실내·외 무관 적절한 밝기"],
    rejectReasons: ["지정 포즈와 전혀 다른 자세", "얼굴이 가려져 있음", "몸이 잘려서 포즈 확인 불가", "너무 어두워서 구분 불가"],
  },
  location_photo: {
    label: "장소 인증",
    desc: "목표한 장소에서 사진을 찍어요",
    checklist: ["장소 특징(간판·건물) 확인", "실외 또는 특정 공간 여부", "낮 시간대 또는 충분한 밝기", "GPS 위치 일치 여부"],
    rejectReasons: ["장소를 특정할 수 없음", "너무 어두워서 배경 불명", "이전 사진 재사용 의심", "실내 일반 공간 (무의미한 장소)"],
  },
};

/**
 * KST(UTC+9) 기준 오늘 하루의 시작/끝을 UTC ISO 문자열로 반환합니다.
 * 이전 코드의 setUTCHours(0,0,0,0) 방식은 UTC 자정 기준이라
 * KST 00:00~08:59 인증이 "전날"로 저장돼 하루 2회 인증이 가능했습니다.
 */
function kstTodayRange(): { start: string; end: string } {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const kstDate = kstNow.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return {
    start: new Date(`${kstDate}T00:00:00+09:00`).toISOString(),
    end:   new Date(`${kstDate}T23:59:59.999+09:00`).toISOString(),
  };
}

function todayLabel(): string {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
    timeZone: "Asia/Seoul",
  });
}

function buildPrompt(key: VerifyTypeKey): string {
  const vt = VERIFY_TYPES[key];
  const today = todayLabel();
  const dateNote = key === "step_walk"
    ? `\n⚠️ [날짜 필수] 사진에 표시된 날짜가 오늘(${today})과 일치해야 합니다. 날짜가 다르거나 보이지 않으면 자동 거절합니다.`
    : "";

  return `당신은 챌린지 앱의 엄격한 사진 인증 AI입니다.
오늘 날짜: ${today}${dateNote}

인증 유형: ${vt.label}
목적: ${vt.desc}

[필수 체크리스트 - 모든 항목이 사진에서 명확히 확인돼야 합니다]
${vt.checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}

[자동 거절 기준 - 하나라도 해당하면 즉시 거절]
${vt.rejectReasons.map(r => `• ${r}`).join("\n")}

[이미지 품질 기준 - 아래 중 하나라도 해당하면 거절]
• 심한 블러 또는 초점이 전혀 맞지 않음
• 핵심 정보가 가려지거나 잘려 있음
• 과노출 또는 극도로 어두워 내용 확인 불가

[판정 일관성 규칙 - 반드시 준수]
• passed=true 이면 failedChecks는 반드시 빈 배열 []
• passed=false 이면 failedChecks에 실패한 체크리스트 항목 원문을 반드시 포함
• score 기준: 통과 확신=85~100, 통과이지만 일부 불명확=70~84, 거절=0~69
• 확신이 없으면 거절 (엄격하게 판단)

JSON만 응답하세요 (마크다운, 설명 없이):
{
  "passed": true 또는 false,
  "score": 0~100 정수,
  "failedChecks": [],
  "reason": "한국어 1~2문장"
}`;
}

interface VerifyResult {
  passed: boolean;
  score: number;
  failedChecks: string[];
  reason: string;
}

function parseResult(raw: unknown, key: VerifyTypeKey): VerifyResult {
  if (typeof raw !== "object" || raw === null) {
    return { passed: false, score: 0, failedChecks: [], reason: "AI 응답 형식 오류" };
  }
  const obj = raw as Record<string, unknown>;
  const passed = obj.passed === true;
  const score = typeof obj.score === "number"
    ? Math.max(0, Math.min(100, Math.round(obj.score))) : 0;
  const reason = typeof obj.reason === "string" && obj.reason.trim()
    ? obj.reason.trim() : "판정 이유 없음";

  const checklist = VERIFY_TYPES[key].checklist;
  let failedChecks: string[] = [];
  if (!passed && Array.isArray(obj.failedChecks)) {
    failedChecks = (obj.failedChecks as unknown[])
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .map(c => checklist.find(ci => ci === c) ?? c)
      .slice(0, checklist.length);
  }
  if (passed) failedChecks = [];

  return { passed, score, failedChecks, reason };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Gemini API 단건 호출 */
async function callGemini(geminiKey: string, key: VerifyTypeKey, image: string): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: "image/jpeg", data: image } },
          { text: buildPrompt(key) },
        ]}],
        generationConfig: { maxOutputTokens: 1024, temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
}

/** Storage 업로드를 최대 2회 시도하고, 성공 시 public URL을 반환합니다. */
async function uploadWithRetry(
  serviceClient: ReturnType<typeof createClient>,
  filePath: string,
  imageBytes: Uint8Array,
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await serviceClient.storage
      .from("verifications")
      .upload(filePath, imageBytes, { contentType: "image/jpeg", upsert: false });
    if (!error) {
      return serviceClient.storage.from("verifications").getPublicUrl(filePath).data.publicUrl;
    }
    console.error(`Storage upload attempt ${attempt + 1} failed:`, error);
    if (attempt === 0) await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  /* ── 인증 ── */
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) return jsonResponse({ error: "Server misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  /* ── 요청 파싱 + 본문 크기 제한 ── */
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "이미지 크기가 너무 큽니다. 6MB 이하 이미지를 사용해주세요." }, 413);
  }

  let body: { image: string; verifyType: string; groupId?: string | null };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { image, verifyType, groupId } = body;
  if (!image || !verifyType || !VERIFY_TYPES[verifyType as VerifyTypeKey]) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }
  const key = verifyType as VerifyTypeKey;
  let verifiedGroupId: string | null = null;

  if (groupId) {
    const { data: membership, error: membershipError } = await serviceClient
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("[verify-photo] Membership check failed:", membershipError);
      return jsonResponse({ error: "그룹 가입 상태를 확인하지 못했습니다." }, 500);
    }

    if (!membership) {
      return jsonResponse({ error: "참여 중인 그룹에서만 인증할 수 있습니다." }, 403);
    }

    verifiedGroupId = membership.group_id;
  }

  /* ── KST 기준 오늘 범위 계산 ── */
  const { start: todayStart, end: todayEnd } = kstTodayRange();

  /* ── 서버 사이드 rate limit: 사용자 전체 일일 호출 한도 ── */
  const { count: totalTodayAttempts } = await serviceClient
    .from("verify_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("attempted_at", todayStart)
    .lte("attempted_at", todayEnd);

  if ((totalTodayAttempts ?? 0) >= MAX_DAILY_USER_CALLS) {
    return jsonResponse(
      { error: `하루 인증 시도 한도(${MAX_DAILY_USER_CALLS}회)에 도달했습니다. 내일 다시 시도해주세요.` },
      429,
    );
  }

  /* ── Gemini API 호출 (429 시 3초 후 1회 재시도) ── */
  let geminiRes = await callGemini(geminiKey, key, image);

  if (!geminiRes.ok && geminiRes.status === 429) {
    // 일시적 RPM 초과일 수 있으므로 3초 대기 후 재시도
    await new Promise(r => setTimeout(r, 3000));
    geminiRes = await callGemini(geminiKey, key, image);
  }

  if (!geminiRes.ok) {
    const errBody = await geminiRes.json().catch(() => null) as { error?: { code?: number; message?: string; status?: string } } | null;
    console.error(`[verify-photo] Gemini error status=${geminiRes.status}`, JSON.stringify(errBody));
    if (geminiRes.status === 429) {
      // 재시도 후에도 429 → 내부 시도 횟수 소모 없이 503 반환
      return jsonResponse(
        { error: "AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요." },
        503,
      );
    }
    // 다른 Gemini 오류 → 시도 기록 후 502 반환
    await serviceClient.from("verify_attempts").insert({ user_id: user.id });
    return jsonResponse({ error: `Gemini 오류: ${errBody?.error?.message ?? geminiRes.status}` }, 502);
  }

  /* ── 시도 기록 (Gemini 호출 성공 이후에 기록 — 외부 API 장애 시 소모 방지) ── */
  await serviceClient.from("verify_attempts").insert({ user_id: user.id });

  const geminiData = await geminiRes.json() as {
    candidates?: { content: { parts: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  };

  if (geminiData.candidates?.[0]?.finishReason === "SAFETY") {
    return jsonResponse({ passed: false, score: 0, failedChecks: [], reason: "사진이 안전 정책에 의해 차단됐습니다." });
  }

  // thinking 모델은 parts 중 thought:true 부분 제외하고 실제 텍스트만 추출
  const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
  console.log("[verify-photo] Gemini full response:", JSON.stringify(geminiData).slice(0, 800));
  const text = parts.find(p => !p.thought && typeof p.text === "string")?.text?.trim()
    ?? parts[0]?.text?.trim()
    ?? "";
  console.log("[verify-photo] Gemini raw text:", text.slice(0, 300));
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let result: VerifyResult;
  try {
    result = jsonMatch
      ? parseResult(JSON.parse(jsonMatch[0]), key)
      : { passed: false, score: 0, failedChecks: [], reason: "AI 응답을 파싱할 수 없습니다." };
  } catch {
    result = { passed: false, score: 0, failedChecks: [], reason: "AI 응답 파싱 실패" };
  }

  /* ── 통과 시: Storage 업로드 → DB 저장 → XP 지급 ── */
  if (result.passed) {
    const imageBytes = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const photoUrl = await uploadWithRetry(serviceClient, filePath, imageBytes);
    if (!photoUrl) {
      return jsonResponse({ error: "인증 사진 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, 500);
    }

    const { data: verificationRow, error: insertError } = await serviceClient.from("verifications").insert({
      user_id: user.id,
      group_id: verifiedGroupId,
      verify_type: key,
      status: "completed",
      photo_url: photoUrl,
      xp_earned: 10,
    }).select("id").single();

    if (insertError) {
      console.error("Verification insert failed:", insertError);
      return jsonResponse({ error: "DB 저장 실패. 다시 시도해주세요." }, 500);
    }

    if (verifiedGroupId) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const { data: group } = await serviceClient
        .from("groups")
        .select("goal, name")
        .eq("id", verifiedGroupId)
        .maybeSingle();

      const { error: activityError } = await serviceClient.from("activity_posts").insert({
        group_id: verifiedGroupId,
        user_id: user.id,
        verification_id: verificationRow?.id ?? null,
        verify_type: key,
        photo_url: photoUrl,
        message: group?.goal ? `${group.goal} 인증 완료` : `${group?.name ?? "챌린지"} 인증 완료`,
        author_name: profile?.username ?? user.email?.split("@")[0] ?? "챌리 유저",
        author_avatar_url: profile?.avatar_url ?? null,
      });

      if (activityError) {
        console.error("Activity post insert failed:", activityError);
      }
    }

    await serviceClient.rpc("increment_user_xp", { p_user_id: user.id, p_amount: 10 });

    return jsonResponse({ ...result, photoUrl });
  }

  return jsonResponse(result);
});
