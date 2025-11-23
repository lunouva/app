import React, { useMemo, useState } from "react";

import {
  fmtDateLabel,
  fmtDateLocal,
  fmtTime,
  roleColor,
  colorForPosition,
  hoursBetween,
  isDateWithin,
} from "../../utils/scheduleUtils.js";

const timeRange = (start, end) => `${fmtTime(start)} - ${fmtTime(end)}`;
const dayLabel = (d) => fmtDateLabel(d).replace(",", "");

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
    onDuplicate,
    onMoveShift,
    useDense,
    dense,
    cleanUI, // accepted for API compatibility; styling now handled here
  } = props || {};

  const [openShiftMenu, setOpenShiftMenu] = useState(null);
  const isDense = !!(useDense ?? dense);

  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeWeekDays = Array.isArray(weekDays) ? weekDays : [];
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safePositions = positionsById || {};
  const safeUnavailability = Array.isArray(unavailability) ? unavailability : [];
  const safeTimeOff = Array.isArray(timeOffList) ? timeOffList : [];

  const userNameById = useMemo(
    () => Object.fromEntries(safeEmployees.map((u) => [u.id, u.full_name])),
    [safeEmployees]
  );

  const coworkerShifts = useMemo(
    () =>
      currentUserId
        ? safeShifts.filter((sh) => sh.user_id !== currentUserId)
        : [],
    [safeShifts, currentUserId]
  );

  const byUserUnavailability = useMemo(() => {
    const map = {};
    for (const u of safeEmployees) map[u.id] = [];
    for (const ua of safeUnavailability) {
      if (map[ua.user_id]) map[ua.user_id].push(ua);
    }
    return map;
  }, [safeEmployees, safeUnavailability]);

  const byUserTimeOff = useMemo(() => {
    const m = {};
    for (const u of safeEmployees) m[u.id] = [];
    for (const r of safeTimeOff) {
      if (m[r.user_id]) m[r.user_id].push(r);
    }
    return m;
  }, [safeEmployees, safeTimeOff]);

  const hoursByEmployee = useMemo(() => {
    const totals = {};
    for (const emp of safeEmployees) totals[emp.id] = 0;
    for (const s of safeShifts) {
      if (!Object.prototype.hasOwnProperty.call(totals, s.user_id)) continue;
      const isInWeek = safeWeekDays.some(
        (d) => fmtDateLocal(d) === fmtDateLocal(s.starts_at)
      );
      if (isInWeek) {
        totals[s.user_id] += hoursBetween(
          s.starts_at,
          s.ends_at,
          s.break_min
        );
      }
    }
    return totals;
  }, [safeEmployees, safeShifts, safeWeekDays]);

  const hoursByDay = useMemo(() => {
    const totals = {};
    for (const d of safeWeekDays) totals[fmtDateLocal(d)] = 0;
    for (const s of safeShifts) {
      const key = fmtDateLocal(s.starts_at);
      if (Object.prototype.hasOwnProperty.call(totals, key)) {
        totals[key] += hoursBetween(s.starts_at, s.ends_at, s.break_min);
      }
    }
    return totals;
  }, [safeShifts, safeWeekDays]);

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="grid min-w-[960px] grid-cols-[220px_repeat(7,minmax(0,1fr))]">
              <WeekHeaderRow weekDays={safeWeekDays} />
              {safeEmployees.map((emp, idx) => (
                <EmployeeRow
                  key={emp.id}
                  employee={emp}
                  weekDays={safeWeekDays}
                  shifts={safeShifts}
                  positionsById={safePositions}
                  unavailability={byUserUnavailability[emp.id] || []}
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
                  rowIndex={idx}
                  weeklyHours={hoursByEmployee[emp.id] || 0}
                />
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-white to-transparent sm:hidden">
            <span className="pr-2 text-[11px] font-semibold text-gray-400">
              <span aria-hidden="true">&lt;-&gt;</span>
              <span className="sr-only">Scroll horizontally</span>
            </span>
          </div>
        </div>
      </div>

      <SummaryCards
        employees={safeEmployees}
        weekDays={safeWeekDays}
        hoursByEmployee={hoursByEmployee}
        hoursByDay={hoursByDay}
      />
    </div>
  );
}

function WeekHeaderRow({ weekDays }) {
  return (
    <>
      <div className="sticky left-0 top-0 z-30 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.04)] rounded-tl-2xl">
        Employee
      </div>
      {weekDays.map((d, idx) => (
        <div
          key={String(d)}
          className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50 px-3 py-3 text-center text-sm font-semibold text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.04)] ${
            idx === weekDays.length - 1 ? "rounded-tr-2xl" : ""
          }`}
        >
          {dayLabel(d)}
        </div>
      ))}
    </>
  );
}

function EmployeeRow(props) {
  const {
    employee,
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
    rowIndex,
    weeklyHours,
  } = props;

  const rowTint = rowIndex % 2 === 1 ? "bg-gray-50/70" : "bg-white";

  return (
    <>
      <div
        className={`sticky left-0 z-10 flex flex-col justify-center border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 backdrop-blur ${rowTint}`}
      >
        <div className="flex items-center gap-2">
          <span className="truncate">{employee.full_name}</span>
          {employee.role && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
              style={{
                border: `1px solid ${roleColor(employee.role)}`,
                color: roleColor(employee.role),
              }}
            >
              {employee.role}
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] font-medium text-gray-500">
          {weeklyHours.toFixed(2)} h this week
        </div>
      </div>

      {weekDays.map((day) => {
        const dayKey = fmtDateLocal(day);

        const dayShifts = (shifts || []).filter(
          (s) => s.user_id === employee.id && fmtDateLocal(s.starts_at) === dayKey
        );

        const dayUnavailability = (unavailability || []).filter((ua) =>
          ua.kind === "date" ? ua.date === dayKey : ua.weekday === day.getDay()
        );

        const dayTimeOff = (timeOffList || []).filter((r) =>
          isDateWithin(dayKey, r.date_from, r.date_to)
        );

        return (
          <ShiftCell
            key={`${employee.id}-${dayKey}`}
            employeeId={employee.id}
            day={day}
            shifts={dayShifts}
            unavailability={dayUnavailability}
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
            positionsById={positionsById}
            rowTint={rowTint}
          />
        );
      })}
    </>
  );
}

function ShiftCell(props) {
  const {
    day,
    employeeId,
    shifts,
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
    positionsById,
    rowTint,
  } = props;

  const hasUnavailability = (unavailability || []).length > 0;
  const hasTimeOff = (timeOffList || []).length > 0;
  const hasShifts = (shifts || []).length > 0;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (id && onMoveShift) {
      onMoveShift(id, employeeId, day);
    }
  };

  return (
    <div
      className={`min-h-20 border-b border-l border-gray-100 px-3 py-3 align-top transition-colors hover:bg-slate-50 ${rowTint}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="space-y-1.5">
        {showTimeOffChips &&
          (timeOffList || []).map((r) => (
            <div
              key={r.id}
              className={`rounded-full border px-3 py-1 text-[11px] ${
                r.status === "approved"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : r.status === "pending"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              Time off {r.date_from} - {r.date_to} ({r.status})
              {r.notes ? ` - ${r.notes}` : ""}
            </div>
          ))}

        {(unavailability || []).map((ua) => (
          <div
            key={ua.id}
            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700"
          >
            Unavailable {ua.start_hhmm}-{ua.end_hhmm}
            {ua.notes ? ` - ${ua.notes}` : ""}
          </div>
        ))}

        {hasShifts ? (
          (shifts || []).map((s) => (
            <ShiftPill
              key={s.id}
              shift={s}
              positionsById={positionsById}
              hasUnavailability={hasUnavailability}
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
              day={day}
            />
          ))
        ) : (
          <div className="mt-1 h-1 w-full rounded-full bg-gray-100" />
        )}

        {onCreate && (
          <button
            className="text-[11px] font-semibold text-indigo-500 underline-offset-2 hover:underline"
            onClick={() => onCreate(employeeId, day)}
          >
            + add
          </button>
        )}
      </div>
    </div>
  );
}

function ShiftPill(props) {
  const {
    shift,
    positionsById,
    hasUnavailability,
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

  const isCurrentUserShift = currentUserId && shift.user_id === currentUserId;
  const menuOpen = openShiftMenu === shift.id;
  const pad = isDense ? "px-2 py-1" : "px-2.5 py-1.5";

  const availableTradeTargets = (coworkerShifts || []).filter((sh) => {
    const same = sh.position_id === shift.position_id;
    const cross =
      allowCrossPosition &&
      isQualified(currentUserId, sh.position_id) &&
      isQualified(sh.user_id, shift.position_id);
    return same || cross;
  });

  const hasManagerActions = onEdit || onDelete || onDuplicate;
  const hasEmployeeActions = showTileActions && isCurrentUserShift;

  const handleDragStart = (e) => {
    e.dataTransfer.setData("text/plain", shift.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const toggleMenu = (e) => {
    e.stopPropagation();
    setOpenShiftMenu(menuOpen ? null : shift.id);
  };

  return (
    <div className="relative">
      <div
        draggable
        onDragStart={handleDragStart}
        className={`inline-flex w-full items-center gap-3 rounded-md border border-gray-200 bg-white text-xs font-medium text-gray-800 shadow-sm transition hover:border-gray-300 hover:shadow ${pad}`}
        style={{
          borderLeft: `4px solid ${colorForPosition(shift.position_id)}`,
        }}
      >
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: colorForPosition(shift.position_id),
                }}
              />
              {timeRange(shift.starts_at, shift.ends_at)}
            </span>
            <span className="text-[11px] font-medium text-gray-500">
              {positionsById[shift.position_id]?.name || "Shift"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
            {hasUnavailability && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600">
                UA
              </span>
            )}
            {hasTimeOff && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                TO
              </span>
            )}
            {(swapIndicators[shift.id]?.give ||
              swapIndicators[shift.id]?.trade) && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600">
                {`${swapIndicators[shift.id]?.give ? "Give" : ""}${
                  swapIndicators[shift.id]?.give && swapIndicators[shift.id]?.trade
                    ? " / "
                    : ""
                }${swapIndicators[shift.id]?.trade ? "Trade" : ""}`}
              </span>
            )}
          </div>
        </div>

        {(hasManagerActions || hasEmployeeActions) && (
          <button
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
            onClick={toggleMenu}
            aria-label="Shift actions"
          >
            ...
          </button>
        )}
      </div>

      {(hasManagerActions || hasEmployeeActions) && menuOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-gray-200 bg-white p-1 text-xs shadow-lg">
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

          {hasEmployeeActions && (
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
                Offer giveaway
              </button>
              {availableTradeTargets.length > 0 && (
                <div className="mt-1">
                  <div className="px-2 text-[11px] text-gray-600">
                    Propose trade for:
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
                    <option value="">Select shift...</option>
                    {availableTradeTargets.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {(userNameById[sh.user_id] || "Unknown") +
                          " - " +
                          dayLabel(sh.starts_at) +
                          " - " +
                          fmtTime(sh.starts_at) +
                          "-" +
                          fmtTime(sh.ends_at) +
                          (positionsById[sh.position_id]?.name
                            ? " - " + positionsById[sh.position_id].name
                            : "")}
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

function SummaryCards({ employees, weekDays, hoursByEmployee, hoursByDay }) {
  if (!employees.length || !weekDays.length) return null;

  const totalHours = Object.values(hoursByDay || {}).reduce(
    (sum, h) => sum + (h || 0),
    0
  );

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-gray-200 bg-white p-3 text-sm shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            Hours by employee
          </div>
          <div className="text-[11px] text-gray-500">Weekly totals</div>
        </div>
        <div className="space-y-2">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {emp.full_name}
                </span>
                {emp.role && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      border: `1px solid ${roleColor(emp.role)}`,
                      color: roleColor(emp.role),
                    }}
                  >
                    {emp.role}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {(hoursByEmployee?.[emp.id] || 0).toFixed(2)} h
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 text-sm shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            Hours by day
          </div>
          <div className="text-[11px] text-gray-500">
            {totalHours.toFixed(2)} h total
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {weekDays.map((d) => {
            const key = fmtDateLocal(d);
            const total = hoursByDay?.[key] || 0;
            return (
              <div
                key={key}
                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {dayLabel(d)}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {total.toFixed(2)} h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
