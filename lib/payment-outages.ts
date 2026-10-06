const PAYMENT_OUTAGES_KEY = "load-management-payment-outages";

type PaymentOutageMap = Record<string, string>;

// The API payment record has no outageId, so keep the client-side association locally.
export function rememberPaymentOutage(paymentId: string, outageId: string) {
  if (!paymentId || !outageId || typeof window === "undefined") return;

  try {
    const current = readPaymentOutages();
    current[paymentId] = outageId;
    const recentEntries = Object.entries(current).slice(-100);
    window.localStorage.setItem(PAYMENT_OUTAGES_KEY, JSON.stringify(Object.fromEntries(recentEntries)));
  } catch {
    // Payment checkout should still work if browser storage is unavailable.
  }
}

export function readPaymentOutages(): PaymentOutageMap {
  if (typeof window === "undefined") return {};

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PAYMENT_OUTAGES_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}
