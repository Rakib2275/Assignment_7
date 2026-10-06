"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Payment = {
  id: string;
  transactionId: string;
  amount: number;
  status: string;
  bkashPaymentId?: string | null;
  createdAt: string;
};

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

function PaymentSuccessDetails() {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [callbackConfirmed, setCallbackConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("paymentId");
    const callbackStatus = (params.get("paymentStatus") ?? "").toLowerCase();
    const token = getAccessToken();
    if (!paymentId) {
      if (callbackStatus === "success") {
        setCallbackConfirmed(true);
        setLoading(false);
        return;
      }
      setError("The payment reference is missing. Check your payment history for the latest status.");
      setLoading(false);
      return;
    }
    setPaymentReference(paymentId);
    if (!token) {
      setError("bKash confirmed this payment. Sign in to view the full transaction details.");
      setLoading(false);
      return;
    }

    const accessToken = token;
    const requestedPaymentId = paymentId;
    let cancelled = false;
    async function loadPayment() {
      try {
        const response = await apiRequest<Payment>(
          `/api/v1/payment/${encodeURIComponent(requestedPaymentId)}`,
          {},
          accessToken,
        );
        if (!cancelled) setPayment(response.data);
      } catch {
        if (!cancelled) {
          setError("bKash confirmed this payment. Sign in to view the full transaction details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPayment();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="workspace-card payment-success-card" aria-labelledby="payment-success-heading">
      {loading ? (
        <div className="workspace-empty">Loading payment details…</div>
      ) : error ? (
        <>
          <div className="payment-success-mark" aria-hidden="true">✓</div>
          <span className="eyebrow">BKASH PAYMENT COMPLETE</span>
          <h2 id="payment-success-heading">Payment successful</h2>
          <p className="payment-success-intro">Your payment was confirmed by bKash.</p>
          <p className="workspace-message workspace-notice" role="status">{error}</p>
          {paymentReference && <p className="payment-callback-reference"><strong>Payment reference</strong>{paymentReference}</p>}
          <div className="payment-result-actions">
            <Link className="button button-dark" href="/">Back to dashboard</Link>
            <Link className="button button-light" href="/">Back to overview</Link>
          </div>
        </>
      ) : callbackConfirmed ? (
        <>
          <div className="payment-success-mark" aria-hidden="true">✓</div>
          <span className="eyebrow">BKASH PAYMENT COMPLETE</span>
          <h2 id="payment-success-heading">Payment successful</h2>
          <p className="payment-success-intro">bKash confirmed your payment. Your payment history will show the full transaction details.</p>
          <Link className="button button-dark" href="/">Back to dashboard</Link>
        </>
      ) : payment ? (
        <>
          {payment.status === "SUCCESS" && <div className="payment-success-mark" aria-hidden="true">✓</div>}
          <span className="eyebrow">{payment.status === "SUCCESS" ? "BKASH PAYMENT COMPLETE" : "BKASH PAYMENT STATUS"}</span>
          <h2 id="payment-success-heading">{payment.status === "SUCCESS" ? "Payment successful" : "Payment not confirmed"}</h2>
          <p className="payment-success-intro">
            {payment.status === "SUCCESS"
              ? "Your payment was confirmed. Here are the transaction details."
              : "This transaction is not marked as successful. Check its current status below."}
          </p>
          <dl className="payment-success-details">
            <div><dt>Amount</dt><dd>{formatMoney(payment.amount)}</dd></div>
            <div><dt>Transaction ID</dt><dd>{payment.transactionId}</dd></div>
            <div><dt>bKash payment ID</dt><dd>{payment.bkashPaymentId || "Not available"}</dd></div>
            <div><dt>Status</dt><dd><span className={`status-badge status-${payment.status.toLowerCase()}`}>{payment.status}</span></dd></div>
            <div><dt>Transaction date</dt><dd>{formatDate(payment.createdAt)}</dd></div>
          </dl>
          <Link className="button button-dark" href="/payments">View payment history</Link>
        </>
      ) : null}
    </section>
  );
}

export default function PaymentSuccessPage() {
  return (
    <main className="payment-callback-shell">
      <Link className="brand" href="/"><span className="brand-mark">R</span>Rakib</Link>
      <div className="payments-workspace"><PaymentSuccessDetails /></div>
    </main>
  );
}
