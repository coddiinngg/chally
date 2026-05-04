import { BrowserRouter, Routes, Route, Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { GuestGuardProvider } from "./contexts/GuestGuardContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
import { Camera } from "./pages/verify/Camera";
import { Upload } from "./pages/verify/Upload";
import { VerifySelect } from "./pages/verify/Select";
import { VerifyGuide } from "./pages/verify/Guide";
import { Success } from "./pages/Success";
import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";
import { EditProfile } from "./pages/EditProfile";
import { NotificationSettings } from "./pages/NotificationSettings";
import { Challenge } from "./pages/Challenge";
import { GroupDetail } from "./pages/challenge/GroupDetail";
import { ActivityPhoto } from "./pages/challenge/ActivityPhoto";
import { ChallengeResult } from "./pages/challenge/ChallengeResult";
import { Gallery } from "./pages/Gallery";
import { Rewards } from "./pages/Rewards";
import { Notifications } from "./pages/Notifications";
import { WeeklyReport } from "./pages/WeeklyReport";
import { FriendInvite } from "./pages/FriendInvite";
import { UserProfile } from "./pages/UserProfile";
import { FeedAll } from "./pages/FeedAll";
import { ChallengeRequest } from "./pages/ChallengeRequest";
import { UIGallery } from "./pages/UIGallery";

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

/** 비로그인 + 비게스트 → /login 리다이렉트 */
function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (user || isGuestMode() || isPreview()) ? <Outlet /> : <Navigate to="/login" replace />;
}

/** 로그인 유저만 통과. 게스트 → /login 리다이렉트 */
function AuthOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (user || isPreview()) ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <GuestGuardProvider>
        <Routes>
          {/* preview=1 파라미터 → guestMode 자동 활성화 */}
          <Route path="*" element={<PreviewModeInit />} />

          {/* UI 갤러리 — 인증 불필요 */}
          <Route path="/ui-gallery" element={<UIGallery />} />

          {/* 공개 라우트 — 누구나 */}
          <Route element={<Layout showNav={false} />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
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
              <Route path="/friends/invite" element={<FriendInvite />} />
              <Route path="/challenge/group/:groupId" element={<GroupDetail />} />
              <Route path="/challenge/group/:groupId/activity" element={<ActivityPhoto />} />
              <Route path="/challenge/group/:groupId/result" element={<ChallengeResult />} />
              <Route path="/user/:seed" element={<UserProfile />} />
              <Route path="/feed" element={<FeedAll />} />
              <Route path="/challenge/request" element={<ChallengeRequest />} />
            </Route>
          </Route>
        </Routes>
      </GuestGuardProvider>
    </BrowserRouter>
  );
}
