"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type OutageAnalytics = {
  totalOutages: number;
  byType: { scheduled: number; unexpected: number };
  byPriority: { low: number; medium: number; high: number; critical: number };
  byStatus: {
    reported: number;
    verified: number;
    assigned: number;
    inProgress: number;
    restored: number;
    closed: number;
  };
  outagesByArea: Array<{
    areaId: string;
    areaName: string;
    areaCode: string | null;
    outageCount: number;
  }>;
};

type AnalyticsOverview = {
  users: { total: number; customers: number; operators: number; admins: number };
  infrastructure: { areas: number; schedules: number };
  outages: {
    total: number;
    reported: number;
    verified: number;
    assigned: number;
    inProgress: number;
    restored: number;
    closed: number;
  };
  outageBreakdown: {
    byType: Array<{ type: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
  };
  payments: { total: number; successful: number; successfulAmount: number };
};

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AnalyticsPanel() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [analytics, setAnalytics] = useState<OutageAnalytics | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAnalytics(from = startDate, to = endDate) {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (from) query.set("startDate", from);
      if (to) query.set("endDate", to);
      const suffix = query.size ? `?${query.toString()}` : "";
      const [overviewResponse, outageResponse] = await Promise.all([
        apiRequest<AnalyticsOverview>("/api/v1/analytics/overview", {}, token),
        apiRequest<OutageAnalytics>(`/api/v1/analytics/outages${suffix}`, {}, token),
      ]);
      setOverview(overviewResponse.data);
      setAnalytics(outageResponse.data);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to load network analytics."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics("", "");
  }, []);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      setError("The start date must be before or equal to the end date.");
      return;
    }
    void loadAnalytics();
  }

  return (
    <div className="workspace-grid">
      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">NETWORK INSIGHTS</span><h3>Platform overview</h3></div>
          <button className="workspace-refresh" disabled={loading} onClick={() => void loadAnalytics()} type="button">Refresh</button>
        </div>
        {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
        {loading && !overview ? <div className="workspace-empty">Loading platform analytics…</div> : overview ? (
          <div className="infrastructure-summary">
            <div><strong>{overview.users.total}</strong><span>Users</span></div>
            <div><strong>{overview.infrastructure.areas}</strong><span>Service areas</span></div>
            <div><strong>{overview.infrastructure.schedules}</strong><span>Schedules</span></div>
            <div><strong>{overview.outages.total}</strong><span>Outage reports</span></div>
            <div><strong>{overview.payments.successful}</strong><span>Successful payments</span></div>
            <div><strong>৳{overview.payments.successfulAmount.toLocaleString()}</strong><span>Collected</span></div>
          </div>
        ) : <div className="workspace-empty">Platform analytics are unavailable.</div>}
      </section>

      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">OUTAGE REPORTING</span><h3>Outage analytics</h3></div>
          {analytics && <span className="panel-count">{analytics.totalOutages} reports</span>}
        </div>
        <form className="workspace-filters" onSubmit={submitFilters}>
          <input aria-label="Analytics start date" max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
          <input aria-label="Analytics end date" min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
          <button className="button button-light filter-submit" disabled={loading} type="submit">Apply dates</button>
          <button className="button button-light filter-submit" disabled={loading || (!startDate && !endDate)} onClick={() => { setStartDate(""); setEndDate(""); void loadAnalytics("", ""); }} type="button">Clear</button>
        </form>
        {loading && !analytics ? <div className="workspace-empty">Loading outage analytics…</div> : analytics ? (
          <div className="workspace-grid">
            <section>
              <h4 className="infrastructure-list-heading">By status</h4>
              <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Status</th><th>Reports</th></tr></thead><tbody>
                {Object.entries(analytics.byStatus).map(([status, count]) => <tr key={status}><td>{statusLabel(status)}</td><td>{count}</td></tr>)}
              </tbody></table></div>
            </section>
            <section>
              <h4 className="infrastructure-list-heading">By priority</h4>
              <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Priority</th><th>Reports</th></tr></thead><tbody>
                {Object.entries(analytics.byPriority).map(([priority, count]) => <tr key={priority}><td>{statusLabel(priority)}</td><td>{count}</td></tr>)}
              </tbody></table></div>
            </section>
            <section>
              <h4 className="infrastructure-list-heading">By report type</h4>
              <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Type</th><th>Reports</th></tr></thead><tbody>
                {Object.entries(analytics.byType).map(([type, count]) => <tr key={type}><td>{statusLabel(type)}</td><td>{count}</td></tr>)}
              </tbody></table></div>
            </section>
            <section>
              <h4 className="infrastructure-list-heading">Areas with reports</h4>
              {analytics.outagesByArea.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Area</th><th>Reports</th></tr></thead><tbody>
                {[...analytics.outagesByArea].sort((left, right) => right.outageCount - left.outageCount).map((area) => <tr key={area.areaId}><td><strong>{area.areaName}</strong><span>{area.areaCode ?? "No code"}</span></td><td>{area.outageCount}</td></tr>)}
              </tbody></table></div> : <div className="workspace-empty">No area reports in this date range.</div>}
            </section>
          </div>
        ) : <div className="workspace-empty">Outage analytics are unavailable.</div>}
      </section>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <WorkspacePage page="analytics">
      <AnalyticsPanel />
    </WorkspacePage>
  );
}
