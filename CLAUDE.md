# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Chally

챌린지로 모임, 챌린지가 모임! 사진 인증 기반 습관 챌린지 앱.

이 섹션은 2026-05-16 기준으로 `package.json`, `vite.config.ts`, `src/App.tsx`, `src/contexts/*`, `src/lib/*`, `src/types/database.ts`, `supabase/migrations/*`, `supabase/functions/verify-photo/index.ts`를 대조해 갱신했다. `supabase/schema.sql`은 기본/부트스트랩 성격이 강하고 최신 마이그레이션이 모두 합쳐진 단일 진실이 아니므로, DB 변경 판단은 `supabase/migrations/`와 `src/types/database.ts`를 우선 확인한다.

## 기술 스택

- **Frontend**: Vite 6, React 19, TypeScript 5.8
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), `clsx`, `tailwind-merge`, `cn()`
- **Routing**: React Router DOM v7
- **Icons**: Lucide React
- **Backend**: Supabase Auth, PostgreSQL, Storage, Edge Functions, Realtime
- **AI 인증**: Gemini 2.5 Flash Lite via Supabase Edge Function
- **Animation**: 현재는 CSS keyframes 중심. `motion` 패키지는 설치되어 있으나 현재 `src` 내 import는 없다.
- **Path alias**: `@/*`는 repo root (`./*`)를 가리킨다. `src` 전용 alias가 아니다.

## 개발 명령어

```bash
npm run dev       # vite --port=3000 --host=0.0.0.0
npm run build     # 프로덕션 빌드
npm run preview   # Vite preview
npm run lint      # tsc --noEmit
npm run clean     # dist 삭제
supabase functions deploy verify-photo
supabase secrets set GEMINI_API_KEY=<key>
```

환경변수는 `.env.example` 기준으로 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`를 사용한다. 클라이언트는 `vite.config.ts`의 `define`으로 `process.env.SUPABASE_URL` / `process.env.SUPABASE_ANON_KEY`를 주입한다. `GEMINI_API_KEY`는 클라이언트 번들에 넣지 않고 Edge Function secret으로만 사용한다.

## 라우팅 구조

### 공개

| 경로 | 페이지 |
|------|--------|
| `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/forgot-password` | 비밀번호 재설정 |

### 게스트 포함, 바텀 네비 있음

`ProtectedRoute`는 로그인 유저, `sessionStorage.guestMode`, `?preview=1` 중 하나면 통과한다.

| 경로 | 페이지 |
|------|--------|
| `/` | 홈: 그룹 현황, 순위, 채팅, 활동 피드 |
| `/challenge` | 챌린지 목록, 참여/탈퇴 |
| `/stats` | 통계 |
| `/profile` | 프로필 |

### 로그인 전용, 바텀 네비 없음

`AuthOnlyRoute`는 로그인 유저 또는 `?preview=1`이면 통과한다. 단, 액션은 `GuestGuardContext.guardAction`으로 별도 차단되는 곳이 있다.

| 경로 | 페이지 |
|------|--------|
| `/onboarding` | 온보딩 |
| `/verify/select` | 인증 타입 선택 |
| `/verify/guide/:type` | 인증 가이드 |
| `/verify/camera` | 카메라 인증 |
| `/verify/upload` | 사진 업로드 + AI 인증 |
| `/success` | 인증 완료 + 공유 카드 |
| `/challenge/group/:groupId` | 그룹 상세: 활동, 리더보드, 갤러리 |
| `/challenge/group/:groupId/activity` | 활동 사진 상세 |
| `/challenge/group/:groupId/result` | 챌린지 결과 + 참가권 수령 |
| `/challenge/request` | 챌린지 건의 |
| `/gallery` | 내 인증 갤러리 |
| `/rewards` | 리워드/뱃지 |
| `/notifications` | 알림 목록 |
| `/settings/notifications` | 알림 설정 |
| `/profile/edit` | 프로필 편집 |
| `/stats/challenge-history` | 챌린지 이력 |
| `/friends/invite` | 친구 초대 |
| `/user/:seed` | 공개 유저 프로필 |
| `/feed` | 전체 활동 피드 |

## 주요 파일

```
src/
├── App.tsx                    # 라우터, guest/preview 모드, route guard
├── main.tsx                   # AuthProvider > AppProvider > App
├── index.css                  # Tailwind v4, dark variant, app-shell, 전역 애니메이션
├── components/
│   ├── Layout.tsx             # max-w-md 모바일 앱 셸, 탭 스와이프
│   └── BottomNav.tsx          # 홈/챌린지/통계/프로필
├── contexts/
│   ├── AuthContext.tsx        # Supabase auth/session/profile
│   ├── AppContext.tsx         # groups, verifications, notifications, tickets, theme
│   └── GuestGuardContext.tsx  # 게스트 액션 차단 모달
├── lib/
│   ├── supabase.ts            # Supabase client
│   ├── verifyAI.ts            # 이미지 압축, Edge Function 호출, 30초 timeout
│   ├── verifyTypes.ts         # 6가지 VerifyTypeKey 정의
│   ├── challengeUtils.ts      # phase, join 가능 여부, benefit grade/tickets
│   ├── activity.ts            # activity_posts + activity_reactions 로드/캐시
│   ├── chat.ts                # group_messages + reactions 로드
│   ├── leaderboard.ts         # get_group_leaderboard RPC wrapper
│   ├── grades.ts              # XP 등급 LV1~LV15
│   ├── share.ts               # Web Share API + fallback
│   └── useScrollRestoration.ts # sessionStorage 기반 스크롤/필터 복원
├── types/
│   └── database.ts            # Supabase 타입. DB 변경 후 재생성 필요
└── pages/
    ├── Home.tsx               # 홈 카드, 채팅, 피드, Realtime
    ├── Challenge.tsx          # 그룹 목록, 참여/탈퇴, 필터
    ├── challenge/
    │   ├── GroupDetail.tsx
    │   ├── group-detail/GroupDetailUI.tsx
    │   ├── ActivityPhoto.tsx
    │   └── ChallengeResult.tsx
    └── verify/
        ├── Select.tsx / Guide.tsx / Camera.tsx / Upload.tsx
        └── ShareCard.tsx
supabase/
├── schema.sql                 # 최신 단일 진실 아님. migrations 우선 확인
├── migrations/                # DB 변경 이력의 source of truth
└── functions/verify-photo/
    └── index.ts               # AI 인증 Edge Function (Deno)
```

## 상태 관리

### AuthContext

- `user`, `session`, `profile`, `loading`
- `signInWithEmail`, `signUpWithEmail`, `resetPasswordWithEmail`, `signOut`, `refreshProfile`
- 로그인/로그아웃 시 `setGuestMode(false)` 처리
- 가입 시 `raw_user_meta_data.username`과 선택적 `ref`를 Supabase Auth에 전달

### AppContext

- `verificationHistory`: `verifications`를 로그인 유저 기준으로 로드
- `groups`: `groups` + `group_members`를 합쳐 앱용 `Group`으로 매핑
- 앱 표시 ID `"1"`~`"6"`은 `groups.legacy_id`; 실제 DB 관계는 UUID `groups.id`
- `participationTickets`: `profiles.participation_tickets`
- `notifications`: `notifications` 최근 50개 + `postgres_changes` INSERT 구독
- `confirmedEndedIds`: `localStorage["chally-confirmed-ended"]`
- `theme`: `localStorage["chally-theme"]`, `light | dark | system`

### GuestGuardContext

`guardAction(fn)`은 `sessionStorage.guestMode === "1"`이면 로그인 필요 모달을 띄우고 `fn`을 실행하지 않는다. `?preview=1`은 `PreviewModeInit`에서 guestMode를 켠다.

## 핵심 도메인 규칙

### 챌린지 단계

`src/lib/challengeUtils.ts` 기준:

```
recruit : recruitEnd가 있고 now < recruitEnd
active  : challengeStart~challengeEnd의 앞 50%
closing : challengeStart~challengeEnd의 뒤 50%
ended   : now > challengeEnd
```

- `challengeStart` 또는 `challengeEnd`가 없으면 `active`로 처리한다.
- `canJoin`: `ended` 불가, `closing`은 crewRate 40~69일 때만 가능, `recruit/active`는 가능.
- `shouldHide`: `closing`에서 crewRate가 70 이상 또는 39 이하이면 목록에서 숨김.
- `isLateJoiner`: 챌린지 기간 50% 시점 이후 합류면 true. 결과 페이지에서 참가권 지급량을 0으로 만든다.

### 그룹 멤버 상태

| 상태 | 의미 | 현재 프론트 처리 |
|------|------|------------------|
| `ACTIVE` | 정상 참여 | 인증/탈퇴 가능 |
| `EXIT_ELIGIBLE` | 48시간 미인증 경고 | 인증 성공 시 Edge Function이 `ACTIVE`로 복구 |
| `LEFT` | 자발적 탈퇴 | `joinGroup`이 재참여를 차단 |
| `REMOVED` | 자동 강제 퇴장 | `joinGroup` 차단, `get_crew_status` 감지 시 목록으로 이동 |

`leaveGroup`은 현재 RPC가 아니라 `group_members.member_status = 'LEFT'` 직접 UPDATE를 사용한다. `member_voluntary_exit` RPC는 존재하지만 현재 프론트에서 호출하지 않는다.

자동 퇴장 흐름은 `update_member_statuses()`가 담당한다:

```
ACTIVE -> 48h 미인증 -> EXIT_ELIGIBLE -> 24h 경과 -> REMOVED
```

### 참가권

- `profiles.participation_tickets` 기본값은 5.
- `joinGroup` 성공 흐름에서 참가권 1장을 차감한다. 0장이면 UI와 컨텍스트에서 참여를 차단한다.
- `ChallengeResult`에서 `group_members.benefit_claimed_at`으로 멱등성을 보장하며 참가권을 지급한다.
- 지급량은 `ticketsForGrade`: A=3, B=2, C=1, D=0.
- `isLateJoiner=true`면 등급과 무관하게 0장.

### 크루 달성률

- `calculate_crew_rate(p_group_id)`는 챌린지 기간 내 완료 인증을 KST 일자 기준으로 집계한다.
- 최신 마이그레이션은 `REMOVED`/`LEFT`를 분모에서 제외하고, 기존 기여자의 인증은 분자에 유지한다.
- `trg_crew_rate_on_verification`이 `verifications` INSERT/UPDATE 후 `update_crew_cache`를 호출한다.
- 주의: 최신 `update_crew_cache`는 `crew_rate`만 갱신한다. `crew_grade` 컬럼은 존재하지만 최신 함수에서 자동 갱신되지 않으므로 정확한 등급이 필요하면 `crew_rate`로 직접 계산하거나 함수 수정 여부를 먼저 확인한다.

## AI 인증 Edge Function

클라이언트 `verifyAI.ts`는 이미지 파일을 최대 1024px, JPEG 0.85로 압축하고 base64를 `verify-photo` Edge Function에 전송한다. 요청 timeout은 30초다.

`supabase/functions/verify-photo/index.ts` 흐름:

1. Authorization 헤더로 Supabase 사용자 인증
2. 요청 본문 8MB 제한
3. `verifyType` 유효성 확인
4. `groupId`가 있으면 그룹의 `verify_type`, 기간, 멤버십 확인
5. 서버 일일 rate limit 확인: KST 기준 사용자당 20회 (`verify_attempts`)
6. Gemini 2.5 Flash Lite 호출. 429는 3초 후 1회 재시도
7. JSON 응답 파싱 후 서버사이드 이중 검증
8. 통과 시 Storage 업로드 최대 2회
9. `verifications` INSERT. KST 일일 중복이면 409 반환
10. 그룹 인증이면 `activity_posts` INSERT, `group_members.last_verified_at/member_status/exit_deadline` 갱신, `update_crew_cache` 호출
11. `increment_user_xp` RPC로 XP +10

그룹 인증 서버 체크는 현재 `REMOVED`만 명시적으로 거부한다. `LEFT` 차단은 프론트 `joinGroup`/화면 흐름에 의존하므로, 서버 보안을 강화하는 작업이라면 이 부분을 먼저 확인한다.

### VerifyTypeKey

| key | 라벨 | 서버 이중 검증 |
|-----|------|----------------|
| `step_walk` | 걷기 인증 | `stepsRead >= 5000` |
| `run_scenery` | 러닝 풍경 | `runEvidenceRead` 길이 >= 5 |
| `quote_photo` | 인상 문장 | `textRead` 길이 >= 5 |
| `book_cover` | 책 표지 | `titleRead`와 `authorRead` 존재 |
| `celeb_pose` | 포즈 인증 | AI 체크리스트 결과 사용 |
| `location_photo` | 장소 인증 | `landmarkRead` 길이 >= 2 |

## Supabase DB

### 주요 테이블

- `profiles`: auth user 확장. `username`, `avatar_url`, `plan_type`, `streak_count`, `participation_tickets`, `xp_total`, `invite_code`, `referred_by`
- `groups`: `legacy_id`, `name`, `emoji`, `description`, `category`, `member_count`, `rule`, `goal`, `verify_type`, `cover`, `max_members`, `is_public`, `recruit_start/end`, `challenge_start/end`, `crew_rate`, `crew_grade`, `current_round`
- `group_members`: `group_id`, `user_id`, `role`, `joined_at`, `last_verified_at`, `is_contributor`, `member_status`, `exit_deadline`, `removed_at`, `join_day`, `benefit_claimed_at`, `round_number`
- `verifications`: `user_id`, nullable `group_id`, `verify_type`, `verified_at`, `photo_url`, `status`, `xp_earned`, `round_number` (group_id가 NULL이면 round_number도 NULL)
- `activity_posts`: 그룹 인증 피드. `verification_id`는 unique. `round_number`
- `activity_reactions`: activity post당 유저 1개 리액션
- `group_messages`: 홈 채팅 메시지. body 1~500자. `round_number`
- `group_message_reactions`: 메시지당 유저 1개 리액션
- `notifications`: 확장 타입 포함. INSERT는 service role/트리거 경로
- `notification_settings`: 일일/챌린지/주간/성과 알림 설정
- `challenge_suggestions`, `challenge_suggestion_votes`, `challenge_suggestion_comments`, `challenge_suggestion_subscriptions`
- `referrals`, `friend_invites`, `invite_events`
- `verify_attempts`: AI 인증 rate limit 추적

20260514100000 마이그레이션 이후 `profiles.joined_group_ids`와 `groups.rate/status/status_color/my_*` 레거시 컬럼은 제거됐다. 새 코드에서 사용하지 않는다.

### RLS 요약

- `profiles`: 본인 SELECT만. INSERT는 `handle_new_user` 트리거, UPDATE는 `update_profile_basic` RPC 경유. 공개 프로필은 `get_public_profile` RPC로 조회
- `groups`: 공개 그룹 SELECT만. INSERT/UPDATE/DELETE 정책 없음 — 어드민/마이그레이션만 변경
- `group_members`: 본인 행 SELECT만. INSERT/UPDATE/DELETE는 `join_group_with_ticket`/`leave_group`/`claim_participation_benefit` RPC 또는 Edge Function(service_role) 경유
- `verifications`: 본인 SELECT만. INSERT는 `verify-photo` Edge Function(service_role) 경유, UPDATE/DELETE 정책 없음
- `account_deletion_requests`: 본인 SELECT만. INSERT는 `request_account_deletion` RPC 경유
- `activity_posts`, `activity_reactions`: 활동 조회는 공개, 변경은 본인/멤버 기준
- `group_messages`, `group_message_reactions`: 같은 그룹 멤버만 메시지 조회/작성, 리액션 변경은 본인만
- `notifications`: 본인 SELECT/UPDATE. INSERT policy 없음, service role만 가능
- `challenge_suggestions` 계열: 제안/투표/댓글 조회는 공개, 작성/삭제는 로그인 유저 본인 기준
- `referrals`, `friend_invites`, `invite_events`, `verify_attempts`: 본인 또는 관련 사용자 기준

### RPC / 함수

클라이언트 호출:

| 함수 | 설명 |
|------|------|
| `get_group_leaderboard(p_group_id, p_limit)` | ACTIVE/EXIT_ELIGIBLE 멤버 리더보드. 챌린지 기간 내 인증만 집계 |
| `get_public_profile(p_user_id)` | 공개 프로필, 인증 통계, 참여중/지난 그룹 |
| `search_public_profiles(p_query, p_limit)` | 닉네임 검색 |
| `get_crew_status(p_group_id)` | crew status와 내 멤버 상태 |
| `calculate_crew_rate(p_group_id)` | 크루 달성률 계산 |
| `reopen_group(p_group_id, p_challenge_start, p_challenge_end, p_recruit_start?, p_recruit_end?)` | 같은 그룹 row의 `current_round`를 +1, 기간/달성률 리셋, `challenge_reopen_subscriptions` 구독자에게 알림 발송. service role 전용 (PUBLIC EXECUTE 회수됨) |

service role/cron 성격:

- `update_member_statuses(p_group_id default null)`
- `notify_challenge_lifecycle()`
- `notify_daily_reminders()`
- `update_crew_cache(p_group_id)`
- `increment_user_xp(p_user_id, p_amount default 10)`

내부 트리거/헬퍼:

`adjust_group_member_count`, `default_invite_code`, `handle_new_user`, `refresh_challenge_suggestion_counts`, `set_member_contributor`, `grade_from_rate`, `trg_fn_crew_rate_on_verification`, `trg_fn_reset_on_challenge_restart`, `trg_fn_stamp_round_number`, `notify_group_on_verification`, `notify_group_on_streak`, `notify_group_on_chat`, `notify_reopen_subscribers`, `update_updated_at`.

`trg_fn_stamp_round_number`은 `group_messages`/`activity_posts`/`verifications`/`group_members` BEFORE INSERT에 붙어 있으며 `groups.current_round` 값을 자동으로 박는다. 라운드 모델 도입 이후 라운드별 데이터는 "삭제하지 않고 round_number로 태깅 → UI 필터로 비노출" 원칙을 따른다 (자산 보존).

### Realtime

- `AppContext`: `notifications` INSERT 구독
- `Home.tsx`: 선택 그룹의 `group_messages` INSERT 구독, unread용 그룹 메시지 INSERT 구독
- `group_message_reactions`는 publication에 추가되어 있지만 현재 UI는 타인 리액션 변경을 실시간 반영하지 않는다.
- `activity_reactions`도 현재는 낙관적 업데이트/캐시 중심이며 타인 리액션 실시간 구독은 없다.

### Storage

- `verifications` public bucket: 인증 사진. 경로는 `{userId}/{timestamp-random}.jpg`
- `avatars` public bucket: 프로필 이미지
- Edge Function은 service role로 Storage를 사용한다. 클라이언트 직접 업로드 policy도 유저 폴더 기준으로 존재한다.

## 마이그레이션 목록

| 버전 | 파일명 | 핵심 내용 |
|------|--------|-----------|
| `20260501145701` | `remote_schema` | 초기 스키마 |
| `20260503000000` | `notification_settings` | 알림 설정 |
| `20260503001000` | `avatar_storage` | 아바타 Storage |
| `20260503002000` | `challenge_suggestions` | 챌린지 건의/투표/댓글/구독 |
| `20260503003000` | `referrals` | 추천코드, 양방향 XP |
| `20260503003100` | `invite_events` | 초대 이벤트 |
| `20260503004000` | `group_members_app_mapping` | `legacy_id`, 그룹 매핑 |
| `20260503004100` | `fix_group_members_select_policy` | group_members SELECT RLS 수정 |
| `20260504000000` | `activity_posts_reactions` | 활동글/리액션 |
| `20260504001000` | `challenge_lifecycle` | 모집/챌린지 기간 |
| `20260504002000` | `group_leaderboard_rpc` | 리더보드 RPC |
| `20260505000000` | `verifications_storage` | 인증 사진 Storage |
| `20260505001000` | `group_messages` | 채팅/메시지 리액션 |
| `20260505002000` | `public_profile_rpc` | 공개 프로필/검색 |
| `20260505003000` | `group_messages_realtime` | 채팅 Realtime publication |
| `20260505004000` | `group_scoped_verification_uniqueness` | KST 일일 인증 중복 방지 |
| `20260507000000` | `extend_public_profile_rpc` | 공개 프로필 확장 |
| `20260507001000` | `fix_group_member_count` | 멤버 수 보정 |
| `20260507002000` | `crew_rate_system` | 달성률, 멤버 상태, crew RPC |
| `20260507103350` | `group_challenge_notifications` | 인증/스트릭/채팅 알림 |
| `20260508001000` | `member_status_notifications` | 퇴장 경고/퇴장 알림 |
| `20260509000000` | `fix_exit_timing_72h` | 퇴장 타이밍 수정 |
| `20260511000000` | `crew_rate_exclude_removed` | REMOVED 분모 제외 |
| `20260512000000` | `group_members_left_status` | LEFT 상태 추가 |
| `20260512001000` | `kick_timer_48h_plus_6h` | 48h 경고 + 6h 유예 |
| `20260512002000` | `fix_notifications_left_and_chat` | LEFT 알림 제외, 채팅 알림 수정 |
| `20260512003000` | `challenge_and_daily_notifications` | 챌린지 생애주기/일일 알림 |
| `20260512004000` | `group_members_update_policy` | group_members UPDATE RLS |
| `20260512005000` | `fix_crew_rate_isolation_and_auto_update` | crew_rate 기간 격리/자동 갱신 |
| `20260514000000` | `fix_leaderboard_rate_formula` | 리더보드 rate 공식 수정 |
| `20260514100000` | `drop_legacy_columns_and_fix_member_count` | 레거시 컬럼 제거, member_count 보정 |
| `20260514110000` | `filter_leaderboard_and_profile` | 리더보드/공개 프로필 필터 강화 |
| `20260516000000` | `participation_tickets` | 복구권 -> 참가권, benefit_claimed_at |
| `20260518000000` | `kick_timer_extend_to_72h` | 강퇴 유예 6h -> 24h (총 72h) |
| `20260518100000` | `release_rpcs_and_deletion_requests` | 5개 출시 RPC + `account_deletion_requests` 테이블 |
| `20260518110000` | `drop_direct_write_policies` | profiles/verifications/groups/group_members 직접 write 정책 11개 제거. 모든 client write는 RPC 경유 |
| `20260518120000` | `account_deletion_audit_preserve` | `account_deletion_requests.user_id` FK를 ON DELETE SET NULL으로 변경. 유저 삭제 후에도 감사 로그 row 보존 |
| `20260519000000` | `reset_group_messages_on_challenge_restart` | 챌린지 재시작 트리거에서 이전 회차 채팅 DELETE (이후 Phase 1에서 라운드 모델로 대체되며 DELETE 동작 제거됨) |
| `20260519010000` | `round_number_phase1` | 라운드 모델 도입: `groups.current_round`, `group_messages`/`activity_posts`/`verifications`/`group_members.round_number`, 자동 stamp 트리거, 재시작 트리거에서 DELETE 제거, `reopen_group` RPC |
| `20260519020000` | `round_filter_rpcs` | `calculate_crew_rate`/`get_group_leaderboard`/`get_crew_status`에 `round_number = current_round` 필터 추가 |
| `20260519030000` | `group_members_round_key` | group_members 유니크 키 `(group_id, user_id)` → `(group_id, user_id, round_number)`. `join_group_with_ticket`/`leave_group`/`claim_participation_benefit`/`update_member_statuses`가 현재 라운드 row 기준으로 동작. LEFT/REMOVED는 그 라운드 내에서만 영구 |

## 작업 시 주의사항

- `DEV_FLOW.md`와 `USER_FLOW.md`에는 오래된 내용이 남아 있다. 작업 판단은 코드, 마이그레이션, 이 `CLAUDE.md`를 우선한다.
- `src/types/database.ts`는 자동생성 대상이다. 현재 `notifications.type` union은 최신 마이그레이션의 확장 타입보다 좁고, 앱은 `AppContext.NotifType`으로 보완하고 있다. DB 타입 관련 작업 전 재생성 여부를 확인한다.
- `GroupDetailUI.tsx`는 큰 파일이다. 주변 정리보다 요청 범위 안에서 작은 변경을 우선한다.
- 이메일/비밀번호 인증은 구현되어 있지만 OAuth provider 로그인은 구현되어 있지 않다.
- 채팅 메시지 전송 실패는 낙관적 메시지를 제거하고 콘솔에 기록하는 수준이다. 재전송 UI는 없다.
- `schema.sql`만 보고 최신 DB 상태를 판단하지 않는다.
