import { StaffMap, getStaffDisplayName } from "./staffDisplay";

export interface TeamStatItem {
  total: number;
  hot: number;
  overdue: number;
}

export interface DispatchSuggestion {
  staffId: string;
  displayName: string;
  score: number;
  reason: string;
}

const HEALTHY_LIMIT = 30;

/**
 * Calculates a capacity score for a staff member.
 * Lower score = better candidate for assignment.
 * - Every active lead adds 1 point.
 * - Every HOT lead adds 2 points (stress factor).
 * - Every overdue SLA adds 5 points (bottleneck penalty).
 */
export function calculateDispatchLoadScore(stats: TeamStatItem): number {
  return stats.total + stats.hot * 2 + stats.overdue * 5;
}

/**
 * Recommends the best assignee based on the lowest workload score.
 */
export function getRecommendedAssignee(
  customer: any,
  teamStats: Record<string, TeamStatItem>,
  staffMap: StaffMap,
): DispatchSuggestion | null {
  const candidates = Object.entries(teamStats).map(([id, stats]) => {
    return {
      staffId: id,
      score: calculateDispatchLoadScore(stats),
      stats,
    };
  });

  if (candidates.length === 0) return null;

  // Sort by score ascending (lowest score is best)
  candidates.sort((a, b) => a.score - b.score);

  const best = candidates[0];
  const displayName = getStaffDisplayName(best.staffId, staffMap);

  let reason = "Tải thấp nhất";
  if (best.stats.total === 0) reason = "Đang trống việc";
  else if (best.stats.overdue > 0) reason = "Chấp nhận được";

  // Refuse recommendation if the best is already overloaded
  if (best.stats.total >= HEALTHY_LIMIT) {
    reason = "Cả team đang quá tải";
  }

  return {
    staffId: best.staffId,
    displayName,
    score: best.score,
    reason,
  };
}

/**
 * Helper to distribute an array of customer IDs evenly among the top N staff.
 * Returns a map of customerId -> staffId
 */
export function distributeEvenly(
  customerIds: string[],
  teamStats: Record<string, TeamStatItem>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (customerIds.length === 0 || Object.keys(teamStats).length === 0) return result;

  // Clone stats so we can simulate adding loads during distribution
  const simulatedStats = JSON.parse(JSON.stringify(teamStats)) as Record<string, TeamStatItem>;

  customerIds.forEach((cid) => {
    // Re-evaluate best candidate each time
    const candidates = Object.entries(simulatedStats).map(([id, stats]) => ({
      id,
      score: calculateDispatchLoadScore(stats),
    }));
    candidates.sort((a, b) => a.score - b.score);

    const bestId = candidates[0].id;
    result[cid] = bestId;

    // Increment simulated load
    simulatedStats[bestId].total += 1;
  });

  return result;
}
