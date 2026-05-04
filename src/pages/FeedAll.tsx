import React, { useEffect, useState } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { formatActivityTime, loadActivityFeed, type ActivityFeedItem } from "../lib/activity";

function FeedCard({ item, index }: { item: ActivityFeedItem; index: number }) {
  const vt = VERIFY_TYPES[(item.verify_type as VerifyTypeKey) ?? "step_walk"] ?? VERIFY_TYPES.step_walk;
  const aspect = index % 3 === 0 ? "aspect-[3/4]" : "aspect-square";
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform cursor-pointer border border-black/[0.04]">
      <div className={`relative ${aspect}`}>
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.message} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#FF3355] to-[#FF6680]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute top-2.5 left-2.5 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className="text-[9px] text-white font-bold">{formatActivityTime(item.created_at)}</span>
        </div>
        <div className="absolute top-2.5 right-2.5 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
          <span className="text-[10px]">{vt.emoji}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <img src={item.author_avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`} alt={item.author_name ?? ""}
              className="w-5 h-5 rounded-full bg-white/20 shrink-0" />
            <span className="text-white text-[11px] font-black truncate">{item.author_name ?? "챌리 유저"}</span>
          </div>
          <p className="text-white/75 text-[11px] leading-snug line-clamp-2">{item.message}</p>
        </div>
      </div>
    </div>
  );
}

export function FeedAll() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const posts = await loadActivityFeed({ userId: user?.id ?? null, limit: 60 });
        if (!cancelled) setItems(posts);
      } catch (error) {
        console.error("Failed to load feed", error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 헤더 */}
      <header className="shrink-0 bg-white px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#FF3355,#CC0030)" }}>
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <h1 className="text-[18px] font-black text-slate-900">실시간 인증 피드</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </header>

      {/* 피드 */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-6">
        <div className="grid grid-cols-2 gap-2.5">
          {/* 왼쪽 컬럼 */}
          <div className="flex flex-col gap-2.5">
            {items.filter((_, i) => i % 2 === 0).map((item, i) => (
              <React.Fragment key={item.id}><FeedCard item={item} index={i * 2} /></React.Fragment>
            ))}
          </div>
          {/* 오른쪽 컬럼 — 위로 오프셋 */}
          <div className="flex flex-col gap-2.5 mt-6">
            {items.filter((_, i) => i % 2 === 1).map((item, i) => (
              <React.Fragment key={item.id}><FeedCard item={item} index={i * 2 + 1} /></React.Fragment>
            ))}
          </div>
        </div>
        {!loading && items.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-[14px] font-black text-slate-500">아직 인증 피드가 없어요</p>
            <p className="text-[12px] text-slate-400 mt-1">첫 그룹 인증을 완료하면 여기에 표시돼요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
