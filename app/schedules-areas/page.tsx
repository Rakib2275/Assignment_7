"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    substation?: {
      name: string;
      code: string;
      zone?: { name: string; code: string };
    };
  };
};

type Schedule = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  area: Area;
};

type AreaResult = { data: Area[]; meta: { total: number } };
type ScheduleResult = {
  data: Schedule[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function AreaSchedules() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [date, setDate] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [areasLoading, setAreasLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setAreasLoading(false);
      setError("Your session has expired. Please log in again.");
      return;
    }
    const accessToken = token;
    let cancelled = false;

    async function loadAreas() {
      try {
        const response = await apiRequest<AreaResult>(
          "/api/v1/area?page=1&limit=100&sortBy=name&sortOrder=asc",
          {},
          accessToken,
        );
        if (cancelled) return;
        setAreas(response.data.data);
        const requestedAreaId = new URLSearchParams(window.location.search).get("areaId");
        if (requestedAreaId && response.data.data.some((area) => area.id === requestedAreaId)) {
          setSelectedAreaId(requestedAreaId);
        } else if (response.data.data[0]) {
          setSelectedAreaId(response.data.data[0].id);
        }
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load service areas."));
      } finally {
        if (!cancelled) setAreasLoading(false);
      }
    }

    void loadAreas();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedAreaId) {
      setSchedules([]);
      setTotal(0);
      setSchedulesLoading(false);
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setSchedulesLoading(false);
      return;
    }
    const accessToken = token;
    let cancelled = false;

    async function loadSchedules() {
      setSchedulesLoading(true);
      setError("");
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy: "startTime",
        sortOrder: "asc",
        areaId: selectedAreaId,
      });
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
        if (!cancelled) setError(messageFor(requestError, "Unable to load schedules for this area."));
      } finally {
        if (!cancelled) setSchedulesLoading(false);
      }
    }

    void loadSchedules();
    return () => { cancelled = true; };
  }, [date, page, selectedAreaId]);

  const selectedArea = areas.find((area) => area.id === selectedAreaId);

  return (
    <div className="area-schedules-layout">
      <section className="workspace-card" aria-labelledby="area-schedule-filter-heading">
        <div className="workspace-card-heading">
          <div>
            <span className="eyebrow">SERVICE AREA</span>
            <h3 id="area-schedule-filter-heading">Choose an area</h3>
          </div>
          <span className="panel-count">{areas.length} areas</span>
        </div>
        <div className="area-schedule-filters">
          <label htmlFor="schedule-area-filter">Service area</label>
          <select
            id="schedule-area-filter"
            disabled={areasLoading || !areas.length}
            onChange={(event) => {
              setSelectedAreaId(event.target.value);
              setPage(1);
            }}
            value={selectedAreaId}
          >
            {areas.length === 0 && <option value="">No service areas available</option>}
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.code}</option>)}
          </select>
          <label htmlFor="schedule-area-date">Schedule date</label>
          <div className="area-schedule-date-row">
            <input id="schedule-area-date" onChange={(event) => { setDate(event.target.value); setPage(1); }} type="date" value={date} />
            {date && <button className="back-link" onClick={() => { setDate(""); setPage(1); }} type="button">Clear date</button>}
          </div>
        </div>
      </section>

      {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}

      {selectedArea && (
        <section className="workspace-card" aria-labelledby="area-schedules-heading">
          <div className="workspace-card-heading">
            <div>
              <span className="eyebrow">SCHEDULED SERVICE</span>
              <h3 id="area-schedules-heading">{selectedArea.name}</h3>
              <p className="area-schedule-code">{selectedArea.code}</p>
            </div>
            <span className="panel-count">{total} schedules</span>
          </div>

          <div className="area-location-summary">
            <div><span>Feeder</span><strong>{selectedArea.feeder?.name ?? "Not assigned"}{selectedArea.feeder?.code ? ` · ${selectedArea.feeder.code}` : ""}</strong></div>
            <div><span>Substation</span><strong>{selectedArea.feeder?.substation?.name ?? "Not assigned"}{selectedArea.feeder?.substation?.code ? ` · ${selectedArea.feeder.substation.code}` : ""}</strong></div>
            <div><span>Zone</span><strong>{selectedArea.feeder?.substation?.zone?.name ?? "Not assigned"}{selectedArea.feeder?.substation?.zone?.code ? ` · ${selectedArea.feeder.substation.zone.code}` : ""}</strong></div>
          </div>

          {schedulesLoading ? (
            <div className="workspace-empty">Loading area schedules…</div>
          ) : schedules.length ? (
            <>
              <div className="area-schedule-list">
                {schedules.map((schedule) => (
                  <article className="area-schedule-item" key={schedule.id}>
                    <div className="area-schedule-date">
                      <span>{formatDate(schedule.startTime)}</span>
                      <strong>{formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</strong>
                    </div>
                    <div className="area-schedule-item-copy">
                      <h4>{schedule.title}</h4>
                      <p>Ends {formatDate(schedule.endTime)}</p>
                    </div>
                    <span className="area-schedule-indicator">Load schedule</span>
                  </article>
                ))}
              </div>
              <div className="workspace-pagination">
                <span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
                <div>
                  <button className="button button-light" disabled={page <= 1 || schedulesLoading} onClick={() => setPage((currentPage) => currentPage - 1)} type="button">Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button className="button button-light" disabled={page >= totalPages || schedulesLoading} onClick={() => setPage((currentPage) => currentPage + 1)} type="button">Next</button>
                </div>
              </div>
            </>
          ) : (
            <div className="workspace-empty">
              {date ? "There are no schedules for this area on the selected date." : "There are no schedules for this service area yet."}
              <Link className="area-schedule-create-link" href={`/schedules?areaId=${encodeURIComponent(selectedArea.id)}`}>
                View schedule management
              </Link>
            </div>
          )}
        </section>
      )}

      {!areasLoading && !areas.length && (
        <section className="workspace-card">
          <div className="workspace-empty">No service areas are available to browse.</div>
        </section>
      )}
    </div>
  );
}

export default function SchedulesAreasPage() {
  return (
    <WorkspacePage page="schedules-areas">
      <AreaSchedules />
    </WorkspacePage>
  );
}
