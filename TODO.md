# Chally TODO

실제 모바일 런칭을 목표로 한 작업 현황입니다.  
완료 여부는 코드와 Supabase 마이그레이션 기준으로 관리합니다.

## 상태 표기

- `[x]` 완료
- `[~]` 진행 중 / 부분 연결
- `[ ]` 미시작

## 현재 연결 상태

| 영역 | 상태 | 저장 위치 / 기준 |
|------|------|------------------|
| 로그인/회원가입 | [x] | Supabase Auth, `profiles` |
| 추천코드 회원가입 보상 | [x] | `profiles.invite_code`, `referrals`, `xp_total` |
| 그룹 목록 로드 | [x] | `groups` + `legacy_id` 매핑 |
| 그룹 참여/탈퇴 | [x] | `group_members` insert/delete |
| 그룹 참여 상태 유지 | [x] | 재로그인 시 `group_members` 조회 |
| 인증 사진 AI 판정 | [x] | Supabase Edge Function `verify-photo` |
| 인증 성공 기록 | [x] | `verifications`, Storage `verifications` |
| 인증의 그룹/타입 저장 | [x] | `verifications.group_id`, `verifications.verify_type` |
| 인증 성공 활동글 생성 | [x] | Edge Function → `activity_posts` |
| 갤러리/통계/리워드 인증 기반 표시 | [x] | `verificationHistory` / `verifications` |
| 프로필 이미지 업로드 | [x] | Storage `avatars`, `profiles.avatar_url` |
| 알림 목록 읽기/처리 | [x] | `notifications` |
| 알림 설정 저장 | [x] | `notification_settings` |
| 챌린지 건의/응원/댓글/알림받기 | [x] | `challenge_suggestions` 계열 테이블 |
| 친구 초대 코드/공유/초대 기록 | [x] | `friend_invites`, `invite_events`, `referrals` |
| 친구 추천/검색 | [x] | `search_public_profiles` RPC |
| 온보딩 닉네임 저장 | [x] | `profiles.username` |
| 유저 프로필 공개 조회 | [x] | `get_public_profile` RPC |
| 그룹 생성 페이지 | [x] 삭제 | 런칭 범위 제외 |
| 소셜 로그인 버튼 | [~] 배치만 유지 | provider 연결 미완 |
| 활동 사진 리액션/좋아요 | [x] | `activity_reactions` |
| 실제 활동 피드 | [x] | 홈/그룹 상세 DB 기반 표시, 데이터 없을 때 빈 상태 표시 |
| 그룹 랭킹/홈 순위 | [x] | `get_group_leaderboard` RPC |
| 그룹 채팅 | [x] | `group_messages`, `group_message_reactions` |
| 그룹 채팅 실시간 반영 | [x] | Supabase Realtime `group_messages` INSERT |

## 완료된 주요 작업

### 1차

- [x] 그룹 생성 페이지 제거
- [x] 공유 유틸 추가: `src/lib/share.ts`
- [x] 성공/친구초대/챌린지건의 공유 버튼 연결
- [x] 프로필 이미지 업로드를 Supabase Storage `avatars`에 연결
- [x] 알림 설정을 `notification_settings` 테이블에 저장
- [x] 알림 수락/거절 상태 처리
- [x] 마이그레이션 적용
  - `20260503000000_notification_settings.sql`
  - `20260503001000_avatar_storage.sql`

### 2차

- [x] 챌린지 건의함 DB 연결
- [x] 건의 작성, 응원, 댓글, 알림받기 저장
- [x] 투표/댓글 카운트 트리거 추가
- [x] 기본 건의 데이터 seed
- [x] 마이그레이션 적용
  - `20260503002000_challenge_suggestions.sql`

### 3차

- [x] 추천코드 기반 친구 초대 연결
- [x] 회원가입 시 `ref` 처리 및 XP 보상
- [x] 초대 링크 복사/공유/문자/추천 친구 초대 이벤트 저장
- [x] 마이그레이션 적용
  - `20260503003000_referrals.sql`
  - `20260503003100_invite_events.sql`

### 4차

- [x] 앱의 기존 그룹 ID `"1"~"6"`을 DB `groups.id` UUID와 `legacy_id`로 매핑
- [x] 그룹 목록을 Supabase `groups`에서 로드
- [x] 그룹 참여/탈퇴를 `group_members`에 저장
- [x] 가입/탈퇴 시 `groups.member_count` 자동 증감
- [x] 재로그인 후 가입 그룹 조회 RLS 수정
- [x] 마이그레이션 적용
  - `20260503004000_group_members_app_mapping.sql`
  - `20260503004100_fix_group_members_select_policy.sql`

### 5차

- [x] `verifications`에 `group_id`, `verify_type` 추가
- [x] `activity_posts` 테이블 추가
- [x] `activity_reactions` 테이블 추가
- [x] 인증 요청에 그룹 UUID 전달
- [x] Edge Function `verify-photo`에서 그룹 인증 타입/기간/멤버십 확인 후 인증 저장
- [x] 인증 성공 시 `activity_posts` 자동 생성
- [x] `verifications` 저장 실패 시 업로드된 인증 사진 Storage 정리
- [x] 일일 인증 중복 제한을 사용자 전체 기준에서 그룹별 기준으로 변경
- [x] 그룹 상세 활동 탭을 `activity_posts` 기반으로 우선 로드
- [x] 전체 피드를 `activity_posts` 기반으로 로드
- [x] 홈 실시간 인증 피드를 `activity_posts` 기반으로 우선 로드
- [x] 활동 사진 리액션을 `activity_reactions`에 저장
- [x] Edge Function 원격 배포 완료
- [x] 마이그레이션 적용
  - `20260504000000_activity_posts_reactions.sql`

### 6차

- [x] 그룹별 리더보드 RPC 추가
- [x] 홈 순위 슬라이드를 DB 리더보드 우선 로드로 연결
- [x] 그룹 상세 순위 탭을 DB 리더보드 우선 로드로 연결
- [x] DB 데이터가 없을 때 mock 랭킹 fallback 제거, 빈 상태 표시
- [x] 마이그레이션 적용
  - `20260504001000_challenge_lifecycle.sql`
  - `20260504002000_group_leaderboard_rpc.sql`

### 7차

- [x] 그룹 채팅 메시지 테이블 추가
- [x] 그룹 채팅 리액션 테이블 추가
- [x] 같은 그룹 멤버만 채팅 읽기/쓰기 가능한 RLS 추가
- [x] 홈 채팅 슬라이드를 `group_messages` 우선 로드로 연결
- [x] 채팅 메시지 전송을 DB insert로 연결
- [x] 채팅 메시지 리액션을 `group_message_reactions` upsert/delete로 연결
- [x] DB 데이터가 없을 때 mock 채팅 fallback 제거, 빈 상태 표시
- [x] 마이그레이션 적용
  - `20260505001000_group_messages.sql`

### 8차

- [x] 온보딩 닉네임을 `profiles.username`에 저장
- [x] 공개 프로필 조회 RPC 추가
- [x] 유저 프로필 페이지를 `get_public_profile` 기반으로 전환
- [x] 친구 검색 RPC 추가
- [x] 친구 초대 추천/검색을 `profiles` 검색 기반으로 전환
- [x] 마이그레이션 적용
  - `20260505002000_public_profile_rpc.sql`

### 9차

- [x] `group_messages` Realtime publication 추가
- [x] `group_message_reactions` Realtime publication 추가
- [x] 홈 채팅 슬라이드에서 그룹별 메시지 INSERT 구독
- [x] 새 메시지 수신 시 채팅 목록 자동 append
- [x] 구독 cleanup 처리
- [x] 마이그레이션 적용
  - `20260505003000_group_messages_realtime.sql`

## 완료된 주요 작업 (계속)

### 7차

- [x] 챌린지 인증 공유 카드 UI — `src/pages/verify/ShareCard.tsx`
  - 사진 탭 → 전체화면 공유 카드 (다크/라이트 토글, 제목 인라인 편집, @유저명)
  - Canvas API로 카드 이미지 합성 후 4-앱 바텀시트 공유 (인스타·카카오·X·더보기)
  - `Success.tsx` 사진 영역에서 탭 시 오버레이로 진입
- [x] 크루 챌린지 달성 UI — `src/pages/challenge/ChallengeResult.tsx`
  - `/challenge/group/:groupId/result` 라우트 추가
  - 달성(≥50%)/미달성 분기, 베네핏 등급 카드, 내 기록 (get_group_leaderboard RPC 실연동)
  - Home 그룹현황 슬라이드: `challengeEnd < now` 감지 → 결과 카드로 전환

## 다음 우선순위

### P0 — 그룹 참여 유지 검증

- [ ] 실제 계정으로 모바일 흐름 재검증
  - 로그인
  - 그룹 참여
  - 앱 새로고침
  - 로그아웃
  - 재로그인
  - 참여 상태 유지 확인
- [ ] 브라우저 콘솔에서 `Failed to load group memberships` 로그가 없는지 확인
- [ ] Supabase `group_members` row가 생성되는지 확인

### P1 — 홈/그룹 상세 mock 제거

- [x] 그룹 상세 활동 피드 fallback mock 제거
- [x] 홈 활동/피드 fallback mock 제거
- [x] `verifications` / `activity_posts` / `profiles` 기반으로 최신 활동 표시
- [x] 실제 이미지가 없을 때 빈 상태 UI 정리

### P2 — 채팅 UX 보강

- [x] 온라인 멤버 수 mock 제거, 참여 수 표시로 변경
- [ ] 메시지 실패/재전송 UI 정리
- [ ] 다른 사용자의 리액션 실시간 반영 여부 결정

### P3 — 소셜 로그인 실제 연결

- [ ] Supabase provider 설정 확인
- [ ] Google OAuth 연결
- [ ] Apple OAuth 연결 여부 결정
- [ ] 소셜 로그인 후 프로필 생성/추천코드 동작 확인

### P4 — 프로필/친구 UX 보강

- [x] mock fallback에서 열리는 `/user/:seed` 제거
- [x] 친구 추천 기본값 제거, 실제 프로필 검색만 표시
- [ ] 초대 완료 후 토스트/상태 문구 정리

### P5 — 모바일 런칭 점검

- [ ] iOS Safari 카메라/파일 업로드 확인
- [ ] Android Chrome 카메라/파일 업로드 확인
- [ ] safe-area inset 확인
- [ ] 하단 네비 터치 영역 확인
- [ ] 큰 번들 경고 개선 검토
- [ ] 에러/로딩/빈 상태 화면 정리

## 검증 명령어

```bash
npm run lint
npm run build
supabase migration list
```

## 원격 DB 적용 완료 마이그레이션

- `20260501145701_remote_schema.sql`
- `20260503000000_notification_settings.sql`
- `20260503001000_avatar_storage.sql`
- `20260503002000_challenge_suggestions.sql`
- `20260503003000_referrals.sql`
- `20260503003100_invite_events.sql`
- `20260503004000_group_members_app_mapping.sql`
- `20260503004100_fix_group_members_select_policy.sql`
- `20260504000000_activity_posts_reactions.sql`
- `20260504001000_challenge_lifecycle.sql`
- `20260504002000_group_leaderboard_rpc.sql`
- `20260505000000_verifications_storage.sql`
- `20260505001000_group_messages.sql`
- `20260505002000_public_profile_rpc.sql`
- `20260505003000_group_messages_realtime.sql`
- `20260505004000_group_scoped_verification_uniqueness.sql`
