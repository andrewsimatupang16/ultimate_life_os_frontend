import type { Goal, SubGoal, Task } from '@/types';
export { toDateTimeLocal } from '@/lib/format';

export type SubGoalWithGoal = SubGoal & {
  goal_title: string;
  goal_is_completed: boolean;
};

export function flattenSubGoals(goals: Goal[]): SubGoalWithGoal[] {
  return goals.flatMap((goal) =>
    (goal.sub_goals || []).map((subGoal) => ({
      ...subGoal,
      goal_title: goal.title,
      goal_is_completed: goal.is_completed,
      is_locked: subGoal.is_locked || goal.is_completed,
    }))
  );
}

export function isTaskLocked(task: Task, goals: Goal[]) {
  if (!task.sub_goal_id) return false;
  return goals.some((goal) => (goal.sub_goals || []).some((subGoal) =>
    subGoal.id === task.sub_goal_id && (goal.is_completed || subGoal.is_completed || subGoal.is_locked)
  ));
}

export const compactGridClass = "app-list-grid";
export const compactCardClass = "modern-panel app-data-card min-w-0 py-0 gap-0 rounded-2xl h-full self-start";
export const compactContentClass = "app-list-card-content";
export const compactTitleClass = "truncate text-base font-bold";
export const compactMetaClass = "line-clamp-2 text-xs leading-relaxed text-slate-500";
export const compactBadgeClass = "h-6 px-2 text-[11px] leading-none";
export const compactIconButtonClass = "h-9 w-9 p-0 shrink-0 shadow-sm";
export const compactIconClass = "h-4 w-4";

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getGoalTargetInfo(targetDate: string | null) {
  if (!targetDate) return null;

  const now = new Date();
  const target = new Date(targetDate);
  const isPast = target.getTime() < now.getTime();
  const start = isPast ? target : now;
  const end = isPast ? now : target;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += daysInMonth(start.getFullYear(), start.getMonth());
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [
    years > 0 ? `${years} tahun` : '',
    months > 0 ? `${months} bulan` : '',
    days > 0 ? `${days} hari` : '',
  ].filter(Boolean);

  return {
    date: formatDate(targetDate),
    range: parts.length ? parts.join(' ') : 'Hari ini',
    isPast,
  };
}
