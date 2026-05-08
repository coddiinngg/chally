import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { X, Image as ImageIcon, Sparkles, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../contexts/AppContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../../lib/verifyTypes";


export function Camera() {
  const navigate = useNavigate();
  const { verifyType, setVerificationImage, theme } = useApp();
  const captureInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  function showFileError(msg: string) {
    setFileError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setFileError(null), 3000);
  }

  const key = (verifyType as VerifyTypeKey) ?? "step_walk";
  const vt  = VERIFY_TYPES[key] ?? VERIFY_TYPES["step_walk"];

  const PA = "#FF3355";
  const PB = "#FF6680";

  const d = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const baseBg      = d ? "#08080F" : "#EEF0F5";
  const bgGrad      = d
    ? `linear-gradient(160deg, ${PA}28 0%, ${PB}14 40%, #000 100%)`
    : `linear-gradient(160deg, ${PA}22 0%, ${PB}14 50%, #EEF0F5 100%)`;
  const vignette    = d
    ? "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.82) 100%)"
    : "linear-gradient(to bottom, rgba(238,240,245,0.88) 0%, rgba(238,240,245,0) 28%, rgba(238,240,245,0) 52%, rgba(238,240,245,0.9) 100%)";
  const btnBg       = d ? "rgba(0,0,0,0.35)"        : "rgba(255,255,255,0.78)";
  const btnBorder   = d ? "rgba(255,255,255,0.12)"   : "rgba(0,0,0,0.08)";
  const pillBg      = d ? "rgba(0,0,0,0.45)"        : "rgba(255,255,255,0.82)";
  const pillBorder  = d ? "rgba(255,255,255,0.14)"   : "rgba(0,0,0,0.1)";
  const iconColor   = d ? "white"                    : "#1e293b";
  const textPri     = d ? "white"                    : "#0f172a";
  const textMuted   = d ? "rgba(255,255,255,0.5)"    : "rgba(0,0,0,0.38)";
  const divider     = d ? "rgba(255,255,255,0.2)"    : "rgba(0,0,0,0.15)";
  const gridLine    = d ? "rgba(255,255,255,0.04)"   : "rgba(0,0,0,0.05)";
  const logoFilter  = d ? "brightness(0) invert(1)"  : "brightness(0)";
  const logoOpacity = d ? 0.06 : 0.05;
  const scanBg      = d ? "rgba(0,0,0,0.6)"          : "rgba(255,255,255,0.75)";
  const scanText    = d ? "white"                    : "#0f172a";

  const MAX_FILE_BYTES = 30 * 1024 * 1024;

  function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    if (scanning) return;
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("image/")) { showFileError("이미지 파일만 선택할 수 있어요."); return; }
    if (file.size > MAX_FILE_BYTES) { showFileError("파일 크기가 너무 큽니다. 30MB 이하 이미지를 사용해주세요."); return; }
    setVerificationImage(file);
    setScanning(true);
    timerRef.current = setTimeout(() => navigate("/verify/upload"), 900);
  }

  function handleShutter() {
    if (scanning) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
    captureInputRef.current?.click();
  }

  const frameRatio =
    vt.frameAspect === "square" ? "aspect-square"
    : vt.frameAspect === "landscape" ? "aspect-[4/3]"
    : "aspect-[3/4]";

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: baseBg }}>
      <style>{`
        @keyframes cam-scan {
          0%   { top: 6%;  opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }
        @keyframes cam-ring {
          0%, 100% { transform: scale(1);   opacity: 0.55; }
          50%       { transform: scale(1.08); opacity: 1; }
        }
        @keyframes cam-pulse {
          from { transform: scale(0.94); opacity: 0.9; }
          to   { transform: scale(1.06); opacity: 1; }
        }
        @keyframes cam-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cam-bracket {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* 파일 인풋 */}
      <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilePick} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />

      {/* 파일 에러 토스트 */}
      {fileError && (
        <div className="absolute top-16 left-4 right-4 z-50 px-4 py-3 rounded-2xl text-white text-[13px] font-semibold text-center pointer-events-none"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", animation: "cam-in 0.2s ease both" }}>
          {fileError}
        </div>
      )}

      {/* 셔터 플래시 */}
      <div className="absolute inset-0 z-50 pointer-events-none bg-white transition-opacity duration-150"
        style={{ opacity: flash ? 0.75 : 0 }} />

      {/* 배경 — 타입 컬러 그라디언트 */}
      <div className="absolute inset-0" style={{ background: bgGrad }} />

      {/* Chally 로고 워터마크 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img src="/chally-logo-nobg.png" alt=""
          style={{ width: 200, opacity: logoOpacity, filter: logoFilter }} />
      </div>

      {/* 상하 그라데이션 오버레이 */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: vignette }} />

      {/* 타입 컬러 글로우 */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 45%, ${PA}18 0%, transparent 65%)` }} />

      {/* ── 상단 바 ── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-3"
        style={{ animation: mounted ? "cam-in 0.35s ease both" : "none" }}>

        {/* 닫기 */}
        <button onClick={() => navigate("/")}
          className="w-10 h-10 flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
          style={{ background: btnBg, backdropFilter: "blur(8px)", border: `1px solid ${btnBorder}` }}>
          <X className="w-4 h-4" style={{ color: iconColor }} />
        </button>

        {/* 중앙 타입 pill */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: pillBg, backdropFilter: "blur(12px)", border: `1px solid ${pillBorder}` }}>
          <span className="text-[15px] leading-none">{vt.emoji}</span>
          <span className="text-[13px] font-black" style={{ color: textPri }}>{vt.label}</span>
          <div className="w-px h-3 mx-0.5" style={{ background: divider }} />
          <span className="text-[11px] font-medium" style={{ color: textMuted }}>AI 인증</span>
        </div>

        <div className="w-10 h-10" />
      </div>

      {/* ── 뷰파인더 프레임 ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 px-10">
        <div className={`relative w-full max-w-[270px] ${frameRatio}`}
          style={{ animation: mounted ? "cam-bracket 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s both" : "none" }}>

          {/* 모서리 브래킷 */}
          {[
            "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl",
            "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl",
            "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl",
            "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-9 h-9 ${cls}`}
              style={{ borderColor: PA, filter: `drop-shadow(0 0 8px ${PA}90)` }} />
          ))}

          {/* 스캔 라인 */}
          {!scanning && (
            <div className="absolute left-3 right-3 h-[2px] rounded-full pointer-events-none z-10"
              style={{
                background: `linear-gradient(to right, transparent, ${PA}, ${PB}, transparent)`,
                boxShadow: `0 0 14px ${PA}`,
                animation: "cam-scan 2.6s ease-in-out infinite",
              }} />
          )}

          {/* 프레임 내부 미세 격자선 (구도 보조) */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
              backgroundSize: "33.3% 33.3%",
            }} />

          {/* 스캔 중 오버레이 */}
          {scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
              style={{ background: scanBg, backdropFilter: "blur(6px)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg,${PA},${PB})`,
                  boxShadow: `0 0 32px ${PA}70`,
                  animation: "cam-pulse 0.7s ease-in-out infinite alternate",
                }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <p className="font-black text-[14px]" style={{ color: scanText }}>AI 분석 중…</p>
            </div>
          )}
        </div>

        {/* 힌트 — 프레임 아래 */}
        <p className="text-[12px] text-center leading-snug px-4"
          style={{ color: textMuted, animation: mounted ? "cam-in 0.4s ease 0.2s both" : "none" }}>
          {vt.hint}
        </p>
      </div>

      {/* ── 하단 컨트롤 ── */}
      <div className="relative z-10 pb-12 px-10"
        style={{ animation: mounted ? "cam-in 0.4s ease 0.15s both" : "none" }}>
        <div className="flex items-center justify-between">

          {/* 갤러리 */}
          <button onClick={() => galleryInputRef.current?.click()}
            className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: btnBg, backdropFilter: "blur(8px)", border: `1px solid ${btnBorder}` }}>
              <ImageIcon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: textMuted }}>갤러리</span>
          </button>

          {/* 셔터 */}
          <button onClick={handleShutter}
            className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
            <div className="relative">
              {/* 바깥 링 */}
              <div className="absolute inset-[-8px] rounded-full"
                style={{ border: `2px solid ${PA}`, animation: "cam-ring 2.2s ease-in-out infinite" }} />
              {/* 셔터 버튼 */}
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                style={{ background: d ? "white" : "white", boxShadow: `0 6px 28px rgba(0,0,0,${d ? 0.45 : 0.18}), 0 0 0 1px ${btnBorder}` }}>
                <div className="w-[56px] h-[56px] rounded-full"
                  style={{ background: `linear-gradient(135deg, ${PA}40, ${PB}28)` }} />
              </div>
            </div>
            <span className="text-[10px] font-semibold mt-1.5" style={{ color: textMuted }}>촬영</span>
          </button>

          {/* 가이드 바로가기 */}
          <button onClick={() => navigate(-1)}
            className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: btnBg, backdropFilter: "blur(8px)", border: `1px solid ${btnBorder}` }}>
              <BookOpen className="w-5 h-5" style={{ color: iconColor }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: textMuted }}>가이드</span>
          </button>

        </div>
      </div>
    </div>
  );
}
