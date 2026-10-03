"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { saveAccessToken } from "@/lib/session";

type AuthResult = { accessToken: string; refreshToken: string };

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

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (name.trim().length < 4 || name.trim().length > 20) {
      setError("Your name must be between 4 and 20 characters.");
      return;
    }
    if (!validPassword(password)) {
      setError("Use 8–20 characters with uppercase, lowercase, a number, and one of !@#$%^&*.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiRequest<null>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email, password }),
      });
      setStep("verify");
      setNotice(response.message || "Check your inbox for your verification code.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const response = await apiRequest<AuthResult>("/api/v1/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      saveAccessToken(response.data.accessToken);
      router.replace("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to verify your email.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside register-aside">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">R</span>Rakib</Link>
        <div className="auth-aside-copy">
          <span className="eyebrow">A LITTLE MORE IN CONTROL</span>
          <h1>Know what’s<br />next. <span>Plan for<br />everything.</span></h1>
          <p>Sign up to see service-area information and load schedules made for your community.</p>
        </div>
        <div className="aside-caption"><span className="caption-line" /> Your day, with fewer surprises</div>
        <div className="aside-decoration decoration-one" />
        <div className="aside-decoration decoration-two" />
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand"><Link className="brand" href="/"><span className="brand-mark">R</span>Rakib</Link></div>
        <div className="auth-form-wrap">
          <span className="eyebrow">{step === "details" ? "GET STARTED" : "ONE LAST STEP"}</span>
          <h2>{step === "details" ? "Create your account." : "Check your inbox."}</h2>
          <p className="auth-subtitle">
            {step === "details"
              ? "A few details and you’re on your way."
              : `We sent a 6-digit verification code to ${email}.`}
          </p>

          <div className="step-indicator" aria-label={step === "details" ? "Step 1 of 2" : "Step 2 of 2"}>
            <span className={step === "details" ? "step-active" : "step-complete"} />
            <span className={step === "verify" ? "step-active" : ""} />
            <small>{step === "details" ? "ACCOUNT DETAILS" : "EMAIL VERIFICATION"}</small>
          </div>

          {notice && <div className="form-notice" role="status">{notice}</div>}
          {error && <div className="form-error" role="alert">{error}</div>}

          {step === "details" ? (
            <form className="auth-form" onSubmit={createAccount}>
              <label htmlFor="name">Your name</label>
              <input
                autoComplete="name"
                id="name"
                maxLength={20}
                minLength={4}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Samira Rahman"
                required
                value={name}
              />

              <label htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />

              <label htmlFor="password">Create a password</label>
              <div className="password-wrap">
                <input
                  autoComplete="new-password"
                  id="password"
                  maxLength={20}
                  minLength={8}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a strong password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="field-hint">8–20 characters, with uppercase, lowercase, number &amp; special character.</p>

              <button className="button button-dark auth-submit" disabled={submitting} type="submit">
                {submitting ? "Creating account…" : "Create account"} <span aria-hidden="true">→</span>
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={verifyEmail}>
              <label htmlFor="otp">Verification code</label>
              <input
                autoComplete="one-time-code"
                className="otp-input"
                id="otp"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                name="otp"
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                value={otp}
              />
              <p className="field-hint">The code expires in 5 minutes. Check your spam folder if you can’t find the email.</p>
              <button className="button button-dark auth-submit" disabled={submitting || otp.length !== 6} type="submit">
                {submitting ? "Verifying…" : "Verify email & continue"} <span aria-hidden="true">→</span>
              </button>
              <button
                className="back-link"
                onClick={() => {
                  setStep("details");
                  setError("");
                  setNotice("");
                }}
                type="button"
              >
                ← Change account details
              </button>
            </form>
          )}

          <p className="auth-switch">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
          <div className="auth-security"><span>♧</span> Your account is protected and private.</div>
        </div>
        <div className="auth-copyright">© {new Date().getFullYear()} Rakib</div>
      </section>
    </main>
  );
}
