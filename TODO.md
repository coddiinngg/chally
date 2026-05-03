# Chally 작업 계획

| 기능 | 상태 | Phase |
|------|------|-------|
| 그룹 목록 | ❌ mock | 1 |
| 그룹 참여/탈퇴 | ❌ mock | 1 |
| 그룹 생성 | ❌ DB 없음 | 1 |
| 리더보드 | ❌ mock | 1 |
| 홈 순위 슬라이드 | ❌ mock | 1 |
| 실시간 인증 피드 | ❌ mock | 1 |
| 그룹 채팅 | ❌ mock | 2 |
| 알림 설정 저장 | ❌ 저장 안 됨 | 2 |
| 통계 달력 월 이동 | ✅ 완료 | 3 |
| 챌린지 건의함 | ❌ mock | 3 |
| 친구 초대 | ❌ mock | 3 |
| 프로필 달성 회수 | ✅ 완료 | 3 |

---

> 이 파일은 Claude가 실제 구현 작업 시 참조하는 실행 계획서입니다.
> 각 태스크는 원자적(atomic)으로 작성되어 있으며, 의존 관계 순서대로 나열됩니다.

---

## 상태 표기
- `[ ]` 미시작
- `[~]` 진행 중
- `[x]` 완료

---

## Phase 1 — 소셜 기능 기반

> 전제: Phase 1 DB 작업은 Supabase SQL Editor에서 먼저 실행해야 코드 작업이 가능합니다.

### DB 작업 (schema.sql 반영 후 Supabase에서 실행)

- [ ] **P1-DB-1** `supabase/schema.sql`
  - `group_leaderboard` 뷰 추가
  - 목적: 그룹별 멤버 달성률 실시간 집계 (GroupDetail 리더보드, 홈 순위 슬라이드 공통 사용)
  ```sql
  CREATE OR REPLACE VIEW group_leaderboard AS
  SELECT
    gm.group_id,
    gm.user_id,
    p.username,
    p.avatar_url,
    COUNT(v.id) FILTER (WHERE v.status = 'completed') AS total_done,
    ROUND(
      COUNT(v.id) FILTER (WHERE v.status = 'completed')::numeric
      / NULLIF(DATE_PART('day', NOW() - gm.joined_at) + 1, 0) * 100
    ) AS rate
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  LEFT JOIN verifications v ON v.user_id = gm.user_id
  GROUP BY gm.group_id, gm.user_id, p.username, p.avatar_url, gm.joined_at;
  ```

- [ ] **P1-DB-2** `supabase/schema.sql`
  - `profiles` 공개 읽기 RLS 정책 추가
  - 목적: 피드에서 다른 유저의 username/avatar_url 조회 가능하도록
  ```sql
  DROP POLICY IF EXISTS "profiles_select" ON profiles;
  CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
  CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  ```

- [ ] **P1-DB-3** `supabase/schema.sql`
  - 그룹 시드 데이터 INSERT (현재 하드코딩된 6개 그룹)
  - 주의: 이미 존재하면 중복 삽입 방지를 위해 `ON CONFLICT DO NOTHING` 사용
  ```sql
  INSERT INTO groups (name, description, category, max_members, is_public) VALUES
    ('매일 5,000보 걷기', '걸음 수 인증으로 함께 건강해져요', '운동', 50, true),
    ('러닝 크루', '러닝하며 최애 풍경을 함께 공유해요', '운동', 50, true),
    ('일일 독서 클럽', '매일 읽는 책 표지를 함께 모아요', '학습', 50, true),
    ('필사 챌린지', '곱씹게 되는 문장을 함께 모아요', '학습', 50, true),
    ('포즈 챌린지', '오늘의 지정 포즈에 도전해요', '생활', 50, true),
    ('장소 탐험대', '목표 장소에서 인증샷을 찍어요', '생활', 50, true)
  ON CONFLICT DO NOTHING;
  ```

---

### 코드 작업

- [ ] **P1-1** `src/contexts/AppContext.tsx`
  - `DEFAULT_GROUPS` 상수 제거
  - `loadGroups()` 함수 추가: `groups` 테이블 + `group_members` JOIN으로 목록 조회 및 `joined` 판단
  - `useEffect([user?.id])` 에서 `loadGroups()` 호출
  - `groups` 초기값 `[]`로 변경
  - 의존: P1-DB-3 완료 후

- [ ] **P1-2** `src/contexts/AppContext.tsx`
  - `joinGroup(id)` 함수: 낙관적 업데이트 → `group_members` INSERT → 실패 시 롤백
  - `leaveGroup(id)` 함수: 낙관적 업데이트 → `group_members` DELETE → 실패 시 롤백
  - 의존: P1-1

- [ ] **P1-3** `src/pages/challenge/CreateGroup.tsx`
  - `handleCreate`: `setTimeout` 제거, `groups` INSERT → `group_members` INSERT (role: 'admin') → done 처리
  - 의존: P1-2

- [ ] **P1-4** `src/pages/challenge/GroupDetail.tsx`
  - `GROUPS_DETAIL` 상수 제거
  - 컴포넌트 마운트 시 `group_leaderboard` 뷰 조회 → leaderboard state 설정
  - 활동 피드: `verifications` JOIN `profiles` 조회로 대체
  - 의존: P1-DB-1, P1-DB-2

- [ ] **P1-5** `src/pages/Home.tsx`
  - `GROUP_RANKERS` 상수 제거
  - `selectedGroupId` 변경 시 `group_leaderboard` 뷰 조회 → rankers state 설정
  - 의존: P1-DB-1

- [ ] **P1-6** `src/pages/Home.tsx` + `src/pages/FeedAll.tsx`
  - `FEED_ITEMS` / `ALL_FEED_ITEMS` 상수 제거
  - `verifications` 테이블에서 `photo_url IS NOT NULL` + `status = 'completed'` 조건으로 최신 20건 조회
  - JOIN: `profiles(username, avatar_url)`
  - 의존: P1-DB-2

---

## Phase 2 — 채팅 + 알림 설정

### DB 작업

- [ ] **P2-DB-1** `supabase/schema.sql`
  - `group_messages` 테이블 + RLS 정책 추가
  ```sql
  CREATE TABLE IF NOT EXISTS group_messages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id   UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS group_messages_group_created
    ON group_messages (group_id, created_at DESC);
  ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
  -- 같은 그룹 멤버만 읽기/쓰기 가능
  CREATE POLICY "group_messages_select" ON group_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
  CREATE POLICY "group_messages_insert" ON group_messages FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
  ```

- [ ] **P2-DB-2** `supabase/schema.sql`
  - `profiles` 테이블에 알림 설정 컬럼 추가
  ```sql
  ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS notif_daily       BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notif_challenge   BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notif_weekly      BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notif_achievement BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS notif_time        TIME DEFAULT '07:00';
  ```

---

### 코드 작업

- [ ] **P2-1** `src/pages/Home.tsx` (채팅 슬라이드)
  - `GROUP_CHATS` 상수 제거
  - 마운트 시 `group_messages` 최근 50건 조회
  - Supabase Realtime `postgres_changes` 구독 → 새 메시지 자동 append
  - `sendChat`: `group_messages` INSERT
  - 언마운트 시 `supabase.removeChannel()` cleanup
  - 의존: P2-DB-1, P1-2 (그룹 참여 여부 확인)

- [ ] **P2-2** `src/types/database.ts`
  - `Profile` 타입에 알림 설정 컬럼 추가
  - `notif_daily`, `notif_challenge`, `notif_weekly`, `notif_achievement`, `notif_time`
  - 의존: P2-DB-2

- [ ] **P2-3** `src/pages/NotificationSettings.tsx`
  - 마운트 시 `AuthContext`의 `profile`에서 알림 설정값 읽어와 state 초기화
  - 토글/시간 변경 시 500ms debounce 후 `profiles` UPDATE
  - 의존: P2-2

---

## Phase 3 — 나머지 기능

### DB 작업

- [ ] **P3-DB-1** `supabase/schema.sql`
  - `suggestions` + `suggestion_votes` 테이블 추가 (건의함)
  ```sql
  CREATE TABLE IF NOT EXISTS suggestions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT,
    category          TEXT,
    duration          TEXT,
    verify_method     TEXT,
    status            TEXT DEFAULT 'voting' CHECK (status IN ('voting','confirmed','reviewing')),
    votes             INT DEFAULT 0,
    operator_comment  TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS suggestion_votes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suggestion_id UUID REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE (suggestion_id, user_id)
  );
  ALTER TABLE suggestions      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "suggestions_select"       ON suggestions FOR SELECT USING (true);
  CREATE POLICY "suggestions_insert"       ON suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "suggestion_votes_select"  ON suggestion_votes FOR SELECT USING (true);
  CREATE POLICY "suggestion_votes_insert"  ON suggestion_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "suggestion_votes_delete"  ON suggestion_votes FOR DELETE  USING (auth.uid() = user_id);
  ```

- [ ] **P3-DB-2** `supabase/schema.sql`
  - `profiles.invite_code` 컬럼 추가 + `handle_new_user` 트리거 수정
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
  -- 기존 유저 코드 일괄 생성
  UPDATE profiles SET invite_code = upper(substring(md5(id::text), 1, 8))
  WHERE invite_code IS NULL;
  -- 신규 가입 트리거에 invite_code 포함 (handle_new_user 함수 수정)
  ```

---

### 코드 작업

- [x] **P3-1** `src/pages/Stats.tsx` — codex
  - `calOffset` state 추가 (0 = 이번 달)
  - `CAL_YEAR`, `CAL_MONTH`, `CAL_TODAY`를 `calOffset` 기반으로 동적 계산
  - `ChevronLeft` onClick: `setCalOffset(o => o - 1)`
  - `ChevronRight` onClick: `setCalOffset(o => Math.min(0, o + 1))`, `calOffset === 0`이면 disabled
  - 의존: 없음 (독립)

- [ ] **P3-2** `src/pages/ChallengeRequest.tsx`
  - `SUGGESTIONS` 상수 제거
  - 마운트 시 `suggestions` + `suggestion_votes` 조회 (내가 투표했는지 포함)
  - 투표 토글: `suggestion_votes` INSERT/DELETE + `suggestions.votes` 낙관적 업데이트
  - 새 건의 제출: `suggestions` INSERT
  - 의존: P3-DB-1

- [ ] **P3-3** `src/pages/FriendInvite.tsx`
  - 검색 입력 시 `profiles` ilike 검색 (2글자 이상)
  - `SUGGESTED` 하드코딩 제거
  - `INVITE_CODE` / `INVITE_URL` 하드코딩 제거 → `profile.invite_code` 사용
  - 공유 버튼: `navigator.share()` → fallback `navigator.clipboard.writeText()`
  - 의존: P3-DB-2

- [x] **P3-4** `src/pages/Profile.tsx` — 완료 — codex
  - `totalDone`: verificationHistory 기반으로 수정
  - `maxStreak`: profile.streak_count 사용
  - `성공률`: 최근 30일 인증 일수 기반으로 계산
  - 의존: 없음 (독립)

---

## 빠른 버그픽스 (언제든 독립 처리 가능)

- [x] **BUG-1** `src/pages/Profile.tsx:53` — 달성 회수 계산 오류 — codex
- [x] **BUG-2** `src/pages/Stats.tsx` — 통계 헤더 `Calendar` 버튼 빈 onClick 제거 또는 달력 스크롤로 연결 — codex

---

## UI/UX 개선

- [x] **UX-1** `src/pages/challenge/GroupDetail.tsx` — 그룹 상세 1차 UI 구조 정리 (히어로 축소, 컴팩트 바 단순화, 우상단 액션 메뉴, 참여 상태별 카드, 활동 빈 상태) — codex

---

## 작업 전 체크사항

작업 시작 전 항상 확인:
1. DB 작업(`*-DB-*`)은 코드 작업 전에 Supabase에서 먼저 실행
2. `supabase/schema.sql`에도 동일하게 반영해 형상관리 유지
3. RLS 정책 변경 시 기존 정책 DROP 후 재생성 (중복 방지)
4. Realtime 구독은 반드시 컴포넌트 unmount 시 `removeChannel()` cleanup
