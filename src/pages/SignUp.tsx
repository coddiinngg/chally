import { ChevronLeft, Eye, EyeOff, ArrowRight, Mail } from "lucide-react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { cn } from "../lib/utils";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";

export function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setNickname: saveNickname } = useApp();
  const { signUpWithEmail } = useAuth();
  const refCode = searchParams.get("ref");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: 기본 정보, 2: 비밀번호
  const [emailSent, setEmailSent] = useState(false);

  const canNext1 = nickname.trim().length >= 2 && email.includes("@");
  const canNext2 = password.length >= 8 && password === confirm;

  const handleSubmit = async () => {
    if (!canNext2) return;
    setError("");
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, nickname.trim(), refCode);
      saveNickname(nickname.trim());
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#0F1117] items-center justify-center px-8">
        <div className="w-20 h-20 rounded-3xl bg-[#FFE8EC] flex items-center justify-center mb-6">
          <Mail className="w-10 h-10 text-[#FF3355]" strokeWidth={2} />
        </div>
        <h2 className="text-[24px] font-black text-slate-900 dark:text-white text-center mb-3">이메일을 확인해주세요!</h2>
        <p className="text-slate-500 dark:text-white/50 text-[14px] text-center leading-relaxed mb-8">
          <span className="text-slate-900 dark:text-white font-bold">{email}</span>으로{"\n"}
          인증 이메일을 보냈어요.<br />
          메일함을 확인하고 링크를 클릭하면<br />
          로그인할 수 있어요.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="w-full h-14 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #FF3355, #ff5570)", boxShadow: "0 8px 24px -4px rgba(255,51,85,0.5)" }}
        >
          로그인 화면으로
        </button>
        <p className="text-slate-400 dark:text-white/25 text-[12px] mt-4 text-center">
          메일이 안 보이면 스팸함도 확인해주세요
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F1117] relative overflow-hidden">
      {/* 배경 글로우 (다크) */}
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#FF3355]/15 blur-[70px]" />
        <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full bg-[#FF3355]/08 blur-[50px]" />
      </div>
      {/* 배경 글로우 (라이트) */}
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-[#FF3355]/06 blur-[70px]" />
      </div>

      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 relative z-10">
        <button
          onClick={() => step === 2 ? setStep(1) : navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
        <span className="text-[13px] font-semibold text-slate-400 dark:text-white/40">{step} / 2</span>
        <div className="w-10" />
      </div>

      {/* 스텝 바 */}
      <div className="shrink-0 flex gap-2 px-5 pb-1 relative z-10">
        {[1, 2].map(i => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-500"
            style={{ background: i <= step ? "#FF3355" : "rgba(255,255,255,0.15)" }}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8 relative z-10">
        {/* 타이틀 */}
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF3355] mb-1.5">
            {step === 1 ? "기본 정보" : "비밀번호 설정"}
          </p>
          <h1 className="text-[26px] font-black leading-tight text-slate-900 dark:text-white">
            {step === 1 ? (
              <>챌리에<br />오신 걸 환영해요!</>
            ) : (
              <>비밀번호를<br />설정해주세요</>
            )}
          </h1>
          {step === 1 && refCode && (
            <p className="mt-3 inline-flex rounded-full bg-[#FF3355]/15 px-3 py-1.5 text-[12px] font-bold text-[#FF9DB2]">
              초대 코드 {refCode} 적용됨
            </p>
          )}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            {/* 닉네임 */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 mb-2 block">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="2자 이상 입력해주세요"
                className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3355] transition-colors text-[15px]"
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 mb-2 block">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@chally.app"
                className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3355] transition-colors text-[15px]"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className={cn(
                "w-full h-14 flex items-center justify-center gap-2 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] mt-4",
                canNext1
                  ? "text-white"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
              style={canNext1 ? {
                background: "linear-gradient(135deg, #FF3355, #ff5570)",
                boxShadow: "0 8px 24px -4px rgba(255,51,85,0.5)",
              } : {}}
            >
              다음
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 비밀번호 */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 mb-2 block">비밀번호 (8자 이상)</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full h-14 pl-5 pr-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3355] transition-colors text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* 강도 표시 */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{
                        background: password.length >= i * 3
                          ? i <= 1 ? "#ef4444" : i <= 2 ? "#f97316" : i <= 3 ? "#eab308" : "#22c55e"
                          : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 mb-2 block">비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className={cn(
                    "w-full h-14 pl-5 pr-12 rounded-2xl border bg-slate-50 dark:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none transition-colors text-[15px]",
                    confirm.length > 0
                      ? password === confirm ? "border-emerald-500" : "border-red-400"
                      : "border-slate-200 dark:border-white/10 focus:border-[#FF3355]"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirm.length > 0 && password !== confirm && (
                <p className="text-red-400 text-[12px] mt-1.5 ml-1">비밀번호가 일치하지 않아요</p>
              )}
            </div>

            {error && (
              <p className="text-center text-[13px] text-red-400">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canNext2 || loading}
              className={cn(
                "w-full h-14 flex items-center justify-center gap-2 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] mt-4",
                canNext2 && !loading
                  ? "text-white"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
              style={canNext2 && !loading ? {
                background: "linear-gradient(135deg, #FF3355, #ff5570)",
                boxShadow: "0 8px 24px -4px rgba(255,51,85,0.5)",
              } : {}}
            >
              {loading ? "처리 중..." : "가입 완료"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}

        <p className="text-center text-slate-400 dark:text-white/30 text-[13px] mt-6">
          이미 계정이 있으신가요?{" "}
          <Link to="/login" className="text-[#FF3355] font-bold hover:text-[#ff5570] transition-colors">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
