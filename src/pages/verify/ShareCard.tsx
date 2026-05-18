import React, { useState, useRef } from "react";
import { X, Sun, Moon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApp } from "../../contexts/AppContext";
import { cn } from "../../lib/utils";

interface Props {
  imageUrl: string;
  defaultTitle: string;
  onClose: () => void;
  onSave?: (title: string, isDark: boolean) => void;
}

export async function buildShareImage(
  src: string,
  title: string,
  username: string,
  isDark: boolean,
): Promise<File | null> {
  const W = 810, H = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = isDark ? "#111111" : "#F8F8FA";
  ctx.fillRect(0, 0, W, H);

  const img = new Image();
  img.crossOrigin = "anonymous";
  const loaded = await new Promise<boolean>(res => {
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
  if (!loaded) return null; // CORS 또는 네트워크 오류 시 null 반환

  const ratio = img.naturalWidth / img.naturalHeight;
  const drawW = W;
  const drawH = Math.round(drawW / ratio);
  const drawY = Math.round((H - drawH) / 2);
  ctx.drawImage(img, 0, drawY, drawW, drawH);

  // top/bottom gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 200);
  topGrad.addColorStop(0, isDark ? "rgba(17,17,17,0.90)" : "rgba(248,248,250,0.90)");
  topGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 200);

  const botGrad = ctx.createLinearGradient(0, H - 200, 0, H);
  botGrad.addColorStop(0, "transparent");
  botGrad.addColorStop(1, isDark ? "rgba(17,17,17,0.90)" : "rgba(248,248,250,0.90)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, H - 200, W, 200);

  ctx.textAlign = "center";

  // title
  ctx.shadowColor = isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)";
  ctx.shadowBlur = 16;
  ctx.font = "bold 58px Pretendard, 'Apple SD Gothic Neo', sans-serif";
  ctx.fillStyle = isDark ? "#FFFFFF" : "#111111";
  ctx.fillText(title, W / 2, 120, W - 80);

  // @username
  ctx.font = "bold 34px Pretendard, sans-serif";
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)";
  ctx.fillText(`@${username}`, W / 2, H - 68);

  ctx.shadowBlur = 0;

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return; }
      resolve(new File([blob], "chally-verify.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.93);
  });
}


export function ShareCard({ imageUrl, defaultTitle, onClose, onSave }: Props) {
  const { profile } = useAuth();
  const { nickname } = useApp();
  const username = profile?.username ?? nickname ?? "챌리유저";

  const [title, setTitle]   = useState(defaultTitle);
  const [editing, setEditing] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    onSave?.(title, isDark);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: isDark ? "#111111" : "#F8F8FA" }}
    >
      {/* ── top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2 z-10">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}
        >
          <X className={cn("w-5 h-5", isDark ? "text-white" : "text-slate-700")} />
        </button>

        <button
          onClick={() => setIsDark(v => !v)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }}
        >
          {isDark
            ? <Sun className="w-5 h-5 text-amber-300" />
            : <Moon className="w-5 h-5 text-slate-500" />
          }
        </button>
      </div>

      {/* ── 사진 + 제목 + 아이디 (한 묶음으로 화면 중앙 정렬) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* title */}
        <div className="shrink-0 mb-3 w-full flex items-center justify-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={e => e.key === "Enter" && setEditing(false)}
              maxLength={30}
              className="text-center font-black text-[28px] tracking-tight bg-transparent border-b-2 border-[#FF3355] outline-none w-full max-w-[320px]"
              style={{ color: isDark ? "#FFFFFF" : "#111111" }}
            />
          ) : (
            <button
              onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 60); }}
              className="font-black text-[28px] tracking-tight leading-tight active:opacity-70 transition-opacity text-center"
              style={{ color: isDark ? "#FFFFFF" : "#111111" }}
            >
              {title}
            </button>
          )}
        </div>

        {/* photo */}
        <div className="shrink-0 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
          <img
            src={imageUrl}
            alt="인증 사진"
            className="w-full object-contain"
            draggable={false}
          />
        </div>

        {/* @username */}
        <div className="shrink-0 mt-3 flex items-center justify-center">
          <span className="text-[18px] font-bold tracking-tight" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)" }}>
            @{username}
          </span>
        </div>
      </div>
    </div>
  );
}
