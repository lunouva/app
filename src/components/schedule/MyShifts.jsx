import React, { useEffect, useMemo, useState } from "react";

import { WeekGrid } from "./WeekGrid.jsx";
import {
  fmtDate,
  isScheduleApiEnabled,
  scheduleApiRequest,
} from "../../utils/scheduleUtils.js";

export function MyShifts({
  currentUser,
  schedule,
  weekDays,
  positionsById,
  users = [],
  swapIndicators = {},
  onOfferGiveaway,
  onProposeTrade,
  allowCrossPosition = false,
  isQualified = () => true,
}) {
  const [remoteShifts, setRemoteShifts] = useState(null);

  const weekStart = useMemo(
    () => (weekDays && weekDays.length ? fmtDate(weekDays[0]) : null),
    [weekDays]
  );

  useEffect(() => {
    const useApi = isScheduleApiEnabled();
    if (!useApi || !currentUser || !weekStart) {
      setRemoteShifts(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ weekStart });
        const res = await scheduleApiRequest(
          `/api/my/shifts?${params.toString()}`
        );
        if (!cancelled) {
          setRemoteShifts((res && res.data) || []);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "MyShifts API error, falling back to schedule prop",
          err
        );
        if (!cancelled) {
          setRemoteShifts(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, weekStart]);

  const myShifts = useMemo(() => {
    if (Array.isArray(remoteShifts)) return remoteShifts;
    return (schedule?.shifts || []).filter(
      (s) => s.user_id === currentUser.id
    );
  }, [remoteShifts, schedule?.shifts, currentUser?.id]);

  const myEmployees = useMemo(
    () => (users || []).filter((u) => currentUser && u.id === currentUser.id),
    [users, currentUser?.id]
  );

  return (
    <WeekGrid
      employees={myEmployees}
      weekDays={weekDays}
      shifts={myShifts}
      positionsById={positionsById}
      unavailability={[]}
      timeOffList={[]}
      showTimeOffChips={false}
      currentUserId={currentUser.id}
      showTileActions={true}
      swapIndicators={swapIndicators}
      onOfferGiveaway={onOfferGiveaway}
      onProposeTrade={onProposeTrade}
      allowCrossPosition={allowCrossPosition}
      isQualified={isQualified}
    />
  );
}

