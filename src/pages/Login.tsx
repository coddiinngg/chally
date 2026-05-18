import React, { useState } from "react";
import { Eye, EyeOff, ArrowRight, X } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export const TERMS_CONTENT = `챌리(Chally) 서비스 이용약관

제1조 (목적)

본 약관은 챌리(Chally)(이하 "회사")가 제공하는 챌리 서비스 및 관련 제반 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

제2조 (정의)

1. "서비스"란 회사가 제공하는 목표 설정, 챌린지 참여, 기록 관리, 커뮤니티 및 기타 관련 기능을 의미합니다.
2. "회원"이란 본 약관에 동의하고 회사와 이용계약을 체결하여 서비스를 이용하는 자를 의미합니다.
3. "계정"이란 회원 식별 및 서비스 이용을 위해 회원이 설정한 이메일, 소셜 로그인 정보 등을 의미합니다.
4. "콘텐츠"란 회원이 서비스 내에 게시, 등록 또는 공유하는 텍스트, 이미지, 영상, 댓글 및 기타 모든 정보를 의미합니다.

제3조 (약관의 효력 및 변경)

1. 본 약관은 회원이 동의함으로써 효력이 발생합니다.
2. 회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있습니다.
3. 변경된 약관은 서비스 내 공지하거나 회원에게 통지함으로써 효력이 발생합니다.
4. 회원이 변경된 약관 시행일 이후에도 서비스를 계속 이용하는 경우, 변경 사항에 동의한 것으로 간주합니다.

제4조 (회원가입 및 계정 관리)

1. 회원은 회사가 정한 절차에 따라 회원가입을 신청할 수 있습니다.
2. 회원은 정확하고 최신의 정보를 제공해야 합니다.
3. 회원은 자신의 계정 정보를 안전하게 관리할 책임이 있습니다.
4. 계정 관리 소홀로 발생한 손해에 대한 책임은 회원에게 있습니다.

제5조 (서비스의 제공)

1. 회사는 다음과 같은 서비스를 제공합니다.
  가. 목표 및 챌린지 생성, 참여 및 관리
  나. 공동 목표 달성을 위한 매칭 서비스
  다. 활동 기록 및 성과 관리
  라. 커뮤니티 및 소통 기능
  마. 기타 회사가 제공하는 부가 서비스
2. 회사는 서비스의 일부 또는 전부를 변경하거나 종료할 수 있습니다.

제6조 (회원의 의무)

회원은 다음 각 호의 행위를 하여서는 안 됩니다.

1. 허위 정보 등록
2. 타인의 계정 도용
3. 서비스 운영을 방해하는 행위
4. 타인의 권리, 명예 또는 이익을 침해하는 행위
5. 관련 법령 또는 공공질서에 반하는 행위

제7조 (콘텐츠의 권리 및 이용)

1. 회원이 작성한 콘텐츠의 저작권은 회원에게 귀속됩니다.
2. 회원은 회사가 서비스 운영, 홍보, 개선을 위하여 해당 콘텐츠를 사용할 수 있도록 비독점적 이용권을 부여합니다.
3. 회사는 관련 법령 또는 본 약관에 위반되는 콘텐츠를 삭제하거나 이용을 제한할 수 있습니다.

제8조 (서비스 이용 제한)

회사는 회원이 다음 각 호에 해당하는 경우 서비스 이용을 제한하거나 회원 자격을 정지 또는 상실시킬 수 있습니다.

1. 본 약관을 위반한 경우
2. 관련 법령을 위반한 경우
3. 서비스 운영에 중대한 지장을 초래한 경우

제9조 (면책조항)

1. 회사는 천재지변, 시스템 장애, 통신망 장애 등 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.
2. 회사는 회원 간 또는 회원과 제3자 간에 발생한 분쟁에 개입하지 않으며, 이에 대한 책임을 부담하지 않습니다.
3. 회사는 회원이 서비스를 통해 기대하는 특정 성과나 결과를 보장하지 않습니다.

제10조 (개인정보 보호)

회사는 관련 법령이 정하는 바에 따라 회원의 개인정보를 보호하며, 개인정보 처리에 관한 사항은 개인정보처리방침에 따릅니다.

제11조 (계약 해지 및 탈퇴)

1. 회원은 언제든지 서비스 내에서 회원 탈퇴를 요청할 수 있습니다.
2. 회사는 관련 법령에 따라 필요한 정보를 일정 기간 보관할 수 있습니다.

제12조 (준거법 및 관할법원)

1. 본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.
2. 서비스 이용과 관련하여 발생한 분쟁은 대한민국 법원을 관할 법원으로 합니다.

부칙

본 약관은 2026년 5월 16일부터 시행합니다.`;

export const PRIVACY_CONTENT = `챌리(Chally) 개인정보처리방침

챌리(Chally)(이하 "회사")는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 회사는 이용자의 개인정보를 안전하게 보호하고, 관련 고충을 신속하고 원활하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.

제1조 (개인정보의 수집 항목 및 방법)

1. 회사는 서비스 제공을 위하여 다음과 같은 개인정보를 수집할 수 있습니다.

가. 회원가입 및 로그인
- 이메일 주소
- 닉네임
- 프로필 이미지
- 소셜 로그인 식별자

나. 서비스 이용 과정에서 자동으로 생성되는 정보
- 서비스 이용 기록
- 접속 로그
- 기기 정보(OS, 기기 모델, 고유 식별자)
- IP 주소
- 쿠키 및 광고 식별자

다. 고객 문의 및 상담
- 이름
- 이메일 주소
- 문의 내용

라. 이미지 업로드 기능 이용 시
- 이용자가 직접 촬영하거나 선택한 사진 및 이미지 파일

2. 회사는 다음과 같은 방법으로 개인정보를 수집합니다.
- 회원가입 및 서비스 이용 과정에서 이용자가 직접 입력
- 소셜 로그인 연동 과정
- 고객센터 문의 접수
- 서비스 이용 과정에서 자동 생성

제2조 (개인정보의 수집 및 이용 목적)

회사는 수집한 개인정보를 다음 목적을 위해 이용합니다.

- 회원 식별 및 본인 확인
- 서비스 제공 및 운영
- 챌린지 생성, 참여 및 기록 관리
- 회원 간 매칭 및 커뮤니티 기능 제공
- 이미지 업로드 및 콘텐츠 등록
- 고객 문의 응대 및 불만 처리
- 서비스 개선 및 신규 서비스 개발
- 부정 이용 방지 및 보안 관리
- 법령상 의무 이행

제3조 (카메라 및 사진첩 접근 권한)

1. 회사는 이미지 업로드 기능 제공을 위해 다음 접근 권한을 요청할 수 있습니다.
- 카메라: 사진 촬영 후 즉시 업로드
- 사진첩(갤러리): 기존 사진 선택 및 업로드

2. 해당 권한은 이용자가 선택적으로 허용할 수 있으며, 허용하지 않더라도 기본 서비스 이용에는 제한이 없습니다. 다만, 이미지 업로드 기능 이용이 제한될 수 있습니다.

제4조 (개인정보의 보유 및 이용 기간)

1. 회사는 개인정보 수집 및 이용 목적이 달성된 후 지체 없이 해당 정보를 파기합니다.
2. 다만, 관련 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 기간 동안 안전하게 보관합니다.
- 계약 또는 청약철회 등에 관한 기록: 5년
- 대금결제 및 재화 등의 공급에 관한 기록: 5년
- 소비자 불만 또는 분쟁 처리에 관한 기록: 3년
- 접속 기록: 3개월

제5조 (개인정보의 제3자 제공)

회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.

- 이용자가 사전에 동의한 경우
- 법령에 특별한 규정이 있는 경우
- 수사기관 등 관계 법령에 따른 적법한 요청이 있는 경우

제6조 (개인정보 처리의 위탁)

회사는 원활한 서비스 제공을 위해 필요한 경우 개인정보 처리 업무를 외부 업체에 위탁할 수 있으며, 위탁 시 관련 법령에 따라 필요한 사항을 공개합니다.

제7조 (이용자의 권리와 행사 방법)

1. 이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있습니다.
2. 이용자는 언제든지 개인정보 처리에 대한 동의를 철회할 수 있습니다.
3. 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.

제8조 (개인정보의 파기)

회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 개인정보를 파기합니다.

- 전자적 파일: 복구 불가능한 방법으로 삭제
- 종이 문서: 분쇄 또는 소각

제9조 (개인정보의 안전성 확보 조치)

회사는 개인정보 보호를 위하여 다음과 같은 조치를 취합니다.

- 개인정보 암호화
- 접근 권한 관리
- 보안 프로그램 설치 및 운영
- 접속 기록 보관 및 위변조 방지
- 내부 관리 계획 수립 및 시행

제10조 (개인정보 보호책임자)

회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제를 위하여 개인정보 보호책임자를 지정합니다.

- 개인정보 보호책임자: 챌리 운영팀
- 이메일: privacy@chally.app

제11조 (개인정보처리방침의 변경)

본 개인정보처리방침은 관련 법령 및 회사 정책에 따라 변경될 수 있으며, 변경 시 서비스 내 공지사항을 통해 안내합니다.

부칙

본 개인정보처리방침은 2026년 5월 16일부터 시행합니다.`;

function LegalModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-t-3xl overflow-hidden"
        style={{
          background: "#161921",
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "85vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg,#FF3355,#FF6680)" }} />
            <span className="text-white font-bold text-[15px]">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.07] text-white/50 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {content.split("\n\n").map((block, i) => {
            const isTitle = block.startsWith("챌리(Chally)");
            const isArticle = /^제\d+조/.test(block);
            const isAddendum = block.startsWith("부칙");
            if (isTitle) {
              return (
                <h2 key={i} className="text-white font-black text-[16px] mb-4 text-center">
                  {block}
                </h2>
              );
            }
            if (isArticle || isAddendum) {
              const [heading, ...rest] = block.split("\n");
              return (
                <div key={i} className="mb-4">
                  <p className="text-white font-bold text-[13px] mb-1">{heading}</p>
                  {rest.length > 0 && (
                    <p className="text-white/50 text-[12px] leading-relaxed whitespace-pre-line">{rest.join("\n")}</p>
                  )}
                </div>
              );
            }
            return (
              <p key={i} className="text-white/50 text-[12px] leading-relaxed mb-4 whitespace-pre-line">{block}</p>
            );
          })}
          <div className="h-4" />
        </div>

        {/* 확인 버튼 */}
        <div className="px-5 pb-8 pt-3 shrink-0 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="w-full rounded-2xl text-white font-bold text-[15px] transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#FF3355,#ff5570)", boxShadow: "0 6px 20px -4px rgba(255,51,85,0.45)", height: "52px" }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { signInWithEmail } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      const uid = loggedInUser?.id;
      const localDone = uid ? localStorage.getItem(`ob_done_${uid}`) : null;
      let onboardingDone = localDone;
      if (!onboardingDone && uid) {
        const { data: profileData } = await supabase.from("profiles").select("username").eq("id", uid).single();
        if (profileData?.username) {
          localStorage.setItem(`ob_done_${uid}`, "1");
          onboardingDone = "1";
        }
      }
      navigate(onboardingDone ? "/" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F1117] relative overflow-hidden">
      {/* 배경 글로우 (다크 모드만) */}
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute top-10 -left-36 w-80 h-80 rounded-full bg-[#FF3355]/20 blur-[80px]" />
        <div className="absolute bottom-8 -right-32 w-72 h-72 rounded-full bg-[#FF3355]/12 blur-[70px]" />
      </div>
      {/* 배경 글로우 (라이트 모드) */}
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div className="absolute top-10 -left-36 w-80 h-80 rounded-full bg-[#FF3355]/08 blur-[80px]" />
        <div className="absolute bottom-8 -right-32 w-72 h-72 rounded-full bg-[#FF3355]/05 blur-[70px]" />
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto relative z-10">
        {/* 로고 영역 */}
        <div className="flex flex-col items-center pt-16 pb-8 px-8">
          <img
            src="/chally-logo-nobg.png"
            alt="챌리"
            className="w-32 h-32 object-contain mb-2 drop-shadow-[0_8px_32px_rgba(255,51,85,0.35)]"
          />
          <h1 className="text-[28px] font-black text-slate-900 dark:text-white leading-tight text-center">
            반가워요!<br />
            <span className="text-[#FF3355]">챌리</span>에 오신 걸 환영해요
          </h1>
          <p className="text-slate-400 dark:text-white/40 text-[13px] font-medium mt-2 text-center">
            챌린지로 모임, 챌린지가 모임!
          </p>
        </div>

        {/* 이메일 폼 */}
        <form onSubmit={handleLogin} className="px-6 space-y-3 mb-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일"
            className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-[#FF3355] transition-colors text-[15px]"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full h-14 pl-5 pr-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-[#FF3355] transition-colors text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-[15px] transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #FF3355, #ff5570)", boxShadow: "0 8px 24px -4px rgba(255,51,85,0.5)" }}
          >
            {loading ? "로그인 중..." : (<>로그인 <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>

        {/* 링크 */}
        <div className="flex items-center justify-center gap-4 text-[13px] text-slate-400 dark:text-white/30 mb-6">
          <Link to="/forgot-password" className="hover:text-slate-600 dark:hover:text-white/60 transition-colors">비밀번호 찾기</Link>
          <div className="w-px h-3 bg-slate-200 dark:bg-white/10" />
          <Link to="/signup" className="text-[#FF3355] font-bold hover:text-[#ff5570] transition-colors">회원가입</Link>
        </div>



        <p className="text-center text-[11px] text-slate-400 dark:text-white/15 pb-8 px-8">
          계속 진행 시 챌리의{" "}
          <button
            className="underline hover:text-slate-600 dark:hover:text-white/30 transition-colors"
            onClick={() => setShowTerms(true)}
          >서비스 약관</button>{" "}
          및{" "}
          <button
            className="underline hover:text-slate-600 dark:hover:text-white/30 transition-colors"
            onClick={() => setShowPrivacy(true)}
          >개인정보 처리방침</button>에 동의하게 됩니다.
        </p>
      </div>

      {showTerms && <LegalModal title="서비스 이용약관" content={TERMS_CONTENT} onClose={() => setShowTerms(false)} />}
      {showPrivacy && <LegalModal title="개인정보처리방침" content={PRIVACY_CONTENT} onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
