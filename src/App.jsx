import React, { useEffect, useMemo, useState, createContext, useContext } from "react";



import { useRouter, parseRoute } from "./router.jsx";

// Error boundary to avoid blank screen and show runtime errors
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { try { console.error('App error:', error, info); } catch(_) {} }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      const msg = String(err && (err.stack || err.message || err));
      return (
        <div style={{ padding: 16, fontFamily: 'system-ui' }}>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff7ed', border: '1px solid #fed7aa', padding: 12, borderRadius: 12 }}>{msg}</pre>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('shiftmate_v2');
                  localStorage.removeItem('shiftmate_current_user');
                  localStorage.removeItem('shiftmate_schedule_view');
                  location.reload();
                } catch (e) { console.warn(e); }
              }}
              style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#111827', color: '#fff' }}
            >
              Clear Storage & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}const PrintCSS = () => (
  <style>{` ... `}</style>
);


/**
 * ShiftMate â€“ safe build + updates per new spec
 * - Prev/Next week controls (respect custom work-week start)
 * - Unavailability: override with warning (confirm). Employees can edit; Managers can toggle in Settings.
 * - Time off: pending/approved chips on Schedule; scheduling over time off shows warning (confirm).
 * - Newsfeed: only Managers/Owners can post by default; toggle in Settings to allow employees.
 * - Tasks: task templates for Managers/Owners; create tasks from templates; quick task creation in Shift modal.
 * - Requests: its own tab for Managers/Owners (time-off approvals). Positions moved under Settings.
 * - Messages: simple DMs.
 * - NEW: Work-week start day configurable in Settings (applies to week picker & grid) + prev/next week buttons.
 * - NEW: Add Employee fields â€“ phone, birthday, pronouns (optional), emergency contact, attachments (metadata only in demo), notes.
 * - NEW: Manager quick inputs (under Schedule): add Time Off & Weekly Unavailability; full lists remain in Requests/Unavailability tabs.
 *
 * This file is a complete, runnable React single-file app for the canvas preview.
 */

// ---------- constants ----------
const WEEK_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ---------- date utils (safe) ----------
const safeDate = (v) => {
  if (v instanceof Date) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const s = String(v || "");
  // If it's a plain YYYY-MM-DD string, parse as local (not UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
};

const addDays = (d, n) => { const x = safeDate(d); const y = new Date(x); y.setDate(y.getDate() + n); return y; };

const startOfWeek = (d, weekStartsOn = 1) => {
  const date = safeDate(d);
  const day = date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const fmtDate = (d) => safeDate(d).toISOString().slice(0, 10); // YYYY-MM-DD (UTC-based)

// Local YYYY-MM-DD (no UTC shift)
const fmtDateLocal = (v) => {
  const d = safeDate(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fmtTime = (d) => safeDate(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDateLabel = (d) => safeDate(d).toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });

// ---------- utilities ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date();

// Deterministic color accents by position id
const POSITION_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#e879f9", // fuchsia-400
  "#22d3ee", // sky-400
  "#fb7185", // rose-400
];
const colorForPosition = (positionId = "") => {
  let hash = 0;
  const s = String(positionId);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return POSITION_COLORS[hash % POSITION_COLORS.length];
};

const roleColor = (role = "") => ({
  owner: "#e11d48",   // rose-600
  manager: "#0ea5e9", // sky-500
  employee: "#64748b" // slate-500
}[role] || "#6b7280");

// HH:MM from Date (local)
const toHHMM = (dt) => {
  const d = safeDate(dt);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};


const minutes = (hhmm) => {
  const [h, m] = String(hhmm || "00:00").split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
};

// Combine a calendar day (Date or YYYY-MM-DD) with an HH:MM time into a local Date
const combineDayAndTime = (day, hhmm) => {
  const base = safeDate(day);
  const [h, m] = String(hhmm || "00:00").split(":").map((n) => Number(n) || 0);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => Math.max(aStart, bStart) < Math.min(aEnd, bEnd);

const hoursBetween = (a, b, breakMin = 0) => Math.max(0, (safeDate(b) - safeDate(a) - (Number(breakMin) || 0) * 60000) / 3600000);

const download = (filename, text) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const isDateWithin = (dayISO, fromISO, toISO) => dayISO >= fromISO && dayISO <= toISO; // strings YYYY-MM-DD

// ---------- backend API helpers (schedules / shifts) ----------
const getAuthToken = () => {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("shiftmate_auth_token");
  } catch {
    return null;
  }
};

const isScheduleApiEnabled = () => typeof fetch === "function" && !!getAuthToken();

const scheduleApiRequest = async (path, options = {}) => {
  const token = getAuthToken();
  if (typeof fetch !== "function" || !token) {
    throw new Error("schedule_api_unavailable");
  }
  const res = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let errBody = null;
    try {
      errBody = await res.json();
    } catch (_) {
      // ignore
    }
    const msg = (errBody && (errBody.error || errBody.message)) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = errBody;
    throw err;
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
};

// ---------- demo storage ----------
const STORAGE_KEY = "shiftmate_v2";

const defaultFlags = () => ({
  unavailabilityEnabled: true,
  employeeEditUnavailability: true,
  showTimeOffOnSchedule: true,
  newsfeedEnabled: true,
  employeesCanPostToFeed: false,
  tasksEnabled: true,
  messagesEnabled: true,
  // Swap Shifts feature flags
  requireManagerApproval: true,
  swapCutoffHours: 12,
  allowCrossPosition: false,
  weekStartsOn: 1, // 0=Sun ... 6=Sat
});

const seedData = () => {
  const loc1 = { id: "loc1", name: "Main Shop" };
  const positions = [
    { id: uid(), location_id: loc1.id, name: "Scooper" },
    { id: uid(), location_id: loc1.id, name: "Shift Lead" },
    { id: uid(), location_id: loc1.id, name: "Manager" },
  ];
  const pByName = Object.fromEntries(positions.map(p => [p.name, p]));
  const users = [
    { id: uid(), location_id: loc1.id, full_name: "Manager Mike", email: "manager@demo.local", password: "demo", role: "manager", is_active: true, phone: "", birthday: "", pronouns: "", emergency_contact: { name: "", phone: "" }, attachments: [], notes: "" },
    { id: uid(), location_id: loc1.id, full_name: "Owner Olivia", email: "owner@demo.local", password: "demo", role: "owner", is_active: true, phone: "", birthday: "", pronouns: "", emergency_contact: { name: "", phone: "" }, attachments: [], notes: "" },
    { id: uid(), location_id: loc1.id, full_name: "Lily Adams", email: "lily@example.com", password: "demo", role: "employee", is_active: true, phone: "", birthday: "", pronouns: "she/her", emergency_contact: { name: "A. Adams", phone: "555-0102" }, attachments: [], notes: "" },
    { id: uid(), location_id: loc1.id, full_name: "Gavin Reed", email: "gavin@example.com", password: "demo", role: "employee", is_active: true, phone: "", birthday: "", pronouns: "he/him", emergency_contact: { name: "R. Reed", phone: "555-0103" }, attachments: [], notes: "" },
    { id: uid(), location_id: loc1.id, full_name: "Riley Brooks", email: "riley@example.com", password: "demo", role: "employee", is_active: true, phone: "", birthday: "", pronouns: "they/them", emergency_contact: { name: "K. Brooks", phone: "555-0104" }, attachments: [], notes: "" },
  ];
  const uByName = Object.fromEntries(users.map(u => [u.full_name, u]));
  const user_qualifications = [
    { id: uid(), user_id: uByName["Lily Adams"].id, position_id: pByName["Scooper"].id },
    { id: uid(), user_id: uByName["Gavin Reed"].id, position_id: pByName["Scooper"].id },
    { id: uid(), user_id: uByName["Riley Brooks"].id, position_id: pByName["Shift Lead"].id },
  ];
  return {
    locations: [loc1],
    positions,
    users,
    schedules: [],
    // Swap Shifts data (in-app demo storage)
    // NOTE: Today this request/offer model is frontend-only.
    // In the backend, the canonical tables are swap_offers / swap_claims;
    // this state will eventually be hydrated from the /api/swaps/* endpoints.
    swap_requests: [], // {id, shift_id, requester_id, type:'give'|'trade', status, message, created_at, expires_at}
    swap_offers: [],   // {id, request_id, offerer_id, offer_shift_id|null, status, created_at}
    swap_audit_logs: [], // {id, swap_id, kind:'request'|'offer', actor_id, action, meta, created_at}
    time_off_requests: [],
    unavailability: [], // {id, user_id, kind:'weekly'|'date', weekday?, date?, start_hhmm, end_hhmm, notes}
    availability_change_requests: [], // {id, user_id, pattern, note, created_at}
    news_posts: [], // {id, user_id, body, created_at}
    tasks: [], // {id, title, assigned_to, due_date, status:'open'|'done', created_by}
    task_templates: [], // {id, title}
    messages: [], // {id, from_user_id, to_user_id, body, created_at}
    user_qualifications,
    feature_flags: defaultFlags(),
  };
};

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw);
    if (!parsed.unavailability) parsed.unavailability = [];
    if (!parsed.time_off_requests) parsed.time_off_requests = [];
    if (!parsed.availability_change_requests) parsed.availability_change_requests = [];
    if (!parsed.news_posts) parsed.news_posts = [];
    if (!parsed.tasks) parsed.tasks = [];
    if (!parsed.task_templates) parsed.task_templates = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.feature_flags) parsed.feature_flags = defaultFlags();
    if (parsed.feature_flags.weekStartsOn == null) parsed.feature_flags.weekStartsOn = 1;
    // backfill swap fields and flags
    // NOTE: when wired to the backend, swap_requests/swap_offers here
    // will be replaced by data coming from swap_offers/swap_claims via /api/swaps/*
    if (!parsed.swap_requests) parsed.swap_requests = [];
    if (!parsed.swap_offers) parsed.swap_offers = [];
    if (!parsed.swap_audit_logs) parsed.swap_audit_logs = [];
    if (parsed.feature_flags.requireManagerApproval == null) parsed.feature_flags.requireManagerApproval = true;
    if (parsed.feature_flags.swapCutoffHours == null) parsed.feature_flags.swapCutoffHours = 12;
    if (parsed.feature_flags.allowCrossPosition == null) parsed.feature_flags.allowCrossPosition = false;
    // ensure schedules exists but treat as ephemeral (source of truth is backend)
    if (!parsed.schedules) parsed.schedules = [];
    // backfill user extra fields
    parsed.users = (parsed.users || []).map(u => ({
      phone: "", birthday: "", pronouns: "", emergency_contact: { name: "", phone: "" }, attachments: [], notes: "", ...u,
      emergency_contact: { name: "", phone: "", ...(u.emergency_contact||{}) }
    }));
    // backfill qualifications: default each user qualified for their location's positions
    if (!parsed.user_qualifications) parsed.user_qualifications = [];
    if ((parsed.user_qualifications||[]).length === 0) {
      const qual = [];
      const positionsByLoc = {};
      for (const p of (parsed.positions||[])) {
        if (!positionsByLoc[p.location_id]) positionsByLoc[p.location_id] = [];
        positionsByLoc[p.location_id].push(p);
      }
      for (const u of (parsed.users||[])) {
        for (const p of (positionsByLoc[u.location_id]||[])) {
          qual.push({ id: uid(), user_id: u.id, position_id: p.id });
        }
      }
      parsed.user_qualifications = qual;
    }
    return parsed;
  } catch (e) {
    console.error(e);
    return seedData();
  }
};

const saveData = (data) => {
  const { schedules, ...rest } = data || {};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
};

// ---------- small UI bits ----------
function Section({ title, right, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <div>{right}</div>
      </div>
      <div className="rounded-2xl border p-4 shadow-sm">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "default" }) {
  const toneCls = tone === "success" ? "text-green-700" : tone === "warn" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-gray-700";
  const bgCls = tone === "success" ? "bg-green-50 border-green-300" : tone === "warn" ? "bg-amber-50 border-amber-300" : tone === "danger" ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-300";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${bgCls} ${toneCls}`}>{children}</span>;
}

function Toolbar({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function TextInput({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border px-3 py-2"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <textarea value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="min-h-[80px] rounded-xl border px-3 py-2" />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border px-3 py-2">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange, hint }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} className="mt-1"/>
      <span>
        <span className="font-medium">{label}</span>
        {hint && <div className="text-xs text-gray-600">{hint}</div>}
      </span>
    </label>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined" || !document.body) return;
    const prev = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="rounded-xl border px-2 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="mt-4 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

// ---------- auth ----------
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children, data, setData }) {
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem("shiftmate_current_user") || null);
  const currentUser = data.users.find((u) => u.id === currentUserId) || null;

  const login = (email, password) => {
    const user = data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error("No account found");
    const pass = user.password || "demo";
    if (password !== pass) throw new Error("Wrong password");
    localStorage.setItem("shiftmate_current_user", user.id);
    setCurrentUserId(user.id);
    return user;
  };

  const logout = () => {
    localStorage.removeItem("shiftmate_current_user");
    setCurrentUserId(null);
  };

  const addUser = (payload, location_id = data.locations[0]?.id) => {
    const newUser = { id: uid(), location_id, role: "employee", is_active: true, password: "demo", attachments: [], ...payload };
    setData((d) => ({ ...d, users: [...d.users, newUser] }));
  };

  return <AuthCtx.Provider value={{ currentUser, login, logout, addUser }}>{children}</AuthCtx.Provider>;
}

// ---------- week grid ----------
function WeekGrid(props) {
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
  const userNameById = useMemo(() => Object.fromEntries((employees||[]).map(u => [u.id, u.full_name])), [employees]);
  const coworkerShifts = useMemo(() => (currentUserId ? (shifts||[]).filter(sh => sh.user_id !== currentUserId) : []), [shifts, currentUserId]);
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

  const cellPad = isDense ? 'p-1 min-h-[60px]' : 'p-2 min-h-24';
  const bubblePad = isDense ? 'px-2 py-1 text-xs' : 'px-2.5 py-2 text-sm';

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="w-full">
          <div className="grid grid-cols-[200px_repeat(7,1fr)_120px]">
          <div className="sticky left-0 top-0 z-20 bg-gray-50 p-2 font-semibold shadow-sm">Employee</div>
          {weekDays.map((d) => (
            <div key={String(d)} className="sticky top-0 z-10 bg-gray-50 p-2 text-center font-semibold shadow-sm">
              {fmtDateLabel(d)}
            </div>
          ))}
          <div className="sticky top-0 z-10 bg-gray-50 p-2 text-center font-semibold shadow-sm">Total</div>

          {employees.map((emp) => (
            <React.Fragment key={emp.id}>
              <div className="sticky left-0 z-10 border-t bg-white p-2 font-medium">
                {emp.full_name}
                <span
                  className="ml-2 align-middle text-[11px]"
                  style={{
                    border: `1px solid ${roleColor(emp.role)}`,
                    color: roleColor(emp.role),
                    padding: '2px 8px',
                    borderRadius: '9999px',
                  }}
                >
                  {emp.role}
                </span>
              </div>

              {weekDays.map((day) => {
                const dayKey = fmtDateLocal(day);

                const dayShifts = shifts.filter(
                  (s) => s.user_id === emp.id && fmtDateLocal(s.starts_at) === dayKey
                );

                const dayUnav = (byUserUnav[emp.id] || []).filter((ua) =>
                  ua.kind === "date" ? ua.date === dayKey : ua.weekday === day.getDay()
                );

                const dayTimeOff = (byUserTimeOff[emp.id] || []).filter((r) =>
                  isDateWithin(dayKey, r.date_from, r.date_to)
                );

                return (
                  <div
                    key={emp.id + dayKey}
                    className={`border-l border-t ${cellPad}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('text/plain');
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
                            Time off {r.date_from}â†’{r.date_to} ({r.status})
                            {r.notes ? ` â€¢ ${r.notes}` : ""}
                          </div>
                        ))}

                      {dayUnav.map((ua) => (
                        <div
                          key={ua.id}
                          className="rounded-xl border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                        >
                          Unavailable {ua.start_hhmm}â€“{ua.end_hhmm}
                          {ua.notes ? ` â€¢ ${ua.notes}` : ""}
                        </div>
                      ))}

                      {dayShifts.map((s) => (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
                          className={`group relative rounded-xl border border-gray-200 bg-white ${isDense ? 'px-2 py-1 text-xs' : 'px-2.5 py-2 text-sm'} shadow-sm transition hover:border-gray-300 hover:shadow-md`}
                          style={{ borderLeft: `4px solid ${colorForPosition(s.position_id)}` }}
                          onClick={() => {
                            if (showTileActions && currentUserId && s.user_id === currentUserId) {
                              setOpenShiftMenu((v) => (v === s.id ? null : s.id));
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">
                              {fmtTime(s.starts_at)} â€“ {fmtTime(s.ends_at)}
                            </div>
                            <div className="absolute right-1 top-1 hidden gap-1 md:flex md:opacity-0 md:transition md:duration-150 md:group-hover:opacity-100">
                              {onEdit && (
                                <button
                                  className="rounded border border-gray-200 bg-gray-50 p-1 hover:bg-gray-100"
                                  onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                                  aria-label="Edit shift"
                                  title="Edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-700">
                                    <path d="M12.316 2.434a1.5 1.5 0 0 1 2.122 0l3.128 3.128a1.5 1.5 0 0 1 0 2.122l-9.17 9.17a2 2 0 0 1-1.106.56l-3.89.557a.75.75 0 0 1-.852-.852l.558-3.89a2 2 0 0 1 .56-1.106l9.172-9.17Zm1.414 1.414L6.56 11.018a.5.5 0 0 0-.14.276l-.29 2.023 2.023-.29a.5.5 0 0 0 .276-.14l7.168-7.168-1.867-1.867Z"/>
                                  </svg>
                                </button>
                              )}
                              {onEdit && onDelete && (
                                <span className="text-gray-300">|</span>
                              )}
                              {onEdit && (
                                <button
                                  className="rounded border border-gray-200 bg-gray-50 p-1 hover:bg-gray-100"
                                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(s.id); }}
                                  aria-label="Duplicate shift"
                                  title="Duplicate"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-700">
                                    <path d="M7 4.5A1.5 1.5 0 0 1 8.5 3h6A1.5 1.5 0 0 1 16 4.5v6A1.5 1.5 0 0 1 14.5 12h-6A1.5 1.5 0 0 1 7 10.5v-6Zm-3 3A1.5 1.5 0 0 1 5.5 6h.5v7a2 2 0 0 0 2 2H15v.5A1.5 1.5 0 0 1 13.5 17h-6A1.5 1.5 0 0 1 6 15.5v-6Z"/>
                                  </svg>
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  className="rounded border border-gray-200 bg-gray-50 p-1 hover:bg-gray-100"
                                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                                  aria-label="Delete shift"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-700">
                                    <path fillRule="evenodd" d="M8.75 2A1.75 1.75 0 0 0 7 3.75V4H3.5a.75.75 0 0 0 0 1.5h.548l.862 10.341A2.25 2.25 0 0 0 7.154 18h5.692a2.25 2.25 0 0 0 2.244-2.159L15.952 5.5H16.5a.75.75 0 0 0 0-1.5H13v-.25A1.75 1.75 0 0 0 11.25 2h-2.5Zm1.75 2h-2.5v.25H10.5V4Zm-3.75 3a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7A.75.75 0 0 1 6.75 7Zm6.5 0a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-1.5 0v-7a.75.75 0 0 1 .75-.75Z" clipRule="evenodd"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Mobile overflow menu trigger */}
                          <button
                            className="absolute right-1 top-1 rounded p-1 md:hidden"
                            onClick={(e) => { e.stopPropagation(); setOpenShiftMenu((v) => (v === s.id ? null : s.id)); }}
                            aria-label="More actions"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-600">
                              <path d="M6 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                            </svg>
                          </button>

                          {/* Conflict indicators (day-level) */}
                          {(dayUnav.length > 0 || dayTimeOff.length > 0) && (
                            <div className="absolute left-1 top-1 flex gap-1 text-[10px]">
                              {dayUnav.length > 0 && <span className="rounded bg-red-100 px-1 text-red-700">UA</span>}
                              {dayTimeOff.length > 0 && <span className="rounded bg-amber-100 px-1 text-amber-700">TO</span>}
                            </div>
                          )}

                          <div className="mt-1">
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
                              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorForPosition(s.position_id) }} />
                              {positionsById[s.position_id]?.name || "?"}
                            </span>
                          </div>

                          {(swapIndicators[s.id]?.give || swapIndicators[s.id]?.trade) && (
                            <div className="pointer-events-none absolute right-1 top-1 flex gap-1 text-xs opacity-70">
                              {swapIndicators[s.id]?.give && <span title="Giveaway">Give</span>}
                              {swapIndicators[s.id]?.trade && <span title="Trade">Trade</span>}
                            </div>
                          )}

                          {/* Mobile overflow menu */}
                          {openShiftMenu === s.id && (
                            <div className="absolute right-1 top-6 z-20 rounded-lg border bg-white p-1 text-xs shadow md:hidden">
                              {onEdit && (
                                <button className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); onEdit(s); setOpenShiftMenu(null); }}>Edit</button>
                              )}
                              {onDuplicate && (
                                <button className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); onDuplicate(s.id); setOpenShiftMenu(null); }}>Duplicate</button>
                              )}
                              {onDelete && (
                                <button className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); onDelete(s.id); setOpenShiftMenu(null); }}>Delete</button>
                              )}
                            </div>
                          )}

                          {showTileActions && currentUserId && s.user_id === currentUserId && openShiftMenu === s.id && (
                            <div className="absolute bottom-1 right-1 z-20 rounded-lg border bg-white p-1 text-xs shadow hidden md:block">
                              <button
                                className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                                onClick={(e) => { e.stopPropagation(); onOfferGiveaway?.(s.id); setOpenShiftMenu(null); }}
                              >
                                Offer Giveaway
                              </button>
                              <div className="mt-1 grid gap-1">
                                <div className="px-2 text-[11px] text-gray-600">Propose Trade for:</div>
                                <select
                                  className="w-56 rounded border px-2 py-1"
                                  onChange={(e) => {
                                    const targetId = e.target.value || '';
                                    if (!targetId) return;
                                    e.stopPropagation();
                                    onProposeTrade?.(s.id, targetId);
                                    setOpenShiftMenu(null);
                                  }}
                                >
                                  <option value="">Select coworker shiftâ€¦</option>
                                  {coworkerShifts.filter((sh)=> {
                                    const same = sh.position_id === s.position_id;
                                    const cross = allowCrossPosition && isQualified(currentUserId, sh.position_id) && isQualified(sh.user_id, s.position_id);
                                    return same || cross;
                                  }).map((sh) => (
                                    <option key={sh.id} value={sh.id}>
                                      {(userNameById[sh.user_id] || 'Unknown')} Â· {fmtDateLabel(sh.starts_at)} Â· {fmtTime(sh.starts_at)}â€“{fmtTime(sh.ends_at)} {positionsById[sh.position_id]?.name ? `Â· ${positionsById[sh.position_id]?.name}` : ''}
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
                    .filter((s) => s.user_id === emp.id && weekDays.some((d) => fmtDateLocal(d) === fmtDateLocal(s.starts_at)))
                    .reduce((sum, s) => sum + hoursBetween(s.starts_at, s.ends_at, s.break_min), 0);
                  return total.toFixed(2) + ' h';
                })()}
              </div>
            </React.Fragment>
          ))}

          {/* Totals row */}
          <div className="sticky left-0 z-10 border-t bg-gray-50 p-2 font-semibold">Totals</div>
          {weekDays.map((d) => (
            <div key={'totals'+String(d)} className="border-l border-t p-2 text-right font-semibold">
              {(() => {
                const key = fmtDateLocal(d);
                const total = (shifts || [])
                  .filter((s) => fmtDateLocal(s.starts_at) === key)
                  .reduce((sum, s) => sum + hoursBetween(s.starts_at, s.ends_at, s.break_min), 0);
                return total.toFixed(2) + ' h';
              })()}
            </div>
          ))}
          <div className="border-l border-t p-2 text-right font-semibold">
            {(() => {
              const total = (shifts || [])
                .reduce((sum, s) => sum + hoursBetween(s.starts_at, s.ends_at, s.break_min), 0);
              return total.toFixed(2) + ' h';
            })()}
          </div>
        </div>
      </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end bg-gradient-to-l from-white/90 to-transparent sm:hidden">
        <span className="pr-1 text-[10px] font-medium text-gray-400">⇠</span>
      </div>
    </div>
  );
}

// ---------- main app ----------
export default function App() {
  const [data, setData] = useState(loadData);
  const [locationId, setLocationId] = useState("loc1");

  const defaultWeekStart = fmtDate(startOfWeek(today(), 1));
  const [weekStart, setWeekStart] = useState(defaultWeekStart);

  const [shiftModal, setShiftModal] = useState({ open: false, preUserId: null, preDay: null });
  const [dense, setDense] = useState(false);

  const location = data.locations.find((l) => l.id === locationId) || data.locations[0];
  const users = data.users.filter((u) => u.location_id === location.id && u.is_active);
  const positions = data.positions.filter((p) => p.location_id === location.id);
  const positionsById = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, p])), [positions]);

  // backfill arrays if old data
  useEffect(() => {
    setData((d) => ({
      ...d,
      unavailability: d.unavailability || [],
      news_posts: d.news_posts || [],
      tasks: d.tasks || [],
      task_templates: d.task_templates || [],
      messages: d.messages || [],
      feature_flags: d.feature_flags || defaultFlags(),
      users: (d.users||[]).map(u=> ({ phone: "", birthday: "", pronouns: "", emergency_contact: {name:"", phone:""}, attachments: [], notes: "", ...u, emergency_contact: {name:"", phone:"", ...(u.emergency_contact||{})} }))
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // normalize initial weekStart to settings
  useEffect(() => {
    const ws = (data.feature_flags || defaultFlags()).weekStartsOn ?? 1;
    setWeekStart((prev) => fmtDate(startOfWeek(prev, ws)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useMemo(
    () => (data.schedules || []).find((s) => s.location_id === location.id && s.week_start === weekStart),
    [data.schedules, location.id, weekStart]
  );
  const weekDays = useMemo(() => {
    const start = safeDate(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  useEffect(() => { saveData(data); }, [data]);

  const ensureSchedule = async () => {
    if (schedule) return schedule;

    const useApi = isScheduleApiEnabled();
    const locId = location.id;
    const wk = weekStart;

    if (useApi) {
      try {
        const params = new URLSearchParams({ locationId: locId, weekStart: wk });
        try {
          const existing = await scheduleApiRequest(`/api/schedules?${params.toString()}`);
          if (existing && existing.schedule) {
            const sched = existing.schedule;
            setData((d) => {
              const current = d.schedules || [];
              const filtered = current.filter((s) => s.id !== sched.id);
              return { ...d, schedules: [...filtered, sched] };
            });
            return sched;
          }
        } catch (err) {
          if (!(err && err.status === 404)) {
            // eslint-disable-next-line no-console
            console.warn('ensureSchedule load error', err);
          }
        }

        const created = await scheduleApiRequest('/api/schedules', {
          method: 'POST',
          body: { locationId: locId, weekStart: wk },
        });
        if (created && created.schedule) {
          const sched = created.schedule;
          setData((d) => ({
            ...d,
            schedules: [...(d.schedules || []), sched],
          }));
          return sched;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('ensureSchedule API failed, falling back to local schedule', err);
      }
    }

    const newSched = { id: uid(), location_id: locId, week_start: wk, status: "draft", shifts: [] };
    setData((d) => ({ ...d, schedules: [...(d.schedules || []), newSched] }));
    return newSched;
  };

  const upsertSchedule = (updater) => {
    setData((d) => {
      const list = d.schedules || [];
      return {
        ...d,
        schedules: list.map((s) =>
          s.location_id === location.id && s.week_start === weekStart ? updater(s) : s
        ),
      };
    });
  };

  // ----- Unavailability helpers -----
  const findUnavailabilityFor = (user_id, day) => {
    const dayKey = fmtDate(day);
    const dow = safeDate(day).getDay();
    return (data.unavailability || []).filter((ua) => ua.user_id === user_id && (
      (ua.kind === 'date' && ua.date === dayKey) || (ua.kind === 'weekly' && ua.weekday === dow)
    ));
  };

  // Auto-ensure schedule whenever week or location changes
  useEffect(() => {
    if (!schedule) {
      // fire-and-forget; errors are handled inside ensureSchedule
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ensureSchedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.id, weekStart, schedule]);

  const hasUnavailabilityConflict = (user_id, day, start_hhmm, end_hhmm) => {
    const aStart = minutes(start_hhmm);
    const aEnd = minutes(end_hhmm);
    if (!(aEnd > aStart)) return [];
    const matches = findUnavailabilityFor(user_id, day);
    return matches.filter((ua) => rangesOverlap(aStart, aEnd, minutes(ua.start_hhmm), minutes(ua.end_hhmm)));
  };

  // ----- Time off helpers -----
  const findTimeOffForDay = (user_id, day) => {
    const dISO = fmtDate(day);
    return (data.time_off_requests || []).filter(r => r.user_id === user_id && isDateWithin(dISO, r.date_from, r.date_to));
  };

  const hasTimeOffConflict = (user_id, day) => {
    const matches = findTimeOffForDay(user_id, day).filter(r => r.status === 'pending' || r.status === 'approved');
    return matches;
  };

  const addUnavailability = async (ua) => {
    const startM = minutes(ua.start_hhmm), endM = minutes(ua.end_hhmm);
    if (!(endM > startM)) { alert('End time must be after start time.'); return; }

    const useApi = isScheduleApiEnabled();
    // For now, only weekly rows are persisted to the backend.
    if (useApi && ua.kind === 'weekly') {
      try {
        const payload = {
          user_id: ua.user_id,
          weekday: ua.weekday,
          start_hhmm: ua.start_hhmm,
          end_hhmm: ua.end_hhmm,
          notes: ua.notes || '',
        };
        const res = await scheduleApiRequest('/api/availability', {
          method: 'POST',
          body: payload,
        });
        const row = res && res.row;
        if (row) {
          const mapped = {
            id: row.id,
            user_id: row.user_id,
            kind: 'weekly',
            weekday: row.weekday,
            start_hhmm: row.start_hhmm,
            end_hhmm: row.end_hhmm,
            notes: row.notes || '',
          };
          setData((d) => ({
            ...d,
            unavailability: [mapped, ...(d.unavailability || [])],
          }));
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('addUnavailability API failed, falling back to local', err);
      }
    }

    setData((d) => ({
      ...d,
      unavailability: [{ id: uid(), ...ua }, ...(d.unavailability || [])],
    }));
  };

  const updateUnavailability = async (ua) => {
    const useApi = isScheduleApiEnabled();
    if (useApi && ua.kind === 'weekly' && ua.id) {
      try {
        const payload = {
          weekday: ua.weekday,
          start_hhmm: ua.start_hhmm,
          end_hhmm: ua.end_hhmm,
          notes: ua.notes || '',
        };
        const res = await scheduleApiRequest(`/api/availability/${encodeURIComponent(ua.id)}`, {
          method: 'PATCH',
          body: payload,
        });
        const row = res && res.row;
        if (row) {
          const mapped = {
            id: row.id,
            user_id: row.user_id,
            kind: 'weekly',
            weekday: row.weekday,
            start_hhmm: row.start_hhmm,
            end_hhmm: row.end_hhmm,
            notes: row.notes || '',
          };
          setData((d) => ({
            ...d,
            unavailability: (d.unavailability || []).map((x) =>
              x.id === ua.id ? mapped : x
            ),
          }));
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('updateUnavailability API failed, falling back to local', err);
      }
    }

    setData((d) => ({
      ...d,
      unavailability: (d.unavailability || []).map((x) =>
        x.id === ua.id ? { ...x, ...ua } : x
      ),
    }));
  };

  const deleteUnavailability = async (id) => {
    const useApi = isScheduleApiEnabled();
    if (useApi && id) {
      try {
        await scheduleApiRequest(`/api/availability/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('deleteUnavailability API failed, falling back to local', err);
      }
    }

    setData((d) => ({
      ...d,
      unavailability: (d.unavailability || []).filter((x) => x.id !== id),
    }));
  };

  // NOTE: we cannot safely destructure useAuth here because App is *outside* the provider.
  // Use a null-guarded lookup for the current user id when creating quick tasks.
  const auth = useAuth();
  const currentUserId = auth?.currentUser?.id || null;
  const currentUserRole = auth?.currentUser?.role || 'employee';

  const createShift = async ({ user_id, position_id, day, start_hhmm, end_hhmm, break_min, notes, quickTaskTitle, quickTaskTemplateId }) => {
    // Basic time validation
    const startM = minutes(start_hhmm), endM = minutes(end_hhmm);
    if (!(endM > startM)) { alert('End time must be after start time.'); return; }
    // Unavailability override with confirm
    const conflicts = hasUnavailabilityConflict(user_id, day, start_hhmm, end_hhmm);
    if (conflicts.length) {
      const lines = conflicts.slice(0, 3).map((c) => `${c.kind === 'weekly' ? 'Weekly' : c.date}: ${c.start_hhmm}â€“${c.end_hhmm}${c.notes ? ' â€¢ ' + c.notes : ''}`).join('\n');
      const ok = confirm(`This shift overlaps with unavailability:\n${lines}\n\nSchedule anyway?`);
      if (!ok) return;
    }
    // Timeâ€‘off warning with confirm
    const timeOffMatches = hasTimeOffConflict(user_id, day);
    if (timeOffMatches.length) {
      const lines = timeOffMatches.slice(0, 3).map((r)=> `${r.date_from}â†’${r.date_to} (${r.status})${r.notes ? ' â€¢ ' + r.notes : ''}`).join('\n');
      const ok = confirm(`This shift falls during time off:\n${lines}\n\nSchedule anyway?`);
      if (!ok) return;
    }

    const starts = combineDayAndTime(day, start_hhmm);
    const ends = combineDayAndTime(day, end_hhmm);
    const baseShift = {
      position_id,
      user_id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      break_min: Number(break_min || 0),
      notes: notes || "",
    };

    let createdShift = { id: uid(), ...baseShift };
    const useApi = isScheduleApiEnabled();

    if (useApi) {
      try {
        const sched = schedule || await ensureSchedule();
        const res = await scheduleApiRequest('/api/shifts', {
          method: 'POST',
          body: { ...baseShift, scheduleId: sched.id },
        });
        if (res && res.shift) {
          createdShift = res.shift;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('createShift API error, falling back to local state only', err);
        if (!schedule) {
          await ensureSchedule();
        }
      }
    } else {
      if (!schedule) {
        await ensureSchedule();
      }
    }

    setData((d) => {
      const list = d.schedules || [];
      return {
        ...d,
        schedules: list.map((s) => {
          if (s.location_id === location.id && s.week_start === weekStart) {
            return { ...s, shifts: [...(s.shifts || []), createdShift] };
          }
          return s;
        }),
      };
    });

    // Optional quick task creation
    if (quickTaskTemplateId) {
      const template = data.task_templates.find(t=> t.id===quickTaskTemplateId);
      if (template) addTask(template.title, user_id, fmtDate(day), currentUserId || user_id);
    } else if (quickTaskTitle && quickTaskTitle.trim()) {
      addTask(quickTaskTitle.trim(), user_id, fmtDate(day), currentUserId || user_id);
    }
  };

  const deleteShift = async (shiftId) => {
    if (!schedule) return;
    const useApi = isScheduleApiEnabled();
    if (useApi) {
      try {
        await scheduleApiRequest(`/api/shifts/${encodeURIComponent(shiftId)}`, { method: 'DELETE' });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('deleteShift API error, applying local state only', err);
      }
    }
    upsertSchedule((s) => ({ ...s, shifts: (s.shifts || []).filter((x) => x.id !== shiftId) }));
  };

  const updateShift = async ({ id, user_id, position_id, day, start_hhmm, end_hhmm, break_min, notes }) => {
    if (!schedule) return;
    const startM = minutes(start_hhmm), endM = minutes(end_hhmm);
    if (!(endM > startM)) { alert('End time must be after start time.'); return; }
    const conflicts = hasUnavailabilityConflict(user_id, day, start_hhmm, end_hhmm);
    if (conflicts.length) {
      const lines = conflicts.slice(0, 3).map((c) => (c.kind === 'weekly' ? 'Weekly' : c.date) + ': ' + (c.start_hhmm ?? '') + 'â€“' + (c.end_hhmm ?? '') + (c.notes ? ' â€¢ ' + c.notes : '')).join('\n');
      const ok = confirm(`This shift overlaps with unavailability:\n${lines}\n\nSave anyway?`);
      if (!ok) return;
    }
    const timeOffMatches = hasTimeOffConflict(user_id, day);
    if (timeOffMatches.length) {
      const lines = timeOffMatches.slice(0, 3).map((r)=> r.date_from + 'â†’' + r.date_to + ' (' + r.status + ')' + (r.notes ? ' â€¢ ' + r.notes : '')).join('\n');
      const ok = confirm(`This shift falls during time off:\n${lines}\n\nSave anyway?`);
      if (!ok) return;
    }
    const starts = combineDayAndTime(day, start_hhmm);
    const ends = combineDayAndTime(day, end_hhmm);
    const baseUpdate = {
      user_id,
      position_id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      break_min: Number(break_min || 0),
      notes: notes || '',
    };

    let updatedShift = { id, ...baseUpdate };
    const useApi = isScheduleApiEnabled();

    if (useApi) {
      try {
        const res = await scheduleApiRequest(`/api/shifts/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: baseUpdate,
        });
        if (res && res.shift) {
          updatedShift = res.shift;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('updateShift API error, updating local state only', err);
      }
    }

    upsertSchedule((s) => ({
      ...s,
      shifts: (s.shifts || []).map((sh) => (sh.id === id ? { ...sh, ...updatedShift } : sh)),
    }));
  };
  // Rename to avoid any chance of free-global lookups in prod bundles
  const handleDuplicateShift = (shiftId) => {
    if (!schedule) return;
    const s = schedule.shifts.find((x) => x.id === shiftId);
    if (!s) return;
    const day = fmtDateLocal(s.starts_at);
    const start_hhmm = toHHMM(s.starts_at);
    const end_hhmm = toHHMM(s.ends_at);
    createShift({ user_id: s.user_id, position_id: s.position_id, day, start_hhmm, end_hhmm, break_min: s.break_min, notes: s.notes });
  };
  const moveShift = (shiftId, targetUserId, day) => {
    if (!schedule) return;
    const s = schedule.shifts.find((x) => x.id === shiftId);
    if (!s) return;
    const start_hhmm = toHHMM(s.starts_at);
    const end_hhmm = toHHMM(s.ends_at);
    updateShift({ id: s.id, user_id: targetUserId, position_id: s.position_id, day, start_hhmm, end_hhmm, break_min: s.break_min, notes: s.notes });
  };
  const publish = async () => {
    if (!schedule) return;
    const nextStatus = schedule.status === "draft" ? "published" : "draft";
    let updatedSchedule = { ...schedule, status: nextStatus };
    const useApi = isScheduleApiEnabled();

    if (useApi) {
      try {
        const res = await scheduleApiRequest(`/api/schedules/${encodeURIComponent(schedule.id)}`, {
          method: 'PATCH',
          body: { status: nextStatus },
        });
        if (res && res.schedule) {
          updatedSchedule = res.schedule;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('publish API error, toggling status locally only', err);
      }
    }

    setData((d) => ({
      ...d,
      schedules: (d.schedules || []).map((s) => (s.id === schedule.id ? { ...s, ...updatedSchedule } : s)),
    }));
  };

  const totalHoursByUser = useMemo(() => {
    const totals = Object.fromEntries(users.map((u) => [u.id, 0]));
    if (!schedule) return totals;
    for (const sh of schedule.shifts) totals[sh.user_id] = (totals[sh.user_id] || 0) + hoursBetween(sh.starts_at, sh.ends_at, sh.break_min);
    return totals;
  }, [schedule, users]);

  const totalHoursByDay = useMemo(() => {
    const totals = Object.fromEntries(weekDays.map((d) => [fmtDate(d), 0]));
    if (!schedule) return totals;
    for (const sh of schedule.shifts) {
      const key = fmtDate(sh.starts_at);
      totals[key] = (totals[key] || 0) + hoursBetween(sh.starts_at, sh.ends_at, sh.break_min);
    }
    return totals;
  }, [schedule, weekDays]);

  const exportCsv = () => {
    if (!schedule) return;
    const header = ["Week Start", "Status", "Employee", "Position", "Date", "Start", "End", "Break (min)", "Hours", "Notes"];
    const rows = [header];
    for (const sh of schedule.shifts) {
      const u = data.users.find((x) => x.id === sh.user_id);
      const p = positionsById[sh.position_id];
      rows.push([schedule.week_start, schedule.status, u?.full_name || "", p?.name || "", fmtDate(sh.starts_at), fmtTime(sh.starts_at), fmtTime(sh.ends_at), sh.break_min, hoursBetween(sh.starts_at, sh.ends_at, sh.break_min).toFixed(2), (sh.notes || "").replaceAll(",", ";")]);
    }
    const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
    download(`ShiftMate_${schedule.week_start}.csv`, csv);
  };

  const copyCsv = async () => {
    if (!schedule) return;
    const header = ["Employee", "Date", "Start", "End", "Break", "Role", "Hours"];
    const rows = [header];
    for (const sh of schedule.shifts) {
      const u = data.users.find((x) => x.id === sh.user_id);
      const p = positionsById[sh.position_id];
      rows.push([u?.full_name || "", fmtDate(sh.starts_at), fmtTime(sh.starts_at), fmtTime(sh.ends_at), sh.break_min, p?.name || "", hoursBetween(sh.starts_at, sh.ends_at, sh.break_min).toFixed(2)]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    try { await navigator.clipboard.writeText(csv); alert("CSV copied to clipboard"); }
    catch (e) { alert("Copy failed. Try Download instead."); }
  };

  const resetDemo = () => {
    if (!confirm("Reset demo data? This cannot be undone.")) return;
    const seeded = seedData();
    setData(seeded);
    setWeekStart(fmtDate(startOfWeek(today(), seeded.feature_flags.weekStartsOn)));
    localStorage.removeItem("shiftmate_current_user");
  };

  const createTimeOff = async ({ user_id, date_from, date_to, notes }) => {
    const useApi = isScheduleApiEnabled();
    if (useApi) {
      try {
        const body = {
          date_from,
          date_to,
          notes: notes || '',
        };
        // Managers/owners can create on behalf of another user.
        if (
          user_id &&
          currentUserId &&
          user_id !== currentUserId &&
          (currentUserRole === 'manager' || currentUserRole === 'owner')
        ) {
          body.user_id = user_id;
        }
        const res = await scheduleApiRequest('/api/time-off', {
          method: 'POST',
          body,
        });
        const row = res && res.request;
        if (row) {
          setData((d) => ({
            ...d,
            time_off_requests: [row, ...(d.time_off_requests || [])],
          }));
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('createTimeOff API failed, falling back to local', err);
      }
    }

    const req = {
      id: uid(),
      user_id,
      date_from,
      date_to,
      notes: notes || '',
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    setData((d) => ({
      ...d,
      time_off_requests: [req, ...(d.time_off_requests || [])],
    }));
  };

  const setTimeOffStatus = async (id, status) => {
    const useApi = isScheduleApiEnabled();
    if (useApi) {
      try {
        const res = await scheduleApiRequest(`/api/time-off/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status },
        });
        const row = res && res.request;
        if (row) {
          setData((d) => ({
            ...d,
            time_off_requests: (d.time_off_requests || []).map((r) =>
              r.id === id ? row : r
            ),
          }));
          return;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('setTimeOffStatus API failed, falling back to local', err);
      }
    }

    setData((d) => ({
      ...d,
      time_off_requests: (d.time_off_requests || []).map((r) =>
        r.id === id ? { ...r, status } : r
      ),
    }));
  };

  const addAvailabilityChangeRequest = (user_id, pattern, note) => {
    const trimmedPattern = String(pattern || '').trim();
    const trimmedNote = String(note || '').trim();
    if (!trimmedPattern && !trimmedNote) return;
    const row = {
      id: uid(),
      user_id,
      pattern: trimmedPattern,
      note: trimmedNote,
      created_at: new Date().toISOString(),
    };
    setData((d) => ({
      ...d,
      availability_change_requests: [row, ...(d.availability_change_requests || [])],
    }));
  };

  // Newsfeed
  const addPost = (user_id, body) => {
    const post = { id: uid(), user_id, body: body.trim(), created_at: new Date().toISOString() };
    if (!post.body) return;
    setData((d) => ({ ...d, news_posts: [post, ...d.news_posts] }));
  };

  // Tasks
  const addTask = (title, assigned_to, due_date, created_by) => {
    const t = { id: uid(), title: title.trim(), assigned_to, due_date, status: 'open', created_by };
    if (!t.title || !assigned_to) return alert('Task needs a title and assignee');
    setData((d) => ({ ...d, tasks: [t, ...d.tasks] }));
  };
  const setTaskStatus = (id, status) => setData((d)=> ({ ...d, tasks: d.tasks.map(t=> t.id===id ? { ...t, status } : t) }));
  const deleteTask = (id) => setData((d)=> ({ ...d, tasks: d.tasks.filter(t=> t.id!==id) }));

  // Task templates (manager/owner)
  const addTemplate = (title) => setData((d)=> ({ ...d, task_templates: [{ id: uid(), title: title.trim() }, ...d.task_templates] }));
  const deleteTemplate = (id) => setData((d)=> ({ ...d, task_templates: d.task_templates.filter(t=> t.id!==id) }));

  // Messages
  const sendMessage = (from_user_id, to_user_id, body) => {
    const m = { id: uid(), from_user_id, to_user_id, body: body.trim(), created_at: new Date().toISOString() };
    if (!m.body) return;
    setData((d)=> ({ ...d, messages: [...d.messages, m] }));
  };

  // Add employee (enhanced) â€“ used by form
  const addEmployee = (payload) => setData((d) => ({ ...d, users: [...d.users, { id: uid(), location_id: (d.locations[0]?.id||'loc1'), role: payload.role||'employee', is_active: true, password: 'demo', attachments: payload.attachments||[], ...payload }] }));

  return (
    <ErrorBoundary>
      <AuthProvider data={data} setData={setData}>
      <InnerApp
        data={data}
        setData={setData}
        locationId={locationId}
        setLocationId={setLocationId}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        users={users}
        positions={positions}
        positionsById={positionsById}
        weekDays={weekDays}
        schedule={schedule}
        ensureSchedule={ensureSchedule}
        createShift={createShift}
        updateShift={updateShift}
        deleteShift={deleteShift}
        handleDuplicateShift={handleDuplicateShift}
        moveShift={moveShift}
        publish={publish}
        totalHoursByUser={totalHoursByUser}
        totalHoursByDay={totalHoursByDay}
        copyCsv={copyCsv}
        exportCsv={exportCsv}
        resetDemo={resetDemo}
        shiftModal={shiftModal}
        setShiftModal={setShiftModal}
        addEmployee={addEmployee}
        addPosition={(name) => setData((d) => ({ ...d, positions: [...d.positions, { id: uid(), location_id: location.id, name }] }))}
        createTimeOff={createTimeOff}
        setTimeOffStatus={setTimeOffStatus}
        addAvailabilityChangeRequest={addAvailabilityChangeRequest}
        addUnavailability={addUnavailability}
        updateUnavailability={updateUnavailability}
        deleteUnavailability={deleteUnavailability}
        unavailability={data.unavailability || []}
        addPost={addPost}
        addTask={addTask}
        setTaskStatus={setTaskStatus}
        deleteTask={deleteTask}
        addTemplate={addTemplate}
        deleteTemplate={deleteTemplate}
        sendMessage={sendMessage}
        dense={dense}
        setDense={setDense}
      />
    </AuthProvider>
    </ErrorBoundary>
  );
}

function InnerApp(props) {
  const {
    data, setData, locationId, setLocationId, weekStart, setWeekStart,
    users, positions, positionsById, weekDays, schedule, ensureSchedule, createShift, updateShift, deleteShift,
    handleDuplicateShift, moveShift,
    publish, totalHoursByUser, totalHoursByDay, copyCsv, exportCsv, resetDemo, shiftModal, setShiftModal,
    addEmployee, addPosition, createTimeOff, setTimeOffStatus, addAvailabilityChangeRequest, addUnavailability, updateUnavailability, deleteUnavailability, unavailability,
    addPost, addTask, setTaskStatus, deleteTask, addTemplate, deleteTemplate, sendMessage,
    dense, setDense,
  } = props;
  const safeDense = !!dense;
  const { path, navigate } = useRouter();
  const { name: routeName, params: routeParams } = useMemo(() => parseRoute(path), [path]);
  const { currentUser, logout } = useAuth();
  // Schedule view toggle (persisted): 'my' or 'full'
  const SCHEDULE_VIEW_KEY = 'shiftmate_schedule_view';
  const [scheduleView, setScheduleView] = useState(() => localStorage.getItem(SCHEDULE_VIEW_KEY) || 'my');
  const canViewFullSchedule = currentUser && (currentUser.role === 'manager' || currentUser.role === 'owner');
  useEffect(() => { try { localStorage.setItem(SCHEDULE_VIEW_KEY, scheduleView); } catch {} }, [scheduleView]);
  // Requests sub-tab state
  const [requestsSubTab, setRequestsSubTab] = useState('timeoff');
  // Set default after login if not previously set
  useEffect(() => {
    if (!currentUser) return;
    const existing = localStorage.getItem(SCHEDULE_VIEW_KEY);
    if (!existing) setScheduleView(canViewFullSchedule ? 'full' : 'my');
  }, [currentUser, canViewFullSchedule]);

  // If the current user cannot see the full schedule, force view to "my"
  useEffect(() => {
    if (!canViewFullSchedule && scheduleView !== 'my') {
      setScheduleView('my');
    }
  }, [canViewFullSchedule, scheduleView]);

  const notAuthed = !currentUser;

  const flags = data.feature_flags || defaultFlags();
  const isManager = (currentUser?.role || 'employee') !== "employee";
  const scopedUsers = users;

  const activeTab = useMemo(() => {
    if (routeName === 'my') return 'schedule';
    if (['schedule','dashboard','employees','availability','feed','tasks','messages','requests','settings'].includes(routeName)) {
      return routeName;
    }
    return 'schedule';
  }, [routeName]);

  // Route-driven redirects and tab syncing
  useEffect(() => {
    if (!currentUser) {
      if (routeName !== 'login') {
        navigate('/login', { replace: true });
      }
      return;
    }
      if (routeName === 'login' || routeName === 'root' || routeName === 'unknown') {
        const role = currentUser.role || 'employee';
        if (role === 'employee') {
          navigate('/my', { replace: true });
        } else if (weekStart) {
          navigate(`/schedule/${weekStart}`, { replace: true });
        }
      }
  }, [currentUser, routeName, navigate, weekStart]);

  // Protect manager/owner-only routes
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role || 'employee';
    if (routeName === 'dashboard' && role === 'employee') {
      // Employees should not access the dashboard; send them to their default view
      navigate('/my', { replace: true });
    }
  }, [currentUser, routeName, navigate]);

  // Keep weekStart in sync with /schedule/:week
  useEffect(() => {
    if (routeName !== 'schedule') return;
    const weekParam = routeParams.week;
    if (weekParam && weekParam !== weekStart) {
      setWeekStart(weekParam);
    }
  }, [routeName, routeParams.week, weekStart, setWeekStart]);

  // When managers change the week, reflect it in the URL
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role || 'employee';
    if (role === 'employee') return;
    if (routeName === 'schedule') {
      const desired = `/schedule/${weekStart}`;
      if (desired !== path) {
        navigate(desired, { replace: true });
      }
    }
  }, [currentUser, routeName, weekStart, path, navigate]);

  // Hydrate time-off requests from backend when auth + API are available.
  useEffect(() => {
    const useApi = isScheduleApiEnabled();
    if (!useApi || !currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await scheduleApiRequest('/api/time-off');
        if (!cancelled && res && Array.isArray(res.data)) {
          setData((d) => ({ ...d, time_off_requests: res.data }));
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('time-off API error; keeping local state', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, setData]);

  // Hydrate weekly availability/unavailability from backend.
  useEffect(() => {
    const useApi = isScheduleApiEnabled();
    if (!useApi || !currentUser || !flags.unavailabilityEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (currentUser.role === 'employee') {
          params.set('userId', currentUser.id);
        }
        const qs = params.toString();
        const res = await scheduleApiRequest(`/api/availability${qs ? `?${qs}` : ''}`);
        if (!cancelled && res && Array.isArray(res.data)) {
          const rows = res.data.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            kind: 'weekly',
            weekday: r.weekday,
            start_hhmm: r.start_hhmm,
            end_hhmm: r.end_hhmm,
            notes: r.notes || '',
          }));
          setData((d) => ({ ...d, unavailability: rows }));
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('availability API error; keeping local state', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role, flags.unavailabilityEnabled, setData]);

  const shiftWeek = (delta) => setWeekStart((s) => fmtDate(startOfWeek(addDays(s, delta * 7), flags.weekStartsOn)));

  // ----- Swap Shifts: helpers, state, actions -----
  // This section currently manages a local request/offer model:
  // - swap_requests/swap_offers are UI-only arrays.
  // - In the backend, the canonical schema is swap_offers + swap_claims (see migrations and /api/swaps routes).
  // When the API is wired up, these helpers will call:
  // - POST /api/swaps/offers to create giveaway/trade offers for a shift.
  // - GET /api/swaps/my and /api/swaps/open to populate the manager/employee views.
  // - POST /api/swaps/:id/approve|deny|claim to apply, deny, or claim approved giveaways.
  const activeSwapStatuses = new Set(['open','offered','manager_pending']);
  const nowIso = () => new Date().toISOString();

  const [swapModal, setSwapModal] = useState({ open: false, shiftId: null });
  const [offerModal, setOfferModal] = useState({ open: false, requestId: null });

  const [editModal, setEditModal] = useState({ open: false, shift: null });
  // Build swap indicator map for tiles
  const swapIndicators = useMemo(() => {
    const map = {};
    for (const r of (data.swap_requests || [])) {
      if (!activeSwapStatuses.has(r.status)) continue;
      if (!map[r.shift_id]) map[r.shift_id] = {};
      if (r.type === 'give') map[r.shift_id].give = true;
      if (r.type === 'trade') {
        map[r.shift_id].trade = true;
        if (r.target_shift_id) {
          if (!map[r.target_shift_id]) map[r.target_shift_id] = {};
          map[r.target_shift_id].trade = true;
        }
      }
    }
    return map;
  }, [data.swap_requests]);

  // Tile action shortcuts
  const offerGiveawayFromTile = (shiftId) => {
    createSwapRequest({ shiftId, type: 'give' });
  };
  const proposeTradeFromTile = (shiftId, targetShiftId) => { if (!targetShiftId) return; createSwapRequest({ shiftId, type: 'trade', targetShiftId }); };

  const allShifts = useMemo(() => (data.schedules || []).flatMap(s => (s.shifts || []).map(sh => ({...sh, __schedule_id: s.id, __location_id: s.location_id }))), [data.schedules]);
  const findShiftById = (shiftId) => allShifts.find(s => s.id === shiftId) || null;
  const userFutureShifts = (userId) => allShifts.filter(s => s.user_id === userId && safeDate(s.starts_at) > new Date());
  const isWithinCutoff = (shift) => {
    const cutoffH = Number(flags.swapCutoffHours || 0);
    const diffH = (safeDate(shift.starts_at) - new Date()) / 3600000;
    return diffH >= cutoffH;
  };
  const overlapsAny = (userId, starts_at, ends_at, excludeShiftIds = []) => {
    const a = safeDate(starts_at).getTime();
    const b = safeDate(ends_at).getTime();
    for (const sh of allShifts) {
      if (sh.user_id !== userId) continue;
      if (excludeShiftIds.includes(sh.id)) continue;
      const x = safeDate(sh.starts_at).getTime();
      const y = safeDate(sh.ends_at).getTime();
      if (Math.max(a, x) < Math.min(b, y)) return true;
    }
    return false;
  };
  // Qualifications
  const isQualified = (userId, positionId) => (data.user_qualifications || []).some(q => q.user_id === userId && q.position_id === positionId);
  const tradeAllowed = (baseShift, otherShift, requesterId, offererId) => {
    if (baseShift.position_id === otherShift.position_id) return true;
    if (!flags.allowCrossPosition) return false;
    return isQualified(requesterId, otherShift.position_id) && isQualified(offererId, baseShift.position_id);
  };
  const coverAllowed = (offererId, baseShift) => isQualified(offererId, baseShift.position_id);

  const addAudit = (swap_id, kind, actor_id, action, meta = {}) => {
    const row = { id: uid(), swap_id, kind, actor_id, action, meta, created_at: nowIso() };
    setData((d) => ({ ...d, swap_audit_logs: [...d.swap_audit_logs, row] }));
  };

  const expireSwaps = () => {
    const now = new Date();
    setData((d) => ({
      ...d,
      swap_requests: d.swap_requests.map(r => {
        if ((r.status === 'open' || r.status === 'offered') && r.expires_at && safeDate(r.expires_at) <= now) {
          addAudit(r.id, 'request', currentUser.id, 'expire', { reason: 'expires_at passed' });
          return { ...r, status: 'expired' };
        }
        return r;
      })
    }));
  };

  useEffect(() => {
    if (!currentUser) return;
    expireSwaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const createSwapRequest = ({ shiftId, type, message, expiresAt, targetShiftId }) => {
    const shift = findShiftById(shiftId);
    if (!shift) return alert('Shift not found');
    if (shift.user_id !== currentUser.id) return alert('You can only request a swap for your own shift');
    if (!isWithinCutoff(shift)) return alert(`Swaps must be requested ${flags.swapCutoffHours}h before start`);
    // One active swap per shift
    const hasActive = (data.swap_requests || []).some(r => r.shift_id === shiftId && activeSwapStatuses.has(r.status));
    if (hasActive) return alert('This shift already has an active swap request');
    const req = { id: uid(), shift_id: shiftId, requester_id: currentUser.id, type, status: 'open', message: message || '', created_at: nowIso(), expires_at: expiresAt || null };
    if (type === 'trade' && targetShiftId) req.target_shift_id = targetShiftId;
    setData((d) => ({ ...d, swap_requests: [req, ...d.swap_requests] }));
    addAudit(req.id, 'request', currentUser.id, 'create', { type, message, target_shift_id: targetShiftId || null });
    setSwapModal({ open: false, shiftId: null });
  };

  const cancelSwapRequest = (requestId) => {
    const req = (data.swap_requests || []).find(r => r.id === requestId);
    if (!req) return;
    if (req.requester_id !== currentUser.id) return alert('Only the requester can cancel');
    if (!activeSwapStatuses.has(req.status)) return alert('Request is no longer active');
    setData((d) => ({ ...d, swap_requests: d.swap_requests.map(r => r.id===requestId ? { ...r, status: 'canceled' } : r) }));
    addAudit(req.id, 'request', currentUser.id, 'cancel', {});
  };

  const createSwapOffer = ({ requestId, offerShiftId = null }) => {
    const req = (data.swap_requests || []).find(r => r.id === requestId);
    if (!req) return alert('Request not found');
    if (!activeSwapStatuses.has(req.status)) return alert('Request is not open');
    const shift = findShiftById(req.shift_id);
    if (!shift) return alert('Base shift not found');
    if (currentUser.id === req.requester_id) return alert('You cannot offer on your own request');
    // eligibility checks
    if (!isWithinCutoff(shift)) return alert('Shift is within cutoff');
    if (!positionMatchesOrAllowed(shift.position_id, offerShiftId ? (findShiftById(offerShiftId)?.position_id) : shift.position_id)) return alert('Position mismatch (cross-train disabled)');
    // cover only must not overlap
    if (!offerShiftId && overlapsAny(currentUser.id, shift.starts_at, shift.ends_at, [])) return alert('Offer would overlap your existing shift');
    // trade: must provide offerShiftId
    if (req.type === 'trade') {
      if (!offerShiftId) return alert('Choose one of your shifts to trade');
      const myShift = findShiftById(offerShiftId);
      if (!myShift || myShift.user_id !== currentUser.id) return alert('Invalid trade shift');
      // Trade: position rules
      if (!tradeAllowed(shift, myShift, req.requester_id, currentUser.id)) return alert('Trade not allowed by cross-train/qualification rules');
      // After trade, neither employee should overlap
      const wouldRequesterOverlap = overlapsAny(req.requester_id, myShift.starts_at, myShift.ends_at, [req.shift_id]);
      const wouldOffererOverlap = overlapsAny(currentUser.id, shift.starts_at, shift.ends_at, [offerShiftId]);
      if (wouldRequesterOverlap || wouldOffererOverlap) return alert('Trade would create an overlap');
    }
    const offer = { id: uid(), request_id: requestId, offerer_id: currentUser.id, offer_shift_id: offerShiftId || null, status: 'proposed', created_at: nowIso() };
    setData((d) => ({ ...d, swap_offers: [offer, ...d.swap_offers], swap_requests: d.swap_requests.map(r => r.id===requestId ? { ...r, status: 'offered' } : r) }));
    addAudit(offer.id, 'offer', currentUser.id, 'offer', { offer_shift_id: offerShiftId });
    setOfferModal({ open: false, requestId: null });
  };

  const withdrawOffer = (offerId) => {
    const offer = (data.swap_offers||[]).find(o => o.id === offerId);
    if (!offer) return;
    if (offer.offerer_id !== currentUser.id) return alert('Only the offerer can withdraw');
    setData((d) => ({ ...d, swap_offers: d.swap_offers.map(o => o.id===offerId ? { ...o, status: 'withdrawn' } : o) }));
    addAudit(offer.id, 'offer', currentUser.id, 'withdraw', {});
  };

  const applySwap = (requestId, offerId) => {
    const req = (data.swap_requests || []).find(r => r.id === requestId);
    const offer = (data.swap_offers || []).find(o => o.id === offerId);
    if (!req || !offer) return alert('Missing items');
    const base = findShiftById(req.shift_id);
    if (!base) return alert('Base shift missing');
    // perform atomic adjustment in a single setData
    setData((d) => {
      const schedules = d.schedules.map(s => ({...s, shifts: [...s.shifts]}));
      const findMut = (sid) => {
        for (const s of schedules) {
          const i = s.shifts.findIndex(x => x.id===sid);
          if (i>=0) return { s, i };
        }
        return null;
      };
      const baseRef = findMut(req.shift_id);
      if (!baseRef) return d;
      if (req.type === 'give') {
        baseRef.s.shifts[baseRef.i] = { ...baseRef.s.shifts[baseRef.i], user_id: offer.offerer_id };
      } else {
        const otherRef = findMut(offer.offer_shift_id);
        if (!otherRef) return d;
        const a = baseRef.s.shifts[baseRef.i];
        const b = otherRef.s.shifts[otherRef.i];
        baseRef.s.shifts[baseRef.i] = { ...a, user_id: b.user_id };
        otherRef.s.shifts[otherRef.i] = { ...b, user_id: a.user_id };
      }
      return {
        ...d,
        schedules,
        swap_requests: d.swap_requests.map(r => r.id===requestId ? { ...r, status: 'approved' } : r),
        swap_offers: d.swap_offers.map(o => o.id===offerId ? { ...o, status: 'accepted' } : o)
      };
    });
    addAudit(requestId, 'request', currentUser.id, 'apply', { offer_id: offerId });
  };

  const acceptOffer = (offerId) => {
    const offer = (data.swap_offers||[]).find(o => o.id===offerId);
    if (!offer) return;
    const req = (data.swap_requests||[]).find(r => r.id===offer.request_id);
    if (!req) return;
    if (req.requester_id !== currentUser.id) return alert('Only the requester can accept');
    if (flags.requireManagerApproval) {
      setData((d)=> ({ ...d, swap_requests: d.swap_requests.map(r => r.id===req.id ? { ...r, status: 'manager_pending' } : r) }));
      addAudit(req.id, 'request', currentUser.id, 'accept', { offer_id: offerId, manager_pending: true });
    } else {
      addAudit(req.id, 'request', currentUser.id, 'accept', { offer_id: offerId, manager_pending: false });
      applySwap(req.id, offerId);
    }
  };

  const approveSwapRequest = (requestId) => {
    const req = (data.swap_requests||[]).find(r => r.id===requestId);
    if (!req) return;
    // pick first accepted or proposed offer? In manager_pending flow: requester accepted one; find that offer_id from audit trail.
    const accepted = (data.swap_offers||[]).find(o => o.request_id===requestId && o.status==='proposed');
    // If requester accepted, they didn't change offer status; rely on latest offer by actor.
    const lastAcceptedAudit = [...data.swap_audit_logs].reverse().find(a => a.kind==='request' && a.swap_id===requestId && a.action==='accept');
    const offerId = lastAcceptedAudit?.meta?.offer_id || accepted?.id;
    if (!offerId) return alert('No offer to approve');
    addAudit(requestId, 'request', currentUser.id, 'approve', { offer_id: offerId });
    applySwap(requestId, offerId);
  };

  const declineSwapRequest = (requestId) => {
    setData((d)=> ({ ...d, swap_requests: d.swap_requests.map(r => r.id===requestId ? { ...r, status: 'declined' } : r) }));
    addAudit(requestId, 'request', currentUser.id, 'decline', {});
  };

  return (notAuthed ? (
    <LoginPage
      onAfterLogin={(user) => {
        const role = user?.role || 'employee';
        if (role === 'employee') {
          navigate('/my', { replace: true });
        } else if (weekStart) {
          navigate(`/schedule/${weekStart}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }}
    />
  ) : (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <PrintCSS />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center rounded-2xl border bg-white p-2 shadow-sm">
            <div className="h-8 w-8 rounded-xl border" />
          </div>
          <div>
            <h1 className="text-2xl font-black">ShiftMate</h1>
            <div className="text-sm text-gray-600">{isManager ? "Manager Console" : "My Shifts"}</div>
          </div>
        </div>
        <Toolbar>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <span className="text-gray-600">Location</span>
            <select className="outline-none" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <span className="text-gray-600">Week</span>
            <button className="rounded-lg border px-2 py-1" title="Prev week" onClick={()=>shiftWeek(-1)}>â—€</button>
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(fmtDate(startOfWeek(e.target.value, flags.weekStartsOn)))} className="outline-none" />
            <button className="rounded-lg border px-2 py-1" title="Jump to current week" onClick={()=> setWeekStart(fmtDate(startOfWeek(today(), flags.weekStartsOn)))}>Today</button>
            <button className="rounded-lg border px-2 py-1" title="Next week" onClick={()=>shiftWeek(1)}>â–¶</button>
          </div>
          <label className="hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <input type="checkbox" checked={safeDense} onChange={(e)=> setDense && setDense(e.target.checked)} />
            Compact
          </label>
          <div className="rounded-xl border px-3 py-2 text-sm">{currentUser.full_name} <span className="text-gray-500">({currentUser.role})</span></div>
          <button className="rounded-xl border px-3 py-2 text-sm shadow-sm" onClick={logout}>Logout</button>
        </Toolbar>
      </header>

      <nav className="flex flex-wrap gap-2">
        {isManager && (<>
          <TabBtn id="schedule" tab={activeTab} label="Schedule" to={`/schedule/${weekStart}`} />
          <TabBtn id="dashboard" tab={activeTab} label="Dashboard" to="/dashboard" />
          <TabBtn id="employees" tab={activeTab} label="Employees" to="/employees" />
          {flags.unavailabilityEnabled && <TabBtn id="availability" tab={activeTab} label="Availability" to="/availability" />}
          {flags.newsfeedEnabled && <TabBtn id="feed" tab={activeTab} label="Feed" to="/feed" />}
          {flags.tasksEnabled && <TabBtn id="tasks" tab={activeTab} label="Tasks" to="/tasks" />}
          {flags.messagesEnabled && <TabBtn id="messages" tab={activeTab} label="Messages" to="/messages" />}
          <TabBtn id="requests" tab={activeTab} label={`Requests (${(data.time_off_requests||[]).filter(r=>r.status==='pending').length + (data.swap_requests||[]).filter(r=> ['open','offered','manager_pending'].includes(r.status)).length})`} to="/requests" />
          <TabBtn id="settings" tab={activeTab} label="Settings" to="/settings" />
        </>)}
        {!isManager && (<>
          <TabBtn id="schedule" tab={activeTab} label="Schedule" to="/my" />
          {flags.unavailabilityEnabled && <TabBtn id="availability" tab={activeTab} label="Availability" to="/availability" />}
          {flags.newsfeedEnabled && <TabBtn id="feed" tab={activeTab} label="Feed" to="/feed" />}
          {flags.tasksEnabled && <TabBtn id="tasks" tab={activeTab} label="Tasks" to="/tasks" />}
          {flags.messagesEnabled && <TabBtn id="messages" tab={activeTab} label="Messages" to="/messages" />}
          <TabBtn id="requests" tab={activeTab} label={`Requests (${(data.time_off_requests||[]).filter(r=>r.user_id===currentUser.id && r.status==='pending').length + (data.swap_requests||[]).filter(r=> r.requester_id===currentUser.id && !['approved','declined','canceled','expired'].includes(r.status)).length})`} to="/requests" />
        </>)}
      </nav>

      {isManager && activeTab === "dashboard" && (
        <Section title="Dashboard" right={<div className="text-sm text-gray-600">Location overview</div>}>
          <DashboardPanel data={data} users={users} currentUser={currentUser} />
        </Section>
      )}

      {isManager && activeTab === "schedule" && (
        <Section
          title={`Week of ${safeDate(weekStart).toLocaleDateString()}`}
          right={
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                {schedule ? (
                  <Pill>
                    Status: <span className={`ml-1 font-semibold ${schedule.status === "published" ? "text-green-700" : "text-amber-700"}`}>{schedule.status}</span>
                  </Pill>
                ) : (
                  <Pill>Draft (no schedule yet)</Pill>
                )}
                <div className="inline-flex rounded-full border p-1 text-xs">
                  <button
                    className={`px-3 py-1 rounded-full ${scheduleView === 'my' ? 'bg-black text-white' : ''}`}
                    onClick={() => setScheduleView('my')}
                  >
                    My Schedule
                  </button>
                  {canViewFullSchedule && (
                    <button
                      className={`px-3 py-1 rounded-full ${scheduleView === 'full' ? 'bg-black text-white' : ''}`}
                      onClick={() => setScheduleView('full')}
                    >
                      Full Schedule
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {scheduleView === 'my' ? 'Viewing: My Schedule' : 'Viewing: Full Schedule'}
              </div>
            </div>
          }
        >
          <div className="mt-3 mb-4 flex items-center justify-between gap-2 sm:hidden text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Week</span>
              <button className="rounded-lg border px-2 py-1" title="Previous week" onClick={() => shiftWeek(-1)}>‹</button>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(fmtDate(startOfWeek(e.target.value, flags.weekStartsOn)))}
                className="rounded-lg border px-2 py-1 text-sm"
              />
              <button className="rounded-lg border px-2 py-1" title="Next week" onClick={() => shiftWeek(1)}>›</button>
            </div>
            <button
              className="rounded-lg border px-2 py-1 text-sm"
              onClick={() => setWeekStart(fmtDate(startOfWeek(today(), flags.weekStartsOn)))}
            >
              Today
            </button>
          </div>
          {scopedUsers.length === 0 ? (
            <div className="text-sm text-gray-600">Add employees first.</div>
          ) : scheduleView === 'my' ? (
            <MyShifts
              currentUser={currentUser}
              schedule={schedule}
              weekDays={weekDays}
              positionsById={positionsById}
              users={users}
              swapIndicators={swapIndicators}
              onOfferGiveaway={offerGiveawayFromTile}
              onProposeTrade={proposeTradeFromTile}
            />
          ) : (
            <WeekGrid
              employees={scopedUsers}
              weekDays={weekDays}
              shifts={schedule?.shifts || []}
              positionsById={positionsById}
              unavailability={unavailability}
              timeOffList={data.time_off_requests}
              showTimeOffChips={flags.showTimeOffOnSchedule}
              onCreate={(userId, day) => setShiftModal({ open: true, preUserId: userId, preDay: day })}
              onDelete={deleteShift}
              onEdit={(sh) => setEditModal({ open: true, shift: sh })}
              swapIndicators={swapIndicators}
              allowCrossPosition={flags.allowCrossPosition}
              isQualified={isQualified}
              useDense={safeDense}
              onDuplicate={handleDuplicateShift}
              onMoveShift={moveShift}
            />
          )}

          {schedule && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border p-3">
                <h4 className="mb-2 font-semibold">Total hours by employee</h4>
                <ul className="space-y-1 text-sm">
                  {scopedUsers.map((u) => (
                    <li key={u.id} className="flex justify-between"><span>{u.full_name}</span><span className="tabular-nums">{(totalHoursByUser[u.id] || 0).toFixed(2)} h</span></li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border p-3">
                <h4 className="mb-2 font-semibold">Total hours by day</h4>
                <ul className="space-y-1 text-sm">
                  {weekDays.map((d) => (
                    <li key={String(d)} className="flex justify-between"><span>{fmtDateLabel(d)}</span><span className="tabular-nums">{(totalHoursByDay[fmtDate(d)] || 0).toFixed(2)} h</span></li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={!schedule} className={`rounded-xl border px-3 py-2 text-sm shadow-sm ${schedule?.status === "published" ? "bg-green-50" : ""}`} onClick={publish}>{schedule?.status === "published" ? "Unpublish" : "Publish"}</button>
            <button disabled={!schedule} className="rounded-xl border px-3 py-2 text-sm shadow-sm" onClick={copyCsv}>Copy CSV</button>
            <button disabled={!schedule} className="rounded-xl border px-3 py-2 text-sm shadow-sm" onClick={exportCsv}>Download CSV</button>
            <button className="rounded-xl border px-3 py-2 text-sm shadow-sm" onClick={resetDemo}>Reset Demo</button>
          </div>
          {/* Quick inputs removed per UX: keep grid focused on shifts */}
        </Section>
      )}

      {isManager && activeTab === "employees" && (
        <Section title="Employees">
          <div className="grid gap-4 md:grid-cols-[1fr,2fr]">
            <AddEmployeeForm onAdd={addEmployee} />
            <div>
              <h4 className="mb-2 font-semibold">Active employees</h4>
              <ul className="divide-y rounded-2xl border">
                {users.map((u) => (
                  <li key={u.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="font-medium">{u.full_name} {u.pronouns ? <span className="text-xs text-gray-500">({u.pronouns})</span> : null}</div>
                      <div className="text-xs text-gray-600">{u.email}{u.phone ? ` â€¢ ${u.phone}` : ''}{u.birthday ? ` â€¢ Birthday: ${u.birthday}` : ''}</div>
                      {u.emergency_contact?.name && (
                        <div className="text-xs text-gray-600">Emergency: {u.emergency_contact.name} {u.emergency_contact.phone ? `(${u.emergency_contact.phone})` : ''}</div>
                      )}
                      {u.notes && <div className="text-xs text-gray-600">Notes: {u.notes}</div>}
                      {(u.attachments||[]).length>0 && (
                        <div className="mt-1 text-xs text-gray-600">Attachments: {(u.attachments||[]).map(f=> f.name).join(', ')}</div>
                      )}
                    </div>
                    <Pill>{u.role}</Pill>
                  </li>
                ))}
                {users.length === 0 && <li className="p-3 text-sm text-gray-600">No employees yet.</li>}
              </ul>
            </div>
          </div>
        </Section>
      )}

      {isManager && flags.unavailabilityEnabled && activeTab === "availability" && (
        <Section title="Availability (all employees)">
          <UnavailabilityAdmin
            users={users}
            list={unavailability}
            onAdd={addUnavailability}
            onUpdate={updateUnavailability}
            onDelete={deleteUnavailability}
          />
        </Section>
      )}

      {!isManager && flags.unavailabilityEnabled && activeTab === "availability" && (
        <Section title="My Availability">
          <EmployeeAvailabilityView
            currentUser={currentUser}
            list={unavailability}
            onRequestChange={addAvailabilityChangeRequest}
          />
        </Section>
      )}

      {flags.newsfeedEnabled && activeTab === "feed" && (
        <Section title="Company feed">
          <NewsFeed users={users} currentUser={currentUser} posts={data.news_posts} onPost={(body)=>addPost(currentUser.id, body)} allowPost={isManager || data.feature_flags.employeesCanPostToFeed} />
        </Section>
      )}

      {flags.tasksEnabled && activeTab === "tasks" && (
        <Section title="Tasks">
          <TasksPanel users={users} currentUser={currentUser} tasks={data.tasks} templates={data.task_templates} onAdd={addTask} onSetStatus={setTaskStatus} onDelete={deleteTask} onAddTemplate={addTemplate} onDeleteTemplate={deleteTemplate} />
        </Section>
      )}

      {flags.messagesEnabled && activeTab === "messages" && (
        <Section title="Messages">
          <MessagesPanel users={users} currentUser={currentUser} messages={data.messages} onSend={sendMessage} />
        </Section>
      )}

      {isManager && activeTab === "requests-old" && (
        <Section title="Timeâ€‘off requests">
          <RequestsPanel users={users} list={data.time_off_requests} onSetStatus={setTimeOffStatus} />
        </Section>
      )}

      {isManager && activeTab === "requests-old" && (
        <Section title="Swap requests (queue)">
          <SwapQueuePanel
            requests={data.swap_requests}
            offers={data.swap_offers}
            users={users}
            findShiftById={(id)=> (data.schedules||[]).flatMap(s=> (s.shifts||[]).map(sh=> ({...sh, __location_id: s.location_id}))).find(x=>x.id===id)}
            onApprove={approveSwapRequest}
            onDecline={declineSwapRequest}
          />
        </Section>
      )}

      {!isManager && activeTab === "requests-old" && (
        <Section title="Swap Center">
          <EmployeeSwapsPanel
            data={data}
            users={users}
            currentUser={currentUser}
            positionsById={positionsById}
            findShiftById={(id)=> (data.schedules||[]).flatMap(s=> (s.shifts||[]).map(sh=> ({...sh, __location_id: s.location_id}))).find(x=>x.id===id)}
            onCreateRequest={(payload)=> createSwapRequest(payload)}
            onOfferCover={(requestId)=> createSwapOffer({ requestId, offerShiftId: null })}
            onOfferTrade={(requestId, offerShiftId)=> createSwapOffer({ requestId, offerShiftId })}
            onWithdrawOffer={withdrawOffer}
            onAcceptOffer={acceptOffer}
            onCancelRequest={cancelSwapRequest}
            flags={flags}
          />
        </Section>
      )}

      {!isManager && activeTab === "schedule" && (
        <Section
          title={`Week of ${safeDate(weekStart).toLocaleDateString()}`}
          right={
            <div className="flex flex-col items-end gap-1 text-xs">
              <div className="inline-flex rounded-full border p-1">
                <button
                  className={`px-3 py-1 rounded-full ${scheduleView === 'my' ? 'bg-black text-white' : ''}`}
                  onClick={() => setScheduleView('my')}
                >
                  My Schedule
                </button>
                {canViewFullSchedule && (
                  <button
                    className={`px-3 py-1 rounded-full ${scheduleView === 'full' ? 'bg-black text-white' : ''}`}
                    onClick={() => setScheduleView('full')}
                  >
                    Full Schedule
                  </button>
                )}
              </div>
              <div className="mt-1 text-gray-500">
                {scheduleView === 'my' ? 'Viewing: My Schedule' : 'Viewing: Full Schedule'}
              </div>
            </div>
          }
        >
          <div className="mt-3 mb-4 flex items-center justify-between gap-2 sm:hidden text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Week</span>
              <button className="rounded-lg border px-2 py-1" title="Previous week" onClick={() => shiftWeek(-1)}>‹</button>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(fmtDate(startOfWeek(e.target.value, flags.weekStartsOn)))}
                className="rounded-lg border px-2 py-1 text-sm"
              />
              <button className="rounded-lg border px-2 py-1" title="Next week" onClick={() => shiftWeek(1)}>›</button>
            </div>
            <button
              className="rounded-lg border px-2 py-1 text-sm"
              onClick={() => setWeekStart(fmtDate(startOfWeek(today(), flags.weekStartsOn)))}
            >
              Today
            </button>
          </div>
          {scheduleView==='my' || !canViewFullSchedule ? (
            <>
              <Pill tone={schedule?.status === 'published' ? 'success' : 'warn'}>{schedule ? schedule.status : 'no schedule yet'}</Pill>
              <div className="mt-3" />
              <MyShifts currentUser={currentUser} schedule={schedule} weekDays={weekDays} positionsById={positionsById} users={users} swapIndicators={swapIndicators} onOfferGiveaway={offerGiveawayFromTile} onProposeTrade={proposeTradeFromTile} />
            </>
          ) : (
            <WeekGrid
              employees={scopedUsers}
              weekDays={weekDays}
              shifts={schedule?.shifts || []}
              positionsById={positionsById}
              unavailability={unavailability}
              timeOffList={data.time_off_requests}
              showTimeOffChips={flags.showTimeOffOnSchedule}
              currentUserId={currentUser.id}
              showTileActions={true}
              swapIndicators={swapIndicators}
              onOfferGiveaway={offerGiveawayFromTile}
              onProposeTrade={proposeTradeFromTile}
              allowCrossPosition={flags.allowCrossPosition}
              isQualified={isQualified}
            />
          )}
        </Section>
      )}

      {activeTab === "requests" && (
        <Section title="Requests">
          {(() => {
            const pendingTO = (data.time_off_requests||[]).filter(r=> isManager ? r.status==='pending' : (r.user_id===currentUser.id && r.status==='pending')).length;
            const pendingSwaps = isManager
              ? (data.swap_requests||[]).filter(r=> ['open','offered','manager_pending'].includes(r.status)).length
              : (data.swap_requests||[]).filter(r=> r.requester_id===currentUser.id && !['approved','declined','canceled','expired'].includes(r.status)).length;
            const pendingAvailability = (data.availability_change_requests || []).filter(r =>
              isManager ? true : r.user_id === currentUser.id
            ).length;
            return (
              <div>
                <div className="mb-3 flex gap-2">
                  <TabBtn id="timeoff" tab={requestsSubTab} setTab={setRequestsSubTab} label={`Time Off (${pendingTO})`} />
                  <TabBtn id="swaps" tab={requestsSubTab} setTab={setRequestsSubTab} label={`Swaps (${pendingSwaps})`} />
                  <TabBtn id="availability" tab={requestsSubTab} setTab={setRequestsSubTab} label={`Availability (${pendingAvailability})`} />
                </div>
                {requestsSubTab === 'timeoff' && (
                  isManager
                    ? <RequestsPanel users={users} list={data.time_off_requests} onSetStatus={setTimeOffStatus} />
                    : (
                      <>
                        <TimeOffForm onSubmit={(vals) => createTimeOff({ user_id: currentUser.id, ...vals })} />
                        <MyTimeOffList data={data} currentUser={currentUser} />
                      </>
                    )
                )}
                {requestsSubTab === 'swaps' && (
                  isManager ? (
                    <SwapQueuePanel
                      requests={data.swap_requests}
                      offers={data.swap_offers}
                      users={users}
                      findShiftById={(id)=> (data.schedules||[]).flatMap(s=> (s.shifts||[]).map(sh=> ({...sh, __location_id: s.location_id}))).find(x=>x.id===id)}
                      onApprove={approveSwapRequest}
                      onDecline={declineSwapRequest}
                    />
                  ) : (
                    <EmployeeSwapsPanel
                      data={data}
                      users={users}
                      currentUser={currentUser}
                      positionsById={positionsById}
                      findShiftById={(id)=> (data.schedules||[]).flatMap(s=> (s.shifts||[]).map(sh=> ({...sh, __location_id: s.location_id}))).find(x=>x.id===id)}
                      onCreateRequest={(payload)=> createSwapRequest(payload)}
                      onOfferCover={(requestId)=> createSwapOffer({ requestId, offerShiftId: null })}
                      onOfferTrade={(requestId, offerShiftId)=> createSwapOffer({ requestId, offerShiftId })}
                      onWithdrawOffer={withdrawOffer}
                      onAcceptOffer={acceptOffer}
                      onCancelRequest={cancelSwapRequest}
                      flags={flags}
                    />
                  )
                )}
                {requestsSubTab === 'availability' && (
                  <AvailabilityChangeRequestsPanel
                    users={users}
                    currentUser={currentUser}
                    requests={data.availability_change_requests || []}
                  />
                )}
              </div>
            );
          })()}
        </Section>
      )}

      {activeTab === "settings" && (
        <Section title="Settings">
  <div className="space-y-6 text-sm">
    <div>
      <div className="font-semibold">Feature toggles</div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Checkbox label="Enable Unavailability" checked={flags.unavailabilityEnabled} onChange={(v)=> setData(d=> ({...d, feature_flags: { ...d.feature_flags, unavailabilityEnabled: v }}))} />
        <Checkbox label="Employees can edit their unavailability" checked={flags.employeeEditUnavailability} onChange={(v)=> setData(d=> ({...d, feature_flags: { ...d.feature_flags, employeeEditUnavailability: v }}))} />
        <Checkbox label="Show Time-off chips on Schedule" checked={flags.showTimeOffOnSchedule} onChange={(v)=> setData(d=> ({...d, feature_flags: { ...d.feature_flags, showTimeOffOnSchedule: v }}))} />
        <Checkbox label="Swap requires manager approval" checked={flags.requireManagerApproval} onChange={(v)=> setData(d=> ({...d, feature_flags: { ...d.feature_flags, requireManagerApproval: v }}))} />
        <Checkbox label="Allow cross-position swaps" checked={flags.allowCrossPosition} onChange={(v)=> setData(d=> ({...d, feature_flags: { ...d.feature_flags, allowCrossPosition: v }}))}/>
        <Select label="Work week starts on" value={flags.weekStartsOn} onChange={(v)=>{ const n = Number(v); setData(d=> ({...d, feature_flags: { ...d.feature_flags, weekStartsOn: n }})); setWeekStart(s=> fmtDate(startOfWeek(s, n))); }} options={WEEK_LABELS.map((w,i)=>({value:i,label:w}))} />
      </div>
    </div>
    <div>
      <div className="font-semibold">Qualifications</div>
      <div className="mt-2">
        <QualificationsEditor
          users={users}
          positions={positions}
          data={data}
          onToggle={(userId, positionId, enabled) => {
            setData(d => {
              const exists = (d.user_qualifications||[]).some(q=> q.user_id===userId && q.position_id===positionId);
              let next = d.user_qualifications||[];
              if (enabled && !exists) next = [...next, { id: uid(), user_id: userId, position_id: positionId }];
              if (!enabled && exists) next = next.filter(q=> !(q.user_id===userId && q.position_id===positionId));
              return { ...d, user_qualifications: next };
            });
          }}
        />
      </div>
    </div>
  </div>

            <div>
              <div className="font-semibold">Positions (roles)</div>
              <div className="grid gap-4 md:grid-cols-[1fr,2fr] mt-2">
                <AddPositionForm onAdd={addPosition} />
                <div>
                  <h4 className="mb-2 font-semibold">Current roles</h4>
                  <ul className="divide-y rounded-2xl border">
                    {positions.map((p) => (
                      <li key={p.id} className="flex items-center justify-between p-3">
                        <div className="font-medium">{p.name}</div>
                        <Pill>loc: {p.location_id}</Pill>
                      </li>
                    ))}
                    {positions.length === 0 && <li className="p-3 text-sm text-gray-600">No positions yet.</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold">Locations</div>
              <ul className="mt-1 list-disc pl-6">
                {data.locations.map((l) => (<li key={l.id}>{l.name} <span className="text-gray-500">(id: {l.id})</span></li>))}
              </ul>
            </div>

            <div className="rounded-xl bg-amber-50 p-3">
              <div className="font-semibold">How to use</div>
              <ol className="ml-4 list-decimal pl-2">
                <li>Add employees & positions.</li>
<li>Pick a week (uses your setting). A schedule is created automatically if missing.</li>
                <li>Create shifts via <b>+ add</b> in each employee/day cell.</li>
                <li>Use <b>Tasks</b> & <b>Feed</b> for daily ops.</li>
                <li>Export via <b>Copy</b> or <b>Download CSV</b>.</li>
              </ol>
            </div>

            {/* <SelfTestsPanel /> */}
        </Section>
      )}
      <ShiftUpdateModal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, shift: null })}
        shift={editModal.shift}
        users={users}
        positions={positions}
        onSave={updateShift}
      />

      <ShiftEditorModal
        open={shiftModal.open}
        onClose={() => setShiftModal({ open: false, preUserId: null, preDay: null })}
        users={users}
        positions={positions}
        defaultUserId={shiftModal.preUserId}
        defaultDay={shiftModal.preDay}
        onCreate={createShift}
        templates={data.task_templates}
        canQuickTask={true}
      />

      <footer className="py-8 text-center text-xs text-gray-500">Roleâ€‘based demo. Ready to connect to Express/Postgres & JWT for production.</footer>
    </div>
  ));
}

function TabBtn({ id, tab, setTab, label, to }) {
  const router = useRouter();
  const isActive = tab === id;
  const handleClick = () => {
    if (typeof setTab === 'function') {
      setTab(id);
    }
    if (to && router && typeof router.navigate === 'function') {
      router.navigate(to);
    }
  };
  return (
    <button onClick={handleClick} className={`rounded-full px-4 py-1 text-sm ${isActive ? "bg-black text-white" : "border"}`}>{label}</button>
  );
}

// ---------- forms & modals ----------
function AddEmployeeForm({ onAdd }) {
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [emName, setEmName] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [filesMeta, setFilesMeta] = useState([]);

  const onFiles = (fileList) => {
    const arr = Array.from(fileList || []).map(f => ({ id: uid(), name: f.name, size: f.size, type: f.type, lastModified: f.lastModified }));
    setFilesMeta(arr);
  };

  return (
    <div className="rounded-2xl border p-3">
      <h4 className="mb-2 font-semibold">Add employee</h4>
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput label="Full name" value={full_name} onChange={setName} placeholder="Jane Doe" />
        <TextInput label="Email" value={email} onChange={setEmail} placeholder="jane@example.com" />
        <Select label="Role" value={role} onChange={setRole} options={[{ value: "employee", label: "Employee" }, { value: "manager", label: "Manager" }, { value: "owner", label: "Owner" }]} />
        <TextInput label="Phone" value={phone} onChange={setPhone} placeholder="555-0123" />
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Birthday</span>
          <input type="date" value={birthday} onChange={(e)=>setBirthday(e.target.value)} className="rounded-xl border px-3 py-2"/>
        </label>
        <TextInput label="Pronouns (optional)" value={pronouns} onChange={setPronouns} placeholder="she/her" />
        <TextInput label="Emergency contact name" value={emName} onChange={setEmName} placeholder="Contact name" />
        <TextInput label="Emergency contact phone" value={emPhone} onChange={setEmPhone} placeholder="555-0456" />
        <label className="md:col-span-2 grid gap-1 text-sm">
          <span className="text-gray-600">Attachments (stored as metadata only in demo)</span>
          <input type="file" multiple onChange={(e)=>onFiles(e.target.files)} className="rounded-xl border px-3 py-2" />
          {filesMeta.length>0 && <div className="text-xs text-gray-600">{filesMeta.length} file(s): {filesMeta.map(f=>f.name).join(', ')}</div>}
        </label>
        <div className="md:col-span-2">
          <TextArea label="Notes" value={notes} onChange={setNotes} placeholder="Allergies, preferred shifts, etc." />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button className="rounded-xl border px-3 py-2 text-sm shadow-sm" onClick={() => { if (!full_name.trim()) return alert("Enter a name"); onAdd({ full_name: full_name.trim(), email: email.trim(), role, phone, birthday, pronouns, emergency_contact: { name: emName, phone: emPhone }, attachments: filesMeta, notes }); setName(""); setEmail(""); setRole("employee"); setPhone(""); setBirthday(""); setPronouns(""); setEmName(""); setEmPhone(""); setFilesMeta([]); setNotes(""); }}>Add</button>
      </div>
    </div>
  );
}

function AddPositionForm({ onAdd }) {
  const [name, setName] = useState("");
  return (
    <div className="rounded-2xl border p-3">
      <h4 className="mb-2 font-semibold">Add role/position</h4>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Name" value={name} onChange={setName} placeholder="Scooper" />
      </div>
      <div className="mt-3 flex justify-end">
        <button className="rounded-2xl border px-3 py-2 text-sm shadow-sm" onClick={() => { if (!name.trim()) return alert("Enter a name"); onAdd(name.trim()); setName(""); }}>Add</button>
      </div>
    </div>
  );
}

function ShiftEditorModal({ open, onClose, users, positions, defaultUserId, defaultDay, onCreate, templates, canQuickTask }) {
  const [userId, setUserId] = useState(defaultUserId || (users[0]?.id ?? ""));
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [day, setDay] = useState(defaultDay || startOfWeek(today(), 1));
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("22:00");
  const [breakMin, setBreakMin] = useState(0);
  const [notes, setNotes] = useState("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    if (defaultUserId) setUserId(defaultUserId);
    if (defaultDay) setDay(defaultDay);
  }, [defaultUserId, defaultDay, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add shift"
      footer={
        <>
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button className="rounded-xl border bg-black px-3 py-2 text-sm text-white" onClick={() => { if (!userId || !positionId) return alert("Pick employee & position"); onCreate({ user_id: userId, position_id: positionId, day, start_hhmm: start, end_hhmm: end, break_min: breakMin, notes, quickTaskTitle, quickTaskTemplateId: templateId }); setQuickTaskTitle(""); setTemplateId(""); onClose(); }}>Save shift</button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="Employee" value={userId} onChange={setUserId} options={users.map((u) => ({ value: u.id, label: u.full_name }))} />
        <Select label="Position" value={positionId} onChange={setPositionId} options={positions.map((p) => ({ value: p.id, label: p.name }))} />
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Day</span>
          <input type="date" value={fmtDate(day)} onChange={(e) => setDay(safeDate(e.target.value))} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Start time</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">End time</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Break (minutes)</span>
          <input type="number" min={0} step={5} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="md:col-span-2 grid gap-1 text-sm">
          <span className="text-gray-600">Notes (optional)</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
      </div>

      {canQuickTask && (
        <div className="mt-4 rounded-xl border p-3">
          <div className="mb-2 text-sm font-semibold">Optional: create a task for this shift</div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="From template" value={templateId} onChange={setTemplateId} options={[{ value: "", label: "(none)" }, ...(templates||[]).map(t=>({ value:t.id, label:t.title }))]} />
            <TextInput label="Or custom title" value={quickTaskTitle} onChange={setQuickTaskTitle} placeholder="Mop floor at close" />
          </div>
          <div className="mt-1 text-xs text-gray-600">Task will assign to the selected employee with due date = shift day.</div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Manager quick inputs ----------
function ManagerQuickTimeOff({ users, onSubmit }) {
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [from, setFrom] = useState(fmtDate(new Date()));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [notes, setNotes] = useState('');
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Select label="Employee" value={userId} onChange={setUserId} options={users.map(u=>({value:u.id,label:u.full_name}))} />
      <label className="grid gap-1 text-sm"><span className="text-gray-600">From</span><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
      <label className="grid gap-1 text-sm"><span className="text-gray-600">To</span><input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
      <TextInput label="Notes" value={notes} onChange={setNotes} placeholder="Optional" />
      <div className="md:col-span-2 flex justify-end"><button className="rounded-xl border px-3 py-2 text-sm" onClick={()=> onSubmit({ user_id: userId, date_from: from, date_to: to, notes })}>Submit</button></div>
    </div>
  );
}

function ManagerQuickUnavailability({ users, onSubmit }) {
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [notes, setNotes] = useState('');
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Select label="Employee" value={userId} onChange={setUserId} options={users.map(u=>({value:u.id,label:u.full_name}))} />
      <Select label="Weekday" value={weekday} onChange={(v)=>setWeekday(Number(v))} options={WEEK_LABELS.map((w,i)=>({value:i,label:w}))} />
      <label className="grid gap-1 text-sm"><span className="text-gray-600">Start</span><input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
      <label className="grid gap-1 text-sm"><span className="text-gray-600">End</span><input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
      <TextInput label="Notes" value={notes} onChange={setNotes} placeholder="Optional" />
      <div className="md:col-span-2 flex justify-end"><button className="rounded-xl border px-3 py-2 text-sm" onClick={()=> onSubmit({ user_id: userId, kind:'weekly', weekday: Number(weekday), start_hhmm: start, end_hhmm: end, notes })}>Add</button></div>
    </div>
  );
}

// ---------- auth + employee pages ----------
function LoginPage({ onAfterLogin }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("manager@demo.local");
  const [password, setPassword] = useState("demo");
  const [err, setErr] = useState("");

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center p-6">
      <div className="w-full rounded-2xl border p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-black">ShiftMate</h1>
        <div className="mb-4 text-gray-600">Sign in</div>
        {err && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        <div className="grid gap-3">
          <TextInput label="Email" value={email} onChange={setEmail} type="email" />
          <TextInput label="Password" value={password} onChange={setPassword} type="password" />
          <button className="mt-1 rounded-xl border bg-black px-3 py-2 text-sm font-medium text-white" onClick={() => { try { const u = login(email, password); onAfterLogin?.(u); } catch (e) { setErr(e.message || "Login failed"); } }}>Sign in</button>
        </div>
        <div className="mt-4 text-xs text-gray-600">
          Demo accounts:
          <ul className="list-disc pl-5">
            <li>Manager: <code>manager@demo.local</code> / <code>demo</code></li>
            <li>Employee: <code>lily@example.com</code> / <code>demo</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function MyShifts({ currentUser, schedule, weekDays, positionsById, users = [], swapIndicators = {}, onOfferGiveaway, onProposeTrade, allowCrossPosition = false, isQualified = () => true }) {
  const [remoteShifts, setRemoteShifts] = useState(null);
  const [openShiftMenu, setOpenShiftMenu] = useState(null);

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
        const res = await scheduleApiRequest(`/api/my/shifts?${params.toString()}`);
        if (!cancelled) {
          setRemoteShifts((res && res.data) || []);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('MyShifts API error, falling back to schedule prop', err);
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
    return (schedule?.shifts || []).filter((s) => s.user_id === currentUser.id);
  }, [remoteShifts, schedule?.shifts, currentUser?.id]);

  const byDay = useMemo(() => {
    const map = Object.fromEntries(weekDays.map((d) => [fmtDate(d), []]));
    for (const s of myShifts) {
      const k = fmtDate(s.starts_at);
      if (!map[k]) map[k] = [];
      map[k].push(s);
    }
    return map;
  }, [weekDays, myShifts]);

  const userNameById = useMemo(() => Object.fromEntries((users||[]).map(u => [u.id, u.full_name])), [users]);
  const coworkerShifts = useMemo(() => ((schedule?.shifts||[]).filter(sh => sh.user_id !== currentUser.id)), [schedule?.shifts, currentUser?.id]);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {weekDays.map((d) => (
        <div key={String(d)} className="rounded-2xl border p-3">
          <div className="mb-1 text-sm font-semibold">{fmtDateLabel(d)}</div>
          {(byDay[fmtDate(d)] || []).length === 0 ? (
            <div className="text-sm text-gray-600">No shift.</div>
          ) : (
            <ul className="space-y-2">
              {byDay[fmtDate(d)].map((s) => (
                <li
                  key={s.id}
                  className="relative rounded-xl border px-3 py-2 text-sm"
                  onClick={() => setOpenShiftMenu((v) => (v === s.id ? null : s.id))}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{fmtTime(s.starts_at)} â€“ {fmtTime(s.ends_at)}</div>
                  </div>
                            {positionsById[s.position_id]?.name || "?"}

                  {(swapIndicators[s.id]?.give || swapIndicators[s.id]?.trade) && (
                    <div className="pointer-events-none absolute right-1 top-1 flex gap-1 text-xs opacity-70">
                      {swapIndicators[s.id]?.give && <span title="Giveaway">Give</span>}
                      {swapIndicators[s.id]?.trade && <span title="Trade">Trade</span>}
                    </div>
                  )}

                  {openShiftMenu === s.id && (
                    <div className="absolute bottom-1 right-1 z-20 rounded-lg border bg-white p-1 text-xs shadow">
                      <button
                        className="block w-full rounded px-2 py-1 text-left hover:bg-gray-50"
                        onClick={(e) => { e.stopPropagation(); onOfferGiveaway?.(s.id); setOpenShiftMenu(null); }}
                      >
                        Offer Giveaway
                      </button>
                      <div className="mt-1 grid gap-1">
                        <div className="px-2 text-[11px] text-gray-600">Propose Trade for:</div>
                        <select
                          className="w-56 rounded border px-2 py-1"
                          onChange={(e) => {
                            const targetId = e.target.value || '';
                            if (!targetId) return;
                            e.stopPropagation();
                            onProposeTrade?.(s.id, targetId);
                            setOpenShiftMenu(null);
                          }}
                        >
                          <option value="">Select coworker shiftâ€¦</option>
                          {coworkerShifts.filter((sh)=>{
                            const same = sh.position_id === s.position_id;
                            const cross = allowCrossPosition && isQualified(currentUser.id, sh.position_id) && isQualified(sh.user_id, s.position_id);
                            return same || cross;
                          }).map((sh) => (
                            <option key={sh.id} value={sh.id}>
                              {(userNameById[sh.user_id] || 'Unknown')} Â· {fmtDateLabel(sh.starts_at)} Â· {fmtTime(sh.starts_at)}â€“{fmtTime(sh.ends_at)} {positionsById[sh.position_id]?.name ? `Â· ${positionsById[sh.position_id]?.name}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function TimeOffForm({ onSubmit }) {
  const [from, setFrom] = useState(fmtDate(new Date()));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [notes, setNotes] = useState("");
  return (
    <div className="mt-4 rounded-2xl border p-3">
      <h4 className="mb-2 font-semibold">Request time off</h4>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm md:col-span-1">
          <span className="text-gray-600">Notes</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => onSubmit({ date_from: from, date_to: to, notes })}>Submit</button>
      </div>
    </div>
  );
}

function MyUnavailabilityEditor({ currentUser, list, onAdd, onUpdate, onDelete }) {
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);

  const mine = useMemo(() => (list || []).filter(ua => ua.user_id === currentUser.id && ua.kind === 'weekly'), [list, currentUser?.id]);

  const save = () => {
    if (editingId) {
      onUpdate({ id: editingId, user_id: currentUser.id, kind: 'weekly', weekday: Number(weekday), start_hhmm: start, end_hhmm: end, notes });
      setEditingId(null);
    } else {
      onAdd({ user_id: currentUser.id, kind: 'weekly', weekday: Number(weekday), start_hhmm: start, end_hhmm: end, notes });
    }
    setNotes('');
  };

  const beginEdit = (ua) => { setEditingId(ua.id); setWeekday(Number(ua.weekday)); setStart(ua.start_hhmm); setEnd(ua.end_hhmm); setNotes(ua.notes || ''); };

  return (
    <div className="mt-4 rounded-2xl border p-3">
      <h4 className="mb-2 font-semibold">My weekly unavailability</h4>
      <div className="grid gap-3 md:grid-cols-3">
        <Select label="Weekday" value={weekday} onChange={(v)=>setWeekday(Number(v))} options={WEEK_LABELS.map((w,i)=>({value:i,label:w}))} />
        <label className="grid gap-1 text-sm"><span className="text-gray-600">Start</span><input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
        <label className="grid gap-1 text-sm"><span className="text-gray-600">End</span><input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
        <div className="md:col-span-3"><TextInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Class, commute, etc." /></div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {editingId && <button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>{ setEditingId(null); setNotes(''); }}>Cancel</button>}
        <button className="rounded-xl border px-3 py-2 text-sm" onClick={save}>{editingId ? 'Save' : 'Add'}</button>
      </div>
      <div className="mt-3">
        <ul className="divide-y rounded-2xl border">
          {mine.length === 0 && <li className="p-3 text-sm text-gray-600">No weekly unavailability yet.</li>}
          {mine.map((ua) => (
            <li key={ua.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <div className="font-medium">{WEEK_LABELS[ua.weekday]} {ua.start_hhmm}â€“{ua.end_hhmm}</div>
                {ua.notes && <div className="text-xs text-gray-600">{ua.notes}</div>}
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl border px-2 py-1" onClick={()=>beginEdit(ua)}>Edit</button>
                <button className="rounded-xl border px-2 py-1" onClick={()=>onDelete(ua.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Employee read-only availability with simple request form
function EmployeeAvailabilityView({ currentUser, list, onRequestChange }) {
  const mine = useMemo(() => (list || []).filter(ua => ua.user_id === currentUser.id && ua.kind === 'weekly'), [list, currentUser?.id]);
  const [note, setNote] = useState('');
  const [pattern, setPattern] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 font-semibold">Weekly availability</h4>
        <ul className="divide-y rounded-2xl border">
          {mine.length === 0 && <li className="p-3 text-sm text-gray-600">No weekly rows set.</li>}
          {mine.map(ua => (
            <li key={ua.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{WEEK_LABELS[ua.weekday]} {ua.start_hhmm} - {ua.end_hhmm}</div>
                {ua.notes && <div className="text-xs text-gray-600">{ua.notes}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Request change</h4>
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Preferred pattern (free text)</span>
            <input value={pattern} onChange={(e)=>setPattern(e.target.value)} placeholder="e.g., Mon-Thu 9-5" className="rounded-xl border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Note</span>
            <textarea value={note} onChange={(e)=>setNote(e.target.value)} className="min-h-20 rounded-xl border px-3 py-2" />
          </label>
          <button
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={() => {
              onRequestChange?.(currentUser.id, pattern, note);
              setNote('');
              setPattern('');
              setSubmitted(true);
            }}
          >
            Submit request
          </button>
          {submitted && (
            <div className="text-xs text-green-700">
              Request sent. Your manager will review and update your availability.
            </div>
          )}
          <div className="text-xs text-gray-600">Your manager will review and update canonical availability.</div>
        </div>
      </div>
    </div>
  );
}

function MyTimeOffList({ data, currentUser }) {
  const mine = data.time_off_requests.filter((r) => r.user_id === currentUser.id).sort((a,b)=> safeDate(b.created_at) - safeDate(a.created_at));
  if (mine.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border p-3">
      <h4 className="mb-2 font-semibold">My requests</h4>
      <ul className="divide-y">
        {mine.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              {r.date_from} â†’ {r.date_to} {r.notes ? `â€¢ ${r.notes}` : ""}
            </div>
            <Pill tone={r.status === "approved" ? "success" : r.status === "denied" ? "danger" : "warn"}>{r.status}</Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Unavailability (Manager/Owner) ----------
function UnavailabilityAdmin({ users, list, onAdd, onUpdate, onDelete }) {
  const [userId, setUserId] = useState(users[0]?.id || '');
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState(null); // ua

  const grouped = useMemo(() => {
    const m = {};
    for (const u of users) m[u.id] = [];
    for (const ua of list) if (m[ua.user_id]) m[ua.user_id].push(ua);
    return m;
  }, [users, list]);

  const save = () => {
    if (!userId) return alert('Pick an employee');
    if (editing) {
      onUpdate({ id: editing.id, user_id: userId, kind: 'weekly', weekday: Number(weekday), start_hhmm: start, end_hhmm: end, notes });
      setEditing(null);
    } else {
      onAdd({ user_id: userId, kind: 'weekly', weekday: Number(weekday), start_hhmm: start, end_hhmm: end, notes });
    }
    setNotes('');
  };

  const beginEdit = (ua) => { setEditing(ua); setUserId(ua.user_id); setWeekday(Number(ua.weekday)); setStart(ua.start_hhmm); setEnd(ua.end_hhmm); setNotes(ua.notes||''); };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr,2fr]">
      <div className="rounded-2xl border p-3">
        <h4 className="mb-2 font-semibold">{editing ? 'Edit' : 'Add'} weekly unavailability</h4>
        <Select label="Employee" value={userId || ''} onChange={setUserId} options={users.map(u=>({value:u.id,label:u.full_name}))} />
        <div className="mt-3 grid gap-3">
          <Select label="Weekday" value={weekday} onChange={(v)=>setWeekday(Number(v))} options={WEEK_LABELS.map((w,i)=>({value:i,label:w}))} />
          <label className="grid gap-1 text-sm"><span className="text-gray-600">Start</span><input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
          <label className="grid gap-1 text-sm"><span className="text-gray-600">End</span><input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
          <TextInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Class, commute, etc." />
          <div className="flex justify-end gap-2">
            {editing && <button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>setEditing(null)}>Cancel</button>}
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={save}>{editing ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Current unavailability (all)</h4>
        {users.map((u)=> (
          <div key={u.id} className="mb-4 rounded-2xl border">
            <div className="flex items-center justify-between p-3"><div className="font-medium">{u.full_name}</div></div>
            <ul className="divide-y">
              {(grouped[u.id]||[]).filter(ua=>ua.kind==='weekly').length===0 && <li className="p-3 text-sm text-gray-600">No entries.</li>}
              {(grouped[u.id]||[]).filter(ua=>ua.kind==='weekly').map((ua)=> (
                <li key={ua.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <div className="font-medium">{WEEK_LABELS[ua.weekday]} {ua.start_hhmm}â€“{ua.end_hhmm}</div>
                    {ua.notes && <div className="text-xs text-gray-600">{ua.notes}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-xl border px-2 py-1" onClick={()=>beginEdit(ua)}>Edit</button>
                    <button className="rounded-xl border px-2 py-1" onClick={()=>onDelete(ua.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- NewsFeed ----------
function NewsFeed({ users, currentUser, posts, onPost, allowPost }) {
  const [body, setBody] = useState("");
  const byId = useMemo(()=> Object.fromEntries(users.map(u=>[u.id,u])), [users]);
  return (
    <div className="space-y-4">
      {allowPost && (
        <div className="rounded-2xl border p-3">
          <TextInput label="Share an update" value={body} onChange={setBody} placeholder="Post an announcement..." />
          <div className="mt-2 flex justify-end">
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>{ onPost(body); setBody(""); }}>Post</button>
          </div>
        </div>
      )}
      <ul className="space-y-3">
        {posts.length===0 && <li className="rounded-2xl border p-3 text-sm text-gray-600">No posts yet.</li>}
        {posts.map(p=> (
          <li key={p.id} className="rounded-2xl border p-3">
            <div className="text-sm text-gray-500">{byId[p.user_id]?.full_name || 'Unknown'} â€¢ {new Date(p.created_at).toLocaleString()}</div>
            <div className="mt-1 whitespace-pre-wrap">{p.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Tasks ----------
function TasksPanel({ users, currentUser, tasks, templates, onAdd, onSetStatus, onDelete, onAddTemplate, onDeleteTemplate }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(currentUser.role==='employee' ? currentUser.id : (users[0]?.id||''));
  const [due, setDue] = useState(fmtDate(new Date()));
  const [newTpl, setNewTpl] = useState("");

  const mine = currentUser.role==='employee' ? tasks.filter(t=> t.assigned_to===currentUser.id) : tasks;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr,2fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border p-3">
          <h4 className="mb-2 font-semibold">Create task</h4>
          <div className="grid gap-3">
            <TextInput label="Title" value={title} onChange={setTitle} placeholder="Clean front counter" />
            {currentUser.role!=='employee' && <Select label="Assign to" value={assignee} onChange={setAssignee} options={users.map(u=>({value:u.id,label:u.full_name}))} />}
            <label className="grid gap-1 text-sm"><span className="text-gray-600">Due date</span><input type="date" value={due} onChange={(e)=>setDue(e.target.value)} className="rounded-xl border px-3 py-2"/></label>
            <div className="flex justify-end">
              <button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>{ onAdd(title, currentUser.role==='employee'? currentUser.id : assignee, due, currentUser.id); setTitle(''); }}>Add</button>
            </div>
          </div>
        </div>

        {currentUser.role!=='employee' && (
          <div className="rounded-2xl border p-3">
            <h4 className="mb-2 font-semibold">Task templates</h4>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <TextInput label="New template title" value={newTpl} onChange={setNewTpl} placeholder="Mop floor at close" />
              <div className="flex items-end"><button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>{ if(!newTpl.trim()) return; onAddTemplate(newTpl.trim()); setNewTpl(''); }}>Add template</button></div>
            </div>
            <ul className="mt-2 divide-y rounded-xl border">
              {templates.length===0 && <li className="p-3 text-sm text-gray-600">No templates yet.</li>}
              {templates.map(t=> (
                <li key={t.id} className="flex items-center justify-between p-2 text-sm">
                  <div>{t.title}</div>
                  <div className="flex items-center gap-2">
                    <select className="rounded-xl border px-2 py-1" onChange={(e)=>{ const userId = e.target.value; if(!userId) return; onAdd(t.title, userId, fmtDate(new Date()), currentUser.id); e.target.value=''; }}>
                      <option value="">Assignâ€¦</option>
                      {users.map(u=> <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                    <button className="rounded-xl border px-2 py-1" onClick={()=>onDeleteTemplate(t.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 font-semibold">{currentUser.role==='employee' ? 'My tasks' : 'All tasks'}</h4>
        <ul className="divide-y rounded-2xl border">
          {mine.length===0 && <li className="p-3 text-sm text-gray-600">No tasks.</li>}
          {mine.map(t=> (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-gray-600">Due {t.due_date} â€¢ Assigned to {users.find(u=>u.id===t.assigned_to)?.full_name || 'â€”'}</div>
              </div>
              <div className="flex items-center gap-2">
                <select className="rounded-xl border px-2 py-1" value={t.status} onChange={(e)=>onSetStatus(t.id, e.target.value)}>
                  <option value="open">open</option>
                  <option value="done">done</option>
                </select>
                <button className="rounded-xl border px-2 py-1" onClick={()=>onDelete(t.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- Messages ----------
function MessagesPanel({ users, currentUser, messages, onSend }) {
  const [peerId, setPeerId] = useState(users.find(u=>u.id!==currentUser.id)?.id || '');
  const [body, setBody] = useState('');
  const thread = messages.filter(m => (m.from_user_id===currentUser.id && m.to_user_id===peerId) || (m.to_user_id===currentUser.id && m.from_user_id===peerId));

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="rounded-2xl border p-3">
        <h4 className="mb-2 font-semibold">Conversations</h4>
        <select className="w-full rounded-xl border px-3 py-2" value={peerId} onChange={(e)=>setPeerId(e.target.value)}>
          {users.filter(u=>u.id!==currentUser.id).map(u=> <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>
      <div className="rounded-2xl border p-3">
        <h4 className="mb-2 font-semibold">Chat</h4>
        <div className="mb-3 max-h-72 overflow-auto rounded-xl border p-2">
          {thread.length===0 && <div className="text-sm text-gray-600">No messages yet.</div>}
          {thread.map(m => (
            <div key={m.id} className={`mb-2 flex ${m.from_user_id===currentUser.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-xl border px-2 py-1 text-sm ${m.from_user_id===currentUser.id ? 'bg-black text-white' : ''}`}>
                {m.body}
                <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 rounded-xl border px-3 py-2 text-sm" value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Type a message" />
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={()=>{ onSend(currentUser.id, peerId, body); setBody(''); }}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard (Manager/Owner) ----------
function DashboardPanel({ data, users, currentUser }) {
  const locId = currentUser?.location_id || null;

  const usersById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])),
    [users]
  );

  const locationUserIds = useMemo(() => {
    if (!locId) return new Set(users.map((u) => u.id));
    return new Set(users.filter((u) => u.location_id === locId).map((u) => u.id));
  }, [users, locId]);

  const timeOff = useMemo(() => {
    const list = data.time_off_requests || [];
    return list.filter((r) => locationUserIds.has(r.user_id));
  }, [data.time_off_requests, locationUserIds]);

  const pendingTimeOff = useMemo(
    () => timeOff.filter((r) => r.status === 'pending'),
    [timeOff]
  );

  const swapRequests = useMemo(() => {
    const list = data.swap_requests || [];
    const schedules = data.schedules || [];
    const allShifts = schedules.flatMap((s) =>
      (s.shifts || []).map((sh) => ({ ...sh, __location_id: s.location_id }))
    );
    const shiftById = Object.fromEntries(allShifts.map((s) => [s.id, s]));
    return list.filter((r) => {
      const shift = shiftById[r.shift_id];
      if (shift && locId) return shift.__location_id === locId;
      if (!locId) return true;
      const requester = usersById[r.requester_id];
      return requester && requester.location_id === locId;
    });
  }, [data.swap_requests, data.schedules, usersById, locId]);

  const pendingSwaps = useMemo(
    () => swapRequests.filter((r) => ['open', 'offered', 'manager_pending'].includes(r.status)),
    [swapRequests]
  );

  const availabilityRequests = useMemo(() => {
    const list = data.availability_change_requests || [];
    return list.filter((r) => locationUserIds.has(r.user_id));
  }, [data.availability_change_requests, locationUserIds]);

  const recentItems = useMemo(() => {
    const items = [];

    for (const r of timeOff) {
      items.push({
        id: `to-${r.id}`,
        created_at: r.created_at || r.date_from,
        type: 'Time Off',
        label: `${usersById[r.user_id]?.full_name || 'Employee'} requested ${r.date_from} \u2192 ${r.date_to}`,
        status: r.status,
      });
    }

    for (const r of swapRequests) {
      const requester = usersById[r.requester_id];
      items.push({
        id: `sw-${r.id}`,
        created_at: r.created_at,
        type: 'Swap',
        label: `${requester?.full_name || 'Employee'} ${r.type === 'trade' ? 'proposed trade' : 'offered shift'}`,
        status: r.status,
      });
    }

    for (const r of availabilityRequests) {
      const user = usersById[r.user_id];
      items.push({
        id: `av-${r.id}`,
        created_at: r.created_at,
        type: 'Availability',
        label: `${user?.full_name || 'Employee'} requested availability change`,
        status: r.status || 'pending',
      });
    }

    items.sort((a, b) => {
      const aTime = safeDate(a.created_at || 0).getTime();
      const bTime = safeDate(b.created_at || 0).getTime();
      return bTime - aTime;
    });

    return items.slice(0, 10);
  }, [timeOff, swapRequests, availabilityRequests, usersById]);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border p-3">
          <h3 className="mb-2 text-sm font-semibold">Recent Changes</h3>
          {recentItems.length === 0 ? (
            <div className="text-sm text-gray-600">No recent changes for this location yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{item.type}</div>
                    <div className="text-xs text-gray-700">{item.label}</div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {item.status && <div className="mb-1 capitalize">{item.status}</div>}
                    {item.created_at && (
                      <div>{safeDate(item.created_at).toLocaleString()}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border p-3">
          <h3 className="mb-2 text-sm font-semibold">Swap Requests</h3>
          {pendingSwaps.length === 0 ? (
            <div className="text-sm text-gray-600">No open swap requests.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingSwaps.map((r) => {
                const requester = usersById[r.requester_id];
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {requester?.full_name || 'Employee'} &middot; {r.type}
                      </div>
                      <div className="text-xs text-gray-600">
                        Status: {r.status}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.created_at && safeDate(r.created_at).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border p-3">
          <h3 className="mb-2 text-sm font-semibold">Pending Time Off</h3>
          {pendingTimeOff.length === 0 ? (
            <div className="text-sm text-gray-600">No pending time-off requests.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingTimeOff.map((r) => {
                const user = usersById[r.user_id];
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{user?.full_name || 'Employee'}</div>
                      <div className="text-xs text-gray-600">
                        {r.date_from} \u2192 {r.date_to}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.created_at && safeDate(r.created_at).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border p-3">
          <h3 className="mb-2 text-sm font-semibold">Availability Requests</h3>
          {availabilityRequests.length === 0 ? (
            <div className="text-sm text-gray-600">No availability change requests.</div>
          ) : (
            <AvailabilityChangeRequestsPanel
              users={users}
              currentUser={currentUser}
              requests={availabilityRequests}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Requests (Manager/Owner) ----------
function AvailabilityChangeRequestsPanel({ users, currentUser, requests }) {
  const byId = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const isManager = (currentUser?.role || 'employee') !== 'employee';
  const locationId = currentUser?.location_id || null;

  const visible = useMemo(() => {
    const list = requests || [];
    if (!isManager) {
      return list.filter((r) => r.user_id === currentUser.id);
    }
    if (!locationId) return list;
    const allowedUserIds = new Set(
      users.filter((u) => u.location_id === locationId).map((u) => u.id)
    );
    return list.filter((r) => allowedUserIds.has(r.user_id));
  }, [requests, isManager, currentUser?.id, locationId, users]);

  if (!visible.length) {
    return <div className="text-sm text-gray-600">No availability change requests yet.</div>;
  }

  return (
    <ul className="divide-y rounded-2xl border">
      {visible.map((r) => {
        const u = byId[r.user_id];
        return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div>
              <div className="font-medium">
                {isManager && u ? u.full_name : 'Requested change'}
              </div>
              {r.pattern && (
                <div className="text-xs text-gray-700">
                  {r.pattern}
                </div>
              )}
              {r.note && (
                <div className="text-xs text-gray-600">
                  {r.note}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {safeDate(r.created_at).toLocaleString()}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RequestsPanel({ users, list, onSetStatus }) {
  const byId = useMemo(()=> Object.fromEntries(users.map(u=>[u.id,u])), [users]);
  const pending = list.filter(r=> r.status==='pending');
  const others = list.filter(r=> r.status!=='pending');
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-semibold">Pending</div>
        <ul className="divide-y rounded-2xl border">
          {pending.length===0 && <li className="p-3 text-sm text-gray-600">No pending requests.</li>}
          {pending.map(r=> (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <div className="font-medium">{byId[r.user_id]?.full_name || 'â€”'}</div>
                <div className="text-gray-600">{r.date_from} â†’ {r.date_to}{r.notes ? ` â€¢ ${r.notes}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl border px-2 py-1" onClick={()=>onSetStatus(r.id,'approved')}>Approve</button>
                <button className="rounded-xl border px-2 py-1" onClick={()=>onSetStatus(r.id,'denied')}>Deny</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-2 font-semibold">History</div>
        <ul className="divide-y rounded-2xl border">
          {others.length===0 && <li className="p-3 text-sm text-gray-600">No history yet.</li>}
          {others.map(r=> (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <div className="font-medium">{byId[r.user_id]?.full_name || 'â€”'}</div>
                <div className="text-gray-600">{r.date_from} â†’ {r.date_to}{r.notes ? ` â€¢ ${r.notes}` : ''}</div>
              </div>
              <Pill tone={r.status==='approved' ? 'success' : r.status==='denied' ? 'danger' : 'warn'}>{r.status}</Pill>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- Swaps UI Components ----------
function SwapQueuePanel({ requests, offers, users, findShiftById, onApprove, onDecline }) {
  const byId = useMemo(()=> Object.fromEntries(users.map(u=>[u.id,u])), [users]);
  const pending = (requests||[]).filter(r => r.status==='manager_pending');
  const offersByReq = useMemo(()=> {
    const m = {};
    for (const o of (offers||[])) { if (!m[o.request_id]) m[o.request_id]=[]; m[o.request_id].push(o); }
    return m;
  }, [offers]);
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-semibold">Manager approval queue</div>
        <ul className="divide-y rounded-2xl border">
          {pending.length===0 && <li className="p-3 text-sm text-gray-600">No items in queue.</li>}
          {pending.map(r => {
            const sh = findShiftById(r.shift_id);
            const u = byId[r.requester_id];
            const count = (offersByReq[r.id]||[]).length;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="font-medium">{u?.full_name || 'Unknown'} <span className="ml-2 text-gray-600">{r.type}</span></div>
                  {sh && (
                    <div className="text-gray-600">{new Date(sh.starts_at).toLocaleString()} - {new Date(sh.ends_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill>offers: {count}</Pill>
                  <button className="rounded-xl border px-2 py-1" onClick={()=> onApprove(r.id)}>Approve</button>
                  <button className="rounded-xl border px-2 py-1" onClick={()=> onDecline(r.id)}>Decline</button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function EmployeeSwapsPanel({ data, users, currentUser, positionsById, findShiftById, onCreateRequest, onOfferCover, onOfferTrade, onWithdrawOffer, onAcceptOffer, onCancelRequest, flags }) {
  const myId = currentUser.id;
  const allShifts = (data.schedules||[]).flatMap(s => (s.shifts||[]).map(sh => ({...sh, __location_id: s.location_id })));
  const myFutureShifts = allShifts.filter(s => s.user_id===myId && safeDate(s.starts_at) > new Date());
  // NOTE: openRequests/myRequests/myOffers are still based on the local swap_requests/swap_offers model.
  // In the normalized backend these will map to swap_offers rows and (for giveaways) swap_claims rows returned by /api/swaps/my and /api/swaps/open.
  const openRequests = (data.swap_requests||[]).filter(r => (r.status==='open' || r.status==='offered') && r.requester_id!==myId);
  const myRequests = (data.swap_requests||[]).filter(r => r.requester_id===myId);
  const myOffers = (data.swap_offers||[]).filter(o => o.offerer_id===myId);
  const offersByReq = useMemo(()=> {
    const m = {}; for (const o of (data.swap_offers||[])) { if (!m[o.request_id]) m[o.request_id]=[]; m[o.request_id].push(o); } return m; }, [data.swap_offers]);

  const [formShiftId, setFormShiftId] = useState(myFutureShifts[0]?.id || '');
  const [formType, setFormType] = useState('give');
  const [formMsg, setFormMsg] = useState('');
  const [formExpireH, setFormExpireH] = useState('');

  const submit = () => {
    if (!formShiftId) return alert('Pick a shift');
    const expiresAt = formExpireH ? new Date(Date.now() + Number(formExpireH)*3600000).toISOString() : null;
    onCreateRequest({ shiftId: formShiftId, type: formType, message: formMsg, expiresAt });
    setFormMsg(''); setFormExpireH('');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-semibold">Create swap request</div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">My future shift</span>
            <select className="rounded-xl border px-3 py-2" value={formShiftId} onChange={(e)=> setFormShiftId(e.target.value)}>
              {myFutureShifts.map(s => (
                <option key={s.id} value={s.id}>
                  {positionsById[s.position_id]?.name || "?"} — {new Date(s.starts_at).toLocaleString()} - {new Date(s.ends_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                </option>
              ))}
            </select>
          </label>
          <Select label="Type" value={formType} onChange={setFormType} options={[{value:'give',label:'Give away'},{value:'trade',label:'Trade'}]} />
          <label className="grid gap-1 text-sm">
            <span className="text-gray-600">Expires in (hours)</span>
            <input className="rounded-xl border px-3 py-2" type="number" min="0" value={formExpireH} onChange={(e)=> setFormExpireH(e.target.value)} />
          </label>
          <div className="md:col-span-3">
            <TextInput label="Message (optional)" value={formMsg} onChange={setFormMsg} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={submit}>Request swap</button>
        </div>
      </div>

      <div>
        <div className="mb-2 font-semibold">Open requests (eligible)</div>
        <ul className="divide-y rounded-2xl border">
          {openRequests.length===0 && <li className="p-3 text-sm text-gray-600">No open requests right now.</li>}
          {openRequests.map(r => {
            const sh = findShiftById(r.shift_id);
            const requester = users.find(u=>u.id===r.requester_id);
            if (!sh) return null;
            const mineSameLoc = sh.__location_id === currentUser.location_id;
            if (!mineSameLoc) return null;
            const myEligibleShifts = myFutureShifts.filter(ms => flags.allowCrossPosition || ms.position_id === sh.position_id);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="font-medium">{requester?.full_name || 'Unknown'} <span className="ml-2 text-gray-600">{r.type}</span></div>
                  <div className="text-gray-600">{new Date(sh.starts_at).toLocaleString()} - {new Date(sh.ends_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.type==='give' ? (
                    <button className="rounded-xl border px-2 py-1" onClick={()=> onOfferCover(r.id)}>Offer to cover</button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select className="rounded-xl border px-2 py-1" onChange={(e)=> { if(e.target.value) onOfferTrade(r.id, e.target.value); }} defaultValue="">
                        <option value="" disabled>Offer trade shift</option>
                        {myEligibleShifts.map(ms => (
                          <option key={ms.id} value={ms.id}>{new Date(ms.starts_at).toLocaleDateString()} {new Date(ms.starts_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-2 font-semibold">My requests</div>
        <ul className="divide-y rounded-2xl border">
          {myRequests.length===0 && <li className="p-3 text-sm text-gray-600">No swap requests yet.</li>}
          {myRequests.map(r => {
            const sh = findShiftById(r.shift_id);
            const listOffers = offersByReq[r.id] || [];
            return (
              <li key={r.id} className="p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.type} <span className="ml-2 text-gray-600">{r.status}</span></div>
                    {sh && <div className="text-gray-600">{new Date(sh.starts_at).toLocaleString()}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {(r.status==='open' || r.status==='offered') && (<button className="rounded-xl border px-2 py-1" onClick={()=> onCancelRequest(r.id)}>Cancel</button>)}
                  </div>
                </div>
                {listOffers.length>0 && (
                  <div className="mt-2 rounded-xl border p-2">
                    <div className="mb-1 text-xs font-semibold">Offers</div>
                    <ul className="space-y-1 text-xs">
                      {listOffers.map(o => (
                        <li key={o.id} className="flex items-center justify-between">
                          <span>From {users.find(u=>u.id===o.offerer_id)?.full_name || 'Unknown'}{o.offer_shift_id ? ' (trade)' : ' (cover)'}
                          </span>
                          {r.status!=='manager_pending' && (
                            <button className="rounded-xl border px-2 py-0.5" onClick={()=> onAcceptOffer(o.id)}>Accept</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-2 font-semibold">My offers</div>
        <ul className="divide-y rounded-2xl border">
          {myOffers.length===0 && <li className="p-3 text-sm text-gray-600">No offers yet.</li>}
          {myOffers.map(o => (
            <li key={o.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{o.offer_shift_id ? 'Trade' : 'Cover'} offer <span className="ml-2 text-gray-600">{o.status}</span></div>
                <div className="text-gray-600">For request {o.request_id.slice(0,6)}</div>
              </div>
              {o.status==='proposed' && <button className="rounded-xl border px-2 py-1" onClick={()=> onWithdrawOffer(o.id)}>Withdraw</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- Self Tests ----------
function runSelfTests() {
  const tests = [];
  const t = (name, fn) => {
    try { const ok = fn(); tests.push({ name, pass: !!ok }); }
    catch (e) { tests.push({ name, pass: false, error: e?.message || String(e) }); }
  };
  t('minutes("09:30") === 570', () => minutes('09:30') === 570);
  t('minutes span 8h', () => minutes('17:00') - minutes('09:00') === 480);
  t('rangesOverlap true', () => rangesOverlap(540, 600, 570, 630) === true);
  t('rangesOverlap false', () => rangesOverlap(540, 600, 600, 660) === false);
  t('date range includes day', () => isDateWithin('2025-02-10','2025-02-01','2025-02-28') === true && isDateWithin('2025-03-01','2025-02-01','2025-02-28') === false);
  // unavailability conflict check
  t('conflict weekly', () => {
    const day = new Date('2025-01-06'); // Monday
    const ua = [{ user_id: 'u1', kind: 'weekly', weekday: 1, start_hhmm: '09:00', end_hhmm: '12:00' }];
    const matches = ua.filter((x) => x.user_id === 'u1' && (x.kind === 'date' ? x.date === fmtDate(day) : x.weekday === day.getDay()))
    return matches.filter((x) => rangesOverlap(minutes('10:00'), minutes('11:00'), minutes(x.start_hhmm), minutes(x.end_hhmm))).length === 1;
  });
  // date conflict check kept for compat
  t('conflict date', () => {
    const day = new Date('2025-01-07'); // Tuesday
    const ua = [{ user_id: 'u1', kind: 'date', date: '2025-01-07', start_hhmm: '14:00', end_hhmm: '18:00' }];
    const matches = ua.filter((x) => x.user_id === 'u1' && (x.kind === 'date' ? x.date === fmtDate(day) : x.weekday === day.getDay()));
    return matches.filter((x) => rangesOverlap(minutes('13:00'), minutes('15:00'), minutes(x.start_hhmm), minutes(x.end_hhmm))).length === 1;
  });
  t('hoursBetween 8h no break', () => Math.abs(hoursBetween('2025-01-01T09:00:00.000Z','2025-01-01T17:00:00.000Z',0) - 8) < 1e-9);
  t('hoursBetween 7.5h with break', () => Math.abs(hoursBetween('2025-01-01T09:00:00.000Z','2025-01-01T17:00:00.000Z',30) - 7.5) < 1e-9);
  // extra sanity tests
  t('WEEK_LABELS has 7 days', () => WEEK_LABELS.length === 7);
  t('fmtDate preserves day', () => fmtDate(combineDayAndTime('2025-01-02', '09:30')) === '2025-01-02');
  t('feature flags include employeesCanPostToFeed', () => defaultFlags().hasOwnProperty('employeesCanPostToFeed'));
  t('swap flags exist in defaults', () => defaultFlags().hasOwnProperty('requireManagerApproval') && defaultFlags().hasOwnProperty('swapCutoffHours') && defaultFlags().hasOwnProperty('allowCrossPosition'));
  // template test
  t('template add => task title copy', () => { const title='Sweep'; const tmp={ id:'t1', title }; return tmp.title==='Sweep'; });
  // time off overlap
  t('time off overlap detect', () => isDateWithin('2025-01-10','2025-01-09','2025-01-11') === true);
  // startOfWeek tests
  t('startOfWeek Sunday keeps Sunday 2025-01-05', () => fmtDate(startOfWeek('2025-01-05', 0)) === '2025-01-05');
  t('startOfWeek Monday from Sunday 2025-01-05 -> 2024-12-30', () => fmtDate(startOfWeek('2025-01-05', 1)) === '2024-12-30');
  // week shifting tests
  t('addDays +7 shifts a week', () => fmtDate(addDays('2025-01-01', 7)) === '2025-01-08');
  t('shift week respects startOfWeek', () => fmtDate(startOfWeek(addDays('2025-01-05', 7), 1)) === '2025-01-06');
  t('today startOfWeek -> yyyy-mm-dd', () => fmtDate(startOfWeek(today(), 1)).length === 10);
  return tests;
}

function SelfTestsPanel() {
  const [results] = useState(runSelfTests());
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  useEffect(() => {
    console.table(results);
  }, [results]);
  return (
    <div className="rounded-2xl border p-3">
      <div className="mb-2 font-semibold">Self-tests</div>
      <div className="text-sm mb-2">{passed}/{total} passed</div>
      <ul className="text-xs space-y-1">
        {results.map((r, i) => (
          <li key={i} className={r.pass ? 'text-green-700' : 'text-red-700'}>
            {r.pass ? 'âœ”' : 'âœ˜'} {r.name}{!r.pass && r.error ? ` â€“ ${r.error}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}






function QualificationsEditor({ users, positions, data, onToggle }) {
  const byUser = useMemo(() => {
    const map = {};
    for (const u of users) map[u.id] = new Set();
    for (const q of (data.user_qualifications || [])) {
      if (!map[q.user_id]) map[q.user_id] = new Set();
      map[q.user_id].add(q.position_id);
    }
    return map;
  }, [users, data.user_qualifications]);
  const positionsByLoc = useMemo(() => {
    const m = {};
    for (const p of positions) {
      if (!m[p.location_id]) m[p.location_id] = [];
      m[p.location_id].push(p);
    }
    return m;
  }, [positions]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="p-2">Employee</th>
            {positions.map(p => (
              <th key={p.id} className="p-2 whitespace-nowrap">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t">
              <td className="p-2 font-medium whitespace-nowrap">{u.full_name}</td>
              {positions.map(p => {
                const checked = byUser[u.id]?.has(p.id) || false;
                const sameLoc = u.location_id === p.location_id;
                return (
                  <td key={p.id} className="p-2 text-center">
                    <input
                      type="checkbox"
                      disabled={!sameLoc}
                      checked={checked}
                      onChange={(e)=> onToggle(u.id, p.id, e.target.checked)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



function ShiftUpdateModal({ open, onClose, shift, users, positions, onSave }) {
  // Always initialize hooks (do not return before hooks)
  const toHHMM = (dt) => { const d = safeDate(dt); const h = String(d.getHours()).padStart(2,'0'); const m = String(d.getMinutes()).padStart(2,'0'); return `${h}:${m}`; };
  const seedUser = users?.[0]?.id || '';
  const seedPos = positions?.[0]?.id || '';
  const seedDay = new Date();
  const [userId, setUserId] = useState(shift?.user_id ?? seedUser);
  const [positionId, setPositionId] = useState(shift?.position_id ?? seedPos);
  const [day, setDay] = useState(safeDate(shift?.starts_at ?? seedDay));
  const [start, setStart] = useState(toHHMM(shift?.starts_at ?? seedDay));
  const [end, setEnd] = useState(toHHMM(shift?.ends_at ?? seedDay));
  const [breakMin, setBreakMin] = useState(shift?.break_min || 0);
  const [notes, setNotes] = useState(shift?.notes || '');

  useEffect(() => {
    if (shift) {
      setUserId(shift.user_id);
      setPositionId(shift.position_id);
      setDay(safeDate(shift.starts_at));
      setStart(toHHMM(shift.starts_at));
      setEnd(toHHMM(shift.ends_at));
      setBreakMin(shift.break_min || 0);
      setNotes(shift.notes || '');
    }
  }, [shift, open]);

  if (!open || !shift) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit shift"
      footer={
        <>
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button className="rounded-xl border bg-black px-3 py-2 text-sm text-white" onClick={() => { if (!userId || !positionId) return alert('Pick employee & position'); onSave({ id: shift.id, user_id: userId, position_id: positionId, day, start_hhmm: start, end_hhmm: end, break_min: breakMin, notes }); onClose(); }}>Save changes</button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="Employee" value={userId} onChange={setUserId} options={users.map((u) => ({ value: u.id, label: u.full_name }))} />
        <Select label="Position" value={positionId} onChange={setPositionId} options={positions.map((p) => ({ value: p.id, label: p.name }))} />
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Day</span>
          <input type="date" value={fmtDate(day)} onChange={(e) => setDay(safeDate(e.target.value))} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Start time</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">End time</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">Break (minutes)</span>
          <input type="number" min={0} step={5} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} className="rounded-xl border px-3 py-2" />
        </label>
        <label className="md:col-span-2 grid gap-1 text-sm">
          <span className="text-gray-600">Notes (optional)</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl border px-3 py-2" />
        </label>
      </div>
    </Modal>
  );
}












