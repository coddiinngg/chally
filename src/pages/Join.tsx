import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

function normalizeGroupCode(code: string | undefined) {
  if (!code) return null;
  const raw = code.replace(/^GROUP-/i, "");
  const numeric = raw.replace(/^0+/, "");
  return numeric || raw;
}

export function Join() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const groupId = normalizeGroupCode(code);
    sessionStorage.setItem("guestMode", "1");
    navigate(groupId ? `/challenge/group/${groupId}?preview=1` : "/challenge?preview=1", { replace: true });
  }, [code, navigate]);

  return (
    <div className="flex h-full items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#FF3355]/20 border-t-[#FF3355]" />
    </div>
  );
}
