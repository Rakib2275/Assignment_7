"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { readPaymentOutages } from "@/lib/payment-outages";
import { WorkspacePage } from "../components/workspace-page";

type Area = { id: string; name: string; code: string };
type Operator = { id: string; name: string; email: string; role: string };
type Assignment = { technician: Operator };
type Outage = {
  id: string;
  title: string;
  description?: string | null;
  type: "SCHEDULED" | "UNEXPECTED";
  status: string;
  priority: string;
  reportedAt: string;
  area: Area;
  reportedBy?: { name: string; email: string };
  assignments?: Assignment[];
  payments?: { id: string; status: string; amount: number; transactionId: string }[];
};
type PaymentStatus = { id: string; status: string };
type OutageResult = {
  data: Outage[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
type OutageForm = {
  title: string;
  description: string;
  areaId: string;
  type: "SCHEDULED" | "UNEXPECTED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

const emptyForm: OutageForm = {
  title: "",
  description: "",
  areaId: "",
  type: "UNEXPECTED",
  priority: "MEDIUM",
};

const statusTransitions: Record<string, string[]> = {
  REPORTED: ["VERIFIED"],
  VERIFIED: ["IN_PROGRESS"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESTORED"],
  RESTORED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function OutageWorkspace({ role }: { role: string }) {
  const isCustomer = role === "CUSTOMER";
  const canManage = ["ADMIN", "SUPER_ADMIN", "OPERATOR"].includes(role);
  const [areas, setAreas] = useState<Area[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [paidReportIds, setPaidReportIds] = useState<Set<string>>(() => new Set());
  const [retryReportIds, setRetryReportIds] = useState<Set<string>>(() => new Set());
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    status: "",
    priority: "",
    type: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState<OutageForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyOutageId, setBusyOutageId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isCustomer) return;
    const refreshPaymentStatuses = () => setPaymentRefreshKey((key) => key + 1);
    window.addEventListener("focus", refreshPaymentStatuses);
    return () => window.removeEventListener("focus", refreshPaymentStatuses);
  }, [isCustomer]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const accessToken = token;
    let cancelled = false;

    async function loadAreasAndOperators() {
      try {
        const areaResponse = await apiRequest<{ data: Area[] }>(
          "/api/v1/area?page=1&limit=100&sortBy=name&sortOrder=asc",
          {},
          accessToken,
        );
        if (cancelled) return;
        setAreas(areaResponse.data.data);
        if (areaResponse.data.data[0]) {
          setForm((current) => ({ ...current, areaId: current.areaId || areaResponse.data.data[0].id }));
        }
        if (role === "ADMIN" || role === "SUPER_ADMIN") {
          const operatorResponse = await apiRequest<{ data: Operator[] }>(
            "/api/v1/admin/users?role=OPERATOR&limit=100",
            {},
            accessToken,
          );
          if (!cancelled) setOperators(operatorResponse.data.data);
        }
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load service areas."));
      }
    }

    void loadAreasAndOperators();
    return () => { cancelled = true; };
  }, [role]);

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
      setLoading(true);
      setError("");
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy: "reportedAt",
        sortOrder: "desc",
      });
      if (appliedFilters.search.trim()) query.set("search", appliedFilters.search.trim());
      if (appliedFilters.status) query.set("status", appliedFilters.status);
      if (appliedFilters.priority) query.set("priority", appliedFilters.priority);
      if (appliedFilters.type) query.set("type", appliedFilters.type);

      try {
        if (isCustomer) {
          const response = await apiRequest<Outage[]>("/api/v1/outage/my-reports", {}, accessToken);
          if (cancelled) return;
          setOutages(response.data);
          setTotal(response.data.length);
          setTotalPages(1);
          setPaidReportIds(new Set());
          setRetryReportIds(new Set());
          try {
            const paymentResponse = await apiRequest<PaymentStatus[]>("/api/v1/payment", {}, accessToken);
            if (cancelled) return;
            const paymentOutages = readPaymentOutages();
            const paidIds = new Set<string>();
            const latestStatusByOutage = new Map<string, string>();
            for (const payment of paymentResponse.data) {
              const outageId = paymentOutages[payment.id];
              if (!outageId) continue;
              if (payment.status === "SUCCESS") paidIds.add(outageId);
              if (!latestStatusByOutage.has(outageId)) latestStatusByOutage.set(outageId, payment.status);
            }
            setPaidReportIds(paidIds);
            setRetryReportIds(new Set(
              [...latestStatusByOutage]
                .filter(([outageId, paymentStatus]) => paymentStatus !== "SUCCESS" && !paidIds.has(outageId))
                .map(([outageId]) => outageId),
            ));
          } catch {
            // The outage directory remains usable if payment history is temporarily unavailable.
          }
        } else {
          const response = await apiRequest<OutageResult>(`/api/v1/outage?${query.toString()}`, {}, accessToken);
          if (cancelled) return;
          setOutages(response.data.data);
          setTotal(response.data.meta.total);
          setTotalPages(Math.max(response.data.meta.totalPages, 1));
        }
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load outage reports."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOutages();
    return () => { cancelled = true; };
  }, [appliedFilters, isCustomer, page, paymentRefreshKey]);

  async function reportOutage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<Outage>(
        "/api/v1/outage",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            title: form.title.trim(),
            description: form.description.trim() || undefined,
          }),
        },
        token,
      );
      setForm({ ...emptyForm, areaId: areas[0]?.id ?? "" });
      setShowForm(false);
      setNotice("Your outage report was submitted.");
      setPage(1);
      try {
        if (isCustomer) {
          const response = await apiRequest<Outage[]>("/api/v1/outage/my-reports", {}, token);
          setOutages(response.data);
          setTotal(response.data.length);
        } else {
          const query = new URLSearchParams({ page: "1", limit: "10", sortBy: "reportedAt", sortOrder: "desc" });
          const response = await apiRequest<OutageResult>(`/api/v1/outage?${query.toString()}`, {}, token);
          setOutages(response.data.data);
          setTotal(response.data.meta.total);
          setTotalPages(Math.max(response.data.meta.totalPages, 1));
        }
      } catch {
        setError("Report submitted, but the report list could not be refreshed. Reload the page to see it.");
      }
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to submit your outage report."));
    } finally {
      setSaving(false);
    }
  }

  async function updateOutage(
    outage: Outage,
    action: "verify" | "status" | "assign",
    value?: string,
  ) {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    setBusyOutageId(outage.id);
    setError("");
    setNotice("");
    try {
      if (action === "verify") {
        await apiRequest<Outage>(
          `/api/v1/outage/${encodeURIComponent(outage.id)}/verify`,
          { method: "PATCH", body: JSON.stringify({}) },
          token,
        );
      } else if (action === "status" && value) {
        await apiRequest<Outage>(
          `/api/v1/outage/${encodeURIComponent(outage.id)}/status`,
          { method: "PATCH", body: JSON.stringify({ status: value }) },
          token,
        );
      } else if (action === "assign" && value) {
        await apiRequest<unknown>(
          `/api/v1/outage/${encodeURIComponent(outage.id)}/assign`,
          { method: "POST", body: JSON.stringify({ technicianId: value }) },
          token,
        );
      }
      setNotice("Outage report updated.");
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy: "reportedAt",
        sortOrder: "desc",
      });
      if (appliedFilters.search.trim()) query.set("search", appliedFilters.search.trim());
      if (appliedFilters.status) query.set("status", appliedFilters.status);
      if (appliedFilters.priority) query.set("priority", appliedFilters.priority);
      if (appliedFilters.type) query.set("type", appliedFilters.type);
      const response = await apiRequest<OutageResult>(`/api/v1/outage?${query.toString()}`, {}, token);
      setOutages(response.data.data);
      setTotal(response.data.meta.total);
      setTotalPages(Math.max(response.data.meta.totalPages, 1));
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to update this outage report."));
    } finally {
      setBusyOutageId("");
    }
  }

  return (
    <div className="workspace-grid outage-workspace">
      <section className="workspace-card" aria-labelledby="outage-reports-heading">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">{isCustomer ? "YOUR SERVICE REPORTS" : "SERVICE OPERATIONS"}</span><h3 id="outage-reports-heading">{isCustomer ? "My outage reports" : "Outage directory"}</h3></div>
          <div className="workspace-heading-actions">
            <span className="panel-count">{total} reports</span>
            {isCustomer && <button className="button button-dark" onClick={() => { setShowForm((value) => !value); setError(""); }} type="button">Report outage</button>}
          </div>
        </div>

        {canManage && (
          <form className="workspace-filters incident-filters" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ search, status, priority, type }); setPage(1); }}>
            <input aria-label="Search outage reports" onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" type="search" value={search} />
            <select aria-label="Filter by outage status" onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">All statuses</option>
              {["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESTORED", "CLOSED"].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
            <select aria-label="Filter by priority" onChange={(event) => setPriority(event.target.value)} value={priority}>
              <option value="">All priorities</option>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((item) => <option key={item} value={item}>{humanize(item)}</option>)}
            </select>
            <select aria-label="Filter by outage type" onChange={(event) => setType(event.target.value)} value={type}>
              <option value="">All types</option>
              <option value="SCHEDULED">Scheduled</option><option value="UNEXPECTED">Unexpected</option>
            </select>
            <button className="button button-light filter-submit" disabled={loading} type="submit">Apply</button>
          </form>
        )}

        {showForm && isCustomer && (
          <section className="schedule-editor" aria-labelledby="outage-form-heading">
            <div className="workspace-card-heading"><h4 id="outage-form-heading">Report a service interruption</h4><button className="back-link" onClick={() => setShowForm(false)} type="button">Cancel</button></div>
            <form className="workspace-form" onSubmit={reportOutage}>
              <label htmlFor="outage-title">What happened?</label>
              <input id="outage-title" maxLength={150} minLength={3} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Briefly describe the outage" required value={form.title} />
              <label htmlFor="outage-description">Details <span className="optional-label">(optional)</span></label>
              <textarea id="outage-description" maxLength={1000} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} />
              <label htmlFor="outage-area">Service area</label>
              <select id="outage-area" onChange={(event) => setForm({ ...form, areaId: event.target.value })} required value={form.areaId}>
                <option value="">Select an area</option>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.code}</option>)}
              </select>
              <div className="workspace-form-row">
                <div><label htmlFor="outage-type">Report type</label><select id="outage-type" onChange={(event) => { const nextType = event.target.value; if (nextType === "SCHEDULED" || nextType === "UNEXPECTED") setForm({ ...form, type: nextType }); }} value={form.type}><option value="UNEXPECTED">Unexpected</option><option value="SCHEDULED">Scheduled</option></select></div>
                <div><label htmlFor="outage-priority">Priority</label><select id="outage-priority" onChange={(event) => { const nextPriority = event.target.value; if (nextPriority === "LOW" || nextPriority === "MEDIUM" || nextPriority === "HIGH" || nextPriority === "CRITICAL") setForm({ ...form, priority: nextPriority }); }} value={form.priority}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
              </div>
              <button className="button button-dark workspace-submit" disabled={saving || !areas.length} type="submit">{saving ? "Submitting…" : "Submit report"}</button>
            </form>
          </section>
        )}

        {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
        {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}

        {loading ? <div className="workspace-empty">Loading outage reports…</div> : outages.length ? (
          <>
            <div className="outage-report-list">
              {outages.map((outage) => {
                const nextStatuses = statusTransitions[outage.status] ?? [];
                return (
                  <article className="outage-report-card" key={outage.id}>
                    <div className="outage-report-heading">
                      <div><span className="eyebrow">{humanize(outage.type)} · {humanize(outage.priority)} PRIORITY</span><h4>{outage.title}</h4></div>
                      <span className={`status-badge status-${outage.status.toLowerCase()}`}>{humanize(outage.status)}</span>
                    </div>
                    {outage.description && <p className="outage-report-description">{outage.description}</p>}
                    <div className="outage-report-meta">
                      <span><strong>Area</strong>{outage.area.name} · {outage.area.code}</span>
                      <span><strong>Reported</strong>{formatDate(outage.reportedAt)}</span>
                      {outage.reportedBy && <span><strong>By</strong>{outage.reportedBy.name}</span>}
                      {outage.assignments?.[0] && <span><strong>Assigned to</strong>{outage.assignments[0].technician.name}</span>}
                    </div>
                    {isCustomer && (
                      <div className="outage-payment-action">
                        {paidReportIds.has(outage.id) ? (
                          <span className="payment-paid-badge" role="status"><span aria-hidden="true">✓</span> Paid</span>
                        ) : (
                          <Link className="button button-dark" href={`/payments?outageId=${encodeURIComponent(outage.id)}`}>
                            {retryReportIds.has(outage.id) ? "Try payment again" : "Continue to payment"}
                            <span aria-hidden="true">→</span>
                          </Link>
                        )}
                      </div>
                    )}
                    {canManage && (
                      <div className="record-actions">
                        {outage.status === "REPORTED" && (role === "ADMIN" || role === "SUPER_ADMIN") && (
                          <button className="table-action" disabled={busyOutageId === outage.id} onClick={() => void updateOutage(outage, "verify")} type="button">Verify report</button>
                        )}
                        {nextStatuses.length > 0 && (
                          <select aria-label={`Update status for ${outage.title}`} disabled={busyOutageId === outage.id} onChange={(event) => { if (event.target.value) void updateOutage(outage, "status", event.target.value); }} value="">
                            <option value="">Move to next status…</option>
                            {nextStatuses.map((nextStatus) => <option key={nextStatus} value={nextStatus}>{humanize(nextStatus)}</option>)}
                          </select>
                        )}
                        {outage.payments?.some((payment) => payment.status === "SUCCESS") && <span className="payment-paid-badge" role="status">✓ Customer paid</span>}
                        {outage.status === "VERIFIED" && outage.payments?.some((payment) => payment.status === "SUCCESS") && (role === "ADMIN" || role === "SUPER_ADMIN") && operators.length > 0 && (
                          <select aria-label={`Assign operator to ${outage.title}`} disabled={busyOutageId === outage.id} onChange={(event) => { if (event.target.value) void updateOutage(outage, "assign", event.target.value); }} value="">
                            <option value="">Assign an operator…</option>
                            {operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name} · {operator.email}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {!isCustomer && (
              <div className="workspace-pagination">
                <span>Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}</span>
                <div>
                  <button className="button button-light" disabled={page <= 1 || loading} onClick={() => setPage((currentPage) => currentPage - 1)} type="button">Previous</button>
                  <span>Page {page} of {totalPages}</span>
                  <button className="button button-light" disabled={page >= totalPages || loading} onClick={() => setPage((currentPage) => currentPage + 1)} type="button">Next</button>
                </div>
              </div>
            )}
          </>
        ) : (
          !error ? (
            <div className="workspace-empty">
              {isCustomer ? "You haven’t reported an outage yet." : "No outage reports match the current filters."}
            </div>
          ) : null
        )}
      </section>
    </div>
  );
}

export default function OutagePage() {
  return <WorkspacePage page="outage">{(user) => <OutageWorkspace role={user.role} />}</WorkspacePage>;
}
