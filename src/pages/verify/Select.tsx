import React, { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../contexts/AppContext";
import { VERIFY_TYPES, VERIFY_TYPE_KEYS, type VerifyTypeKey } from "../../lib/verifyTypes";

export function VerifySelect() {
  const navigate = useNavigate();
  const { beginVerification } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  function pick(key: VerifyTypeKey) {
    beginVerification({ verifyType: key });
    navigate(`/verify/guide/${key}`);
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F8FA]">
      <style>{`
        @keyframes vs-in { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* 헤더 */}
      <div className="shrink-0 bg-white border-b border-black/[0.05] px-4 pt-4 pb-4"
        style={{ animation: "vs-in 0.35s ease both" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-[18px] font-black text-slate-900 leading-tight">인증 방식 선택</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">오늘 어떻게 인증할까요?</p>
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {VERIFY_TYPE_KEYS.map((key, i) => {
            const vt = VERIFY_TYPES[key];
            return (
              <button
                key={key}
                onClick={() => pick(key)}
                className="relative overflow-hidden rounded-2xl p-4 text-left active:scale-[0.97] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #FF3355, #FF6680)",
                  boxShadow: "0 6px 20px rgba(255,51,85,0.3)",
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(16px)",
                  transition: `opacity 0.45s ease ${i * 70}ms, transform 0.45s cubic-bezier(0.4,0,0.2,1) ${i * 70}ms`,
                }}
              >
                {/* 배경 장식 원 */}
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -left-3 w-16 h-16 rounded-full bg-white/10" />

                <span className="relative z-10 text-[32px] block mb-2">{vt.emoji}</span>
                <p className="relative z-10 font-black text-[15px] text-white leading-tight">{vt.label}</p>
                <p className="relative z-10 text-[11px] text-white/70 mt-1 leading-snug">{vt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
