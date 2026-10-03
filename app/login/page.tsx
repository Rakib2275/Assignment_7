"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { saveAccessToken } from "@/lib/session";

type LoginResult = { accessToken: string; refreshToken: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiRequest<LoginResult>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveAccessToken(response.data.accessToken);
      router.replace("/");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to log in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-aside">
        <Link className="brand auth-brand" href="/"><span className="brand-mark">R</span>Rakib</Link>
        <div className="auth-aside-copy">
          <span className="eyebrow">A CLEARER VIEW OF YOUR DAY</span>
          <h1>Power plans<br />that make<br /><span>room for life.</span></h1>
          <p>Your service information, schedules, and areas—together in one simple place.</p>
        </div>
        <div className="aside-caption"><span className="caption-line" /> Made for everyday moments</div>
        <div className="aside-decoration decoration-one" />
        <div className="aside-decoration decoration-two" />
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand"><Link className="brand" href="/"><span className="brand-mark">R</span>Rakib</Link></div>
        <div className="auth-form-wrap">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Good to have you back.</h2>
          <p className="auth-subtitle">Log in to check what’s happening in your area.</p>

          {error && <div className="form-error" role="alert">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
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

            <div className="label-row">
              <label htmlFor="password">Password</label>
            </div>
            <div className="password-wrap">
              <input
                autoComplete="current-password"
                id="password"
                maxLength={20}
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
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

            <button className="button button-dark auth-submit" disabled={submitting} type="submit">
              {submitting ? "Logging in…" : "Log in"} <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="auth-switch">New to Rakib? <Link href="/register">Create an account</Link></p>
          <div className="auth-security"><span>♧</span> Your account is protected and private.</div>
        </div>
        <div className="auth-copyright">© {new Date().getFullYear()} Rakib</div>
      </section>
    </main>
  );
}
