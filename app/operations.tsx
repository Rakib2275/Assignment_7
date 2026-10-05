"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Area = { id: string; name: string; code: string };
type Schedule = { id: string };
type User = { role: string };
type Outage = {
  id: string;
  title: string;
  status: string;
  priority: string;
  reportedAt: string;
  area: Area;
};

type OperationsWorkspaceProps = {
  user: User;
  areas: Area[];
  schedules: Schedule[];
};

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function OperationsWorkspace({ user, areas, schedules }: OperationsWorkspaceProps) {
  const isCustomer = user.role === "CUSTOMER";
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const [outages, setOutages] = useState<Outage[]>([]);
  const [outageCount, setOutageCount] = useState(0);
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

    async function loadOutages() {
      try {
        if (isCustomer) {
          const response = await apiRequest<Outage[]>("/api/v1/outage/my-reports", {}, accessToken);
          if (!cancelled) {
            setOutages(response.data.slice(0, 4));
            setOutageCount(response.data.length);
          }
        } else {
          const response = await apiRequest<{ data: Outage[]; meta: { total: number } }>(
            "/api/v1/outage?page=1&limit=4&sortBy=reportedAt&sortOrder=desc",
            {},
            accessToken,
          );
          if (!cancelled) {
            setOutages(response.data.data);
            setOutageCount(response.data.meta.total);
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load outage activity.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOutages();
    return () => { cancelled = true; };
  }, [isCustomer]);

  return (
    <section className="operations-workspace operations-overview" aria-label="Workspace overview">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">{isCustomer ? "YOUR SERVICE" : "OPERATIONS"}</span>
          <h2>{isCustomer ? "Your service activity" : "Operations overview"}</h2>
          <p>{isCustomer ? "Keep track of reports and plan around upcoming service." : "A quick view of current reports and the tools used to manage service."}</p>
        </div>
      </div>

      <div className="operations-summary">
        <Link className="operations-summary-card" href="/areas">
          <span className="operations-summary-icon">⌖</span>
          <span><small>Service areas</small><strong>{areas.length}</strong></span>
          <span className="operations-summary-link">Browse →</span>
        </Link>
        <Link className="operations-summary-card" href="/schedules">
          <span className="operations-summary-icon">◷</span>
          <span><small>Schedules</small><strong>{schedules.length}</strong></span>
          <span className="operations-summary-link">{isAdmin || user.role === "OPERATOR" ? "Manage →" : "View →"}</span>
        </Link>
        <Link className="operations-summary-card" href="/outage">
          <span className="operations-summary-icon">ϟ</span>
          <span><small>{isCustomer ? "Your reports" : "Outage reports"}</small><strong>{outageCount}</strong></span>
          <span className="operations-summary-link">{isCustomer ? "Report / view →" : "Open queue →"}</span>
        </Link>
        {isCustomer && (
          <Link className="operations-summary-card" href="/payments">
            <span className="operations-summary-icon">৳</span>
            <span><small>Payments</small><strong>Secure</strong></span>
            <span className="operations-summary-link">Open →</span>
          </Link>
        )}
      </div>

      <section className="workspace-card operations-activity" aria-labelledby="operations-activity-heading">
        <div className="workspace-card-heading">
          <div>
            <span className="eyebrow">{isCustomer ? "REPORT UPDATES" : "LATEST REPORTS"}</span>
            <h3 id="operations-activity-heading">{isCustomer ? "Your outage reports" : "Recent outage activity"}</h3>
          </div>
          <Link className="workspace-refresh operations-view-all" href="/outage">
            {isCustomer ? "View all reports" : "Open outage workspace"}
          </Link>
        </div>
        {error ? (
          <p className="workspace-message workspace-error" role="alert">{error}</p>
        ) : loading ? (
          <div className="workspace-empty">Loading outage activity…</div>
        ) : outages.length ? (
          <div className="operations-activity-list">
            {outages.map((outage) => (
              <article className="operations-activity-row" key={outage.id}>
                <span className={`operations-activity-mark status-${outage.status.toLowerCase()}`} aria-hidden="true">ϟ</span>
                <div className="operations-activity-copy">
                  <strong>{outage.title}</strong>
                  <span>{outage.area.name} · {outage.area.code} · {formatDate(outage.reportedAt)}</span>
                </div>
                <span className={`status-badge status-${outage.status.toLowerCase()}`}>{humanize(outage.status)}</span>
                <span className={`priority-label priority-${outage.priority.toLowerCase()}`}>{humanize(outage.priority)}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="operations-empty">
            <span className="operations-empty-icon">✓</span>
            <div>
              <strong>{isCustomer ? "No service reports yet" : "No outage reports to review"}</strong>
              <p>{isCustomer ? "If you experience a service interruption, report it to keep your updates in one place." : "New customer outage reports will appear here."}</p>
            </div>
            {isCustomer && <Link className="button button-dark" href="/outage">Report an outage</Link>}
          </div>
        )}
      </section>
    </section>
  );
}
