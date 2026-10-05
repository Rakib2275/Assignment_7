"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type AdminStats = {
  users: { total: number; customers: number; operators: number; admins: number };
  infrastructure: { areas: number; schedules: number };
  outages: { total: number; active: number; completed: number };
  payments: { total: number; successful: number; successfulAmount: number };
};

function AdminConsole() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      setError("Your session has expired. Please log in again.");
      return;
    }
    const accessToken = token;
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      try {
        const response = await apiRequest<AdminStats>(
          "/api/v1/admin/dashboard-stats",
          {},
          accessToken,
        );
        if (!cancelled) {
          setStats(response.data);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load admin statistics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStats();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="admin-console">
      {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">PLATFORM SUMMARY</span><h3>Operational overview</h3></div>
          <button className="workspace-refresh" disabled={loading} onClick={() => window.location.reload()} type="button">Refresh</button>
        </div>
        {loading && !stats ? <div className="workspace-empty">Loading admin overview…</div> : stats ? (
          <div className="admin-console-stats">
            <article><span>Platform users</span><strong>{stats.users.total}</strong><small>{stats.users.customers} customers · {stats.users.operators} operators · {stats.users.admins} admins</small></article>
            <article><span>Service areas</span><strong>{stats.infrastructure.areas}</strong><small>Across network zones and feeders</small></article>
            <article><span>Published schedules</span><strong>{stats.infrastructure.schedules}</strong><small>Load schedule records</small></article>
            <article><span>Active outages</span><strong>{stats.outages.active}</strong><small>{stats.outages.total} reports · {stats.outages.completed} resolved</small></article>
            <article><span>Successful payments</span><strong>{stats.payments.successful}</strong><small>৳{stats.payments.successfulAmount.toLocaleString()} collected</small></article>
          </div>
        ) : <div className="workspace-empty">Admin statistics are unavailable.</div>}
      </section>

      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">ADMINISTRATIVE TOOLS</span><h3>Manage the platform</h3></div>
        </div>
        <div className="admin-tool-grid">
          <Link href="/users"><span className="admin-tool-icon">♙</span><strong>User management</strong><small>Search accounts and update user roles.</small><span className="admin-tool-link">Manage users →</span></Link>
          <Link href="/zone"><span className="admin-tool-icon">⌖</span><strong>Distribution zones</strong><small>Create, edit, and activate network zones.</small><span className="admin-tool-link">Manage zones →</span></Link>
          <Link href="/substation"><span className="admin-tool-icon">ϟ</span><strong>Substations</strong><small>Review and add substations to the network.</small><span className="admin-tool-link">Open substations →</span></Link>
          <Link href="/feeder"><span className="admin-tool-icon">⌁</span><strong>Feeders</strong><small>Review and add feeder circuits.</small><span className="admin-tool-link">Open feeders →</span></Link>
          <Link href="/analytics"><span className="admin-tool-icon">▥</span><strong>Analytics</strong><small>Explore platform and outage reporting insights.</small><span className="admin-tool-link">View analytics →</span></Link>
          <Link href="/audit-log"><span className="admin-tool-icon">◷</span><strong>Audit log</strong><small>Review recent administrative activity.</small><span className="admin-tool-link">View activity →</span></Link>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return <WorkspacePage page="admin"><AdminConsole /></WorkspacePage>;
}
