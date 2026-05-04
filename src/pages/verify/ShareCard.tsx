import React, { useState, useRef } from "react";
import { X, Sun, Moon, Share2, Instagram, Twitter, MessageCircle, MoreHorizontal, Check } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useApp } from "../../contexts/AppContext";
import { cn } from "../../lib/utils";

interface Props {
  imageUrl: string;
  defaultTitle: string;
  onClose: () => void;
}

async function buildShareImage(
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

  // Chally brand mark
  ctx.font = "bold 28px Pretendard, sans-serif";
  ctx.fillStyle = "#FF3355";
  ctx.fillText("CHALLY", W / 2, H - 100);

  // @username
  ctx.font = "30px Pretendard, sans-serif";
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)";
  ctx.fillText(`@${username}`, W / 2, H - 55);

  ctx.shadowBlur = 0;

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return; }
      resolve(new File([blob], "chally-verify.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.93);
  });
}

async function tryShare(options: ShareData & { files?: File[] }) {
  if (!navigator.share) return false;
  try {
    await navigator.share(options);
    return true;
  } catch {
    return false;
  }
}

export function ShareCard({ imageUrl, defaultTitle, onClose }: Props) {
  const { profile } = useAuth();
  const { nickname } = useApp();
  const username = profile?.username ?? nickname ?? "chally_user";

  const [title, setTitle]             = useState(defaultTitle);
  const [editing, setEditing]         = useState(false);
  const [isDark, setIsDark]           = useState(true);
  const [showSheet, setShowSheet]     = useState(false);
  const [sharing, setSharing]         = useState(false);
  const [sharedTarget, setSharedTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function share(target: "instagram" | "kakao" | "x" | "more") {
    if (sharing) return;
    setSharing(true);
    try {
      const file = await buildShareImage(imageUrl, title, username, isDark);
      const appUrl = window.location.origin + "/";
      const text = `${title} 챌린지 인증! @${username}`;

      if (target === "x") {
        const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(appUrl)}`;
        window.open(tw, "_blank");
        setSharedTarget("x");
      } else {
        const ok = await tryShare({
          title: `${title} 챌린지 인증`,
          text,
          url: appUrl,
          ...(file ? { files: [file] } : {}),
        });
        if (ok) setSharedTarget(target);
      }
    } catch {
      // ignore
    } finally {
      setSharing(false);
      setTimeout(() => setSharedTarget(null), 2000);
    }
  }

  const shareApps = [
    { key: "instagram" as const, label: "인스타그램 DM", color: "#E1306C", Icon: Instagram },
    { key: "kakao"     as const, label: "카카오톡",      color: "#FEE500", Icon: MessageCircle },
    { key: "x"         as const, label: "X",             color: "#000000", Icon: Twitter },
    { key: "more"      as const, label: "더보기",         color: "#6366F1", Icon: MoreHorizontal },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: isDark ? "#111111" : "#F8F8FA" }}
    >
      {/* ── top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-12 pb-3 z-10">
        <button
          onClick={onClose}
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

      {/* ── title ── */}
      <div className="shrink-0 px-6 pb-3 flex items-center justify-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => e.key === "Enter" && setEditing(false)}
            maxLength={30}
            className="text-center font-black text-[20px] bg-transparent border-b-2 border-[#FF3355] outline-none w-full max-w-[260px]"
            style={{ color: isDark ? "#FFFFFF" : "#111111" }}
          />
        ) : (
          <button
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 60); }}
            className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
          >
            <span className="font-black text-[20px]" style={{ color: isDark ? "#FFFFFF" : "#111111" }}>
              {title}
            </span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#FF3355", color: "#fff" }}>편집</span>
          </button>
        )}
      </div>

      {/* ── photo ── */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
          <img
            src={imageUrl}
            alt="인증 사진"
            className="w-full object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* ── @username + brand ── */}
      <div className="shrink-0 flex flex-col items-center gap-0.5 py-3">
        <span className="text-[11px] font-black tracking-widest" style={{ color: "#FF3355" }}>CHALLY</span>
        <span className="text-[13px] font-medium" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }}>
          @{username}
        </span>
      </div>

      {/* ── share button ── */}
      <div className="shrink-0 px-6 pb-10">
        <button
          onClick={() => setShowSheet(true)}
          className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-[16px] active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)", boxShadow: "0 8px 24px -4px rgba(255,51,85,0.35)" }}
        >
          <Share2 className="w-5 h-5" />
          공유하기
        </button>
      </div>

      {/* ── share bottom sheet ── */}
      {showSheet && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
            style={{ background: isDark ? "#1C1C1E" : "#FFFFFF" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-400/40 mx-auto mt-3 mb-5" />
            <p className={cn("text-center text-[13px] font-semibold mb-5", isDark ? "text-slate-400" : "text-slate-500")}>
              공유할 앱을 선택하세요
            </p>

            <div className="grid grid-cols-4 gap-2 px-4 pb-10">
              {shareApps.map(({ key, label, color, Icon }) => (
                <button
                  key={key}
                  onClick={() => share(key)}
                  disabled={sharing}
                  className="flex flex-col items-center gap-2 py-3 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: color === "#FEE500" ? color : `${color}22` }}>
                    {sharedTarget === key
                      ? <Check className="w-6 h-6" style={{ color: color === "#FEE500" ? "#111" : color }} />
                      : <Icon className="w-6 h-6" style={{ color: color === "#FEE500" ? "#111" : color }} />
                    }
                  </div>
                  <span className="text-[10px] font-semibold leading-tight text-center"
                    style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
