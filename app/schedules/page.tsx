"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type Area = {
  id: string;
  name: string;
  code: string;
  feeder?: {
    name: string;
    code: string;
    substation?: { name: string; zone?: { name: string } };
  };
};

type Schedule = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  area: Area;
};

type ScheduleResult = {
  data: Schedule[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type AreaResult = { data: Area[]; meta: { total: number } };

type ScheduleForm = {
  title: string;
  areaId: string;
  startTime: string;
  endTime: string;
};

const emptyForm: ScheduleForm = { title: "", areaId: "", startTime: "", endTime: "" };

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toDateTimeInput(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function SchedulesDirectory({ role }: { role: string }) {
  const canManage = ["ADMIN", "SUPER_ADMIN", "OPERATOR"].includes(role);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [areaId, setAreaId] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "generate">("create");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const requestedAreaId = new URLSearchParams(window.location.search).get("areaId");
    if (requestedAreaId) setAreaId(requestedAreaId);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const accessToken = token;
    let cancelled = false;

    async function loadAreas() {
      try {
        const response = await apiRequest<AreaResult>(
          "/api/v1/area?page=1&limit=100&sortBy=name&sortOrder=asc",
          {},
          accessToken,
        );
        if (!cancelled) setAreas(response.data.data);
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load service areas."));
      }
    }

    void loadAreas();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      setError("Your session has expired. Please log in again.");
      return;
    }
    const accessToken = token;
    let cancelled = false;

    async function loadSchedules() {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy: "startTime",
        sortOrder: "asc",
      });
      if (appliedSearch) query.set("search", appliedSearch);
      if (areaId) query.set("areaId", areaId);
      if (date) query.set("date", date);

      try {
        const response = await apiRequest<ScheduleResult>(
          `/api/v1/schedule?${query.toString()}`,
          {},
          accessToken,
        );
        if (cancelled) return;
        setSchedules(response.data.data);
        setTotal(response.data.meta.total);
        setTotalPages(Math.max(response.data.meta.totalPages, 1));
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load schedules."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSchedules();
    return () => { cancelled = true; };
  }, [appliedSearch, areaId, date, page]);

  function startCreate() {
    setEditing(null);
    setFormMode("create");
    setForm({ ...emptyForm, areaId: areaId || areas[0]?.id || "" });
    setShowForm(true);
    setNotice("");
  }

  function startGenerate() {
    setEditing(null);
    setFormMode("generate");
    setDurationMinutes("60");
    setForm({ ...emptyForm, areaId: areaId || areas[0]?.id || "" });
    setShowForm(true);
    setNotice("");
  }

  function startEdit(schedule: Schedule) {
    setEditing(schedule);
    setFormMode("create");
    setForm({
      title: schedule.title,
      areaId: schedule.area.id,
      startTime: toDateTimeInput(schedule.startTime),
      endTime: toDateTimeInput(schedule.endTime),
    });
    setShowForm(true);
    setNotice("");
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    if (formMode === "generate") {
      const duration = Number(durationMinutes);
      if (!Number.isInteger(duration) || duration < 1) {
        setError("Schedule duration must be a positive whole number of minutes.");
        return;
      }
      if (!Number.isFinite(new Date(form.startTime).getTime())) {
        setError("Enter a valid schedule start time.");
        return;
      }
    } else if (new Date(form.endTime) <= new Date(form.startTime)) {
      setError("The end time must be after the start time.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    const startTime = new Date(form.startTime);
    const endTime = formMode === "generate"
      ? new Date(startTime.getTime() + Number(durationMinutes) * 60 * 1000)
      : new Date(form.endTime);
    const payload = {
      ...(form.title.trim() ? { title: form.title.trim() } : {}),
      areaId: form.areaId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };
    try {
      if (editing) {
        await apiRequest<Schedule>(
          `/api/v1/schedule/${encodeURIComponent(editing.id)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
          token,
        );
        setNotice("Schedule updated successfully.");
      } else if (formMode === "generate") {
        await apiRequest<Schedule>(
          "/api/v1/schedule/generate",
          {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              durationMinutes: Number(durationMinutes),
            }),
          },
          token,
        );
        setNotice("Schedule generated successfully.");
      } else {
        if (!payload.title) {
          setError("Enter a title for the schedule.");
          setSaving(false);
          return;
        }
        await apiRequest<Schedule>(
          "/api/v1/schedule",
          { method: "POST", body: JSON.stringify(payload) },
          token,
        );
        setNotice("Schedule created successfully.");
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      if (page !== 1) setPage(1);
      else {
        const query = new URLSearchParams({
          page: "1",
          limit: "10",
          sortBy: "startTime",
          sortOrder: "asc",
        });
        if (appliedSearch) query.set("search", appliedSearch);
        if (areaId) query.set("areaId", areaId);
        if (date) query.set("date", date);
        const response = await apiRequest<ScheduleResult>(
          `/api/v1/schedule?${query.toString()}`,
          {},
          token,
        );
        setSchedules(response.data.data);
        setTotal(response.data.meta.total);
        setTotalPages(Math.max(response.data.meta.totalPages, 1));
      }
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to save the schedule."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(schedule: Schedule) {
    if (!window.confirm(`Delete "${schedule.title}"? This action cannot be undone.`)) return;
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiRequest<Schedule>(
        `/api/v1/schedule/${encodeURIComponent(schedule.id)}`,
        { method: "DELETE" },
        token,
      );
      setNotice("Schedule deleted successfully.");
      if (schedules.length === 1 && page > 1) setPage((currentPage) => currentPage - 1);
      else {
        setSchedules((currentSchedules) =>
          currentSchedules.filter((currentSchedule) => currentSchedule.id !== schedule.id),
        );
        setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      }
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to delete the schedule."));
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  }

  return (
    <section className="workspace-card" aria-labelledby="schedule-directory-heading">
      <div className="workspace-card-heading">
        <div>
          <span className="eyebrow">NETWORK OPERATIONS</span>
          <h3 id="schedule-directory-heading">Schedule directory</h3>
        </div>
        <div className="workspace-heading-actions">
          <span className="panel-count">{total} schedules</span>
          {canManage && (
            <>
              <button className="button button-dark" disabled={!areas.length} onClick={startCreate} type="button">
                Add schedule
              </button>
              <button className="button button-light" disabled={!areas.length} onClick={startGenerate} type="button">
                Generate by duration
              </button>
            </>
          )}
        </div>
      </div>

      <form className="workspace-filters schedule-filters" onSubmit={submitSearch}>
        <input
          aria-label="Search schedules by title"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search schedule title"
          type="search"
          value={search}
        />
        <select aria-label="Filter schedules by area" onChange={(event) => { setAreaId(event.target.value); setPage(1); }} value={areaId}>
          <option value="">All areas</option>
          {areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.code}</option>)}
        </select>
        <input aria-label="Filter schedules by date" onChange={(event) => { setDate(event.target.value); setPage(1); }} type="date" value={date} />
        <button className="button button-light filter-submit" disabled={loading} type="submit">Search</button>
      </form>

      {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
      {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}

      {showForm && canManage && (
        <section className="schedule-editor" aria-labelledby="schedule-editor-heading">
          <div className="workspace-card-heading">
            <h4 id="schedule-editor-heading">
              {editing ? "Edit schedule" : formMode === "generate" ? "Generate schedule" : "Create schedule"}
            </h4>
            <button className="back-link" onClick={() => setShowForm(false)} type="button">Cancel</button>
          </div>
          <form className="workspace-form" onSubmit={submitForm}>
            <label htmlFor="schedule-title">
              Schedule title {formMode === "generate" && !editing && <span className="optional-label">(optional)</span>}
            </label>
            <input id="schedule-title" maxLength={150} minLength={formMode === "generate" && !form.title ? undefined : 3} onChange={(event) => setForm({ ...form, title: event.target.value })} required={formMode !== "generate" || Boolean(form.title)} value={form.title} />
            <label htmlFor="schedule-area">Service area</label>
            <select id="schedule-area" onChange={(event) => setForm({ ...form, areaId: event.target.value })} required value={form.areaId}>
              <option value="">Select an area</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.code}</option>)}
            </select>
            <div className="workspace-form-row">
              <div>
                <label htmlFor="schedule-start">Start</label>
                <input id="schedule-start" onChange={(event) => setForm({ ...form, startTime: event.target.value })} required type="datetime-local" value={form.startTime} />
              </div>
              {formMode === "generate" && !editing ? (
                <div>
                  <label htmlFor="schedule-duration">Duration (minutes)</label>
                  <input id="schedule-duration" min="1" onChange={(event) => setDurationMinutes(event.target.value)} required step="1" type="number" value={durationMinutes} />
                </div>
              ) : (
                <div>
                <label htmlFor="schedule-end">End</label>
                <input id="schedule-end" min={form.startTime || undefined} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required type="datetime-local" value={form.endTime} />
                </div>
              )}
            </div>
            <button className="button button-dark workspace-submit" disabled={saving} type="submit">
              {saving ? "Saving…" : editing ? "Save changes" : formMode === "generate" ? "Generate schedule" : "Create schedule"}
            </button>
          </form>
        </section>
      )}

      {loading ? (
        <div className="workspace-empty">Loading schedules…</div>
      ) : schedules.length ? (
        <>
          <div className="workspace-table-wrap">
            <table className="workspace-table schedule-directory-table">
              <thead><tr><th>Schedule</th><th>Service area</th><th>Starts</th><th>Ends</th>{canManage && <th>Actions</th>}</tr></thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td><strong>{schedule.title}</strong><span>{schedule.area.feeder?.name ?? "Service network"}</span></td>
                    <td>
                      <Link href={`/schedules-areas?areaId=${encodeURIComponent(schedule.area.id)}`}>
                        <strong>{schedule.area.name}</strong><span>{schedule.area.code}</span>
                      </Link>
                    </td>
                    <td><strong>{formatDate(schedule.startTime)}</strong><span>{formatTime(schedule.startTime)}</span></td>
                    <td><strong>{formatDate(schedule.endTime)}</strong><span>{formatTime(schedule.endTime)}</span></td>
                    {canManage && (
                      <td>
                        <div className="schedule-actions">
                          <button className="table-action" onClick={() => startEdit(schedule)} type="button">Edit</button>
                          <button className="table-action schedule-delete-action" onClick={() => void deleteSchedule(schedule)} type="button">Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="workspace-pagination">
            <span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
            <div>
              <button className="button button-light" disabled={loading || page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)} type="button">Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button className="button button-light" disabled={loading || page >= totalPages} onClick={() => setPage((currentPage) => currentPage + 1)} type="button">Next</button>
            </div>
          </div>
        </>
      ) : (
        <div className="workspace-empty">
          {appliedSearch || areaId || date ? "No schedules match these filters." : "No load schedules have been published yet."}
        </div>
      )}
    </section>
  );
}

export default function SchedulesPage() {
  return (
    <WorkspacePage page="schedules">
      {(user) => <SchedulesDirectory role={user.role} />}
    </WorkspacePage>
  );
}
