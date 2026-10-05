"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../../components/workspace-page";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentId = new URLSearchParams(window.location.search).get("paymentId");
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again to view this payment.");
      setLoading(false);
      return;
    }
    if (!paymentId) {
      setError("The payment reference is missing. Check your payment history for the latest status.");
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
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load payment details.",
          );
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
          <h2 id="payment-success-heading">Payment received</h2>
          <p className="workspace-message workspace-error" role="alert">{error}</p>
          <Link className="button button-light" href="/payments">Go to payment history</Link>
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
    <WorkspacePage page="payments">
      {() => <div className="payments-workspace"><PaymentSuccessDetails /></div>}
    </WorkspacePage>
  );
}
