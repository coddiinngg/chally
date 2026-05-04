export type ChallengePhase = "recruit" | "active" | "closing" | "ended";

/** 챌린지 기간(일수) → 마감임박 기준 (종료일 N일 전부터) */
function closingDaysBefore(totalDays: number): number {
  if (totalDays <= 7) return 3;
  if (totalDays <= 14) return 4;
  if (totalDays <= 21) return 5;
  return 6;
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

  const totalDays  = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const dBefore    = closingDaysBefore(totalDays);
  const closingStart = new Date(end);
  closingStart.setDate(closingStart.getDate() - dBefore);
  closingStart.setHours(0, 0, 0, 0); // D-4 당일 자정부터 마감임박

  return now >= closingStart ? "closing" : "active";
}

/** 마감임박 상태에서 그룹 숨김 여부 */
export function shouldHide(phase: ChallengePhase, crewRate: number): boolean {
  if (phase !== "closing") return false;
  return crewRate >= 70 || crewRate <= 39;
}

/** 참가 가능 여부 */
export function canJoin(phase: ChallengePhase, crewRate: number): boolean {
  if (phase === "ended" || phase === "recruit") return false;
  if (phase === "closing") return crewRate >= 40 && crewRate <= 69;
  return true;
}

/** 마감임박 시작일 이후에 합류한 늦은 참가자 여부 */
export function isLateJoiner(
  challengeStart: string | null,
  challengeEnd: string | null,
  joinedAt: string,
): boolean {
  if (!challengeStart || !challengeEnd) return false;
  const start = new Date(challengeStart);
  const end   = new Date(challengeEnd);
  const totalDays  = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const dBefore    = closingDaysBefore(totalDays);
  const closingStart = new Date(end);
  closingStart.setDate(closingStart.getDate() - dBefore);
  return new Date(joinedAt) >= closingStart;
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
