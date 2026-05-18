import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { GuestGuardProvider } from "./contexts/GuestGuardContext";
import { Layout } from "./components/Layout";

const Login = lazy(() => import("./pages/Login").then(module => ({ default: module.Login })));
const SignUp = lazy(() => import("./pages/SignUp").then(module => ({ default: module.SignUp })));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword").then(module => ({ default: module.ForgotPassword })));
const Onboarding = lazy(() => import("./pages/Onboarding").then(module => ({ default: module.Onboarding })));
const Home = lazy(() => import("./pages/Home").then(module => ({ default: module.Home })));
const Camera = lazy(() => import("./pages/verify/Camera").then(module => ({ default: module.Camera })));
const Upload = lazy(() => import("./pages/verify/Upload").then(module => ({ default: module.Upload })));
const VerifySelect = lazy(() => import("./pages/verify/Select").then(module => ({ default: module.VerifySelect })));
const VerifyGuide = lazy(() => import("./pages/verify/Guide").then(module => ({ default: module.VerifyGuide })));
const Success = lazy(() => import("./pages/Success").then(module => ({ default: module.Success })));
const Stats = lazy(() => import("./pages/Stats").then(module => ({ default: module.Stats })));
const Profile = lazy(() => import("./pages/Profile").then(module => ({ default: module.Profile })));
const EditProfile = lazy(() => import("./pages/EditProfile").then(module => ({ default: module.EditProfile })));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings").then(module => ({ default: module.NotificationSettings })));
const Challenge = lazy(() => import("./pages/Challenge").then(module => ({ default: module.Challenge })));
const GroupDetail = lazy(() => import("./pages/challenge/GroupDetail").then(module => ({ default: module.GroupDetail })));
const ActivityPhoto = lazy(() => import("./pages/challenge/ActivityPhoto").then(module => ({ default: module.ActivityPhoto })));
const ChallengeResult = lazy(() => import("./pages/challenge/ChallengeResult").then(module => ({ default: module.ChallengeResult })));
const Gallery = lazy(() => import("./pages/Gallery").then(module => ({ default: module.Gallery })));
const Rewards = lazy(() => import("./pages/Rewards").then(module => ({ default: module.Rewards })));
const Notifications = lazy(() => import("./pages/Notifications").then(module => ({ default: module.Notifications })));
const WeeklyReport = lazy(() => import("./pages/WeeklyReport").then(module => ({ default: module.WeeklyReport })));
const FriendInvite = lazy(() => import("./pages/FriendInvite").then(module => ({ default: module.FriendInvite })));
const UserProfile = lazy(() => import("./pages/UserProfile").then(module => ({ default: module.UserProfile })));
const FeedAll = lazy(() => import("./pages/FeedAll").then(module => ({ default: module.FeedAll })));
const ChallengeRequest = lazy(() => import("./pages/ChallengeRequest").then(module => ({ default: module.ChallengeRequest })));
const ChallengeHistory = lazy(() => import("./pages/ChallengeHistory").then(module => ({ default: module.ChallengeHistory })));
const Join = lazy(() => import("./pages/Join").then(module => ({ default: module.Join })));
const NotFound = lazy(() => import("./pages/NotFound").then(module => ({ default: module.NotFound })));
const TermsPage = lazy(() => import("./pages/Legal").then(module => ({ default: module.TermsPage })));
const PrivacyPage = lazy(() => import("./pages/Legal").then(module => ({ default: module.PrivacyPage })));
const AccountDeletionPage = lazy(() => import("./pages/Legal").then(module => ({ default: module.AccountDeletionPage })));

export function setGuestMode(on: boolean) {
  if (on) sessionStorage.setItem("guestMode", "1");
  else     sessionStorage.removeItem("guestMode");
}

export function isGuestMode() {
  return sessionStorage.getItem("guestMode") === "1";
}

/** ?preview=1 파라미터가 있으면 guestMode 자동 활성화 */
function PreviewModeInit() {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("preview") === "1") setGuestMode(true);
  }, [searchParams]);
  return null;
}

function isPreview() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1";
}

function AuthLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="w-8 h-8 rounded-full border-[3px] border-[#FF3355]/20 border-t-[#FF3355] animate-spin" />
    </div>
  );
}

/** 비로그인 + 비게스트 → /login 리다이렉트 */
function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  return (user || isGuestMode() || isPreview()) ? <Outlet /> : <Navigate to="/login" replace />;
}

/** 로그인 유저만 통과. 게스트 → /login 리다이렉트 */
function AuthOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  return (user || isPreview()) ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* preview=1 파라미터 → guestMode 자동 활성화 (모든 경로에서 동작) */}
      <PreviewModeInit />
      <GuestGuardProvider>
        <Suspense fallback={<AuthLoader />}>
          <Routes>
            {/* 공개 라우트 — 누구나 */}
            <Route element={<Layout showNav={false} />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/join/:code" element={<Join />} />
              <Route path="/join" element={<Join />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/account-deletion" element={<AccountDeletionPage />} />
              <Route path="/delete-account" element={<AccountDeletionPage />} />
            </Route>

            {/* 게스트 포함 접근 가능 — 바텀 네비 있음 */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout showNav={true} />}>
                <Route path="/" element={<Home />} />
                <Route path="/challenge" element={<Challenge />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* 로그인 유저만 — 바텀 네비 없음 */}
            <Route element={<AuthOnlyRoute />}>
              <Route element={<Layout showNav={false} />}>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/verify/select" element={<VerifySelect />} />
                <Route path="/verify/guide/:type" element={<VerifyGuide />} />
                <Route path="/verify/camera" element={<Camera />} />
                <Route path="/verify/upload" element={<Upload />} />
                <Route path="/success" element={<Success />} />
                <Route path="/settings/notifications" element={<NotificationSettings />} />
                <Route path="/profile/edit" element={<EditProfile />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/stats/weekly-report" element={<WeeklyReport />} />
                <Route path="/stats/challenge-history" element={<ChallengeHistory />} />
                <Route path="/friends/invite" element={<FriendInvite />} />
                <Route path="/challenge/group/:groupId" element={<GroupDetail />} />
                <Route path="/challenge/group/:groupId/activity" element={<ActivityPhoto />} />
                <Route path="/challenge/group/:groupId/result" element={<ChallengeResult />} />
                <Route path="/user/:seed" element={<UserProfile />} />
                <Route path="/feed" element={<FeedAll />} />
                <Route path="/challenge/request" element={<ChallengeRequest />} />
              </Route>
            </Route>

            <Route element={<Layout showNav={false} />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </GuestGuardProvider>
    </BrowserRouter>
  );
}
