import { useState, useEffect } from "react";
import { ChevronLeft, Search, UserPlus, Check, Link2, Copy, Users, MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { copyText, shareOrCopy } from "../lib/share";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { PublicProfileSearchRecord } from "../types/database";

interface Friend {
  id: string;
  name: string;
  handle: string;
  seed: string;
  invited: boolean;
}

const APP_URL = "https://chally.app";

function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  // Color palette based on seed
  const colors = ["#FF3355","#38BDF8","#FB923C","#A78BFA","#34d399","#F59E0B"];
  const idx = seed.charCodeAt(0) % colors.length;
  const initial = seed[0];
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-black shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${colors[idx]}, ${colors[(idx + 2) % colors.length]})`,
        fontSize: size * 0.38,
        boxShadow: `0 2px 10px ${colors[idx]}40`,
      }}
    >
      {initial}
    </div>
  );
}

export function FriendInvite() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invitedKeys, setInvitedKeys] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const inviteCode = profile?.invite_code ?? (user?.id ? `CHALLY-${user.id.slice(0, 8).toUpperCase()}` : "CHALLY-GUEST");
  const inviteUrl = `${APP_URL}/signup?ref=${encodeURIComponent(inviteCode)}`;
  const inviteText = `${profile?.username ?? "친구"}님이 챌리로 초대했어요. 같이 챌린지하고 XP 받아요!`;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInvites() {
      if (!user) {
        setLoadingInvites(false);
        return;
      }
      setLoadingInvites(true);
      const { data, error: loadError } = await supabase
        .from("friend_invites")
        .select("target_key")
        .eq("invited_by", user.id);
      if (cancelled) return;
      if (loadError) {
        setError(loadError.message);
      } else {
        const keys = new Set((data ?? []).map(row => row.target_key));
        setInvitedKeys(keys);
        setFriends(prev => prev.map(friend => ({ ...friend, invited: keys.has(friend.id) })));
      }
      setLoadingInvites(false);
    }
    void loadInvites();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function searchProfiles() {
      const query = search.trim();
      if (!user || query.length < 2) {
        setFriends([]);
        return;
      }

      const { data, error: searchError } = await supabase.rpc("search_public_profiles", {
        p_query: query,
        p_limit: 12,
      });

      if (cancelled) return;
      if (searchError) {
        setError(searchError.message);
        return;
      }

      const results = ((data ?? []) as PublicProfileSearchRecord[]).map(row => ({
        id: row.id,
        name: row.username ?? "챌리 유저",
        handle: `@${row.username ?? row.id.slice(0, 8)}`,
        seed: row.id,
        invited: invitedKeys.has(row.id),
      }));

      setFriends(results);
    }

    void searchProfiles();
    return () => { cancelled = true; };
  }, [search, user?.id, invitedKeys]);

  const filtered = friends; // DB RPC가 이미 search 기준으로 필터링

  async function recordInviteEvent(
    eventType: "copy_code" | "share_link" | "sms_share" | "suggested_friend_invite",
    targetKey?: string,
  ) {
    if (!user) return;
    const { error } = await supabase.from("invite_events").insert({
      user_id: user.id,
      event_type: eventType,
      invite_code: inviteCode,
      target_key: targetKey ?? null,
    });
    if (error) console.error("Failed to record invite event", error);
  }

  async function invite(id: string) {
    const friend = friends.find(f => f.id === id);
    if (!friend) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (friend.invited) {
      await shareInvite();
      return;
    }
    setFriends(prev => prev.map(f => f.id === id ? { ...f, invited: true } : f));
    setInvitedKeys(prev => new Set(prev).add(id));
    const { error: saveError } = await supabase
      .from("friend_invites")
      .insert({
        invited_by: user.id,
        target_key: friend.id,
        target_name: friend.name,
        target_handle: friend.handle,
        invite_code: inviteCode,
      });
    if (saveError) {
      setError(saveError.message);
      setFriends(prev => prev.map(f => f.id === id ? { ...f, invited: false } : f));
      setInvitedKeys(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    await recordInviteEvent("suggested_friend_invite", friend.id);
    await shareInvite();
  }

  async function copyCode() {
    await copyText(inviteCode);
    await recordInviteEvent("copy_code");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    await shareOrCopy({
      title: "챌리 친구 초대",
      text: inviteText,
      url: inviteUrl,
    });
    await recordInviteEvent("share_link");
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  async function inviteBySms() {
    void recordInviteEvent("sms_share");
    const body = `${inviteText}\n${inviteUrl}`;
    // Web Share API 지원 시 사용, 미지원 시 sms: 프로토콜 시도
    if (navigator.share) {
      try {
        await navigator.share({ title: "챌리 친구 초대", text: body });
        return;
      } catch {
        // 사용자 취소 등은 무시
      }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
  }

  const invitedCount = friends.filter(f => f.invited).length;

  return (
    <div className="flex flex-col h-full bg-[#F5F6FA] overflow-hidden">
      <style>{`
        @keyframes fi-in { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);} }
        @keyframes fi-slide { from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);} }
        @keyframes fi-check { 0%{opacity:0;transform:scale(0.5);}60%{transform:scale(1.15);}100%{opacity:1;transform:scale(1);} }
      `}</style>

      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 bg-white border-b border-black/[0.05]"
        style={{ animation: "fi-in 0.4s ease both" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF3355]">소셜</p>
          <h1 className="text-[20px] font-black text-slate-900 tracking-tight">친구 초대</h1>
        </div>
        {invitedCount > 0 && (
          <span
            className="bg-[#FF3355] text-white text-[12px] font-black px-2.5 py-1 rounded-full"
            style={{ animation: "fi-check 0.3s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {invitedCount}명 초대
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loadingInvites && (
          <p className="pt-3 text-center text-[12px] font-semibold text-slate-400">초대 기록을 불러오는 중...</p>
        )}
        {error && (
          <p className="mx-4 mt-3 rounded-2xl bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-500">{error}</p>
        )}

        {/* 초대 링크 카드 */}
        <div
          className="mx-4 mt-4 rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #FF3355, #CC0030)",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1) 60ms",
          }}
        >
          {/* 배경 장식 */}
          <div className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/[0.08]" />
            <div className="pointer-events-none absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-black/[0.06]" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-white/70" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">나의 초대 코드</p>
              </div>
              <p className="text-[28px] font-black text-white tracking-widest mb-4 leading-none">
                {inviteCode}
              </p>
              <p className="text-white/60 text-[12px] leading-relaxed mb-4">
            친구가 이 코드로 가입하면 둘 다<br />
                <span className="text-white font-bold">+50 XP</span>를 받아요!
              </p>

              {/* 버튼들 */}
              <div className="flex gap-2">
                <button
                  onClick={copyCode}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[14px] transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.25)" }}
                >
                  {copied
                    ? <><Check className="w-4 h-4 text-white" /><span className="text-white">복사됨!</span></>
                    : <><Copy className="w-4 h-4 text-white" /><span className="text-white">코드 복사</span></>
                  }
                </button>
                <button
                  onClick={shareInvite}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white font-bold text-[14px] text-[#FF3355] transition-all active:scale-95"
                >
                  {shared ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {shared ? "공유됨" : "링크 공유"}
                </button>
              </div>
            </div>
          </div>

          {/* 초대 URL 표시 */}
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ background: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Link2 className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <p className="text-[11px] text-white/40 font-medium truncate">{inviteUrl}</p>
          </div>
        </div>

        {/* 공유 채널 */}
        <div
          className="mx-4 mt-3 grid grid-cols-4 gap-2"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.5s ease 120ms",
          }}
        >
          {[
            { emoji: "💬", label: "카카오톡", color: "#FEE500", textColor: "#3A1D1D", action: shareInvite },
            { emoji: "📱", label: "문자",     color: "#34C759", textColor: "white",   action: inviteBySms },
            { emoji: "📸", label: "인스타",   color: "#E1306C", textColor: "white",   action: shareInvite },
            { emoji: "📋", label: "기타",     color: "#F1F5F9", textColor: "#64748B", action: shareInvite },
          ].map(({ emoji, label, color, textColor, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-95 transition-all"
              style={{ background: color }}
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-[11px] font-bold" style={{ color: textColor }}>{label}</span>
            </button>
          ))}
        </div>

        {/* 친구 검색 */}
        <div
          className="mx-4 mt-5"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.5s ease 180ms",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1 mb-2">
            친구 검색 {search.trim().length >= 2 ? `${filtered.length}명` : ""}
          </p>
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 px-4 py-3 mb-3 focus-within:border-[#FF3355] transition-colors">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름 또는 @핸들 검색"
              className="flex-1 bg-transparent text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* 친구 목록 */}
        <div className="mx-4 space-y-2">
          {filtered.map((friend, i) => (
            <div
              key={friend.id}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-black/[0.04]"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateX(0)" : "translateX(-12px)",
                transition: `opacity 0.4s ease ${200 + i * 50}ms, transform 0.4s ease ${200 + i * 50}ms`,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <Avatar seed={friend.seed} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-slate-900">{friend.name}</p>
                <p className="text-[12px] text-slate-400 font-medium">{friend.handle}</p>
              </div>
              <button
                onClick={() => invite(friend.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all active:scale-95",
                  friend.invited
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-[#FFF0F3] text-[#FF3355] border border-[#FFD6DC]"
                )}
              >
                {friend.invited ? (
                  <><Check className="w-3.5 h-3.5" />초대됨</>
                ) : (
                  <><UserPlus className="w-3.5 h-3.5" />초대</>
                )}
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium text-[14px]">
                {search.trim().length < 2 ? "이름이나 @핸들을 2글자 이상 입력하세요" : "검색 결과가 없어요"}
              </p>
            </div>
          )}
        </div>

        {/* 초대 메시지 보내기 */}
        <div
          className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-black/[0.04] flex items-center gap-3"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.5s ease 500ms",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div className="w-11 h-11 rounded-2xl bg-[#FFF0F3] flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-[#FF3355]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-slate-900">연락처로 초대</p>
            <p className="text-[12px] text-slate-400 mt-0.5">전화번호부에서 친구 찾기</p>
          </div>
          <button
            onClick={inviteBySms}
            className="text-[12px] font-bold text-[#FF3355] bg-[#FFF0F3] px-3 py-1.5 rounded-full active:bg-[#FFE0E7] transition-colors"
          >
            열기
          </button>
        </div>

      </div>
    </div>
  );
}
