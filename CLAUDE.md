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
- **groups**: 현재 하드코딩 mock 데이터 (6개 그룹), DB 연동 미완
- **notifications**: Supabase `notifications` 테이블 실연동
- **verification 흐름**: `beginVerification` → `setVerificationImage` → `completeCurrentVerification`

## Supabase

- **Project ref**: `xufcmyavctkugjkauqxc`
- **환경변수**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env` 파일)

### DB 테이블
| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (auth.users 확장), streak, XP, recovery_tickets |
| `verifications` | 인증 기록 (photo_url, xp_earned, status) |
| `groups` | 챌린지 그룹 |
| `group_members` | 그룹 멤버 (admin/member role) |
| `notifications` | 알림 (type: badge/group/rank/streak) |
| `verify_attempts` | AI 인증 시도 횟수 추적 (rate limit용) |

### RLS 정책 요약
- 모든 테이블 RLS 활성화
- 기본 원칙: 자신의 데이터만 CRUD
- `groups`: 공개 그룹은 전체 조회 가능
- `notifications`: INSERT는 service role만 (Edge Function)

### 트리거
- `on_auth_user_created`: 회원가입 시 `profiles` 자동 생성
- `profiles_updated_at`: `updated_at` 자동 갱신

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
1. 클라이언트가 base64 이미지 + `verifyType` 전송
2. Rate limit 확인 (사용자 일 20회)
3. Gemini 2.0 Flash Lite로 AI 판정
4. 통과 시: Storage 업로드 → `verifications` INSERT → XP +10

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
- **그룹 전체**: DB 연동 없이 mock 데이터 — `AppContext.tsx` `DEFAULT_GROUPS`, `GroupDetail.tsx` `GROUPS_DETAIL`
- **채팅**: 로컬 state만, Supabase Realtime 미연동
- **피드**: Unsplash 하드코딩, 실제 `verifications.photo_url` 미사용
- **랭킹**: 달성률/streak 실계산 없음
- **알림 설정**: 토글 저장 안 됨 (`profiles` 컬럼 없음)
- **건의함**: mock 데이터, DB 미연동
- **친구 초대**: mock 데이터, invite_code 미구현
