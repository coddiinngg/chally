import { ChevronLeft, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PRIVACY_CONTENT, TERMS_CONTENT } from "./Login";

function LegalDocument({ title, content }: { title: string; content: string }) {
  const navigate = useNavigate();
  const blocks = content.split("\n\n");

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0F1117]">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 active:scale-95 dark:bg-white/10 dark:text-white"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF3355]">Chally</p>
          <h1 className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-5">
        {blocks.map((block, index) => {
          const isTitle = index === 0;
          const isHeading = /^제\d+조/.test(block) || block.startsWith("부칙");

          if (isTitle) {
            return (
              <h2 key={index} className="mb-5 text-[22px] font-black leading-tight text-slate-950 dark:text-white">
                {block}
              </h2>
            );
          }

          if (isHeading) {
            const [heading, ...rest] = block.split("\n");
            return (
              <section key={index} className="mb-5">
                <h3 className="mb-2 text-[15px] font-black text-slate-900 dark:text-white">{heading}</h3>
                {rest.length > 0 && (
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-600 dark:text-white/60">
                    {rest.join("\n")}
                  </p>
                )}
              </section>
            );
          }

          return (
            <p key={index} className="mb-5 whitespace-pre-line text-[13px] leading-relaxed text-slate-600 dark:text-white/60">
              {block}
            </p>
          );
        })}
      </main>
    </div>
  );
}

export function TermsPage() {
  return <LegalDocument title="서비스 이용약관" content={TERMS_CONTENT} />;
}

export function PrivacyPage() {
  return <LegalDocument title="개인정보처리방침" content={PRIVACY_CONTENT} />;
}

export function AccountDeletionPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0F1117]">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-800 active:scale-95 dark:bg-white/10 dark:text-white"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF3355]">Chally</p>
          <h1 className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight">계정 삭제 안내</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-[#FF3355] dark:bg-[#FF3355]/15">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 className="text-[24px] font-black leading-tight text-slate-950 dark:text-white">
          챌리 계정과 관련 데이터 삭제를 요청할 수 있습니다.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-slate-600 dark:text-white/60">
          앱에 로그인할 수 있다면 프로필 화면의 계정 삭제 요청 메뉴에서 삭제를 시작할 수 있습니다. 앱을 사용할 수 없거나 이미 삭제한 경우에는 아래 이메일로 요청할 수 있습니다.
        </p>

        <section className="mt-7 space-y-3">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-black text-slate-900 dark:text-white">
              <ShieldCheck className="h-5 w-5 text-[#FF3355]" />
              삭제 대상
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-white/60">
              계정, 프로필, 인증 사진, 아바타, 활동 게시물, 알림, 그룹 참여 기록 등 계정과 연결된 개인정보 및 사용자 생성 데이터가 삭제 대상입니다. 법적 의무, 보안, 부정 이용 방지 목적으로 보관이 필요한 정보는 관련 법령과 개인정보처리방침에 따라 제한적으로 보관될 수 있습니다.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-black text-slate-900 dark:text-white">
              <Mail className="h-5 w-5 text-[#FF3355]" />
              요청 방법
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-white/60">
              이메일 제목에 "챌리 계정 삭제 요청"을 적고, 가입 이메일 주소를 포함해 privacy@chally.app 으로 보내주세요. 본인 확인 후 처리 상태를 안내합니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
