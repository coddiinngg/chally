import { Home, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isGuestMode } from "../App";
import { useAuth } from "../contexts/AuthContext";

export function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canGoHome = Boolean(user) || isGuestMode();

  return (
    <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#FF3355]">404</p>
      <h1 className="mt-2 text-[24px] font-black text-slate-900">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
        주소가 바뀌었거나 사용할 수 없는 링크예요.
      </p>
      <div className="mt-6 flex w-full max-w-[260px] gap-2">
        {canGoHome && (
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 py-3 text-[14px] font-bold text-white"
          >
            <Home className="h-4 w-4" />
            홈
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#FF3355] py-3 text-[14px] font-bold text-white"
        >
          <LogIn className="h-4 w-4" />
          로그인
        </button>
      </div>
    </div>
  );
}
