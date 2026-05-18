// Supabase Edge Function: delete-account
// 본인 계정 즉시 삭제 (Apple §5.1.1(v) / Google Play 정책 준수)
// 처리: 감사 로그 → Storage 파일 제거 → auth.users 삭제(CASCADE 연쇄)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function purgeBucket(
  serviceClient: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
) {
  // Storage list는 한 번에 최대 1000개. 페이지 순회로 모두 수집.
  const allPaths: string[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });

    if (error) {
      console.error(`[delete-account] list failed bucket=${bucket} prefix=${prefix}:`, error);
      return;
    }
    if (!data || data.length === 0) break;

    for (const entry of data) {
      if (entry.name) allPaths.push(`${prefix}/${entry.name}`);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (allPaths.length === 0) return;

  // remove는 한 번에 최대 1000개. 안전하게 100개씩 나눠서 처리.
  const chunkSize = 100;
  for (let i = 0; i < allPaths.length; i += chunkSize) {
    const chunk = allPaths.slice(i, i + chunkSize);
    const { error } = await serviceClient.storage.from(bucket).remove(chunk);
    if (error) {
      console.error(`[delete-account] remove failed bucket=${bucket}:`, error);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // 1. 감사 로그 — pending row가 있으면 completed로 업데이트, 없으면 새로 insert
  const { data: existing } = await serviceClient
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  const completedAt = new Date().toISOString();
  if (existing?.id) {
    await serviceClient
      .from("account_deletion_requests")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", existing.id);
  } else {
    await serviceClient.from("account_deletion_requests").insert({
      user_id: user.id,
      status: "completed",
      completed_at: completedAt,
    });
  }

  // 2. Storage 파일 제거 (verifications, avatars)
  await purgeBucket(serviceClient, "verifications", user.id);
  await purgeBucket(serviceClient, "avatars", user.id);

  // 3. auth.users 삭제 → DB CASCADE 연쇄
  // (admin은 createClient에 service role key를 넘긴 경우에만 사용 가능)
  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[delete-account] auth.admin.deleteUser failed:", deleteError);
    return jsonResponse({ error: "계정 삭제 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, 500);
  }

  return jsonResponse({ ok: true, deletedAt: completedAt });
});
