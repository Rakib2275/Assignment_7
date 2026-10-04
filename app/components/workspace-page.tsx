"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/session";

type WorkspaceRoute =
  | "analytics"
  | "audit-log"
  | "incidents"
  | "schedules"
  | "schedules-areas"
  | "users";

type User = {
  id: string;
  name: string;
  role: string;
};

const pageDetails: Record<WorkspaceRoute, { eyebrow: string; title: string; description: string }> = {
  analytics: {
    eyebrow: "NETWORK INSIGHTS",
    title: "Analytics",
    description: "Track service activity, outages, users, and payments across your network.",
  },
  "audit-log": {
    eyebrow: "SYSTEM ACTIVITY",
    title: "Audit log",
    description: "Review administrative activity across the platform.",
  },
  incidents: {
    eyebrow: "SERVICE OPERATIONS",
    title: "Outages",
    description: "Review outage reports and service updates for your network.",
  },
  schedules: {
    eyebrow: "SERVICE OPERATIONS",
    title: "Load schedules",
    description: "View and manage planned load schedules across service areas.",
  },
  "schedules-areas": {
    eyebrow: "AREA SCHEDULES",
    title: "Schedules by area",
    description: "Choose a service area to see its upcoming and past schedule entries.",
  },
  users: {
    eyebrow: "ACCOUNT DIRECTORY",
    title: "Users",
    description: "Search platform accounts and manage user roles.",
  },
};

export function WorkspacePage({
  page,
  children,
}: {
  page: WorkspaceRoute;
  children?: ReactNode | ((user: User) => ReactNode);
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const accessToken = token;

    async function loadProfile() {
      try {
        const response = await apiRequest<User>("/api/v1/auth/me", {}, accessToken);
        setUser(response.data);
      } catch (requestError) {
        clearAccessToken();
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your account.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  function logout() {
    clearAccessToken();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">R</span>
        <span>Loading workspace…</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="workspace-route-empty">
        <Link className="brand" href="/">
          <span className="brand-mark">R</span>Rakib
        </Link>
        <h1>{error ? "We couldn’t load this page." : "Log in to continue."}</h1>
        <p>{error || "Sign in to access your workspace."}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Link className="button button-dark" href="/login">
          Go to log in <span aria-hidden="true">→</span>
        </Link>
      </main>
    );
  }

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user.role);
  if ((page === "analytics" || page === "audit-log" || page === "users") && !isAdmin) {
    return (
      <main className="workspace-route-empty">
        <Link className="brand" href="/">
          <span className="brand-mark">R</span>Rakib
        </Link>
        <h1>Administrator access required.</h1>
        <p>This workspace is only available to platform administrators.</p>
        <Link className="button button-dark" href="/">Back to overview</Link>
      </main>
    );
  }

  const details = pageDetails[page];
  const content = typeof children === "function" ? children(user) : children;

  return (
    <main className="dashboard-shell workspace-route">
      <header className="site-header dashboard-header workspace-route-header">
        <Link className="brand" href="/" aria-label="Rakib dashboard">
          <span className="brand-mark">R</span>Rakib
        </Link>
        <nav className="workspace-route-nav" aria-label="Main navigation">
          <Link href="/">Overview</Link>
          <Link aria-current={page === "schedules" ? "page" : undefined} href="/schedules">Schedules</Link>
          <Link aria-current={page === "schedules-areas" ? "page" : undefined} href="/schedules-areas">By area</Link>
          <Link href="/areas">Service areas</Link>
          <Link href="/incidents">Outages</Link>
          {isAdmin && <Link href="/users">Users</Link>}
          {isAdmin && <Link href="/analytics">Analytics</Link>}
          {isAdmin && <Link href="/audit-log">Audit log</Link>}
        </nav>
        <div className="header-user">
          {isAdmin && (
            <span className="admin-role-badge">
              {user.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
            </span>
          )}
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
          <span className="header-user-name">{user.name}</span>
          <button className="text-button" onClick={logout} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="dashboard-content workspace-route-content">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">{details.eyebrow}</span>
            <h1>{details.title}</h1>
            <p>{details.description}</p>
          </div>
          <Link className="button button-light workspace-back-link" href="/">
            ← Back to overview
          </Link>
        </div>
        {content}
      </section>
    </main>
  );
}
