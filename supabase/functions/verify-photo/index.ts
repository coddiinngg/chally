// Supabase Edge Function: verify-photo
// 배포: supabase functions deploy verify-photo
// 시크릿 설정: supabase secrets set GEMINI_API_KEY=<your_key>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 사용자당 하루 최대 AI 호출 횟수
const MAX_DAILY_USER_CALLS = 30;
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
    checklist: [
      "걸음 수 숫자 각 자릿수를 직접 읽을 수 있음 (예: 5,234 처럼 선명하게 보임)",
      "오늘 날짜 표시 확인",
      "읽힌 숫자가 5,000 이상",
      "공식 앱 화면 여부 (스크린샷)",
    ],
    rejectReasons: [
      "걸음 수 숫자가 흐리거나 가려져 자릿수를 직접 읽을 수 없음",
      "날짜를 확인할 수 없음",
      "읽힌 걸음 수가 5,000 미만",
      "캡처가 아닌 재촬영 의심",
    ],
  },
  run_scenery: {
    label: "러닝 풍경",
    desc: "러닝하면서 찍은 최애 풍경을 공유해요",
    checklist: [
      "러닝 증거 직접 확인 (달리기 앱 화면·러닝복·운동화·GPS 기록 중 최소 하나)",
      "야외 환경 확인 (실내 불가)",
      "자연광 또는 충분한 밝기",
      "인증자가 현장에서 직접 찍은 사진",
    ],
    rejectReasons: [
      "러닝 증거(앱·복장·장비)가 사진에서 전혀 확인되지 않음",
      "실내에서 찍은 사진",
      "너무 어두워서 장소 불명",
      "인터넷 풍경 사진 재사용 의심",
    ],
  },
  quote_photo: {
    label: "인상 문장",
    desc: "오늘 곱씹게 되는 문장을 사진으로 남겨요",
    checklist: [
      "텍스트를 한 글자씩 직접 읽을 수 있음 (블러·반사·초점 이상 없음)",
      "문장 의미를 파악할 수 있을 만큼 충분한 내용이 보임",
      "출처(책·노트·화면 등)를 확인할 수 있음",
    ],
    rejectReasons: [
      "글자가 흐릿하거나 초점이 맞지 않아 내용을 읽을 수 없음",
      "빛 반사·가림으로 텍스트 확인 불가",
      "의미 있는 문장이 없음 (단순 숫자·기호·제목만 있음)",
      "텍스트가 아닌 다른 콘텐츠 (사람·풍경만 있음)",
    ],
  },
  book_cover: {
    label: "책 표지",
    desc: "지금 읽고 있는 책 표지를 찍어요",
    checklist: [
      "책 제목을 글자 단위로 직접 읽을 수 있음",
      "저자명을 글자 단위로 직접 읽을 수 있음",
      "표지 전체 또는 충분한 부분이 노출됨",
      "실물 책 또는 전자책 화면",
    ],
    rejectReasons: [
      "책 제목을 읽을 수 없음 (흐림·가림·잘림)",
      "저자명을 읽을 수 없음",
      "책이 아닌 다른 오브젝트",
      "조명 부족으로 표지 불분명",
    ],
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
    checklist: [
      "장소를 특정할 수 있는 고유한 특징(간판·건물명·랜드마크)이 사진에 보임",
      "간판 또는 건물명 텍스트를 글자 단위로 직접 읽을 수 있음",
      "실외 또는 특정 공간임을 확인할 수 있음",
      "충분한 밝기로 배경 확인 가능",
    ],
    rejectReasons: [
      "장소를 특정할 수 있는 고유한 특징이 없음",
      "간판·건물명이 흐리거나 가려져 읽을 수 없음",
      "어두워서 배경 확인 불가",
      "일반 실내 공간 (무의미한 배경)",
    ],
  },
};

/** 타입별 최우선 규칙 + AI에게 요구하는 추가 JSON 필드 */
const TYPE_RULES: Partial<Record<VerifyTypeKey, { rule: string; extraFields: string }>> = {
  step_walk: {
    rule: `
⚠️ [step_walk 최우선 규칙 — 다른 모든 판단보다 앞섭니다]
1. 사진에서 걸음 수를 나타내는 숫자를 자릿수 단위로 직접 읽으세요.
2. 숫자가 흐릿하거나, 가려지거나, 추측이 필요한 상황이면 즉시 passed=false 입니다.
3. 직접 읽은 숫자가 5,000 미만이면 즉시 passed=false 입니다.
4. stepsRead 필드에 읽은 숫자(정수) 또는 null을 반드시 기재하세요. null이면 서버에서 자동 거절합니다.`,
    extraFields: `  "stepsRead": 읽힌 걸음 수 정수 또는 null,\n`,
  },
  quote_photo: {
    rule: `
⚠️ [quote_photo 최우선 규칙 — 다른 모든 판단보다 앞섭니다]
1. 사진에서 텍스트를 한 글자씩 직접 읽어 내용을 확인하세요.
2. 읽을 수 없는 글자가 있어 의미 파악이 어려우면 즉시 passed=false 입니다.
3. textRead 필드에 읽은 핵심 문장(최대 60자)을 직접 인용하세요. 읽을 수 없으면 null. null이면 서버에서 자동 거절합니다.`,
    extraFields: `  "textRead": 읽은 핵심 문장(최대 60자) 또는 null,\n`,
  },
  book_cover: {
    rule: `
⚠️ [book_cover 최우선 규칙 — 다른 모든 판단보다 앞섭니다]
1. 사진에서 책 제목과 저자명을 글자 단위로 직접 읽으세요.
2. 제목 또는 저자명을 읽을 수 없으면 즉시 passed=false 입니다.
3. titleRead에 읽은 제목, authorRead에 읽은 저자명을 직접 인용하세요.
   두 필드 중 하나라도 null이면 서버에서 자동 거절합니다.`,
    extraFields: `  "titleRead": 읽은 책 제목 또는 null,\n  "authorRead": 읽은 저자명 또는 null,\n`,
  },
  run_scenery: {
    rule: `
⚠️ [run_scenery 최우선 규칙 — 다른 모든 판단보다 앞섭니다]
1. 사진에서 러닝 증거(달리기 앱 화면, 러닝복, 운동화, GPS 기록 화면 등)를 직접 찾으세요.
2. 러닝 증거가 전혀 없으면 즉시 passed=false 입니다. 야외 풍경만으로는 부족합니다.
3. runEvidenceRead 필드에 발견한 러닝 증거를 구체적으로 기술하세요 (예: "오른쪽 하단에 Nike Run Club 앱 화면"). 없으면 null. null이면 서버에서 자동 거절합니다.`,
    extraFields: `  "runEvidenceRead": 발견한 러닝 증거 설명 또는 null,\n`,
  },
  location_photo: {
    rule: `
⚠️ [location_photo 최우선 규칙 — 다른 모든 판단보다 앞섭니다]
1. 사진에서 장소를 특정할 수 있는 고유한 특징(간판, 건물명, 랜드마크)을 직접 찾으세요.
2. 텍스트로 된 간판·건물명이 있으면 글자 단위로 직접 읽어야 합니다.
3. 장소를 특정할 증거가 없거나 텍스트를 읽을 수 없으면 즉시 passed=false 입니다.
4. landmarkRead 필드에 읽은 간판·건물명 또는 특정 가능한 장소 특징을 기재하세요. 없으면 null. null이면 서버에서 자동 거절합니다.`,
    extraFields: `  "landmarkRead": 읽은 간판·건물명 또는 장소 특징 또는 null,\n`,
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
  const typeRule = TYPE_RULES[key];

  const dateNote = key === "step_walk"
    ? `\n⚠️ [날짜 필수] 사진에 표시된 날짜가 오늘(${today})과 일치해야 합니다. 날짜가 다르거나 보이지 않으면 자동 거절합니다.`
    : "";

  return `당신은 챌린지 앱의 엄격한 사진 인증 AI입니다.
오늘 날짜: ${today}${dateNote}${typeRule?.rule ?? ""}

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
${typeRule?.extraFields ?? ""}  "passed": true 또는 false,
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

interface VerificationGroup {
  id: string;
  verify_type: string | null;
  challenge_start: string | null;
  challenge_end: string | null;
  goal: string | null;
  name: string | null;
  current_round: number;
}

/** 타입별 서버사이드 이중 검증: AI가 통과시켜도 서버에서 재확인 */
const SERVER_VALIDATORS: Partial<Record<VerifyTypeKey, (obj: Record<string, unknown>) => string | null>> = {
  step_walk: (obj) => {
    const steps = typeof obj.stepsRead === "number" ? Math.round(obj.stepsRead) : null;
    if (steps === null) return "걸음 수 숫자를 사진에서 직접 읽을 수 없어 인증이 거절됐습니다.";
    if (steps < 5000) return `읽힌 걸음 수(${steps.toLocaleString()}보)가 5,000보 미만입니다.`;
    return null;
  },
  quote_photo: (obj) => {
    const text = typeof obj.textRead === "string" ? obj.textRead.trim() : null;
    if (!text || text.length < 5) return "텍스트를 사진에서 직접 읽을 수 없어 인증이 거절됐습니다.";
    return null;
  },
  book_cover: (obj) => {
    const title = typeof obj.titleRead === "string" ? obj.titleRead.trim() : null;
    const author = typeof obj.authorRead === "string" ? obj.authorRead.trim() : null;
    if (!title) return "책 제목을 사진에서 직접 읽을 수 없어 인증이 거절됐습니다.";
    if (!author) return "저자명을 사진에서 직접 읽을 수 없어 인증이 거절됐습니다.";
    return null;
  },
  run_scenery: (obj) => {
    const evidence = typeof obj.runEvidenceRead === "string" ? obj.runEvidenceRead.trim() : null;
    if (!evidence || evidence.length < 5) return "러닝 증거(앱·복장·장비 등)를 사진에서 확인할 수 없어 인증이 거절됐습니다.";
    return null;
  },
  location_photo: (obj) => {
    const landmark = typeof obj.landmarkRead === "string" ? obj.landmarkRead.trim() : null;
    if (!landmark || landmark.length < 2) return "장소를 특정할 수 있는 고유한 특징(간판·건물명)을 확인할 수 없어 인증이 거절됐습니다.";
    return null;
  },
};

function parseResult(raw: unknown, key: VerifyTypeKey): VerifyResult {
  if (typeof raw !== "object" || raw === null) {
    return { passed: false, score: 0, failedChecks: [], reason: "AI 응답 형식 오류" };
  }
  const obj = raw as Record<string, unknown>;
  let passed = obj.passed === true;
  const score = typeof obj.score === "number"
    ? Math.max(0, Math.min(100, Math.round(obj.score))) : 0;
  let reason = typeof obj.reason === "string" && obj.reason.trim()
    ? obj.reason.trim() : "판정 이유 없음";

  // 서버사이드 이중 검증: AI가 passed=true 를 반환해도 서버에서 재확인
  if (passed) {
    const validate = SERVER_VALIDATORS[key];
    if (validate) {
      const rejectReason = validate(obj);
      if (rejectReason) {
        passed = false;
        reason = rejectReason;
      }
    }
  }

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

async function removeUploadedPhoto(
  serviceClient: ReturnType<typeof createClient>,
  filePath: string,
) {
  const { error } = await serviceClient.storage.from("verifications").remove([filePath]);
  if (error) console.error("Storage cleanup failed:", error);
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
  let verifiedGroup: VerificationGroup | null = null;

  if (groupId) {
    const { data: group, error: groupError } = await serviceClient
      .from("groups")
      .select("id, verify_type, challenge_start, challenge_end, goal, name, current_round")
      .eq("id", groupId)
      .maybeSingle();

    if (groupError) {
      console.error("[verify-photo] Group check failed:", groupError);
      return jsonResponse({ error: "그룹 정보를 확인하지 못했습니다." }, 500);
    }

    if (!group) {
      return jsonResponse({ error: "존재하지 않는 그룹입니다." }, 404);
    }

    verifiedGroup = group as VerificationGroup;

    if (verifiedGroup.verify_type !== key) {
      return jsonResponse({ error: "이 그룹의 인증 방식과 요청한 인증 방식이 일치하지 않습니다." }, 400);
    }

    const now = Date.now();
    if (verifiedGroup.challenge_start && now < new Date(verifiedGroup.challenge_start).getTime()) {
      return jsonResponse({ error: "아직 챌린지가 시작되지 않았습니다." }, 403);
    }
    if (verifiedGroup.challenge_end && now > new Date(verifiedGroup.challenge_end).getTime()) {
      return jsonResponse({ error: "이미 종료된 챌린지입니다." }, 403);
    }

    const { data: membership, error: membershipError } = await serviceClient
      .from("group_members")
      .select("group_id, member_status")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("round_number", verifiedGroup.current_round)
      .maybeSingle();

    if (membershipError) {
      console.error("[verify-photo] Membership check failed:", membershipError);
      return jsonResponse({ error: "그룹 가입 상태를 확인하지 못했습니다." }, 500);
    }

    if (!membership) {
      return jsonResponse({ error: "참여 중인 그룹에서만 인증할 수 있습니다." }, 403);
    }

    const memberStatus = (membership as { group_id: string; member_status: string }).member_status;
    if (memberStatus === "REMOVED") {
      return jsonResponse(
        { error: "인증 기간 내에 활동이 없어 그룹에서 제외됐습니다. 새 그룹에 참여해 다시 시작해보세요." },
        403,
      );
    }

    verifiedGroupId = verifiedGroup.id;
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
  const text = parts.find(p => !p.thought && typeof p.text === "string")?.text?.trim()
    ?? parts[0]?.text?.trim()
    ?? "";
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
      await removeUploadedPhoto(serviceClient, filePath);
      // unique_violation (23505) = KST 기준 오늘 이미 인증 완료
      if (insertError.code === "23505") {
        return jsonResponse({ error: "오늘 이미 인증을 완료했어요. 내일 다시 도전해보세요!" }, 409);
      }
      console.error("Verification insert failed:", insertError);
      return jsonResponse({ error: "DB 저장 실패. 다시 시도해주세요." }, 500);
    }

    if (verifiedGroupId) {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const { error: activityError } = await serviceClient.from("activity_posts").insert({
        group_id: verifiedGroupId,
        user_id: user.id,
        verification_id: verificationRow?.id ?? null,
        verify_type: key,
        photo_url: photoUrl,
        message: verifiedGroup?.goal ? `${verifiedGroup.goal} 인증 완료` : `${verifiedGroup?.name ?? "챌린지"} 인증 완료`,
        author_name: profile?.username ?? user.email?.split("@")[0] ?? "챌리 유저",
        author_avatar_url: profile?.avatar_url ?? null,
      });

      if (activityError) {
        console.error("Activity post insert failed:", activityError);
      }

      // 인증 성공 → 현재 라운드 멤버 row의 상태 초기화 + 달성률 갱신
      const { error: memberUpdateError } = await serviceClient
        .from("group_members")
        .update({
          last_verified_at: new Date().toISOString(),
          member_status:    "ACTIVE",
          exit_deadline:    null,
        })
        .eq("group_id",     verifiedGroupId)
        .eq("user_id",      user.id)
        .eq("round_number", verifiedGroup!.current_round);
      if (memberUpdateError) {
        console.error("[verify-photo] Member status update failed:", memberUpdateError);
      }

      const { error: crewCacheError } = await serviceClient.rpc("update_crew_cache", {
        p_group_id: verifiedGroupId,
      });
      if (crewCacheError) {
        console.error("[verify-photo] Crew cache update failed:", crewCacheError);
      }
    }

    await serviceClient.rpc("increment_user_xp", { p_user_id: user.id, p_amount: 10 });

    return jsonResponse({ ...result, photoUrl });
  }

  return jsonResponse(result);
});
