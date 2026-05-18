# Chally 출시 전 체크리스트

작성일: 2026-05-16
최종 업데이트: 2026-05-17

이 문서는 Chally를 앱스토어/플레이스토어에 등록하기 전까지 남은 작업을 정리한 문서다. 현재 앱은 Vite/React 기반 웹앱이며, Supabase Auth, DB, Storage, Edge Function, Realtime을 사용한다.

## 현재 점검 결과

- `npm run lint` 통과
- `npm run build` 통과
- `git diff --check` 통과
- Playwright로 `/terms`, `/privacy`, `/account-deletion` 렌더링 확인
- `supabase migration list`로 linked project `xufcmyavctkugjkauqxc` 원격 이력 확인
- `supabase db push --dry-run` 실패: 원격에만 있는 migration version 때문에 자동 push 불가
- 원격 타입 생성 결과, `profiles.participation_tickets`, `group_members.benefit_claimed_at`은 운영 DB에 이미 존재
- 원격 타입 생성 결과, `account_deletion_requests`와 신규 RPC 5개는 아직 운영 DB에 미반영
- 원격 DB 조회 결과, `20260517000000`, `20260517010000`, `20260517020000`의 스키마 효과는 이미 운영 DB에 반영됨
- 원격 DB 정책 조회 결과, 운영 DB에는 아직 `profiles`, `groups`, `group_members`, `verifications`의 직접 write 정책이 남아 있음
- `verify-photo` Edge Function 배포 완료: version 28, 2026-05-17 07:48:58 UTC
- route-level code splitting 적용 후 초기 JS chunk 약 470KB로 감소, Vite 500KB chunk 경고 해소
- 게스트 브라우저 내비게이션 테스트는 5개 중 3개 통과한 상태였고, 이번 변경 후 Playwright 재검증은 아직 미실행
- 로그인 기반 E2E 테스트는 `TEST_EMAIL`, `TEST_PASSWORD`가 없어 미실행
- 워킹트리에 미커밋 변경 있음
- `supabase/migrations/20260516000000_participation_tickets.sql` 신규 마이그레이션이 아직 untracked 상태이며, 이미 컬럼이 있는 DB에서도 실패하지 않도록 멱등 처리로 보강함
- `supabase/migrations/20260516010000_harden_release_writes.sql` 신규 보안/RPC 마이그레이션이 추가됨
- `supabase/migrations/20260517000000_challenge_reopen_subscriptions.sql` 신규 마이그레이션이 아직 untracked 상태이며, 운영 DB에 이미 반영된 테이블/정책과 충돌하지 않도록 멱등 처리로 보강함
- `supabase/migrations/20260517010000_challenge_reopen_notifications.sql` 신규 마이그레이션이 아직 untracked 상태이며, 운영 DB에 이미 반영된 상태
- `supabase/migrations/20260517020000_activity_reactions_add_laugh.sql` 신규 마이그레이션이 아직 untracked 상태이며, 운영 DB에 이미 반영된 상태
- `.env.example`에 운영/CLI/Edge Function 검증에 필요한 `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `ALLOWED_ORIGIN` placeholder 추가
- 공개 법적/삭제 안내 라우트 추가
  - `/terms`
  - `/privacy`
  - `/account-deletion`
  - `/delete-account`

## 이번 작업에서 완료한 항목

- 클라이언트 직접 쓰기 축소용 RLS 보강 마이그레이션 추가
  - `profiles_insert/update` 직접 정책 제거
  - `verifications_insert/update/delete` 직접 정책 제거
  - `groups_insert/update/delete` 직접 정책 제거
  - `group_members_insert/update/delete` 직접 정책 제거
- 서버 RPC 추가
  - `update_profile_basic`
  - `join_group_with_ticket`
  - `leave_group`
  - `claim_participation_benefit`
  - `request_account_deletion`
- 참가권 마이그레이션 보강
  - 이미 `participation_tickets`가 있는 운영 DB에서 실패하지 않도록 `recovery_tickets` rename 조건 처리
  - 기존 운영 값을 5로 일괄 reset하지 않고 `NULL` 값만 5로 보정
- 재개설 알림/피드 리액션 마이그레이션 확인
  - 운영 DB에 `challenge_reopen_subscriptions` 테이블 존재 확인
  - 운영 DB에 `notify_reopen_subscribers` 함수와 `trg_notify_reopen_subscribers` 트리거 존재 확인
  - 운영 DB의 `notifications_type_check`에 `challenge_reopened` 포함 확인
  - 운영 DB의 `activity_reactions_emoji_check`에 `😂` 포함 확인
  - `20260517000000_challenge_reopen_subscriptions.sql`을 중복 실행 가능하도록 보강
- 프론트 연동 변경
  - 프로필 수정/온보딩 닉네임 저장을 `update_profile_basic` 경유로 변경
  - 그룹 참여를 `join_group_with_ticket` 경유로 변경
  - 그룹 탈퇴를 `leave_group` 경유로 변경
  - 챌린지 결과 참가권 수령을 `claim_participation_benefit` 경유로 변경
- 계정 삭제 요청 진입점 추가
  - 프로필 화면에 "계정 삭제 요청" 추가
  - `account_deletion_requests` 테이블 및 요청 RPC 추가
- 라우팅 보강
  - `/join/:code` 초대 링크 처리 추가
  - 404 화면 추가
- 운영 안정성
  - Error Boundary 추가
  - `verify-photo` Edge Function의 AI 응답/인식 텍스트 원문 로그 제거
  - `ALLOWED_ORIGIN` 환경변수 기반 CORS 설정 가능하게 변경
  - `verify-photo` Edge Function 운영 재배포 완료
- 약관/개인정보 문구 정리
  - 개인정보처리방침의 `[담당자명]`, `[이메일 주소]` placeholder 제거
  - 약관/개인정보처리방침 시행일을 2026년 5월 16일로 명시
  - 스토어 제출용 공개 약관/개인정보/계정 삭제 안내 URL 추가

## 결론

아래의 앱 내부/서버 항목을 처리하면 제품 자체는 출시 직전 수준에 가까워진다. 다만 앱스토어/플레이스토어 등록 직전 상태가 되려면 네이티브 패키징, 서명 빌드, 스토어 메타데이터, 개인정보/Data safety 제출 준비까지 별도로 끝내야 한다.

## 출시 준비도 평가

현재 상태는 **앱 내부 기능 기준 베타 후반**, **스토어 정식 출시 기준 중간 단계**다.

- 앱 기능 완성도: 약 78%
  - 핵심 화면, 인증, 그룹 참여, AI 인증, 피드, 리더보드, 알림, 계정 삭제 요청 진입점은 갖춰져 있다.
  - 실제 계정 기반 전체 QA, 실패/권한/빈 상태, 게스트→로그인 전환 검증이 아직 부족하다.
- DB/백엔드 준비도: 약 60%
  - 운영 DB에는 참가권, 재개설 알림, 피드 리액션 확장 등 주요 스키마가 이미 반영되어 있다.
  - 출시 보안 마이그레이션(`20260516010000_harden_release_writes.sql`)은 아직 미반영이다.
  - migration history drift 때문에 `supabase db push`가 바로 되지 않는다.
- 보안/개인정보 준비도: 약 65%
  - Edge Function 민감 로그 제거, 계정 삭제 요청 UI, 공개 약관/개인정보/계정 삭제 안내 URL은 준비됐다.
  - 운영 DB에 위험한 직접 write 정책이 아직 남아 있어, 출시 전 반드시 제거해야 한다.
  - 계정 삭제 요청 접수 이후 실제 삭제 처리 운영 절차가 아직 필요하다.
- QA/운영 안정성: 약 55%
  - `npm run lint`, `npm run build`, `git diff --check`는 통과한다.
  - 로그인 계정 기반 E2E, AI 인증 성공/실패, 스토리지, 알림, 권한 거부 플로우 검증이 남아 있다.
- 스토어 출시 절차: 약 30%
  - 웹앱 제품 준비는 진행됐지만, iOS/Android 네이티브 패키징, 서명, 심사용 계정, 스크린샷, Data safety, App Privacy 제출 준비가 아직 본격 진행되지 않았다.

종합하면, **내부 테스트/클로즈드 베타는 곧 가능**하지만 **앱스토어/플레이스토어 정식 제출 직전 상태는 아니다**. 정식 제출까지는 DB 이력 정리, 보안 마이그레이션 반영, 실제 계정 QA, 네이티브 패키징과 스토어 메타데이터 준비가 남아 있다.

## 다음 진행 순서

현재는 앱 코드보다 Supabase 운영 DB 이력 정리가 먼저다. `20260516010000_harden_release_writes.sql`이 운영 DB에 반영되어야 새 프론트 코드의 프로필 수정, 그룹 참여, 그룹 탈퇴, 참가권 혜택 수령, 계정 삭제 요청이 정상 동작한다.

1. 원격 migration history drift 해소
2. `supabase db push --dry-run` 재통과 확인
3. 보안/RPC 마이그레이션 운영 반영
4. 운영 DB 기준 `src/types/database.ts` 재생성
5. 실제 authenticated key로 직접 write 차단 확인
6. 실제 계정으로 핵심 플로우 QA
7. 번들 크기/code splitting 정리
8. Capacitor 등 네이티브 패키징 방식 결정

### 운영 DB 적용 전 체크

- `SUPABASE_DB_PASSWORD`를 설정하거나 Supabase Dashboard SQL editor를 사용한다.
- `supabase migration list`에서 원격-only version을 먼저 확인한다.
- 로컬에 없는 원격 migration은 실제 적용 내용이 보존되도록 복원하거나, 현재 운영 스키마를 기준으로 새 baseline 전략을 정한다.
- `supabase migration repair`는 실제 적용 이력을 바꾸는 명령이므로, 원격-only migration이 불필요하거나 이미 다른 파일로 반영되었다는 확인 없이 실행하지 않는다.
- `supabase db push --include-all`은 현재 상태에서 실행하지 않는다.
- `supabase db push --dry-run`이 통과한 뒤에만 운영 DB 적용을 진행한다.

현재 다음 작업의 현실적인 선택지는 둘 중 하나다.

- Supabase Dashboard SQL editor에서 `20260516010000_harden_release_writes.sql`을 직접 적용하고, 이후 타입 재생성/권한 검증을 진행한다.
- `SUPABASE_DB_PASSWORD`를 로컬 `.env`에 설정한 뒤 CLI로 migration history drift를 정리하고 `db push --dry-run`을 통과시킨다.

현재 분류:

- 운영 DB에 이미 스키마가 반영된 로컬 migration
  - `20260516000000_participation_tickets.sql`
  - `20260517000000_challenge_reopen_subscriptions.sql`
  - `20260517010000_challenge_reopen_notifications.sql`
  - `20260517020000_activity_reactions_add_laugh.sql`
- 운영 DB에 아직 반영되지 않은 로컬 migration
  - `20260516010000_harden_release_writes.sql`

### 운영 DB 적용 성공 기준

- `account_deletion_requests` 테이블이 운영 DB에 존재한다.
- `update_profile_basic`, `join_group_with_ticket`, `leave_group`, `claim_participation_benefit`, `request_account_deletion` RPC가 운영 DB에 존재한다.
- authenticated client로 `profiles`, `groups`, `group_members`, `verifications`의 위험한 직접 write가 차단된다.
- 앱에서는 RPC 경유 프로필 수정, 그룹 참여/탈퇴, 참가권 혜택 수령, 계정 삭제 요청이 정상 동작한다.
- 운영 DB 기준으로 타입 재생성 후 `npm run lint`, `npm run build`, `git diff --check`가 통과한다.

## 1. 앱 내부 출시 필수 작업

### 1.1 보안/RLS 정리

출시 전 최우선 항목이다. 레포에는 보강 마이그레이션을 추가했으며, 운영 Supabase에 적용하고 실제 권한 테스트를 해야 완료로 본다.

- 완료
  - `profiles`, `verifications`, `groups`, `group_members`의 위험한 직접 쓰기 정책 제거 마이그레이션 추가
  - 프로필 수정, 그룹 가입, 그룹 탈퇴, 혜택 수령, 계정 삭제 요청 RPC 추가
  - 클라이언트의 참가권/멤버 상태 직접 업데이트 제거
- 남은 작업
  - 원격 migration history drift 해소
  - 운영 DB에 마이그레이션 적용
  - 실제 authenticated key로 직접 update/insert가 차단되는지 검증
  - service role/Edge Function 경로가 정상 동작하는지 검증

주의:

- 현재 `supabase db push --dry-run`은 원격에만 있는 migration version 때문에 실패한다.
- 이 상태에서 `supabase db push --include-all`을 실행하면 과거 로컬 마이그레이션이 중복 적용될 수 있으므로 금지한다.
- 원격에만 있는 version:
  `20260507101620`, `20260507103506`, `20260508150436`, `20260508152129`, `20260511052136`, `20260512090207`, `20260512090947`, `20260512091907`, `20260512091930`, `20260512093258`, `20260512095257`, `20260512095929`, `20260514085505`, `20260514095212`, `20260514101257`, `20260516063610`, `20260517070559`, `20260517071838`, `20260517072145`
- 원격 SQL 직접 조회 중 Supabase pooler가 `ECIRCUITBREAKER`를 반환했다. 추가 확인은 잠시 대기 후 `SUPABASE_DB_PASSWORD`를 설정하거나 Supabase Dashboard SQL editor에서 진행한다.

### 1.2 DB/Edge Function 운영 배포 고정

- 새 마이그레이션 적용 여부 확인
  - 운영 DB에 `participation_tickets`, `benefit_claimed_at` 존재 확인 완료
  - 운영 DB에 `challenge_reopen_subscriptions`, `notify_reopen_subscribers`, `trg_notify_reopen_subscribers`, `challenge_reopened`, 피드 `😂` 리액션 허용 반영 확인 완료
  - 운영 DB에 `account_deletion_requests`, `update_profile_basic`, `join_group_with_ticket`, `leave_group`, `claim_participation_benefit`, `request_account_deletion` 미반영 확인
- 운영 Supabase DB에 모든 마이그레이션 적용
- `src/types/database.ts`를 운영 DB 기준으로 재생성
- `verify-photo` Edge Function 배포
- Supabase secret 확인
  - `GEMINI_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Storage bucket 확인
  - `avatars`
  - `verifications`
- pg_cron 확인
  - `update_member_statuses`
  - `notify_challenge_lifecycle`
  - `notify_daily_reminders`
- Realtime publication 확인
  - `group_messages`
  - `group_message_reactions`
  - `notifications`

### 1.3 핵심 플로우 QA

실제 계정으로 아래 플로우를 통과시켜야 한다.

- 회원가입 및 이메일 인증
- 로그인
- 온보딩
- 게스트 모드 둘러보기
- 게스트 상태에서 인증/참여 시 로그인 유도
- 그룹 참여
- 참가권 차감
- 그룹 탈퇴
- 카메라 촬영
- 갤러리 업로드
- AI 인증 성공
- AI 인증 실패 및 재시도
- 하루 인증 중복 차단
- 일일 시도 제한
- 인증 성공 후 XP 지급
- 활동 피드 생성
- 리더보드 갱신
- 채팅 및 리액션
- 알림 목록/읽음 처리
- 챌린지 종료 결과 확인
- 참가권 혜택 수령
- 프로필 편집
- 아바타 업로드
- 갤러리 보기
- 친구 초대 링크
- 비밀번호 재설정
- 로그아웃

### 1.4 약관/개인정보/계정 삭제

- 개인정보처리방침 placeholder 제거 완료
- 개인정보처리방침 URL 공개 완료
  - `/privacy`
- 서비스 이용약관 URL 공개 완료
  - `/terms`
- 계정 삭제 안내 URL 공개 완료
  - `/account-deletion`
  - `/delete-account`
- 앱 내 계정 삭제 시작 경로 추가 완료
- 계정 삭제 시 처리 범위 정의
  - auth user
  - profile
  - verification photos
  - avatar
  - activity posts
  - notifications
  - group membership
  - 보관이 필요한 로그 또는 법적 보존 데이터
- 삭제 요청 완료/대기 상태 UX 정의

Apple은 계정 생성 앱이 앱 안에서 계정 삭제를 시작할 수 있어야 한다고 안내한다. Google Play도 계정 생성 앱에 인앱 삭제 경로와 Data safety 내 삭제 정보 입력을 요구한다.

참고:
- https://developer.apple.com/support/offering-account-deletion-in-your-app
- https://support.google.com/googleplay/android-developer/answer/13327111

### 1.5 초대/라우팅/오류 처리

- 그룹 초대 링크 처리 추가 완료
  - `https://chally.app/join/GROUP-...` → `/challenge/group/:groupId?preview=1`
- 친구 초대 링크 확인
  - `/signup?ref=...`
- 알 수 없는 경로용 404 화면 추가 완료
- 배포 환경에서 SPA rewrite 확인
- `preview=1` 접근 정책 정리
  - 운영에서 유지할지
  - 심사용 demo mode로 사용할지
  - 제거할지

### 1.6 운영 안정성

- Error Boundary 추가 완료
- 운영 에러 모니터링 도입 검토
- 주요 Edge Function 로그에서 민감 정보 제거 완료
- `verify-photo` CORS는 `ALLOWED_ORIGIN` 환경변수로 축소 가능하게 변경
- Gemini 장애/429/timeout UX 확인
- 네트워크 실패 재시도 UX 확인
- 이미지 업로드 용량/압축/실패 UX 확인
- 빈 상태/로딩/권한 거부 상태 점검

### 1.7 성능

- route-level code splitting 적용 검토
- 무거운 페이지 lazy load
- 미사용 dependency 정리
- 이미지 외부 로딩 실패 대체 UI 확인
- 모바일 저사양 기기에서 스크롤/애니메이션 확인

## 2. 앱스토어/플레이스토어 등록 전 작업

현재 프로젝트는 웹앱이므로 스토어 등록 전 네이티브 앱 패키징 절차가 필요하다.

### 2.1 패키징 방식 결정

선택지:

- Capacitor로 현재 웹앱 감싸기
- Expo/React Native로 재구성
- Flutter wrapper 사용
- PWA 우선 출시 후 네이티브 전환

현재 코드 구조를 유지하려면 Capacitor가 가장 빠른 선택지다.

### 2.2 iOS 준비

- Apple Developer Program 가입
- Bundle ID 생성
- Xcode 프로젝트 생성
- 앱 아이콘 세트
- Launch screen
- 카메라/사진 권한 문구
- Associated Domains 필요 여부 검토
- `.ipa` archive
- TestFlight 업로드
- 심사용 계정 준비
- App Review notes 작성

Apple 제출 전 체크 포인트:

- 크래시/버그 테스트
- 앱 정보/메타데이터 완성
- 리뷰팀 연락처 최신화
- 계정 기반 기능이면 심사용 계정 또는 완전한 데모 모드 제공
- 백엔드 서비스가 심사 기간 동안 live 상태

참고:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/app-store/app-privacy-details/

### 2.3 Android 준비

- Google Play Console 개발자 계정
- Application ID/package name 결정
- Android signing key 관리
- `.aab` 빌드
- 앱 아이콘/스플래시
- 카메라/사진 권한 문구
- 내부 테스트 트랙 업로드
- Pre-launch report 확인
- 심사용 로그인 계정 준비

Google Play 제출 전 체크 포인트:

- Data safety form 작성
- 개인정보처리방침 URL 입력
- 계정 삭제 URL/인앱 경로 입력
- 앱 권한 사용 목적 검토
- 타사 SDK 데이터 수집 여부 검토

참고:
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/10144311

### 2.4 스토어 메타데이터

- 앱 이름
- 짧은 설명
- 긴 설명
- 카테고리
- 키워드
- 지원 URL
- 개인정보처리방침 URL
- 마케팅 URL 선택 여부
- 스크린샷
  - iPhone
  - iPad 필요 여부
  - Android phone
  - Android tablet 필요 여부
- 앱 미리보기 영상 선택 여부
- 연령 등급
- 콘텐츠/커뮤니티 기능 관련 고지

## 3. 출시 직전 검수 체크리스트

### 기능

- 신규 유저가 가입부터 첫 인증까지 막힘 없이 완료
- 기존 유저가 로그인 후 홈 진입
- 게스트 유저가 둘러보기 가능
- 게스트 유저의 쓰기 액션은 로그인 유도
- 카메라 권한 거부 시 복구 안내
- 사진 권한 거부 시 복구 안내
- Supabase 장애 시 사용자에게 이해 가능한 메시지 표시
- AI 인증 실패가 앱 실패처럼 보이지 않음

### 데이터

- 운영 DB에 테스트 데이터와 실제 데이터 구분
- 테스트 계정/테스트 그룹 정책 결정
- 공개 프로필에서 민감 정보 노출 없음
- 사진 URL 공개 범위 의도 확인
- 삭제 요청 시 Storage 파일까지 처리

### 심사

- 심사용 계정 준비
- 심사용 계정에 참여 가능한 그룹 준비
- 심사용 계정에 인증 가능한 상태 준비
- AI 인증이 심사 중에도 동작하도록 Gemini quota 확인
- App Review notes에 핵심 플로우 설명
- Google Play 심사용 안내 작성

### 운영

- 배포 도메인 확정
- Supabase 프로젝트 운영/개발 분리 여부 결정
- 환경변수 운영값 확인
- 로그 확인 경로 정리
- 장애 발생 시 rollback 절차 정리
- 고객 문의 이메일 준비

## 4. 권장 작업 순서

1. 완료: RLS/보안 정책 수정 마이그레이션 추가
2. 완료: 참가권/혜택 수령 서버 처리 정리
3. 완료: 계정 삭제 요청 플로우 추가
4. 부분 완료: 약관/개인정보처리방침 placeholder 제거
5. 다음 작업: 운영 DB 마이그레이션 적용 및 타입 재생성
6. 다음 작업: Edge Function 배포 및 secret 확인
7. 다음 작업: 실제 계정 E2E QA
8. 완료: 초대 링크와 404 라우팅 정리
9. 다음 작업: 성능/번들 최적화
10. 다음 작업: 네이티브 패키징 방식 결정
11. 다음 작업: iOS/Android 서명 빌드 생성
12. 다음 작업: TestFlight/Play internal test 업로드
13. 다음 작업: 스토어 메타데이터와 privacy/data safety 작성
14. 다음 작업: 심사용 계정과 Review notes 준비
15. 다음 작업: 정식 심사 제출

## 5. 출시 판단 기준

아래가 모두 충족되면 앱 등록 직전 단계로 볼 수 있다.

- 운영 DB/RLS/Edge Function이 안전하게 고정됨
- 실제 계정으로 핵심 플로우가 통과됨
- 계정 삭제와 개인정보처리방침이 준비됨
- 앱 패키징과 서명 빌드가 완료됨
- 스토어 메타데이터와 스크린샷이 준비됨
- Apple privacy label과 Google Data safety가 작성됨
- 심사용 계정과 안내 문구가 준비됨
