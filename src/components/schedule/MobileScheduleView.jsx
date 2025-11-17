import React, { useMemo } from "react";

import MobileScheduleList from "../MobileScheduleList.jsx";

export function MobileScheduleView({
  role,
  mode,
  weekDays,
  shifts,
  employees,
  currentUserId,
  positionsById,
}) {
  const filteredShifts = useMemo(() => {
    if (!Array.isArray(shifts)) return [];
    if (mode === "my" && currentUserId) {
      return shifts.filter((s) => s.user_id === currentUserId);
    }
    return shifts;
  }, [shifts, mode, currentUserId]);

  const visibleEmployees = useMemo(() => {
    if (!Array.isArray(employees)) return [];
    if (mode === "my" && currentUserId) {
      return employees.filter((e) => e.id === currentUserId);
    }
    return employees;
  }, [employees, mode, currentUserId]);

  return (
    <MobileScheduleList
      weekDays={weekDays}
      shifts={filteredShifts}
      users={visibleEmployees}
      positionsById={positionsById}
    />
  );
}

export { MobileScheduleList };

