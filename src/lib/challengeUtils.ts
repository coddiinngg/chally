export type ChallengePhase = "recruit" | "active" | "closing" | "ended";

/** 챌린지 전체 기간의 50% 시점 (closing 시작 컷오프) */
function closingStartAt(start: Date, end: Date): Date {
  return new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
}

/** 현재 챌린지 단계 계산 */
export function getPhase(
  challengeStart: string | null,
  challengeEnd: string | null,
  recruitEnd: string | null,
  now = new Date(),
): ChallengePhase {
  if (!challengeStart || !challengeEnd) return "active";

  const start = new Date(challengeStart);
  const end   = new Date(challengeEnd);

  if (recruitEnd && now < new Date(recruitEnd)) return "recruit";
  if (now > end) return "ended";

  return now >= closingStartAt(start, end) ? "closing" : "active";
}

/** 마감임박 상태에서 그룹 숨김 여부 */
export function shouldHide(phase: ChallengePhase, crewRate: number): boolean {
  if (phase !== "closing") return false;
  return crewRate >= 70 || crewRate <= 39;
}

/** 참가 가능 여부 */
export function canJoin(phase: ChallengePhase, crewRate: number): boolean {
  if (phase === "ended") return false;
  if (phase === "closing") return crewRate >= 40 && crewRate <= 69;
  return true; // recruit(모집중) + active: 항상 참여 가능
}

/** 마감임박 시작(전체 기간 50% 경과) 이후에 합류한 늦은 참가자 여부 */
export function isLateJoiner(
  challengeStart: string | null,
  challengeEnd: string | null,
  joinedAt: string,
): boolean {
  if (!challengeStart || !challengeEnd) return false;
  const start = new Date(challengeStart);
  const end   = new Date(challengeEnd);
  return new Date(joinedAt) >= closingStartAt(start, end);
}

/** 베네핏 등급 계산 (크루 달성률 선행 조건 포함) */
export function getBenefitGrade(
  myRate: number,
  crewRate: number,
): "A" | "B" | "C" | "D" {
  if (crewRate < 50) return "D";
  if (myRate >= 100) return "A";
  if (myRate >= 80) return "B";
  if (myRate >= 50) return "C";
  return "D";
}

/** 등급별 참가권 지급 수량 */
export function ticketsForGrade(grade: "A" | "B" | "C" | "D"): number {
  switch (grade) {
    case "A": return 3;
    case "B": return 2;
    case "C": return 1;
    case "D": return 0;
  }
}

/** 단계 → 표시 레이블 */
export function phaseLabel(phase: ChallengePhase): string {
  switch (phase) {
    case "recruit": return "모집중";
    case "active":  return "진행중";
    case "closing": return "마감임박";
    case "ended":   return "종료";
  }
}

/** 단계 → 게이지 색상 */
export function phaseColor(phase: ChallengePhase): string {
  if (phase === "closing") return "#D97706"; // amber
  if (phase === "ended")   return "#94A3B8"; // slate
  if (phase === "recruit") return "#3B82F6"; // blue
  return "#10B981"; // green (진행중)
}

/** 종료 후 경과 일수 */
export function daysSinceEnd(challengeEnd: string | null): number {
  if (!challengeEnd) return 0;
  return Math.floor((Date.now() - new Date(challengeEnd).getTime()) / 86_400_000);
}

/** 재개설 알림 신청 가능 여부: 마감임박 기간 OR 종료 후 5일 이내 */
export function canRequestReopenNotify(
  phase: ChallengePhase,
  challengeEnd: string | null,
): boolean {
  if (phase === "closing") return true;
  if (phase === "ended") return daysSinceEnd(challengeEnd) <= 5;
  return false;
}
