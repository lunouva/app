// Shared scheduling/date utilities extracted from App.jsx

// ---------- date utils (safe) ----------
export const safeDate = (v) => {
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

export const addDays = (d, n) => {
  const x = safeDate(d);
  const y = new Date(x);
  y.setDate(y.getDate() + n);
  return y;
};

export const startOfWeek = (d, weekStartsOn = 1) => {
  const date = safeDate(d);
  const day = date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const fmtDate = (d) => safeDate(d).toISOString().slice(0, 10); // YYYY-MM-DD (UTC-based)

// Local YYYY-MM-DD (no UTC shift)
export const fmtDateLocal = (v) => {
  const d = safeDate(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fmtTime = (d) =>
  safeDate(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const fmtDateLabel = (d) =>
  safeDate(d).toLocaleDateString([], {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });

// ---------- utilities ----------
export const uid = () => Math.random().toString(36).slice(2, 10);
export const today = () => new Date();

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

export const colorForPosition = (positionId = "") => {
  let hash = 0;
  const s = String(positionId);
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return POSITION_COLORS[hash % POSITION_COLORS.length];
};

export const roleColor = (role = "") =>
  ({
    owner: "#e11d48", // rose-600
    manager: "#0ea5e9", // sky-500
    employee: "#64748b", // slate-500
  }[role] || "#6b7280");

// HH:MM from Date (local)
export const toHHMM = (dt) => {
  const d = safeDate(dt);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

export const minutes = (hhmm) => {
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map((n) => Number(n) || 0);
  return h * 60 + m;
};

// Combine a calendar day (Date or YYYY-MM-DD) with an HH:MM time into a local Date
export const combineDayAndTime = (day, hhmm) => {
  const base = safeDate(day);
  const [h, m] = String(hhmm || "00:00")
    .split(":")
    .map((n) => Number(n) || 0);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

export const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  Math.max(aStart, bStart) < Math.min(aEnd, bEnd);

export const hoursBetween = (a, b, breakMin = 0) =>
  Math.max(
    0,
    (safeDate(b) - safeDate(a) - (Number(breakMin) || 0) * 60000) / 3600000
  );

export const download = (filename, text) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const isDateWithin = (dayISO, fromISO, toISO) =>
  dayISO >= fromISO && dayISO <= toISO; // strings YYYY-MM-DD

// ---------- backend API helpers (schedules / shifts) ----------
const getAuthToken = () => {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("shiftmate_auth_token");
  } catch {
    return null;
  }
};

export const isScheduleApiEnabled = () =>
  typeof fetch === "function" && !!getAuthToken();

export const scheduleApiRequest = async (path, options = {}) => {
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
    } catch {
      // ignore
    }
    const msg =
      (errBody && (errBody.error || errBody.message)) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = errBody;
    throw err;
  }

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

