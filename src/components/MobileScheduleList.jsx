import React, { useMemo } from "react";

/**
 * Group shifts by calendar day for the given week.
 *
 * @param {Date[]} weekDays
 * @param {Array<{ id: string, starts_at: string, ends_at: string, break_min?: number, user_id: string, position_id: string }>} shifts
 * @returns {Array<{ key: string, date: Date, shifts: any[] }>}
 */
function groupShiftsByDay(weekDays, shifts) {
  const safeWeekDays = Array.isArray(weekDays) ? weekDays : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];

  return safeWeekDays.map((day) => {
    const date = new Date(day);
    date.setHours(0, 0, 0, 0);
    const key = date.toDateString();

    const shiftsForDay = safeShifts
      .filter((shift) => {
        if (!shift || !shift.starts_at) return false;
        const start = new Date(shift.starts_at);
        if (Number.isNaN(start.getTime())) return false;
        return (
          start.getFullYear() === date.getFullYear() &&
          start.getMonth() === date.getMonth() &&
          start.getDate() === date.getDate()
        );
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

    return { key, date, shifts: shiftsForDay };
  });
}

function formatTime(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(starts_at, ends_at) {
  if (!starts_at || !ends_at) return "";
  return `${formatTime(starts_at)} \u2013 ${formatTime(ends_at)}`;
}

function formatDuration(starts_at, ends_at, break_min = 0) {
  const start = new Date(starts_at);
  const end = new Date(ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const breakMs = (Number(break_min) || 0) * 60000;
  const diffMs = Math.max(0, end.getTime() - start.getTime() - breakMs);
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0 && minutes <= 0) return "";
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDayHeader(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.toLocaleDateString([], { weekday: "short" });
  const day = d.getDate();
  return `${weekday} ${day}`;
}

function roleClasses(role) {
  switch (role) {
    case "owner":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "manager":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      // crew / employees
      return "border-sky-200 bg-sky-50 text-sky-900";
  }
}

function roleLabel(role) {
  if (!role) return "";
  if (role === "employee") return "Crew";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Mobile agenda-style schedule list for a single week.
 *
 * Props:
 * - weekDays: Date[]
 * - shifts: Shift[]
 * - users: User[]
 * - positionsById: Record<string, Position>
 */
export default function MobileScheduleList({ weekDays, shifts, users = [], positionsById = {} }) {
  const groups = useMemo(() => groupShiftsByDay(weekDays, shifts), [weekDays, shifts]);

  const userById = useMemo(
    () => Object.fromEntries((users || []).map((u) => [u.id, u])),
    [users]
  );

  return (
    <div className="space-y-4">
      {groups.map(({ key, date, shifts: dayShifts }) => (
        <div key={key} className="border-b border-gray-100 pb-3 last:border-b-0">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {formatDayHeader(date)}
            </div>
            {dayShifts.length === 0 && (
              <div className="text-[11px] text-gray-400">No shifts</div>
            )}
          </div>

          <div className="space-y-2">
            {dayShifts.map((shift) => {
              const user = userById[shift.user_id];
              const position = positionsById[shift.position_id] || null;
              const role = user?.role || "employee";
              const cardClasses = roleClasses(role);
              const duration = formatDuration(shift.starts_at, shift.ends_at, shift.break_min);

              return (
                <div
                  key={shift.id}
                  className={`w-full rounded-xl border px-3 py-2 text-sm shadow-sm ${cardClasses}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold">
                      {formatTimeRange(shift.starts_at, shift.ends_at)}
                    </div>
                    {duration && (
                      <div className="text-xs font-medium opacity-80">{duration}</div>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {user?.full_name || "Unassigned"}
                  </div>
                  <div className="mt-0.5 text-xs opacity-90">
                    {position?.name || "Shift"}
                    {role && <span> · {roleLabel(role)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

