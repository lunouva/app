import React, { useState } from "react";

import { fmtDate } from "../../utils/scheduleUtils.js";

export function TimeOffForm({ onSubmit }) {
  const [from, setFrom] = useState(fmtDate(new Date()));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 rounded-2xl border p-3">
      <h4 className="mb-2 font-semibold">Request time off</h4>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-600">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-1">
          <span className="text-gray-600">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-xl border px-3 py-2"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          className="rounded-xl border px-3 py-2 text-sm"
          onClick={() =>
            onSubmit({ date_from: from, date_to: to, notes })
          }
        >
          Submit
        </button>
      </div>
    </div>
  );
}

