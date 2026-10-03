"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type User = { id: string; name: string; email: string; role: string; status?: string };
type Area = { id: string; name: string; code: string };
type Schedule = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  area: Pick<Area, "name"> & Partial<Pick<Area, "id" | "code">>;
};
type Paginated<T> = { data: T[]; meta: { total: number } };
type Outage = {
  id: string;
  title: string;
  description?: string | null;
  type: "SCHEDULED" | "UNEXPECTED";
  status: string;
  priority: string;
  reportedAt: string;
  area: Area;
  reportedBy?: Pick<User, "id" | "name" | "email" | "role">;
  assignments?: Array<{
    technician: Pick<User, "id" | "name" | "email" | "role">;
  }>;
};
type Payment = {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  createdAt: string;
  user?: Pick<User, "name" | "email">;
};
type AuditLog = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user?: Pick<User, "name" | "email" | "role">;
};
type Feeder = { id: string; name: string; code: string; substation?: { name: string } };

function listData<T>(value: T[] | Paginated<T>) {
  return Array.isArray(value) ? value : value.data;
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PanelMessage({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
      {notice && <p className="workspace-message workspace-notice" role="status">{notice}</p>}
    </>
  );
}

export function OperationsWorkspace({
  user,
  areas,
  schedules,
}: {
  user: User;
  areas: Area[];
  schedules: Schedule[];
}) {
  const admin = ["ADMIN", "SUPER_ADMIN"].includes(user.role);
  const operator = user.role === "OPERATOR";
  const [active, setActive] = useState(admin ? "Incident queue" : operator ? "Incident queue" : "My reports");
  const tabs = admin
    ? ["Incident queue", "Schedules & areas", "Users", "Payments", "Audit log"]
    : operator
      ? ["Incident queue", "Schedules"]
      : ["My reports", "Payments"];

  return (
    <section className="operations-workspace" aria-label="Service tools">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">SERVICE TOOLS</span>
          <h2>{admin ? "Manage your network" : operator ? "Your workbench" : "Your service"}</h2>
          <p>
            {admin
              ? "Review reports, manage accounts, and keep operations moving."
              : operator
                ? "Track reported outages and keep customers up to date."
                : "Report a service issue and follow its progress."}
          </p>
        </div>
      </div>
      <div className="workspace-tabs" role="tablist" aria-label="Service tools">
        {tabs.map((tab) => (
          <button
            aria-selected={active === tab}
            className={active === tab ? "workspace-tab is-active" : "workspace-tab"}
            key={tab}
            onClick={() => setActive(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="workspace-panel" role="tabpanel">
        {active === "My reports" && <CustomerReports user={user} areas={areas} />}
        {active === "Payments" && (
          <PaymentsPanel admin={admin} user={user} />
        )}
        {active === "Incident queue" && (
          <IncidentQueue user={user} areas={areas} />
        )}
        {active === "Schedules" && (
          <SchedulesPanel areas={areas} schedules={schedules} />
        )}
        {active === "Schedules & areas" && (
          <InfrastructurePanel areas={areas} schedules={schedules} />
        )}
        {active === "Users" && <UsersPanel user={user} />}
        {active === "Audit log" && <AuditPanel />}
      </div>
    </section>
  );
}

function CustomerReports({ user, areas }: { user: User; areas: Area[] }) {
  const [reports, setReports] = useState<Outage[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [type, setType] = useState<Outage["type"]>("UNEXPECTED");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadReports() {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }
    try {
      const response = await apiRequest<Outage[]>("/api/v1/outage/my-reports", {}, token);
      setReports(response.data);
      setError("");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to load your reports."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const result = await apiRequest<Outage>("/api/v1/outage", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          areaId,
          type,
          priority,
        }),
      }, token);
      setReports((current) => [result.data, ...current]);
      setTitle("");
      setDescription("");
      setNotice(result.message || "Your outage report was submitted.");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to submit your report."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="workspace-grid customer-workspace-grid">
      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">LET US KNOW</span><h3>Report an outage</h3></div>
        </div>
        <PanelMessage error={error} notice={notice} />
        {areas.length === 0 ? (
          <div className="workspace-empty">No service areas are available yet.</div>
        ) : (
          <form className="workspace-form" onSubmit={submitReport}>
            <label htmlFor="report-title">What is happening?</label>
            <input id="report-title" maxLength={150} minLength={3} onChange={(event) => setTitle(event.target.value)} placeholder="Briefly describe the outage" required value={title} />
            <label htmlFor="report-area">Service area</label>
            <select id="report-area" onChange={(event) => setAreaId(event.target.value)} required value={areaId}>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.code}</option>)}
            </select>
            <label htmlFor="report-description">Details <span className="optional-label">(optional)</span></label>
            <textarea id="report-description" maxLength={1000} onChange={(event) => setDescription(event.target.value)} placeholder="Add any details that could help the service team." rows={3} value={description} />
            <div className="workspace-form-row">
              <div><label htmlFor="report-type">Report type</label><select id="report-type" onChange={(event) => setType(event.target.value as Outage["type"])} value={type}><option value="UNEXPECTED">Unexpected outage</option><option value="SCHEDULED">Scheduled work</option></select></div>
              <div><label htmlFor="report-priority">Priority</label><select id="report-priority" onChange={(event) => setPriority(event.target.value)} value={priority}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
            </div>
            <button className="button button-dark workspace-submit" disabled={submitting || !areaId} type="submit">{submitting ? "Sending report…" : "Submit report"} <span aria-hidden="true">→</span></button>
          </form>
        )}
      </section>
      <section className="workspace-card">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">YOUR ACTIVITY</span><h3>My outage reports</h3></div>
          <button className="workspace-refresh" onClick={() => void loadReports()} type="button">Refresh</button>
        </div>
        {loading ? <div className="workspace-empty">Loading your reports…</div> : reports.length ? (
          <div className="workspace-record-list">
            {reports.map((report) => (
              <article className="workspace-record" key={report.id}>
                <div className="record-title-row"><h4>{report.title}</h4><span className={`status-badge status-${report.status.toLowerCase()}`}>{statusLabel(report.status)}</span></div>
                <p>{report.area?.name ?? "Service area"}{report.area?.code ? ` · ${report.area.code}` : ""} · {dateTime(report.reportedAt)}</p>
                {report.description && <p className="record-description">{report.description}</p>}
                <div className="record-meta"><span className={`priority-${report.priority.toLowerCase()}`}>{statusLabel(report.priority)} priority</span><span>{report.assignments?.[0]?.technician?.name ? `Assigned to ${report.assignments[0].technician.name}` : "Awaiting service team"}</span></div>
              </article>
            ))}
          </div>
        ) : <div className="workspace-empty">You haven’t submitted any outage reports yet.</div>}
      </section>
      <p className="workspace-footnote">Signed in as {user.email}. Report updates are supplied by your service operator.</p>
    </div>
  );
}

function IncidentQueue({ user, areas }: { user: User; areas: Area[] }) {
  const admin = ["ADMIN", "SUPER_ADMIN"].includes(user.role);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [operators, setOperators] = useState<User[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [areaId, setAreaId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadQueue() {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: "100", sortBy: "reportedAt", sortOrder: "desc" });
      if (status) query.set("status", status);
      if (areaId) query.set("areaId", areaId);
      if (search.trim()) query.set("search", search.trim());
      const [outageResponse, operatorResponse] = await Promise.all([
        apiRequest<Paginated<Outage>>(`/api/v1/outage?${query.toString()}`, {}, token),
        admin
          ? apiRequest<User[] | Paginated<User>>("/api/v1/admin/users?role=OPERATOR&limit=100", {}, token)
          : Promise.resolve(null),
      ]);
      setOutages(outageResponse.data.data);
      if (operatorResponse) setOperators(listData(operatorResponse.data));
      setError("");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to load the incident queue."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, [status, areaId]);

  async function mutateOutage(outage: Outage, action: "verify" | "assign" | "status", nextStatus?: string) {
    setBusyId(outage.id);
    setError("");
    setNotice("");
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Your session has expired. Please log in again.");
      if (action === "verify") {
        await apiRequest<Outage>(`/api/v1/outage/${outage.id}/verify`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }, token);
      } else if (action === "assign") {
        const technicianId = admin ? selectedOperator[outage.id] : user.id;
        if (!technicianId) throw new Error("Select an operator before assigning this report.");
        await apiRequest<Outage>(`/api/v1/outage/${outage.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ technicianId }),
        }, token);
      } else if (nextStatus) {
        await apiRequest<Outage>(`/api/v1/outage/${outage.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        }, token);
      }
      setNotice("Incident updated successfully.");
      await loadQueue();
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to update this incident."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="workspace-card">
      <div className="workspace-card-heading">
        <div><span className="eyebrow">FIELD OPERATIONS</span><h3>Incident queue</h3></div>
        <button className="workspace-refresh" onClick={() => void loadQueue()} type="button">Refresh</button>
      </div>
      <PanelMessage error={error} notice={notice} />
      <form className="workspace-filters" onSubmit={(event) => { event.preventDefault(); void loadQueue(); }}>
        <input aria-label="Search incidents" onChange={(event) => setSearch(event.target.value)} placeholder="Search reports…" value={search} />
        <select aria-label="Filter by status" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All statuses</option>{["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESTORED", "CLOSED"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
        <select aria-label="Filter by service area" onChange={(event) => setAreaId(event.target.value)} value={areaId}><option value="">All service areas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        <button className="button button-light filter-submit" type="submit">Search</button>
      </form>
      {loading ? <div className="workspace-empty">Loading incident reports…</div> : outages.length ? (
        <div className="workspace-record-list incident-list">
          {outages.map((outage) => {
            const assigned = outage.assignments?.find((assignment) => assignment.technician)?.technician;
            const nextStatus: Record<string, string> = { ASSIGNED: "IN_PROGRESS", IN_PROGRESS: "RESTORED", RESTORED: "CLOSED" };
            return (
              <article className="workspace-record incident-record" key={outage.id}>
                <div className="record-title-row"><h4>{outage.title}</h4><span className={`status-badge status-${outage.status.toLowerCase()}`}>{statusLabel(outage.status)}</span></div>
                <p>{outage.area?.name ?? "Service area"}{outage.area?.code ? ` · ${outage.area.code}` : ""} · Reported {dateTime(outage.reportedAt)}</p>
                {outage.description && <p className="record-description">{outage.description}</p>}
                <div className="record-meta"><span>{outage.reportedBy ? `By ${outage.reportedBy.name}` : statusLabel(outage.type)}</span><span className={`priority-${outage.priority.toLowerCase()}`}>{statusLabel(outage.priority)} priority</span>{assigned && <span>Operator: {assigned.name}</span>}</div>
                <div className="record-actions">
                  {outage.status === "REPORTED" && <button className="button button-dark small-action" disabled={busyId === outage.id} onClick={() => void mutateOutage(outage, "verify")} type="button">{busyId === outage.id ? "Updating…" : "Verify report"}</button>}
                  {outage.status === "VERIFIED" && (
                    <>
                      {admin ? <select aria-label={`Operator for ${outage.title}`} onChange={(event) => setSelectedOperator((current) => ({ ...current, [outage.id]: event.target.value }))} value={selectedOperator[outage.id] ?? ""}><option value="">Select operator</option>{operators.map((operatorOption) => <option key={operatorOption.id} value={operatorOption.id}>{operatorOption.name}</option>)}</select> : null}
                      <button className="button button-dark small-action" disabled={busyId === outage.id || (admin && !selectedOperator[outage.id])} onClick={() => void mutateOutage(outage, "assign")} type="button">{admin ? "Assign operator" : "Assign to me"}</button>
                    </>
                  )}
                  {nextStatus[outage.status] && <button className="button button-dark small-action" disabled={busyId === outage.id} onClick={() => void mutateOutage(outage, "status", nextStatus[outage.status])} type="button">Mark {statusLabel(nextStatus[outage.status])}</button>}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="workspace-empty">No incidents match these filters.</div>}
    </div>
  );
}

function PaymentsPanel({ admin, user }: { admin: boolean; user: User }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reports, setReports] = useState<Outage[]>([]);
  const [outageId, setOutageId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadPayments() {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [paymentResponse, reportResponse] = await Promise.all([
        apiRequest<Payment[]>("/api/v1/payment", {}, token),
        admin ? Promise.resolve(null) : apiRequest<Outage[]>("/api/v1/outage/my-reports", {}, token),
      ]);
      setPayments(paymentResponse.data);
      if (reportResponse) setReports(reportResponse.data);
      setError("");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to load payment history."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  async function initiatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPaymentUrl("");
    setSubmitting(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await apiRequest<{ paymentURL: string }>("/api/v1/payment/initiate", {
        method: "POST",
        body: JSON.stringify({ outageId, amount: Number(amount) }),
      }, token);
      setPaymentUrl(response.data.paymentURL);
      setNotice("Payment session created. Continue securely with bKash.");
      await loadPayments();
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to start the payment."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="workspace-grid">
      {!admin && (
        <section className="workspace-card">
          <div className="workspace-card-heading"><div><span className="eyebrow">BKASH</span><h3>Make a payment</h3></div></div>
          <p className="workspace-helper">Choose one of your outage reports and enter the amount requested by your service provider.</p>
          <PanelMessage error={error} notice={notice} />
          <form className="workspace-form payment-form" onSubmit={initiatePayment}>
            <label htmlFor="payment-outage">Outage report</label>
            <select id="payment-outage" onChange={(event) => setOutageId(event.target.value)} required value={outageId}><option value="">Choose a report</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.title} · {report.area?.name ?? "Area"} ({statusLabel(report.status)})</option>)}</select>
            <label htmlFor="payment-amount">Amount (BDT)</label>
            <input id="payment-amount" inputMode="decimal" max="10000" min="1" onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 250" required type="number" value={amount} />
            <button className="button button-dark workspace-submit" disabled={submitting || !outageId} type="submit">{submitting ? "Preparing payment…" : "Continue to bKash"} <span aria-hidden="true">→</span></button>
            {paymentUrl && <a className="button button-light payment-link" href={paymentUrl} rel="noreferrer" target="_blank">Open secure payment page ↗</a>}
          </form>
        </section>
      )}
      <section className="workspace-card">
        <div className="workspace-card-heading"><div><span className="eyebrow">TRANSACTIONS</span><h3>{admin ? "All payments" : "Payment history"}</h3></div><button className="workspace-refresh" onClick={() => void loadPayments()} type="button">Refresh</button></div>
        {admin && <PanelMessage error={error} notice={notice} />}
        {loading ? <div className="workspace-empty">Loading payments…</div> : payments.length ? (
          <div className="workspace-record-list">
            {payments.map((payment) => <article className="workspace-record compact-record" key={payment.id}>
              <div className="record-title-row"><h4>{payment.transactionId}</h4><span className={`status-badge status-${payment.status.toLowerCase()}`}>{statusLabel(payment.status)}</span></div>
              <p>{payment.user ? `${payment.user.name} · ${payment.user.email} · ` : ""}{dateTime(payment.createdAt)}</p>
              <div className="record-meta"><strong>৳{Number(payment.amount).toLocaleString()}</strong><span>Transaction {payment.id.slice(0, 8)}</span></div>
            </article>)}
          </div>
        ) : <div className="workspace-empty">No payments have been recorded yet.</div>}
      </section>
      {!admin && <p className="workspace-footnote">Payments are processed through bKash. You are signed in as {user.email}.</p>}
    </div>
  );
}

function SchedulesPanel({ areas, schedules }: { areas: Area[]; schedules: Schedule[] }) {
  const [currentSchedules, setCurrentSchedules] = useState(schedules);
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await apiRequest<Schedule>("/api/v1/schedule", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          areaId,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        }),
      }, token);
      setCurrentSchedules((current) => [response.data, ...current]);
      setNotice(response.message || "Schedule published successfully.");
      setTitle("");
      setStartTime("");
      setEndTime("");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to publish this schedule."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-grid customer-workspace-grid">
      <section className="workspace-card">
        <div className="workspace-card-heading"><div><span className="eyebrow">PLAN AHEAD</span><h3>Publish a schedule</h3></div></div>
        <PanelMessage error={error} notice={notice} />
        {areas.length ? <form className="workspace-form" onSubmit={createSchedule}>
          <label htmlFor="schedule-title">Schedule title</label><input id="schedule-title" maxLength={150} minLength={3} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Evening maintenance" required value={title} />
          <label htmlFor="schedule-area">Service area</label><select id="schedule-area" onChange={(event) => setAreaId(event.target.value)} required value={areaId}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.code}</option>)}</select>
          <div className="workspace-form-row"><div><label htmlFor="schedule-start">Starts</label><input id="schedule-start" onChange={(event) => setStartTime(event.target.value)} required type="datetime-local" value={startTime} /></div><div><label htmlFor="schedule-end">Ends</label><input id="schedule-end" min={startTime || undefined} onChange={(event) => setEndTime(event.target.value)} required type="datetime-local" value={endTime} /></div></div>
          <button className="button button-dark workspace-submit" disabled={busy} type="submit">{busy ? "Publishing…" : "Publish schedule"} <span aria-hidden="true">→</span></button>
        </form> : <div className="workspace-empty">Create a service area before publishing schedules.</div>}
      </section>
      <section className="workspace-card">
        <div className="workspace-card-heading"><div><span className="eyebrow">NETWORK ACTIVITY</span><h3>Published schedules</h3></div></div>
        {currentSchedules.length ? <div className="workspace-record-list">{currentSchedules.slice(0, 12).map((schedule) => <article className="workspace-record compact-record" key={schedule.id}><div className="record-title-row"><h4>{schedule.title}</h4><span className="status-badge">{schedule.area?.name ?? "Area"}</span></div><p>{dateTime(schedule.startTime)} – {dateTime(schedule.endTime)}</p></article>)}</div> : <div className="workspace-empty">No published schedules are available.</div>}
      </section>
    </div>
  );
}

function InfrastructurePanel({ areas, schedules }: { areas: Area[]; schedules: Schedule[] }) {
  const [currentAreas, setCurrentAreas] = useState(areas);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [areaName, setAreaName] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [feederId, setFeederId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function loadFeeders() {
      const token = getAccessToken();
      if (!token) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      try {
        const response = await apiRequest<Feeder[]>("/api/v1/feeder", {}, token);
        setFeeders(response.data);
      } catch (requestError) {
        setError(messageFor(requestError, "Unable to load network feeders."));
      }
    }
    void loadFeeders();
  }, []);

  async function createArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await apiRequest<Area>("/api/v1/area", {
        method: "POST",
        body: JSON.stringify({ name: areaName.trim(), code: areaCode.trim().toUpperCase(), feederId }),
      }, token);
      setCurrentAreas((current) => [response.data, ...current]);
      setNotice(response.message || "Service area created successfully.");
      setAreaName("");
      setAreaCode("");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to create this service area."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-grid">
      <section className="workspace-card">
        <div className="workspace-card-heading"><div><span className="eyebrow">NETWORK COVERAGE</span><h3>Add a service area</h3></div></div>
        <PanelMessage error={error} notice={notice} />
        {feeders.length ? <form className="workspace-form" onSubmit={createArea}>
          <label htmlFor="area-name">Area name</label><input id="area-name" maxLength={100} minLength={2} onChange={(event) => setAreaName(event.target.value)} placeholder="e.g. Central Ward" required value={areaName} />
          <label htmlFor="area-code">Area code</label><input id="area-code" maxLength={20} minLength={2} onChange={(event) => setAreaCode(event.target.value.toUpperCase())} placeholder="e.g. CT-01" required value={areaCode} />
          <label htmlFor="area-feeder">Feeder</label><select id="area-feeder" onChange={(event) => setFeederId(event.target.value)} required value={feederId}><option value="">Choose a feeder</option>{feeders.map((feeder) => <option key={feeder.id} value={feeder.id}>{feeder.name} · {feeder.code}{feeder.substation ? ` · ${feeder.substation.name}` : ""}</option>)}</select>
          <button className="button button-dark workspace-submit" disabled={busy} type="submit">{busy ? "Saving…" : "Create service area"} <span aria-hidden="true">→</span></button>
        </form> : <div className="workspace-empty">No feeders are available. Add a feeder in the existing network setup first.</div>}
      </section>
      <section className="workspace-card">
        <div className="workspace-card-heading"><div><span className="eyebrow">INFRASTRUCTURE</span><h3>Current network</h3></div></div>
        <div className="infrastructure-summary"><div><strong>{currentAreas.length}</strong><span>Service areas</span></div><div><strong>{schedules.length}</strong><span>Schedules loaded</span></div><div><strong>{feeders.length}</strong><span>Feeders</span></div></div>
        <SchedulesPanel areas={currentAreas} schedules={schedules} />
      </section>
    </div>
  );
}

function UsersPanel({ user }: { user: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadUsers(searchTerm = search) {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: "100", sortBy: "createdAt", sortOrder: "desc" });
      if (searchTerm.trim()) query.set("search", searchTerm.trim());
      const response = await apiRequest<Paginated<User>>(`/api/v1/admin/users?${query.toString()}`, {}, token);
      setUsers(response.data.data);
      setRoles(Object.fromEntries(response.data.data.map((item) => [item.id, item.role])));
      setError("");
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to load user accounts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers("");
  }, []);

  async function updateRole(target: User) {
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Your session has expired. Please log in again.");
      const response = await apiRequest<User>(`/api/v1/admin/users/${target.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: roles[target.id] }),
      }, token);
      setUsers((current) => current.map((item) => item.id === target.id ? response.data : item));
      setNotice(`Role updated for ${target.name}.`);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to update this user's role."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="workspace-card">
      <div className="workspace-card-heading"><div><span className="eyebrow">ACCESS CONTROL</span><h3>User accounts</h3></div><span className="panel-count">{users.length} shown</span></div>
      <PanelMessage error={error} notice={notice} />
      <form className="workspace-filters user-search" onSubmit={(event) => { event.preventDefault(); void loadUsers(); }}><input aria-label="Search users" onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email…" value={search} /><button className="button button-light filter-submit" type="submit">Search</button></form>
      {loading ? <div className="workspace-empty">Loading accounts…</div> : users.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>User</th><th>Status</th><th>Role</th><th>Action</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><span>{account.email}{account.id === user.id ? " · You" : ""}</span></td><td><span className={`status-badge status-${(account as User & { status?: string }).status?.toLowerCase() ?? "active"}`}>{statusLabel((account as User & { status?: string }).status ?? "ACTIVE")}</span></td><td><select aria-label={`Role for ${account.name}`} disabled={account.id === user.id} onChange={(event) => setRoles((current) => ({ ...current, [account.id]: event.target.value }))} value={roles[account.id] ?? account.role}>{["CUSTOMER", "OPERATOR", "ADMIN", "SUPER_ADMIN"].map((role) => <option key={role} value={role}>{statusLabel(role)}</option>)}</select></td><td><button className="table-action" disabled={busyId === account.id || account.id === user.id || roles[account.id] === account.role} onClick={() => void updateRole(account)} type="button">{busyId === account.id ? "Saving…" : "Save role"}</button></td></tr>)}</tbody></table></div> : <div className="workspace-empty">No users match your search.</div>}
      <p className="workspace-footnote">You cannot change your own role. Role changes are recorded in the audit log.</p>
    </section>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadLogs() {
      const token = getAccessToken();
      if (!token) {
        setError("Your session has expired. Please log in again.");
        setLoading(false);
        return;
      }
      try {
        const response = await apiRequest<Paginated<AuditLog>>("/api/v1/admin/audit-logs?limit=100", {}, token);
        setLogs(response.data.data);
        setError("");
      } catch (requestError) {
        setError(messageFor(requestError, "Unable to load audit history."));
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    void loadLogs();
  }, [reloadKey]);

  return (
    <section className="workspace-card">
      <div className="workspace-card-heading"><div><span className="eyebrow">ACCOUNTABILITY</span><h3>Recent audit events</h3></div><button className="workspace-refresh" onClick={() => setReloadKey((key) => key + 1)} type="button">Refresh</button></div>
      <PanelMessage error={error} notice="" />
      {loading ? <div className="workspace-empty">Loading audit history…</div> : logs.length ? <div className="workspace-record-list">{logs.map((log) => <article className="workspace-record compact-record" key={log.id}><div className="record-title-row"><h4>{statusLabel(log.action)}</h4><span className="status-badge">{statusLabel(log.entity)}</span></div><p>{log.user ? `${log.user.name} · ${log.user.email} · ` : ""}{dateTime(log.createdAt)}</p></article>)}</div> : <div className="workspace-empty">No audit events have been recorded yet.</div>}
    </section>
  );
}
