"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

function validPassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 20 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*]/.test(password)
  );
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const response = await apiRequest<null>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStep("reset");
      setNotice(response.message || "If the account exists, a password reset code has been sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request a reset code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!validPassword(password)) {
      setError("Use 8–20 characters with uppercase, lowercase, a number, and one of !@#$%^&*.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiRequest<null>("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, otp, newPassword: password }),
      });
      setNotice(response.message || "Your password has been reset. You can now log in.");
      setStep("email");
      setOtp("");
      setPassword("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reset your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">R</span>Rakib</Link>
        <div className="auth-aside-copy">
          <span className="eyebrow">ACCOUNT SECURITY</span>
          <h1>A fresh start,<br /><span>on your terms.</span></h1>
          <p>Reset your password securely and get back to the service information you need.</p>
        </div>
        <div className="aside-caption"><span className="caption-line" /> Your account, kept secure</div>
        <div className="aside-decoration decoration-one" />
        <div className="aside-decoration decoration-two" />
      </section>
      <section className="auth-main">
        <div className="auth-mobile-brand"><Link className="brand" href="/"><span className="brand-mark">R</span>Rakib</Link></div>
        <div className="auth-form-wrap">
          <span className="eyebrow">{step === "email" ? "PASSWORD HELP" : "VERIFY YOUR EMAIL"}</span>
          <h2>{step === "email" ? "Reset your password." : "Choose a new password."}</h2>
          <p className="auth-subtitle">
            {step === "email"
              ? "Enter your account email and we’ll send a verification code."
              : `Enter the code sent to ${email}, then choose a new password.`}
          </p>
          {notice && <div className="form-notice" role="status">{notice}</div>}
          {error && <div className="form-error" role="alert">{error}</div>}

          {step === "email" ? (
            <form className="auth-form" onSubmit={requestCode}>
              <label htmlFor="reset-email">Email address</label>
              <input autoComplete="email" id="reset-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
              <button className="button button-dark auth-submit" disabled={submitting} type="submit">
                {submitting ? "Sending code…" : "Send reset code"} <span aria-hidden="true">→</span>
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={resetPassword}>
              <label htmlFor="reset-otp">Verification code</label>
              <input autoComplete="one-time-code" className="otp-input" id="reset-otp" inputMode="numeric" maxLength={6} minLength={6} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required value={otp} />
              <label className="reset-password-label" htmlFor="reset-new-password">New password</label>
              <div className="password-wrap">
                <input autoComplete="new-password" id="reset-new-password" maxLength={20} minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="Create a strong password" required type={showPassword ? "text" : "password"} value={password} />
                <button aria-label={showPassword ? "Hide password" : "Show password"} className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? "Hide" : "Show"}</button>
              </div>
              <p className="field-hint">8–20 characters, with uppercase, lowercase, number &amp; special character.</p>
              <button className="button button-dark auth-submit" disabled={submitting || otp.length !== 6} type="submit">
                {submitting ? "Updating password…" : "Reset password"} <span aria-hidden="true">→</span>
              </button>
              <button className="back-link" onClick={() => { setStep("email"); setError(""); setNotice(""); }} type="button">← Use a different email</button>
            </form>
          )}
          <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
          <div className="auth-security"><span>♧</span> Your account is protected and private.</div>
        </div>
        <div className="auth-copyright">© {new Date().getFullYear()} Rakib</div>
      </section>
    </main>
  );
}
