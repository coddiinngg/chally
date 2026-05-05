# Chally

챌린지로 모임, 챌린지가 모임! — 사진 인증 기반 습관 챌린지 앱.

## 기술 스택

- **Frontend**: Vite 6 + React 19 + TypeScript 5.8
- **Styling**: Tailwind CSS v4 + clsx + tailwind-merge (`cn()`)
- **Routing**: React Router DOM v7
- **Animation**: Framer Motion (motion)
- **Icons**: Lucide React
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **AI 인증**: Gemini 2.0 Flash Lite (via Supabase Edge Function)

## 개발 명령어

```bash
npm run dev       # 포트 3000, 0.0.0.0 바인딩
npm run build     # 프로덕션 빌드
npm run lint      # tsc --noEmit
npm run clean     # dist 삭제
```

## 라우팅 구조

### 공개 (누구나)
| 경로 | 페이지 |
|------|--------|
| `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/forgot-password` | 비밀번호 재설정 |

### 게스트 포함 — 바텀 네비 있음 (5탭)
| 경로 | 페이지 |
|------|--------|
| `/` | 홈 (슬라이드 카드: 그룹현황/순위/채팅) |
| `/challenge` | 챌린지 (그룹 목록, 참여하기) |
| `/stats` | 통계 |
| `/profile` | 프로필 |

### 로그인 전용 — 바텀 네비 없음
| 경로 | 페이지 |
|------|--------|
| `/onboarding` | 온보딩 (1회 처리) |
| `/verify/select` | 인증 방법 선택 |
| `/verify/guide/:type` | 인증 가이드 |
| `/verify/camera` | 카메라 인증 |
| `/verify/upload` | 사진 업로드 + AI 인증 |
| `/success` | 인증 완료 |
| `/challenge/group/:groupId` | 그룹 상세 |
| `/challenge/group/:groupId/activity` | 활동 사진 |
| `/challenge/request` | 챌린지 건의 |
| `/gallery` | 갤러리 |
| `/rewards` | 리워드 |
| `/notifications` | 알림 |
| `/settings/notifications` | 알림 설정 |
| `/profile/edit` | 프로필 편집 |
| `/stats/weekly-report` | 주간 리포트 |
| `/friends/invite` | 친구 초대 |
| `/user/:seed` | 유저 프로필 |
| `/feed` | 전체 피드 |

## 주요 파일

```
src/
├── App.tsx                    # 라우터 설정, ProtectedRoute, AuthOnlyRoute
├── main.tsx                   # 앱 진입점
├── onboarding-main.tsx        # 온보딩 별도 HTML 진입점
├── index.css                  # 전역 스타일 (Tailwind v4)
├── components/
│   ├── Layout.tsx             # 레이아웃 래퍼 (showNav prop)
│   ├── BottomNav.tsx          # 5탭 바텀 네비게이션
├── contexts/
│   ├── AppContext.tsx         # 전역 상태 (verificationHistory, groups, notifications 등)
│   ├── AuthContext.tsx        # Supabase 인증 상태 + profile
│   └── GuestGuardContext.tsx  # 게스트 모드 접근 제어
├── lib/
│   ├── supabase.ts            # Supabase 클라이언트 초기화
│   ├── utils.ts               # cn() 유틸리티
│   ├── verifyAI.ts            # Edge Function 호출 (AI 인증)
│   └── verifyTypes.ts         # 인증 타입 정의 (VerifyTypeKey)
├── types/
│   └── database.ts            # Supabase DB 타입 매핑
└── pages/                     # 페이지 컴포넌트 (라우팅 구조와 1:1)
supabase/
├── schema.sql                 # DB 전체 스키마 (테이블, RLS, 트리거)
└── functions/
    └── verify-photo/
        └── index.ts           # AI 인증 Edge Function (Deno)
```

## 상태 관리

### AppContext (`src/contexts/AppContext.tsx`)
앱 전반의 비인증 상태를 관리합니다.

- **verificationHistory**: Supabase `verifications` 테이블 실연동
- **groups**: Supabase `groups` + `group_members` 실연동
  - 앱 화면의 기존 그룹 ID `"1"~"6"`은 `groups.legacy_id`로 유지
  - 실제 DB membership 저장은 `group_members.group_id` UUID 기준
  - 로그인/재로그인 시 `group_members`에서 참여 상태를 다시 로드
- **notifications**: Supabase `notifications` 테이블 실연동
- **verification 흐름**: `beginVerification` → `setVerificationImage` → `completeCurrentVerification`
- **theme**: `localStorage`에 저장

## Supabase

- **Project ref**: `xufcmyavctkugjkauqxc`
- **환경변수**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env` 파일)

### DB 테이블
| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (auth.users 확장), streak, XP, recovery_tickets |
| `verifications` | 인증 기록 (group_id, verify_type, photo_url, xp_earned, status) |
| `groups` | 챌린지 그룹 |
| `group_members` | 그룹 멤버 (admin/member role) |
| `activity_posts` | 인증 성공으로 생성되는 그룹 활동글 |
| `activity_reactions` | 활동글 유저별 이모지 리액션 |
| `group_messages` | 그룹 채팅 메시지 |
| `group_message_reactions` | 그룹 채팅 메시지 유저별 이모지 리액션 |
| `notifications` | 알림 (type: badge/group/rank/streak) |
| `notification_settings` | 알림 설정 |
| `challenge_suggestions` | 챌린지 건의 |
| `challenge_suggestion_votes` | 챌린지 건의 응원 |
| `challenge_suggestion_comments` | 챌린지 건의 댓글 |
| `challenge_suggestion_subscriptions` | 챌린지 건의 알림받기 |
| `referrals` | 추천 가입 보상 기록 |
| `friend_invites` | 친구 초대 대상 기록 |
| `invite_events` | 초대 링크/코드 공유 이벤트 |
| `verify_attempts` | AI 인증 시도 횟수 추적 (rate limit용) |

### RLS 정책 요약
- 모든 테이블 RLS 활성화
- 기본 원칙: 자신의 데이터만 CRUD
- `groups`: 공개 그룹은 전체 조회 가능
- `group_members`: 현재 앱에서는 자신의 가입 기록만 조회 가능
- `activity_posts`: 공개 조회, 본인이 가입한 그룹에는 본인 활동글 insert 가능
- `activity_reactions`: 공개 조회, 본인 리액션만 insert/update/delete
- `group_messages`: 같은 그룹 멤버만 조회/작성
- `group_message_reactions`: 같은 그룹 멤버만 조회, 본인 리액션만 변경
- `challenge_suggestions`: 공개 조회, 로그인 유저 작성/응원/댓글/구독
- `notifications`: INSERT는 service role만 (Edge Function)

### 트리거
- `on_auth_user_created`: 회원가입 시 `profiles` 자동 생성
- `profiles_updated_at`: `updated_at` 자동 갱신
- `adjust_group_member_count`: 그룹 가입/탈퇴 시 `groups.member_count` 증감
- `refresh_challenge_suggestion_counts`: 건의 응원/댓글 카운트 갱신

### RPC
- `get_group_leaderboard(group_id, limit)`: 그룹 멤버와 그룹별 인증 기록 기준 리더보드 반환
- `get_public_profile(user_id)`: 공개 프로필 페이지용 제한된 프로필 조회
- `search_public_profiles(query, limit)`: 친구 초대 검색용 공개 프로필 검색

### Storage 버킷
- `verifications` (공개): 인증 사진 저장 (`{userId}/{timestamp}.jpg`)
- `avatars` (공개): 프로필 사진

## AI 인증 Edge Function (`verify-photo`)

### 배포
```bash
supabase functions deploy verify-photo
supabase secrets set GEMINI_API_KEY=<key>
```

### 인증 흐름
1. 클라이언트가 base64 이미지 + `verifyType` + `groupId` 전송
2. Rate limit 확인 (사용자 일 20회)
3. 그룹 인증이면 DB의 그룹 인증 타입/진행 기간과 `group_members` 멤버십 확인
4. Gemini 2.0 Flash Lite로 AI 판정
5. 통과 시: Storage 업로드 → `verifications` INSERT → `activity_posts` INSERT → XP +10
6. `verifications` INSERT 실패 시 업로드된 인증 사진은 Storage에서 정리

### 인증 타입 (VerifyTypeKey)
| key | 라벨 |
|-----|------|
| `step_walk` | 걷기 인증 (만보기 스크린샷) |
| `run_scenery` | 러닝 풍경 |
| `quote_photo` | 인상 문장 필사 |
| `book_cover` | 책 표지 |
| `celeb_pose` | 포즈 인증 |
| `location_photo` | 장소 인증 |

## 게스트 모드

`sessionStorage.setItem("guestMode", "1")`으로 활성화.
게스트는 바텀 네비 4개 탭(홈, 챌린지, 통계, 프로필) 접근 가능.
인증이 필요한 기능(인증 업로드 등)은 `GuestGuardContext`가 차단 후 `/login`으로 유도.

## 알려진 미완성 영역

상세 내용은 **[TODO.md](./TODO.md)** 참조.

요약:
- **그룹 상세 활동 피드**: `activity_posts` 기반 표시, 데이터 없을 때 빈 상태 표시
- **홈 피드**: `activity_posts` 기반 표시, 데이터 없을 때 빈 상태 표시
- **홈/그룹 상세 랭킹**: `get_group_leaderboard` 기반 표시, 데이터 없을 때 빈 상태 표시
- **홈 채팅**: `group_messages` 기반 표시, 데이터 없을 때 빈 상태 표시
- **그룹 채팅**: 메시지 저장/조회/INSERT 실시간 반영 연결 완료
- **채팅 UX**: 정적 온라인 수 제거, 그룹 참여 수 표시
- **소셜 로그인**: 버튼 배치만 유지, provider 실제 연결 미완
- **친구 추천 기본값**: fallback 추천 제거, `search_public_profiles` 검색 결과만 표시

## 최근 적용된 주요 마이그레이션

| 마이그레이션 | 내용 |
|-------------|------|
| `20260503000000_notification_settings.sql` | 알림 설정 테이블 |
| `20260503001000_avatar_storage.sql` | 프로필 이미지 Storage |
| `20260503002000_challenge_suggestions.sql` | 챌린지 건의/응원/댓글/구독 |
| `20260503003000_referrals.sql` | 추천코드/추천 보상 |
| `20260503003100_invite_events.sql` | 친구 초대 이벤트 |
| `20260503004000_group_members_app_mapping.sql` | 그룹 DB 매핑 및 멤버십 연결 |
| `20260503004100_fix_group_members_select_policy.sql` | 그룹 멤버십 조회 RLS 수정 |
| `20260504000000_activity_posts_reactions.sql` | 활동글/리액션 및 그룹별 인증 저장 |
| `20260504001000_challenge_lifecycle.sql` | 그룹 모집/진행 기간 컬럼 |
| `20260504002000_group_leaderboard_rpc.sql` | 그룹 리더보드 RPC |
| `20260505000000_verifications_storage.sql` | 인증 사진 Storage 정책 |
| `20260505001000_group_messages.sql` | 그룹 채팅/채팅 리액션 |
| `20260505002000_public_profile_rpc.sql` | 공개 프로필 조회/검색 RPC |
| `20260505003000_group_messages_realtime.sql` | 그룹 채팅 Realtime publication |
| `20260505004000_group_scoped_verification_uniqueness.sql` | 그룹별 일일 인증 중복 제한 |
