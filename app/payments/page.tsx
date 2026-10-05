"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type Report = {
  id: string;
  title: string;
  status: string;
  area: { name: string; code: string };
};

type Payment = {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  bkashPaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string; role: string };
};

type PaymentStart = Payment & { paymentURL: string };

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(amount);
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

function PaymentWorkspace({ role }: { role: string }) {
  const canInitiate = role === "CUSTOMER";
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsReloadKey, setReportsReloadKey] = useState(0);
  const [reportsError, setReportsError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [amount, setAmount] = useState("");
  const [checkout, setCheckout] = useState<PaymentStart | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startingPayment, setStartingPayment] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      setError("Your session has expired. Please log in again.");
      return;
    }
    const accessToken = token;
    let cancelled = false;

    async function loadPayments() {
      setLoading(true);
      const callbackUrl = new URL(window.location.href);
      const callbackStatus = callbackUrl.searchParams.get("paymentStatus");
      const transactionId = callbackUrl.searchParams.get("transactionId");
      const callbackMessages: Record<string, string> = {
        success: "bKash payment completed successfully. Your payment history has been refreshed.",
        failed: "bKash could not complete the payment. Your payment history has been refreshed.",
        cancelled: "The bKash payment was cancelled. Your payment history has been refreshed.",
      };
      if (callbackStatus && callbackMessages[callbackStatus]) {
        const transactionNote = transactionId ? ` Transaction: ${transactionId}.` : "";
        setNotice(`${callbackMessages[callbackStatus]}${transactionNote}`);
        callbackUrl.searchParams.delete("paymentStatus");
        callbackUrl.searchParams.delete("transactionId");
        window.history.replaceState(
          window.history.state,
          "",
          `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`,
        );
      }

      try {
        const response = await apiRequest<Payment[]>("/api/v1/payment", {}, accessToken);
        if (!cancelled) {
          setPayments(response.data);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load payments."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPayments();
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (!canInitiate) return;
    const token = getAccessToken();
    if (!token) {
      setReportsLoading(false);
      setReportsError("Your session has expired. Please log in again.");
      return;
    }
    const accessToken = token;
    let cancelled = false;

    async function loadReports() {
      setReportsLoading(true);
      setReportsError("");
      try {
        const response = await apiRequest<Report[]>("/api/v1/outage/my-reports", {}, accessToken);
        if (cancelled) return;
        setReports(response.data);
        if (response.data[0]) setSelectedReportId((currentId) => currentId || response.data[0].id);
      } catch (requestError) {
        if (!cancelled) setReportsError(messageFor(requestError, "Unable to load your outage reports."));
      } finally {
        if (!cancelled) setReportsLoading(false);
      }
    }

    void loadReports();
    return () => { cancelled = true; };
  }, [canInitiate, reportsReloadKey]);

  async function startPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 10000) {
      setError("Enter an amount greater than ৳0 and no more than ৳10,000.");
      return;
    }
    if (!selectedReportId) {
      setError("Select one of your outage reports to continue.");
      return;
    }

    setStartingPayment(true);
    setError("");
    setNotice("");
    setCheckout(null);
    try {
      const response = await apiRequest<PaymentStart>(
        "/api/v1/payment/initiate",
        {
          method: "POST",
          body: JSON.stringify({ outageId: selectedReportId, amount: paymentAmount }),
        },
        token,
      );
      setCheckout(response.data);
      setNotice("Payment started. Continue securely on bKash to complete it.");
      setReloadKey((currentKey) => currentKey + 1);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to start the bKash payment."));
    } finally {
      setStartingPayment(false);
    }
  }

  async function viewDetails(payment: Payment) {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    setDetailsLoading(true);
    setError("");
    try {
      const response = await apiRequest<Payment>(
        `/api/v1/payment/${encodeURIComponent(payment.id)}`,
        {},
        token,
      );
      setSelectedPayment(response.data);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to load payment details."));
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div className="payments-workspace">
      {canInitiate && (
        <section className="workspace-card" aria-labelledby="start-payment-heading">
          <div className="workspace-card-heading">
            <div><span className="eyebrow">BKASH CHECKOUT</span><h3 id="start-payment-heading">Start a payment</h3></div>
          </div>
          {reportsLoading ? (
            <div className="workspace-empty">Loading your outage reports…</div>
          ) : reportsError ? (
            <div className="workspace-message workspace-error" role="alert">
              <span>{reportsError}</span>
              <button className="workspace-refresh" onClick={() => setReportsReloadKey((key) => key + 1)} type="button">Retry</button>
            </div>
          ) : !reports.length ? (
            <div className="workspace-empty">
              A payment needs to be associated with one of your outage reports. Report an outage first, then return here to pay.
            </div>
          ) : (
            <form className="payment-start-form" onSubmit={startPayment}>
              <label htmlFor="payment-report">Outage report</label>
              <select id="payment-report" onChange={(event) => setSelectedReportId(event.target.value)} required value={selectedReportId}>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title} · {report.area.name} · {report.status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <label htmlFor="payment-amount">Amount (BDT)</label>
              <input
                id="payment-amount"
                max="10000"
                min="0.01"
                onChange={(event) => setAmount(event.target.value)}
                required
                step="0.01"
                type="number"
                value={amount}
              />
              <button className="button button-dark workspace-submit" disabled={startingPayment} type="submit">
                {startingPayment ? "Connecting to bKash…" : "Continue to bKash"}
              </button>
            </form>
          )}
          {checkout?.paymentURL && (
            <div className="payment-checkout">
              <p>Transaction <strong>{checkout.transactionId}</strong> is ready. Complete it in bKash, then refresh your payment history to see its status.</p>
              <a className="button button-dark payment-link" href={checkout.paymentURL} rel="noopener noreferrer" target="_blank">
                Open bKash checkout <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
        </section>
      )}

      <section className="workspace-card" aria-labelledby="payment-history-heading">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">TRANSACTION HISTORY</span><h3 id="payment-history-heading">{canInitiate ? "Your payments" : "Platform payments"}</h3></div>
          <div className="workspace-heading-actions">
            <span className="panel-count">{payments.length} payments</span>
            <button className="workspace-refresh" disabled={loading} onClick={() => setReloadKey((currentKey) => currentKey + 1)} type="button">Refresh</button>
          </div>
        </div>

        {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
        {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}

        {loading ? <div className="workspace-empty">Loading payments…</div> : payments.length ? (
          <div className="workspace-table-wrap">
            <table className="workspace-table payment-table">
              <thead><tr><th>Transaction</th>{!canInitiate && <th>Customer</th>}<th>Amount</th><th>Status</th><th>Created</th><th /></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>{payment.transactionId}</strong><span>{payment.bkashPaymentId ? `bKash ${payment.bkashPaymentId}` : "bKash checkout"}</span></td>
                    {!canInitiate && <td><strong>{payment.user?.name ?? "Unknown user"}</strong><span>{payment.user?.email ?? ""}</span></td>}
                    <td>{formatMoney(payment.amount)}</td>
                    <td><span className={`status-badge status-${payment.status.toLowerCase()}`}>{payment.status.replaceAll("_", " ")}</span></td>
                    <td>{formatDate(payment.createdAt)}</td>
                    <td><button className="table-action" disabled={detailsLoading} onClick={() => void viewDetails(payment)} type="button">Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="workspace-empty">No payment records have been created yet.</div>}

        {selectedPayment && (
          <section className="payment-detail" aria-label="Payment details">
            <div className="workspace-card-heading">
              <h4>{selectedPayment.transactionId}</h4>
              <button className="back-link" onClick={() => setSelectedPayment(null)} type="button">Close</button>
            </div>
            <p><strong>Amount:</strong> {formatMoney(selectedPayment.amount)}</p>
            <p><strong>Status:</strong> {selectedPayment.status.replaceAll("_", " ")}</p>
            <p><strong>Created:</strong> {formatDate(selectedPayment.createdAt)}</p>
            <p><strong>Updated:</strong> {formatDate(selectedPayment.updatedAt)}</p>
            {selectedPayment.user && <p><strong>Account:</strong> {selectedPayment.user.name} · {selectedPayment.user.email}</p>}
          </section>
        )}
      </section>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <WorkspacePage page="payments">
      {(user) => <PaymentWorkspace role={user.role} />}
    </WorkspacePage>
  );
}
