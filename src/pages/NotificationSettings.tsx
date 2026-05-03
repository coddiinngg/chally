import { ChevronLeft, Bell, Trophy, BarChart2, Clock, Zap, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(!value); }}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        value ? "bg-[#FF3355]" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200",
          value ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

const OTHER_ITEMS = [
  { icon: Trophy,    color: "#FF3355", bg: "#FFF0F3", label: "챌린지 알림",   desc: "새 챌린지·멤버 현황" },
  { icon: BarChart2, color: "#3b82f6", bg: "#eff6ff", label: "주간 리포트",   desc: "매주 월요일 오전 9시" },
  { icon: Zap,       color: "#a855f7", bg: "#f5f3ff", label: "달성 축하",     desc: "목표·연속 달성 알림"  },
];

export function NotificationSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [daily, setDaily]             = useState(true);
  const [time, setTime]               = useState("07:00");
  const [challenge, setChallenge]     = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [achievement, setAchievement] = useState(true);
  const [showOthers, setShowOthers]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const otherValues   = [challenge, weeklyReport, achievement];
  const otherSetters  = [setChallenge, setWeeklyReport, setAchievement];
  const enabledCount  = otherValues.filter(Boolean).length;
  const allEnabled    = enabledCount === otherValues.length;

  function toggleAll() {
    const next = !allEnabled;
    setChallenge(next);
    setWeeklyReport(next);
    setAchievement(next);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (loadError) {
        setError(loadError.message);
      } else if (data) {
        setDaily(data.daily_enabled);
        setTime(data.daily_time);
        setChallenge(data.challenge_enabled);
        setWeeklyReport(data.weekly_report_enabled);
        setAchievement(data.achievement_enabled);
      }
      setLoading(false);
    }
    void loadSettings();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function saveSettings() {
    if (!user) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase
      .from("notification_settings")
      .upsert({
        user_id: user.id,
        daily_enabled: daily,
        daily_time: time,
        challenge_enabled: challenge,
        weekly_report_enabled: weeklyReport,
        achievement_enabled: achievement,
      });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      navigate(-1);
    }, 700);
  }

  return (
    <div className="flex flex-col h-full bg-[#F5F6FA] overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 flex items-center px-4 pt-8 pb-4 bg-white border-b border-slate-100">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-[17px] font-black text-slate-900 ml-3">알림 설정</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {loading && (
          <p className="text-center text-[12px] text-slate-400 font-semibold">설정을 불러오는 중...</p>
        )}
        {error && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-[12px] text-red-500 font-semibold">{error}</p>
        )}

        {/* 일일 알림 */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1 mb-2">일일 알림</p>
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100">
            <div className="flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FFF0F3]">
                <Bell className="w-4 h-4 text-[#FF3355]" />
              </div>
              <span className="flex-1 text-[14px] font-semibold text-slate-800">매일 인증 알림</span>
              <Toggle value={daily} onChange={setDaily} />
            </div>

            {daily && (
              <>
                <div className="h-px bg-slate-50 mx-4" />
                <div className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50">
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="flex-1 text-[14px] font-semibold text-slate-800">알림 시간</span>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="text-[14px] font-black text-[#FF3355] bg-transparent focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* 기타 알림 — 아코디언 */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1 mb-2">기타 알림</p>
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100">
            {/* 헤더 행 */}
            <button
              onClick={() => setShowOthers(v => !v)}
              className="w-full flex items-center gap-3 p-4 active:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 relative">
                <Bell className="w-4 h-4 text-slate-500" />
                {enabledCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF3355] flex items-center justify-center text-[9px] font-black text-white leading-none">
                    {enabledCount}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-semibold text-slate-800">기타 알림</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {enabledCount > 0
                    ? `${OTHER_ITEMS.filter((_, i) => otherValues[i]).map(o => o.label).join(" · ")}`
                    : "모두 꺼짐"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Toggle value={allEnabled} onChange={toggleAll} />
                <ChevronDown
                  className="w-4 h-4 text-slate-300 transition-transform duration-200"
                  style={{ transform: showOthers ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </div>
            </button>

            {/* 펼쳐지는 항목들 */}
            {showOthers && (
              <div style={{ animation: "noti-drop 0.2s ease both" }}>
                {OTHER_ITEMS.map(({ icon: Icon, color, bg, label, desc }, i) => (
                  <div key={label}>
                    <div className="h-px bg-slate-50 mx-4" />
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                      </div>
                      <Toggle value={otherValues[i]} onChange={otherSetters[i]} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* 저장 버튼 */}
      <div className="shrink-0 px-4 pb-8 pt-3 bg-[#F5F6FA]">
        <button
          onClick={saveSettings}
          disabled={saving || loading}
          className="w-full h-14 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #FF3355, #ff5570)", boxShadow: "0 6px 20px -4px rgba(255,51,85,0.45)" }}
        >
          {saving ? "저장 중..." : saved ? "저장됨" : "저장하기"}
        </button>
      </div>

      <style>{`
        @keyframes noti-drop {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
