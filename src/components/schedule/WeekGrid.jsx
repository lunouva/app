import React, { useMemo, useState } from "react";

import {
  fmtDateLocal,
  fmtDateLabel,
  fmtTime,
  roleColor,
  colorForPosition,
  hoursBetween,
  isDateWithin,
} from "../../utils/scheduleUtils.js";

export function WeekGrid(props) {
  const {
    employees,
    weekDays,
    shifts,
    positionsById,
    unavailability,
    timeOffList,
    showTimeOffChips,
    onCreate,
    onDelete,
    onEdit,
    currentUserId,
    showTileActions = false,
    swapIndicators = {},
    onOfferGiveaway,
    onProposeTrade,
    allowCrossPosition = false,
    isQualified = () => true,
    // use a safe, local flag below to avoid any free variable refs
    onDuplicate,
    onMoveShift,
    useDense,
    // accepted but not used; kept for API compatibility with existing calls
    cleanUI,
  } = props || {};

  const isDense = !!(props && (props.useDense ?? props.dense));

  const [openShiftMenu, setOpenShiftMenu] = useState(null);

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeWeekDays = Array.isArray(weekDays) ? weekDays : [];

  const userNameById = useMemo(
    () =>
      Object.fromEntries(
        safeEmployees.map((u) => [u.id, u.full_name])
      ),
    [safeEmployees]
  );

  const coworkerShifts = useMemo(
    () =>
      currentUserId
        ? safeShifts.filter((sh) => sh.user_id !== currentUserId)
        : [],
    [safeShifts, currentUserId]
  );

  const byUserUnav = useMemo(() => {
    const map = {};
    for (const u of safeEmployees) map[u.id] = [];
    for (const ua of unavailability || []) {
      if (map[ua.user_id]) map[ua.user_id].push(ua);
    }
    return map;
  }, [safeEmployees, unavailability]);

  const byUserTimeOff = useMemo(() => {
    const m = {};
    for (const u of safeEmployees) m[u.id] = [];
    for (const r of timeOffList || []) {
      if (m[r.user_id]) m[r.user_id].push(r);
    }
    return m;
  }, [safeEmployees, timeOffList]);

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="space-y-4">
        {safeEmployees.map((emp) => (
          <EmployeeScheduleCard
            key={emp.id}
            employee={emp}
            weekDays={safeWeekDays}
            allShifts={safeShifts}
            positionsById={positionsById || {}}
            unavailability={byUserUnav[emp.id] || []}
            timeOffList={byUserTimeOff[emp.id] || []}
            showTimeOffChips={showTimeOffChips}
            onCreate={onCreate}
            onDelete={onDelete}
            onEdit={onEdit}
            currentUserId={currentUserId}
            showTileActions={showTileActions}
            swapIndicators={swapIndicators}
            onOfferGiveaway={onOfferGiveaway}
            onProposeTrade={onProposeTrade}
            allowCrossPosition={allowCrossPosition}
            isQualified={isQualified}
            onDuplicate={onDuplicate}
            onMoveShift={onMoveShift}
            isDense={isDense}
            openShiftMenu={openShiftMenu}
            setOpenShiftMenu={setOpenShiftMenu}
            coworkerShifts={coworkerShifts}
            userNameById={userNameById}
          />
        ))}
      </div>
    </div>
  );
}

function EmployeeScheduleCard(props) {
  const {
    employee,
    weekDays,
    allShifts,
    positionsById,
    unavailability,
    timeOffList,
    showTimeOffChips,
    onCreate,
    onDelete,
    onEdit,
    currentUserId,
    showTileActions,
    swapIndicators,
    onOfferGiveaway,
    onProposeTrade,
    allowCrossPosition,
    isQualified,
    onDuplicate,
    onMoveShift,
    isDense,
    openShiftMenu,
    setOpenShiftMenu,
    coworkerShifts,
    userNameById,
  } = props;

  const employeeShifts = (allShifts || []).filter(
    (s) => s.user_id === employee.id
  );

  const totalHoursForEmployee = employeeShifts.reduce(
    (sum, s) => sum + hoursBetween(s.starts_at, s.ends_at, s.break_min),
    0
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white/80 px-4 py-3 odd:bg-gray-50">
      <div className="sticky top-0 z-20 mb-2 flex items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-gray-900">{employee.full_name}</div>
          <span
            className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
            style={{
              border: `1px solid ${roleColor(employee.role)}`,
              color: roleColor(employee.role),
            }}
          >
            {employee.role}
          </span>
        </div>
        <div className="text-xs font-medium text-gray-600">
          {totalHoursForEmployee.toFixed(2)} h
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {weekDays.map((day) => {
          const dayKey = fmtDateLocal(day);

          const dayShifts = employeeShifts.filter(
            (s) => fmtDateLocal(s.starts_at) === dayKey
          );

          const dayUnav = (unavailability || []).filter((ua) =>
            ua.kind === "date"
              ? ua.date === dayKey
              : ua.weekday === day.getDay()
          );

          const dayTimeOff = (timeOffList || []).filter((r) =>
            isDateWithin(dayKey, r.date_from, r.date_to)
          );

          return (
            <DayRow
              key={employee.id + dayKey}
              day={day}
              employee={employee}
              shifts={dayShifts}
              positionsById={positionsById}
              unavailability={dayUnav}
              timeOffList={dayTimeOff}
              showTimeOffChips={showTimeOffChips}
              onCreate={onCreate}
              onDelete={onDelete}
              onEdit={onEdit}
              currentUserId={currentUserId}
              showTileActions={showTileActions}
              swapIndicators={swapIndicators}
              onOfferGiveaway={onOfferGiveaway}
              onProposeTrade={onProposeTrade}
              allowCrossPosition={allowCrossPosition}
              isQualified={isQualified}
              onDuplicate={onDuplicate}
              onMoveShift={onMoveShift}
              isDense={isDense}
              openShiftMenu={openShiftMenu}
              setOpenShiftMenu={setOpenShiftMenu}
              coworkerShifts={coworkerShifts}
              userNameById={userNameById}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayRow(props) {
  const {
    day,
    employee,
    shifts,
    positionsById,
    unavailability,
    timeOffList,
    showTimeOffChips,
    onCreate,
    onDelete,
    onEdit,
    currentUserId,
    showTileActions,
    swapIndicators,
    onOfferGiveaway,
    onProposeTrade,
    allowCrossPosition,
    isQualified,
    onDuplicate,
    onMoveShift,
    isDense,
    openShiftMenu,
    setOpenShiftMenu,
    coworkerShifts,
    userNameById,
  } = props;

  const hasShifts = (shifts || []).length > 0;
  const hasUnav = (unavailability || []).length > 0;
  const hasTimeOff = (timeOffList || []).length > 0;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (id && onMoveShift) {
      onMoveShift(id, employee.id, day);
    }
  };

  return (
    <div
      className="flex items-start justify-between gap-4 px-3 py-2.5"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="sticky left-0 z-20 min-w-[96px] pr-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-white">
        {fmtDateLabel(day)}
      </div>
      <div className="flex-1 space-y-1.5 text-xs text-gray-700">
        {showTimeOffChips &&
          (timeOffList || []).map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border px-2 py-1 text-xs ${
                r.status === "approved"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : r.status === "pending"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              Time off {r.date_from}–{r.date_to} ({r.status})
              {r.notes ? ` · ${r.notes}` : ""}
            </div>
          ))}

        {(unavailability || []).map((ua) => (
          <div
            key={ua.id}
            className="rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
          >
            Unavailable {ua.start_hhmm}–{ua.end_hhmm}
            {ua.notes ? ` · ${ua.notes}` : ""}
          </div>
        ))}

        {hasShifts ? (
          shifts.map((s) => (
            <ShiftChip
              key={s.id}
              shift={s}
              positionsById={positionsById}
              hasUnav={hasUnav}
              hasTimeOff={hasTimeOff}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              showTileActions={showTileActions}
              currentUserId={currentUserId}
              swapIndicators={swapIndicators}
              onOfferGiveaway={onOfferGiveaway}
              onProposeTrade={onProposeTrade}
              allowCrossPosition={allowCrossPosition}
              isQualified={isQualified}
              openShiftMenu={openShiftMenu}
              setOpenShiftMenu={setOpenShiftMenu}
              coworkerShifts={coworkerShifts}
              userNameById={userNameById}
              isDense={isDense}
            />
          ))
        ) : (
          <div className="text-[11px] text-gray-400">No shifts</div>
        )}
      </div>

      {onCreate && (
        <button
          className="ml-2 text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700"
          onClick={() => onCreate(employee.id, day)}
        >
          + add
        </button>
      )}
    </div>
  );
}

function ShiftChip(props) {
  const {
    shift,
    positionsById,
    hasUnav,
    hasTimeOff,
    onEdit,
    onDelete,
    onDuplicate,
    showTileActions,
    currentUserId,
    swapIndicators,
    onOfferGiveaway,
    onProposeTrade,
    allowCrossPosition,
    isQualified,
    openShiftMenu,
    setOpenShiftMenu,
    coworkerShifts,
    userNameById,
    isDense,
  } = props;

  const isCurrentUserShift = !!(
    currentUserId && shift.user_id === currentUserId
  );
  const menuOpen = openShiftMenu === shift.id;

  const handleDragStart = (e) => {
    e.dataTransfer.setData("text/plain", shift.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTileClick = () => {
    if (showTileActions && isCurrentUserShift) {
      setOpenShiftMenu(menuOpen ? null : shift.id);
    }
  };

  const shiftBase =
    "group relative mb-1 rounded-xl border border-gray-200 bg-white/80 text-xs shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition hover:bg-gray-100 hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex items-center justify-between gap-2";

  const shiftTileClass = isDense
    ? `${shiftBase} px-2 py-1`
    : `${shiftBase} px-2.5 py-1.5`;

  const availableTradeTargets = (coworkerShifts || []).filter((sh) => {
    const same = sh.position_id === shift.position_id;
    const cross =
      allowCrossPosition &&
      isQualified(currentUserId, sh.position_id) &&
      isQualified(sh.user_id, shift.position_id);
    return same || cross;
  });

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={shiftTileClass}
      style={{
        borderLeft: `4px solid ${colorForPosition(shift.position_id)}`,
      }}
      onClick={handleTileClick}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-col">
          <div className="font-medium">
            {fmtTime(shift.starts_at)} – {fmtTime(shift.ends_at)}
          </div>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: colorForPosition(shift.position_id),
                }}
              />
              {positionsById[shift.position_id]?.name || "?"}
            </span>
          </div>
        </div>

        {/* Desktop manager actions */}
        <div className="relative flex items-start gap-1">
          {onEdit && (
            <button
              className="hidden rounded border border-gray-200 bg-gray-50 p-1 text-gray-700 hover:bg-gray-100 md:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(shift);
              }}
              aria-label="Edit shift"
              title="Edit"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M12.316 2.434a1.5 1.5 0 0 1 2.122 0l3.128 3.128a1.5 1.5 0 0 1 0 2.122l-9.17 9.17a2 2 0 0 1-1.106.56l-3.89.557a.75.75 0 0 1-.852-.852l.558-3.89a2 2 0 0 1 .56-1.106l9.172-9.17Zm1.414 1.414L6.56 11.018a.5.5 0 0 0-.14.276l-.29 2.023 2.023-.29a.5.5 0 0 0 .276-.14l7.168-7.168-1.867-1.867Z" />
              </svg>
            </button>
          )}
          {onDuplicate && (
            <button
              className="hidden rounded border border-gray-200 bg-gray-50 p-1 text-gray-700 hover:bg-gray-100 md:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(shift.id);
              }}
              aria-label="Duplicate shift"
              title="Duplicate"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M7 4.5A1.5 1.5 0 0 1 8.5 3h6A1.5 1.5 0 0 1 16 4.5v6A1.5 1.5 0 0 1 14.5 12h-6A1.5 1.5 0 0 1 7 10.5v-6Zm-3 3A1.5 1.5 0 0 1 5.5 6h.5v7a2 2 0 0 0 2 2H15v.5A1.5 1.5 0 0 1 13.5 17h-6A1.5 1.5 0 0 1 6 15.5v-6Z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              className="hidden rounded border border-gray-200 bg-gray-50 p-1 text-gray-700 hover:bg-gray-100 md:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shift.id);
              }}
              aria-label="Delete shift"
              title="Delete"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 2A1.75 1.75 0 0 0 7 3.75V4H3.5a.75.75 0 0 0 0 1.5h.548l.862 10.341A2.25 2.25 0 0 0 7.154 18h5.692a2.25 2.25 0 0 0 2.244-2.159L15.952 5.5H16.5a.75.75 0 0 0 0-1.5H13v-.25A1.75 1.75 0 0 0 11.25 2h-2.5Zm1.75 2h-2.5v.25H10.5V4Zm-3.75 3a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7A.75.75 0 0 1 6.75 7Zm6.5 0a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {/* Mobile overflow trigger for manager actions */}
          {(onEdit || onDelete || onDuplicate) && (
            <button
              className="inline-flex rounded p-1 md:hidden"
              onClick={(e) => {
                e.stopPropagation();
                setOpenShiftMenu(menuOpen ? null : shift.id);
              }}
              aria-label="More actions"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-gray-600"
              >
                <path d="M6 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Day-level UA/TO flags */}
      {(hasUnav || hasTimeOff) && (
        <div className="mt-1 flex gap-1 text-[10px]">
          {hasUnav && (
            <span className="rounded bg-red-100 px-1 text-red-700">UA</span>
          )}
          {hasTimeOff && (
            <span className="rounded bg-amber-100 px-1 text-amber-700">
              TO
            </span>
          )}
        </div>
      )}

      {/* Swap indicators for this shift */}
      {(swapIndicators[shift.id]?.give ||
        swapIndicators[shift.id]?.trade) && (
        <div className="mt-1 flex gap-1 text-xs text-gray-600">
          {swapIndicators[shift.id]?.give && (
            <span title="Giveaway">Give</span>
          )}
          {swapIndicators[shift.id]?.trade && (
            <span title="Trade">Trade</span>
          )}
        </div>
      )}

      {/* Employee swap actions (desktop) */}
      {showTileActions && isCurrentUserShift && menuOpen && (
        <div className="mt-2 hidden rounded-lg border border-gray-200 bg-white p-2 text-xs shadow md:block">
          <button
            className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              onOfferGiveaway?.(shift.id);
              setOpenShiftMenu(null);
            }}
          >
            Offer Giveaway
          </button>
          <div className="mt-1 grid gap-1">
            <div className="px-2 text-[11px] text-gray-600">
              Propose Trade for:
            </div>
            <select
              className="w-56 rounded border border-gray-200 px-2 py-1"
              onChange={(e) => {
                const targetId = e.target.value || "";
                if (!targetId) return;
                e.stopPropagation();
                onProposeTrade?.(shift.id, targetId);
                setOpenShiftMenu(null);
              }}
            >
              <option value="">Select coworker shift…</option>
              {availableTradeTargets.map((sh) => (
                <option key={sh.id} value={sh.id}>
                  {(userNameById[sh.user_id] || "Unknown") +
                    " · " +
                    fmtDateLabel(sh.starts_at) +
                    " · " +
                    fmtTime(sh.starts_at) +
                    "–" +
                    fmtTime(sh.ends_at) +
                    (positionsById[sh.position_id]?.name
                      ? " · " + positionsById[sh.position_id].name
                      : "")}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Mobile combined overflow menu (manager + employee actions) */}
      {menuOpen && (
        <div className="absolute right-1 top-7 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 text-xs shadow md:hidden">
          {onEdit && (
            <button
              className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(shift);
                setOpenShiftMenu(null);
              }}
            >
              Edit
            </button>
          )}
          {onDuplicate && (
            <button
              className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(shift.id);
                setOpenShiftMenu(null);
              }}
            >
              Duplicate
            </button>
          )}
          {onDelete && (
            <button
              className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shift.id);
                setOpenShiftMenu(null);
              }}
            >
              Delete
            </button>
          )}

          {showTileActions && isCurrentUserShift && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onOfferGiveaway?.(shift.id);
                  setOpenShiftMenu(null);
                }}
              >
                Offer Giveaway
              </button>
              {availableTradeTargets.length > 0 && (
                <div className="mt-1">
                  <div className="px-2 text-[11px] text-gray-600">
                    Propose Trade for:
                  </div>
                  <select
                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1"
                    onChange={(e) => {
                      const targetId = e.target.value || "";
                      if (!targetId) return;
                      e.stopPropagation();
                      onProposeTrade?.(shift.id, targetId);
                      setOpenShiftMenu(null);
                    }}
                  >
                    <option value="">Select shift…</option>
                    {availableTradeTargets.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {(userNameById[sh.user_id] || "Unknown") +
                          " · " +
                          fmtDateLabel(sh.starts_at) +
                          " · " +
                          fmtTime(sh.starts_at) +
                          "–" +
                          fmtTime(sh.ends_at)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
