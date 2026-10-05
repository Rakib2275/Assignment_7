"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
};

type AuditResult = {
  data: AuditEntry[];
  meta: { page: number; limit: number; total: number; totalPage: number };
};

function AuditDirectory() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [action, setAction] = useState("");
  const [appliedAction, setAppliedAction] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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

    async function loadLogs() {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({ page: String(page), limit: "10" });
      if (appliedAction) query.set("action", appliedAction);
      try {
        const response = await apiRequest<AuditResult>(
          `/api/v1/admin/audit-logs?${query.toString()}`,
          {},
          accessToken,
        );
        if (cancelled) return;
        setLogs(response.data.data);
        setTotal(response.data.meta.total);
        setTotalPages(Math.max(response.data.meta.totalPage, 1));
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load the audit log.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLogs();
    return () => { cancelled = true; };
  }, [appliedAction, page]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedAction(action.trim());
    setPage(1);
  }

  return (
    <section className="workspace-card" aria-labelledby="audit-log-heading">
      <div className="workspace-card-heading">
        <div><span className="eyebrow">ADMIN ACTIVITY</span><h3 id="audit-log-heading">Audit log</h3></div>
        <span className="panel-count">{total} events</span>
      </div>
      <form className="workspace-filters audit-filters" onSubmit={submitSearch}>
        <input aria-label="Filter audit events by action" onChange={(event) => setAction(event.target.value)} placeholder="Filter by action" type="search" value={action} />
        <button className="button button-light filter-submit" disabled={loading} type="submit">Search</button>
        <button className="button button-light filter-submit" disabled={loading || !appliedAction} onClick={() => { setAction(""); setAppliedAction(""); setPage(1); }} type="button">Clear</button>
      </form>
      {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
      {loading ? <div className="workspace-empty">Loading audit activity…</div> : logs.length ? (
        <>
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead><tr><th>Action</th><th>Entity</th><th>Administrator</th><th>Date and time</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td><strong>{log.action.replaceAll("_", " ")}</strong><span>{log.id}</span></td>
                    <td>{log.entity}</td>
                    <td>{log.user ? <><strong>{log.user.name}</strong><span>{log.user.email} · {log.user.role.replaceAll("_", " ")}</span></> : "System"}</td>
                    <td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="workspace-pagination">
            <span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
            <div>
              <button className="button button-light" disabled={page <= 1 || loading} onClick={() => setPage((currentPage) => currentPage - 1)} type="button">Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button className="button button-light" disabled={page >= totalPages || loading} onClick={() => setPage((currentPage) => currentPage + 1)} type="button">Next</button>
            </div>
          </div>
        </>
      ) : <div className="workspace-empty">{appliedAction ? "No audit events match this action." : "No administrative events have been recorded yet."}</div>}
    </section>
  );
}

export default function AuditLogPage() {
  return <WorkspacePage page="audit-log"><AuditDirectory /></WorkspacePage>;
}
