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
  } = props || {};
  const isDense = !!(props && (props.useDense ?? props.dense));
  const [openShiftMenu, setOpenShiftMenu] = useState(null);
  const userNameById = useMemo(
    () => Object.fromEntries((employees || []).map((u) => [u.id, u.full_name])),
    [employees]
  );
  const coworkerShifts = useMemo(
    () =>
      currentUserId
        ? (shifts || []).filter((sh) => sh.user_id !== currentUserId)
        : [],
    [shifts, currentUserId]
  );
  const byUserUnav = useMemo(() => {
    const map = {};
    for (const u of employees) map[u.id] = [];
    for (const ua of unavailability) {
      if (map[ua.user_id]) map[ua.user_id].push(ua);
    }
    return map;
  }, [employees, unavailability]);

  const byUserTimeOff = useMemo(() => {
    const m = {};
    for (const u of employees) m[u.id] = [];
    for (const r of timeOffList || []) if (m[r.user_id]) m[r.user_id].push(r);
    return m;
  }, [employees, timeOffList]);

  const cellPad = isDense ? "p-1 min-h-[60px]" : "p-2 min-h-24";
  const bubblePad = isDense ? "px-2 py-1 text-xs" : "px-2.5 py-2 text-sm";

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="w-full">
          <div className="grid grid-cols-[200px_repeat(7,1fr)_120px]">
            <div className="sticky left-0 top-0 z-20 bg-gray-50 p-2 font-semibold shadow-sm">
              Employee
            </div>
            {weekDays.map((d) => (
              <div
                key={String(d)}
                className="sticky top-0 z-10 bg-gray-50 p-2 text-center font-semibold shadow-sm"
              >
                {fmtDateLabel(d)}
              </div>
            ))}
            <div className="sticky top-0 z-10 bg-gray-50 p-2 text-center font-semibold shadow-sm">
              Total
            </div>

            {employees.map((emp) => (
              <React.Fragment key={emp.id}>
                <div className="sticky left-0 z-10 border-t bg-white p-2 font-medium">
                  {emp.full_name}
                  <span
                    className="ml-2 align-middle text-[11px]"
                    style={{
                      border: `1px solid ${roleColor(emp.role)}`,
                      color: roleColor(emp.role),
                      padding: "2px 8px",
                      borderRadius: "9999px",
                    }}
                  >
                    {emp.role}
                  </span>
                </div>

                {weekDays.map((day) => {
                  const dayKey = fmtDateLocal(day);

                  const dayShifts = shifts.filter(
                    (s) =>
                      s.user_id === emp.id &&
                      fmtDateLocal(s.starts_at) === dayKey
                  );

                  const dayUnav = (byUserUnav[emp.id] || []).filter((ua) =>
                    ua.kind === "date"
                      ? ua.date === dayKey
                      : ua.weekday === day.getDay()
                  );

                  const dayTimeOff = (byUserTimeOff[emp.id] || []).filter((r) =>
                    isDateWithin(dayKey, r.date_from, r.date_to)
                  );

                  return (
                    <div
                      key={emp.id + dayKey}
                      className={`border-l border-t ${cellPad}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        const id = e.dataTransfer.getData("text/plain");
                        if (id) onMoveShift?.(id, emp.id, day);
                      }}
                    >
                      <div className="space-y-2">
                        {showTimeOffChips &&
                          dayTimeOff.map((r) => (
                            <div
                              key={r.id}
                              className={`rounded-xl border px-2 py-1 text-xs ${
                                r.status === "approved"
                                  ? "border-green-300 bg-green-50 text-green-700"
                                  : r.status === "pending"
                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                  : "border-gray-300 bg-gray-50 text-gray-700"
                              }`}
                            >
                              Time off {r.date_from}–{r.date_to} ({r.status})
                              {r.notes ? ` • ${r.notes}` : ""}
                            </div>
                          ))}

                        {dayUnav.map((ua) => (
                          <div
                            key={ua.id}
                            className="rounded-xl border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                          >
                            Unavailable {ua.start_hhmm}–{ua.end_hhmm}
                            {ua.notes ? ` • ${ua.notes}` : ""}
                          </div>
                        ))}

                        {dayShifts.map((s) => (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", s.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className={`group relative rounded-xl border border-gray-200 bg-white ${
                              isDense
                                ? "px-2 py-1 text-xs"
                                : "px-2.5 py-2 text-sm"
                            } shadow-sm transition hover:border-gray-300 hover:shadow-md`}
                            style={{
                              borderLeft: `4px solid ${colorForPosition(
                                s.position_id
                              )}`,
                            }}
                            onClick={() => {
                              if (
                                showTileActions &&
                                currentUserId &&
                                s.user_id === currentUserId
                              ) {
                                setOpenShiftMenu((v) => (v === s.id ? null : s.id));
                              }
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium">
                                {fmtTime(s.starts_at)} – {fmtTime(s.ends_at)}
                              </div>
                              <div className="absolute right-1 top-1 hidden gap-1 md:flex md:opacity-0 md:transition md:duration-150 md:group-hover:opacity-100">
                                {onEdit && (
                                  <button
                                    className="rounded border border-gray-200 bg-gray-50 p-1 hover:bg-gray-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(s);
                                    }}
                                    aria-label="Edit shift"
                                    title="Edit"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-4 w-4 text-gray-700"
                                    >
                                      <path d="M12.316 2.434a1.5 1.5 0 0 1 2.122 0l3.128 3.128a1.5 1.5 0 0 1 0 2.122l-9.17 9.17a2 2 0 0 1-1.106.56l-3.89.557a.75.75 0 0 1-.852-.852l.558-3.89a2 2 0 0 1 .56-1.106l9.172-9.17Zm1.414 1.414L6.56 11.018a.5.5 0 0 0-.14.276l-.29 2.023 2.023-.29a.5.5 0 0 0 .276-.14l7.168-7.168-1.867-1.867Z" />
                                    </svg>
                                  </button>
                                )}
                                {onEdit && onDelete && (
                                  <span className="text-gray-300">|</span>
                                )}
                                {onEdit && (
                                  <button
                                    className="rounded border border-gray-200 bg-gray-50 p-1 hover:bg-gray-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDuplicate?.(s.id);
                                    }}
                                    aria-label="Duplicate shift"
                                    title="Duplicate"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-4 w-4 text-gray-700"
                                    >
                                      <path d="M7 4.5A1.5 1.5 0 0 1 8.5 3h6A1.5 1.5 0 0 1 16 4.5v6A1.5 1.5 0 0 1 14.5 12h-6A1.5 1.5 0 0 1 7 10.5v-6Zm-3 3A1.5 1.5 0 0 1 5.5 6h.5v7a2 2 0 0 0 2 2H15v.5A1.5 1.5 0 0 1 13.5 17h-6A1.5 1.5 0 0 1 6 15.5v-6Z" />
                                    </svg>
                                  </button>
                                )}
                                {onDelete && (
                                  <button
                                    className="rounded border border-gray-200 bg-gray-50 p-1 hover:bg-gray-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDelete(s.id);
                                    }}
                                    aria-label="Delete shift"
                                    title="Delete"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className="h-4 w-4 text-gray-700"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M8.75 2A1.75 1.75 0 0 0 7 3.75V4H3.5a.75.75 0 0 0 0 1.5h.548l.862 10.341A2.25 2.25 0 0 0 7.154 18h5.692a2.25 2.25 0 0 0 2.244-2.159L15.952 5.5H16.5a.75.75 0 0 0 0-1.5H13v-.25A1.75 1.75 0 0 0 11.25 2h-2.5Zm1.75 2h-2.5v.25H10.5V4Zm-3.75 3a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7A.75.75 0 0 1 6.75 7Zm6.5 0a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75Z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Mobile overflow menu trigger */}
                            <button
                              className="absolute right-1 top-1 rounded p-1 md:hidden"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenShiftMenu((v) =>
                                  v === s.id ? null : s.id
                                );
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

                            {/* Conflict indicators (day-level) */}
                            {(dayUnav.length > 0 || dayTimeOff.length > 0) && (
                              <div className="absolute left-1 top-1 flex gap-1 text-[10px]">
                                {dayUnav.length > 0 && (
                                  <span className="rounded bg-red-100 px-1 text-red-700">
                                    UA
                                  </span>
                                )}
                                {dayTimeOff.length > 0 && (
                                  <span className="rounded bg-amber-100 px-1 text-amber-700">
                                    TO
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="mt-1">
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
                                <span
                                  className="mr-1 inline-block h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor: colorForPosition(
                                      s.position_id
                                    ),
                                  }}
                                />
                                {positionsById[s.position_id]?.name || "?"}
                              </span>
                            </div>

                            {(swapIndicators[s.id]?.give ||
                              swapIndicators[s.id]?.trade) && (
                              <div className="pointer-events-none absolute right-1 top-1 flex gap-1 text-xs opacity-70">
                                {swapIndicators[s.id]?.give && (
                                  <span title="Giveaway">Give</span>
                                )}
                                {swapIndicators[s.id]?.trade && (
                                  <span title="Trade">Trade</span>
                                )}
                              </div>
                            )}

                            {/* Mobile overflow menu */}
                            {openShiftMenu === s.id && (
                              <div className="absolute right-1 top-6 z-20 rounded-lg border bg-white p-1 text-xs shadow md:hidden">
                                {onEdit && (
                                  <button
                                    className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(s);
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
                                      onDuplicate(s.id);
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
                                      onDelete(s.id);
                                      setOpenShiftMenu(null);
                                    }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}

                            {showTileActions &&
                              currentUserId &&
                              s.user_id === currentUserId &&
                              openShiftMenu === s.id && (
                                <div className="absolute bottom-1 right-1 z-20 hidden rounded-lg border bg-white p-1 text-xs shadow md:block">
                                  <button
                                    className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOfferGiveaway?.(s.id);
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
                                      className="w-56 rounded border px-2 py-1"
                                      onChange={(e) => {
                                        const targetId = e.target.value || "";
                                        if (!targetId) return;
                                        e.stopPropagation();
                                        onProposeTrade?.(s.id, targetId);
                                        setOpenShiftMenu(null);
                                      }}
                                    >
                                      <option value="">Select coworker shift�?�</option>
                                      {coworkerShifts
                                        .filter((sh) => {
                                          const same =
                                            sh.position_id === s.position_id;
                                          const cross =
                                            allowCrossPosition &&
                                            isQualified(
                                              currentUserId,
                                              sh.position_id
                                            ) &&
                                            isQualified(
                                              sh.user_id,
                                              s.position_id
                                            );
                                          return same || cross;
                                        })
                                        .map((sh) => (
                                          <option key={sh.id} value={sh.id}>
                                            {(userNameById[sh.user_id] || 'Unknown')} A� {fmtDateLabel(sh.starts_at)} A� {fmtTime(sh.starts_at)}�?"{fmtTime(sh.ends_at)} {positionsById[sh.position_id]?.name ? `A� ${positionsById[sh.position_id]?.name}` : ''}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                          </div>
                        ))}

                        <button
                          className="text-xs underline"
                          onClick={() => onCreate(emp.id, day)}
                        >
                          + add
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="border-l border-t p-2 text-right font-semibold">
                  {(() => {
                    const total = (shifts || [])
                      .filter(
                        (s) =>
                          s.user_id === emp.id &&
                          weekDays.some(
                            (d) =>
                              fmtDateLocal(d) === fmtDateLocal(s.starts_at)
                          )
                      )
                      .reduce(
                        (sum, s) =>
                          sum +
                          hoursBetween(
                            s.starts_at,
                            s.ends_at,
                            s.break_min
                          ),
                        0
                      );
                    return total.toFixed(2) + " h";
                  })()}
                </div>
              </React.Fragment>
            ))}

            {/* Totals row */}
            <div className="sticky left-0 z-10 border-t bg-gray-50 p-2 font-semibold">
              Totals
            </div>
            {weekDays.map((d) => (
              <div
                key={"totals" + String(d)}
                className="border-l border-t p-2 text-right font-semibold"
              >
                {(() => {
                  const key = fmtDateLocal(d);
                  const total = (shifts || [])
                    .filter((s) => fmtDateLocal(s.starts_at) === key)
                    .reduce(
                      (sum, s) =>
                        sum +
                        hoursBetween(
                          s.starts_at,
                          s.ends_at,
                          s.break_min
                        ),
                      0
                    );
                  return total.toFixed(2) + " h";
                })()}
              </div>
            ))}
            <div className="border-l border-t p-2 text-right font-semibold">
              {(() => {
                const total = (shifts || []).reduce(
                  (sum, s) =>
                    sum + hoursBetween(s.starts_at, s.ends_at, s.break_min),
                  0
                );
                return total.toFixed(2) + " h";
              })()}
            </div>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end bg-gradient-to-l from-white/90 to-transparent sm:hidden">
        <span className="pr-1 text-[10px] font-medium text-gray-400">?</span>
      </div>
    </div>
  );
}
