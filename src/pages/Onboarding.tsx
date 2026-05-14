import React, { useEffect, useState, useRef } from "react";
import {
  Flame, CheckCircle2, ArrowRight,
  Zap, User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import type { Group } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { VERIFY_TYPES } from "../lib/verifyTypes";

/* 카드에 spring-in + float 콤보 animation 문자열 생성 */
function cardAnim(delay: number, floatName = "ob-float-a") {
  return `ob-spring 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both, ${floatName} 5s ease-in-out ${delay + 600}ms infinite`;
}

/* ─── 슬라이드 0: 인트로 (로고) ───────────────── */
function Slide0({ on }: { on: boolean }) {
  return (
    <div className="flex flex-col h-full items-center justify-center px-8 relative z-10">

      {/* 로고 */}
      <div
        className="mb-8"
        style={{ animation: on ? "ob-spring 0.7s cubic-bezier(0.34,1.56,0.64,1) 80ms both" : "none" }}
      >
        <img
          src="/chally-logo-nobg.png"
          alt="Chally"
          className="w-40 h-40 object-contain"
          style={{ animation: on ? "ob-logo-fire 1.2s ease-out 80ms both" : "none" }}
        />
      </div>

      {/* 타이틀 */}
      <div
        className="text-center"
        style={{ animation: on ? "ob-fade 0.5s ease 350ms both" : "none" }}
      >
        <h1
          className="text-[36px] font-black leading-tight mb-3 bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(90deg, #ffffff 0%, #FF3355 60%, #FF9DB2 100%)" }}
        >
          챌리(Chally)
        </h1>
        <p className="text-white/50 text-[16px] font-medium">챌린지로 모임, 챌린지가 모임!</p>
      </div>
    </div>
  );
}

/* ─── 슬라이드 1 ───────────────────────────────── */
function Slide1({ on }: { on: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 relative z-10">
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[#FF3355]/40 bg-[#FF3355]/10"
          style={{ animation: on ? "ob-fade 0.5s ease 80ms both" : "none" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9DB2]" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />
          <span className="text-[#FF9DB2] text-[12px] font-semibold tracking-wide">함께하는 챌린지</span>
        </div>
        <div className="relative w-[300px] h-[280px]">
          {/* 메인 글라스 카드 — 실제 챌린지 커버 사진 + 멤버 목록 */}
          <div
            className="absolute top-[5%] left-[3%] w-[76%] rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              animation: on ? cardAnim(0) : "none",
            }}
          >
            <div className="relative h-[88px] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&fit=crop&q=80" alt="" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/75" />
              <div className="absolute bottom-0 inset-x-0 px-3 pb-2">
                <p className="text-white font-black text-[13px]">매일 5,000보 걷기</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
                    <div className="h-full w-[72%] rounded-full" style={{ background: "linear-gradient(90deg,#FF3355,#FF6680)" }} />
                  </div>
                  <span className="text-white/80 text-[10px] font-black">72%</span>
                </div>
              </div>
            </div>
            <div className="p-3">
              {[
                { name: "sm", rate: 98, color: "#f59e0b" },
                { name: "ms", rate: 94, color: "#94a3b8" },
                { name: "나", rate: 87, color: "#FF3355", me: true },
              ].map((u, i) => (
                <div
                  key={u.name}
                  className={`flex items-center gap-2.5 py-1.5 ${u.me ? "rounded-xl px-2 -mx-2" : ""}`}
                  style={{
                    ...(u.me ? { background: "rgba(255,51,85,0.15)", border: "1px solid rgba(255,51,85,0.2)" } : {}),
                    animation: on ? `ob-slide-in-l 0.4s ease ${300 + i * 80}ms both` : "none",
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[8px] text-white/60">{u.name[0]}</span>
                  </div>
                  <span className={`text-[11px] font-semibold flex-1 ${u.me ? "text-[#FF9DB2]" : "text-white/70"}`}>{u.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: u.color }}>{u.rate}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* 플로팅 — 참여 배지 */}
          <div
            className="absolute top-[2%] right-[0%] rounded-2xl px-3.5 py-2.5 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg,#FF3355,#CC0030)",
              boxShadow: "0 8px 28px rgba(255,51,85,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              animation: on ? cardAnim(130, "ob-float-b") : "none",
            }}
          >
            <span className="text-sm">👥</span>
            <div>
              <div className="text-white/60 text-[8px] font-semibold mb-0.5">지금 참여 중</div>
              <div className="text-white font-extrabold text-sm leading-none">38명</div>
            </div>
          </div>
          {/* 플로팅 — 연속 달성 배지 */}
          <div
            className="absolute bottom-[8%] right-[2%] rounded-2xl px-3.5 py-2.5 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg,#f97316,#ef4444)",
              boxShadow: "0 8px 24px rgba(239,68,68,0.45)",
              border: "1px solid rgba(255,255,255,0.2)",
              animation: on ? cardAnim(280, "ob-float-c") : "none",
            }}
          >
            <Flame className="w-4 h-4 text-white fill-white/80" />
            <div>
              <div className="text-orange-100/60 text-[8px] font-semibold mb-0.5">연속 달성</div>
              <div className="text-white font-extrabold text-sm leading-none">7일 🔥</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h1
          className="text-[36px] leading-[1.15] font-extrabold tracking-tight break-keep"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 260ms both" : "none" }}
        >
          <span className="text-white">목표가 있다면</span>
          <br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#FF3355,#FF99B2)" }}>이루어 내는 사람들</span>
        </h1>
        <p
          className="text-[14px] leading-relaxed text-white/45 font-medium break-keep mt-2"
          style={{ animation: on ? "ob-fade 0.5s ease 380ms both" : "none" }}
        >
          같은 목표를 바라보는 사람들과 함께 해요.
        </p>
      </div>
    </div>
  );
}

/* ─── 슬라이드 2 ───────────────────────────────── */
function Slide2({ on }: { on: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 relative z-10">
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-violet-500/40 bg-violet-500/10"
          style={{ animation: on ? "ob-fade 0.5s ease 80ms both" : "none" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-violet-300" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />
          <span className="text-violet-300 text-[12px] font-semibold tracking-wide">AI 사진 인증</span>
        </div>
        <div className="relative w-[300px] h-[280px]">
          {/* 메인 글라스 카드 — Camera.tsx 뷰파인더 + 실제 인증 배경 사진 */}
          <div
            className="absolute top-[3%] left-[6%] w-[74%] rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              animation: on ? cardAnim(0) : "none",
            }}
          >
            <div className="relative h-[128px]">
              <img
                src="https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400&fit=crop&q=80"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.5 }}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20" />
              {/* 모서리 가이드 (Camera.tsx 스타일) */}
              {[["top-3 left-3","border-l-2 border-t-2"],["top-3 right-3","border-r-2 border-t-2"],
                ["bottom-3 left-3","border-l-2 border-b-2"],["bottom-3 right-3","border-r-2 border-b-2"]].map(([pos, border], i) => (
                <div key={i} className={`absolute ${pos} w-5 h-5 ${border} border-white/65 rounded-sm`} />
              ))}
              {/* 인증 완료 체크 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 4px 18px rgba(124,58,237,0.65)" }}>
                  <CheckCircle2 className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div className="p-3.5">
              <div className="text-white font-bold text-sm mb-1">사진으로 인증하기</div>
              <div className="text-white/40 text-[10px]">AI가 자동으로 인증을 확인해요</div>
            </div>
          </div>
          {/* 플로팅 — AI 배지 */}
          <div
            className="absolute top-[2%] right-[0%] rounded-2xl px-3 py-2.5 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
              boxShadow: "0 8px 28px rgba(124,58,237,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              animation: on ? cardAnim(150, "ob-float-b") : "none",
            }}
          >
            <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300/60" />
            <div>
              <div className="text-purple-200/70 text-[8px] font-semibold mb-0.5">AI 자동 인증</div>
              <div className="text-white font-extrabold text-sm leading-none">통과!</div>
            </div>
          </div>
          {/* 플로팅 — 주간 인증 */}
          <div
            className="absolute bottom-[5%] right-[-2%] rounded-2xl px-3.5 py-2.5"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              animation: on ? cardAnim(300, "ob-float-c") : "none",
            }}
          >
            <div className="text-white/35 text-[8px] font-medium mb-1.5">이번 주 인증</div>
            <div className="flex gap-1.5">
              {["월","화","수","목","금","토","일"].map((d, i) => (
                <div key={d} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${i < 5 ? "bg-[#FF3355]" : "bg-white/10"}`}
                    style={{ animation: on && i < 5 ? `ob-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${460 + i * 60}ms both` : "none" }}
                  >
                    {i < 5 && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={2.5} />}
                  </div>
                  <span className="text-white/30 text-[7px]">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h1
          className="text-[36px] leading-[1.15] font-extrabold tracking-tight break-keep"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 260ms both" : "none" }}
        >
          <span className="text-white">사진 한 장으로</span>
          <br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#a78bfa,#818cf8)" }}>끝나는 인증</span>
        </h1>
        <p
          className="text-[14px] leading-relaxed text-white/45 font-medium break-keep mt-2"
          style={{ animation: on ? "ob-fade 0.5s ease 380ms both" : "none" }}
        >
          챌린지를 가장 쉽게 인증해요.
        </p>
      </div>
    </div>
  );
}

/* ─── 슬라이드 3 ───────────────────────────────── */
function Slide3({ on }: { on: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 relative z-10">
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10"
          style={{ animation: on ? "ob-fade 0.5s ease 80ms both" : "none" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-300" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />
          <span className="text-amber-300 text-[12px] font-semibold tracking-wide">실시간 동기부여</span>
        </div>
        <div className="relative w-[300px] h-[280px]">
          {/* 메인 글라스 카드 — 러닝 크루 커버 사진 + 랭킹 */}
          <div
            className="absolute top-[5%] left-[4%] w-[76%] rounded-3xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              animation: on ? cardAnim(0) : "none",
            }}
          >
            <div className="relative h-[72px] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400&fit=crop&q=80" alt="" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/50" />
              <div className="absolute inset-0 flex items-center px-3 gap-2">
                <span className="text-lg leading-none">🏃</span>
                <div>
                  <p className="text-white font-black text-[13px]">러닝 크루</p>
                  <p className="text-white/45 text-[9px] font-bold uppercase tracking-widest">이번 주 랭킹</p>
                </div>
              </div>
            </div>
            <div className="p-3">
              {([
                { rank: 1, name: "sm", streak: 15, rate: 96, color: "#f59e0b", me: false },
                { rank: 2, name: "나", streak:  3, rate: 50, color: "#94a3b8", me: true  },
                { rank: 3, name: "ms", streak:  1, rate: 40, color: "#cd7c32", me: false },
              ] as const).map((u, i) => (
                <div
                  key={u.rank}
                  className={`flex items-center gap-2.5 py-1.5 ${u.me ? "rounded-xl px-2 -mx-2" : ""}`}
                  style={{
                    ...(u.me ? { background: "rgba(255,51,85,0.15)", border: "1px solid rgba(255,51,85,0.2)" } : {}),
                    animation: on ? `ob-slide-in-l 0.4s ease ${340 + i * 80}ms both` : "none",
                  }}
                >
                  <span className="font-extrabold text-sm w-4 text-center" style={{ color: u.color }}>{u.rank}</span>
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[9px] text-white/60">{u.name[0]}</span>
                  </div>
                  <span className={`text-xs font-semibold flex-1 ${u.me ? "text-[#FF9DB2]" : "text-white/70"}`}>{u.name}</span>
                  <div className="flex items-center gap-1">
                    <Flame className={`w-3 h-3 ${u.me ? "text-[#FF9DB2] fill-[#FF9DB2]/60" : "text-orange-400 fill-orange-400/60"}`} />
                    <span className={`text-[10px] font-bold ${u.me ? "text-[#FF9DB2]" : "text-orange-400"}`}>{u.streak}일</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/50">{u.rate}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* 플로팅 — 신기록 배지 (amber → emerald로 색상 차별화) */}
          <div
            className="absolute top-[2%] right-[-2%] rounded-2xl px-3 py-2.5 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              boxShadow: "0 8px 28px rgba(16,185,129,0.45)",
              border: "1px solid rgba(255,255,255,0.2)",
              animation: on ? cardAnim(180, "ob-float-b") : "none",
            }}
          >
            <span className="text-sm">🌅</span>
            <div>
              <div className="text-emerald-100/70 text-[8px] font-semibold mb-0.5">이번 주 최고</div>
              <div className="text-white font-extrabold text-sm leading-none">sm 96%</div>
            </div>
          </div>
          {/* 플로팅 — 연속 달성 배지 */}
          <div
            className="absolute bottom-[8%] right-[4%] rounded-2xl px-3.5 py-2.5 flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg,#f97316,#ef4444)",
              boxShadow: "0 8px 24px rgba(239,68,68,0.45)",
              border: "1px solid rgba(255,255,255,0.2)",
              animation: on ? cardAnim(330, "ob-float-c") : "none",
            }}
          >
            <Flame className="w-4 h-4 text-white fill-white/80" />
            <div>
              <div className="text-orange-100/60 text-[8px] font-semibold mb-0.5">연속 달성</div>
              <div className="text-white font-extrabold text-sm leading-none">15일 🔥</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h1
          className="text-[36px] leading-[1.15] font-extrabold tracking-tight break-keep"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 260ms both" : "none" }}
        >
          <span className="text-white">중요한 건</span>
          <br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#fbbf24,#f97316)" }}>꺾이지 않는 의지</span>
        </h1>
        <p
          className="text-[14px] leading-relaxed text-white/45 font-medium break-keep mt-2"
          style={{ animation: on ? "ob-fade 0.5s ease 380ms both" : "none" }}
        >
          챌린지 과정을 함께 공유해요.
        </p>
      </div>
    </div>
  );
}

/* ─── 슬라이드 4: 닉네임 입력 ──────────────────── */
function Slide4({ on, value, onChange }: { on: boolean; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (on) setTimeout(() => inputRef.current?.focus(), 400);
  }, [on]);

  return (
    <div className="flex flex-col h-full">
      {/* 타이틀 — 위에 */}
      <div className="px-6 pt-6 pb-3 z-10">
        <div
          className="inline-flex items-center gap-1.5 bg-[#FF3355]/15 border border-[#FF3355]/25 rounded-full px-3 py-1 mb-3"
          style={{ animation: on ? "ob-fade 0.5s ease 100ms both" : "none" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9DB2]" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />
          <span className="text-[#FF9DB2] text-xs font-semibold tracking-wide">프로필 설정</span>
        </div>
        <h1
          className="text-[28px] leading-tight font-extrabold tracking-tight break-keep"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 180ms both" : "none" }}
        >
          <span className="text-white">어떻게</span><br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#FF3355,#FF99B2)" }}>불러드릴까요?</span>
        </h1>
        <p
          className="text-white/40 text-[13px] mt-1.5 break-keep"
          style={{ animation: on ? "ob-fade 0.5s ease 280ms both" : "none" }}
        >
          챌리에서 사용할 닉네임을 입력해주세요.
        </p>
      </div>

      {/* 아바타 + 입력 */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 pb-4 relative z-10"
        style={{ animation: on ? "ob-fade 0.5s ease 320ms both" : "none" }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-[0_16px_40px_rgba(255,51,85,0.4)]"
          style={{ background: "linear-gradient(135deg,#FF3355,#CC0030)" }}
        >
          <User className="w-10 h-10 text-white" strokeWidth={1.8} />
        </div>

        <div className="w-full">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="닉네임을 입력하세요"
            maxLength={12}
            className="w-full text-center text-white text-[22px] font-bold bg-transparent outline-none placeholder:text-white/25 border-b-2 pb-2"
            style={{ borderColor: value ? "#FF3355" : "rgba(255,255,255,0.15)" }}
          />
          <p className="text-center text-white/30 text-[11px] mt-2">최대 12자</p>
        </div>
      </div>
    </div>
  );
}

/* ─── 슬라이드 5: 관심 카테고리 선택 ──────────── */
const OB_CATS = [
  { id: "exercise", label: "운동",  emoji: "💪", grad: ["#FF3355","#FF6680"] as [string,string] },
  { id: "study",    label: "학습",  emoji: "📖", grad: ["#3b82f6","#6366f1"] as [string,string] },
  { id: "reading",  label: "독서",  emoji: "📚", grad: ["#FB923C","#F59E0B"] as [string,string] },
  { id: "habit",    label: "습관",  emoji: "🌱", grad: ["#22c55e","#16a34a"] as [string,string] },
  { id: "hobby",    label: "취미",  emoji: "🎨", grad: ["#a855f7","#7c3aed"] as [string,string] },
  { id: "etc",      label: "기타",  emoji: "✨", grad: ["#38BDF8","#0EA5E9"] as [string,string] },
];

function Slide5({ on, selected, toggle }: {
  on: boolean; selected: string[]; toggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 z-10">
        <div
          className="inline-flex items-center gap-1.5 bg-[#FF3355]/15 border border-[#FF3355]/25 rounded-full px-3 py-1 mb-3"
          style={{ animation: on ? "ob-fade 0.5s ease 100ms both" : "none" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9DB2]" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />
          <span className="text-[#FF9DB2] text-xs font-semibold tracking-wide">관심 분야</span>
        </div>
        <h1
          className="text-[28px] leading-tight font-extrabold tracking-tight break-keep text-white"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 180ms both" : "none" }}
        >
          어떤 분야에<br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#FF3355,#FF9DB2)" }}>관심 있나요?</span>
        </h1>
        <p
          className="text-white/40 text-[13px] mt-1.5 break-keep"
          style={{ animation: on ? "ob-fade 0.5s ease 280ms both" : "none" }}
        >
          여러 개 선택할 수 있어요
        </p>
      </div>

      <div
        className="flex-1 px-5 overflow-y-auto"
        style={{ animation: on ? "ob-fade 0.5s ease 320ms both" : "none" }}
      >
        <div className="grid grid-cols-2 gap-2.5 pb-4">
          {OB_CATS.map((cat, i) => {
            const isOn = selected.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
                className="relative rounded-2xl p-4 text-left transition-all active:scale-[0.97]"
                style={{
                  background: isOn
                    ? `linear-gradient(135deg,${cat.grad[0]},${cat.grad[1]})`
                    : "rgba(255,255,255,0.07)",
                  border: isOn ? "2px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.1)",
                  boxShadow: isOn ? `0 8px 24px ${cat.grad[0]}44` : "none",
                  backdropFilter: "blur(12px)",
                  animation: on ? `ob-spring 0.5s cubic-bezier(0.34,1.56,0.64,1) ${140 + i * 55}ms both` : "none",
                }}
              >
                {isOn && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                  </div>
                )}
                <div className="text-[26px] mb-2 leading-none">{cat.emoji}</div>
                <p className="text-white font-bold text-[14px]">{cat.label}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── 슬라이드 6: 챌린지 선택 ──────────────────── */
function Slide6({ on, selected, toggle, groups }: {
  on: boolean; selected: string[]; toggle: (id: string) => void; groups: Group[];
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 z-10">
        <div
          className="inline-flex items-center gap-1.5 bg-[#FF3355]/15 border border-[#FF3355]/25 rounded-full px-3 py-1 mb-3"
          style={{ animation: on ? "ob-fade 0.5s ease 100ms both" : "none" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9DB2]" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />
          <span className="text-[#FF9DB2] text-xs font-semibold tracking-wide">챌린지 참여</span>
        </div>
        <h1
          className="text-[28px] leading-tight font-extrabold tracking-tight break-keep text-white"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 180ms both" : "none" }}
        >
          참여할 챌린지를<br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#FF3355,#FF9DB2)" }}>골라보세요</span>
        </h1>
        <p
          className="text-white/40 text-[13px] mt-1.5 break-keep"
          style={{ animation: on ? "ob-fade 0.5s ease 280ms both" : "none" }}
        >
          최대 2개까지 선택할 수 있어요{selected.length > 0 && <span className="text-[#FF9DB2] font-semibold"> · {selected.length}개 선택됨</span>}
        </p>
      </div>

      <div
        className="flex-1 px-5 overflow-y-auto"
        style={{ animation: on ? "ob-fade 0.5s ease 320ms both" : "none" }}
      >
        <div className="flex flex-col gap-2.5 pb-4">
          {groups.map((ch, i) => {
            const isOn = selected.includes(ch.id);
            const maxed = selected.length >= 2 && !isOn;
            const emoji = VERIFY_TYPES[ch.verifyType]?.emoji ?? "🎯";
            return (
              <button
                key={ch.id}
                onClick={() => !maxed && toggle(ch.id)}
                className="relative rounded-2xl overflow-hidden text-left transition-all active:scale-[0.99]"
                style={{
                  opacity: maxed ? 0.4 : 1,
                  outline: isOn ? "2.5px solid #FF3355" : "none",
                  outlineOffset: 2,
                  animation: on ? `ob-spring 0.5s cubic-bezier(0.34,1.56,0.64,1) ${140 + i * 50}ms both` : "none",
                }}
              >
                <div className="relative h-[72px]">
                  {ch.cover ? (
                    <img
                      src={ch.cover}
                      alt={ch.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#1A1A2E]" />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to right,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.25) 100%)" }}
                  />
                  <div className="absolute inset-0 flex items-center px-4 gap-3">
                    <span className="text-[22px] leading-none shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-[15px] leading-tight">{ch.title}</p>
                      <p className="text-white/50 text-[11px] mt-0.5">{ch.members}명 참여 중</p>
                    </div>
                    {isOn && (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-[#FF3355] flex items-center justify-center shadow-[0_4px_12px_rgba(255,51,85,0.5)]">
                        <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── 공통 텍스트 블록 ─────────────────────────── */
function TextBlock({ on, tag, tagColor, tagBg, noDot, children }: {
  on: boolean; tag?: string; tagColor?: string; tagBg?: string; noDot?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="px-8 z-10 text-center flex flex-col items-center">
      {tag && (
        <div
          className={`inline-flex items-center gap-1.5 ${tagBg} border rounded-full px-3 py-1 mb-4`}
          style={{ animation: on ? "ob-fade 0.5s ease 180ms both" : "none" }}
        >
          {!noDot && <div className="w-1.5 h-1.5 rounded-full bg-current" style={{ animation: "ob-orb 2s ease-in-out infinite" }} />}
          <span className={`${tagColor} text-xs font-semibold tracking-wide`}>{tag}</span>
        </div>
      )}
      <div className="overflow-hidden mb-1.5">
        <h1
          className="text-[36px] leading-[1.15] font-extrabold tracking-tight break-keep"
          style={{ animation: on ? "ob-word 0.5s cubic-bezier(0.34,1.2,0.64,1) 260ms both" : "none" }}
        >
          {children}
        </h1>
      </div>
    </div>
  );
}

function SubText({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <p
      className="px-8 pb-4 text-center text-[14px] leading-relaxed text-white/45 font-medium break-keep"
      style={{ animation: on ? "ob-fade 0.5s ease 380ms both" : "none" }}
    >
      {children}
    </p>
  );
}

const TOTAL = 7;

/* ─── 메인 ─────────────────────────────────────── */
export function Onboarding() {
  const navigate = useNavigate();
  const { setNickname, joinGroup, groups } = useApp();
  const { user, refreshProfile } = useAuth();
  const [current, setCurrent] = useState(0);
  const [on, setOn] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOn(true), 80);
    return () => clearTimeout(t);
  }, []);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= TOTAL) return;
    setOn(false);
    setTimeout(() => { setCurrent(idx); setOn(true); }, 220);
  };

  const toggleCat = (id: string) =>
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const toggleChallenge = (id: string) =>
    setSelectedChallenges(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 2 ? [...prev, id] : prev
    );

  const handleStart = async () => {
    const nextNickname = nicknameInput.trim();
    if (nextNickname) {
      setNickname(nextNickname);
      if (user?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({ username: nextNickname })
          .eq("id", user.id);
        if (!error) void refreshProfile();
      }
    }
    selectedChallenges.forEach(id => joinGroup(id));
    if (user?.id) localStorage.setItem(`ob_done_${user.id}`, "1");
    navigate("/");
  };

  // slide 4(닉네임)은 입력 필수, 나머지 선택 단계는 선택 없어도 통과 가능
  const canNext = current !== 4 || nicknameInput.trim().length > 0;

  return (
    <div
      className="flex-1 flex flex-col bg-[#0A0808] relative h-full overflow-hidden"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) dx < 0 ? goTo(current + 1) : goTo(current - 1);
        touchX.current = null;
      }}
    >
      {/* 슬라이드 */}
      <div
        className="flex-1 flex flex-col min-h-0"
        style={{
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
      >
        {current === 0 && <Slide0 on={on} />}
        {current === 1 && <Slide1 on={on} />}
        {current === 2 && <Slide2 on={on} />}
        {current === 3 && <Slide3 on={on} />}
        {current === 4 && <Slide4 on={on} value={nicknameInput} onChange={setNicknameInput} />}
        {current === 5 && <Slide5 on={on} selected={selectedCats} toggle={toggleCat} />}
        {current === 6 && <Slide6 on={on} selected={selectedChallenges} toggle={toggleChallenge} groups={groups} />}
      </div>

      {/* 하단 CTA */}
      <div
        className="w-full px-8 pb-6 flex flex-col items-center gap-4 z-30 shrink-0"
        style={{ animation: "ob-fade 0.6s ease 500ms both" }}
      >
        {/* 인디케이터 */}
        <div className="flex gap-2 items-center">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? 28 : 6,
                height: 6,
                borderRadius: 9999,
                background: i === current ? "#FF3355" : "rgba(255,255,255,0.18)",
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>

        {current < TOTAL - 1 ? (
          <button
            onClick={() => canNext && goTo(current + 1)}
            disabled={!canNext}
            className="w-full h-14 text-white rounded-2xl text-[17px] font-bold flex items-center justify-center gap-2 group active:scale-[0.97] transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg,#FF3355,#FF6680)",
              animation: canNext ? "ob-glow 2.5s ease-in-out infinite" : "none",
            }}
          >
            다음
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="w-full h-14 text-white rounded-2xl text-[17px] font-bold flex items-center justify-center gap-2 group active:scale-[0.97] transition-transform"
            style={{
              background: "linear-gradient(135deg,#FF3355,#FF6680)",
              animation: "ob-glow 2.5s ease-in-out infinite",
            }}
          >
            {selectedChallenges.length > 0 ? `${selectedChallenges.length}개 챌린지로 시작하기` : "시작하기"}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {current >= 1 && current <= 3 && (
          <button
            onClick={() => goTo(4)}
            className="text-white/30 text-sm font-medium hover:text-white/50 transition-colors"
          >
            건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}
