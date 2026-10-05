"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/session";
import { ProfileImageControl } from "./components/profile-image-control";
import { OperationsWorkspace } from "./operations";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  imageUrl?: string;
};

type Schedule = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  area: {
    id: string;
    name: string;
    code: string;
    feeder?: {
      name: string;
      substation?: { name: string; zone?: { name: string } };
    };
  };
};

type Area = {
  id: string;
  name: string;
  code: string;
  feeder?: {
    id: string;
    name: string;
    code: string;
    substation?: {
      id: string;
      name: string;
      code: string;
      zone?: { id: string; name: string; code: string };
    };
  };
};
type PaginatedData<T> = { data: T[]; meta: { total: number } };

type AdminStats = {
  users: {
    total: number;
    customers: number;
    operators: number;
    admins: number;
  };
  infrastructure: { areas: number; schedules: number };
  outages: { total: number; active: number; completed: number };
  payments: {
    total: number;
    successful: number;
    successfulAmount: number;
  };
};

type DashboardData = {
  user: User;
  schedules: Schedule[];
  areas: Area[];
  adminStats: AdminStats | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function AdminDashboard({
  data,
  onLogout,
  onImageUploaded,
}: {
  data: DashboardData;
  onLogout: () => void;
  onImageUploaded: (imageUrl: string) => void;
}) {
  const stats = data.adminStats;
  if (!stats) return null;

  const recentSchedules = [...data.schedules]
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )
    .slice(0, 5);

  return (
    <main className="dashboard-shell admin-dashboard">
      <header className="site-header dashboard-header">
        <Link className="brand" href="/" aria-label="Rakib home">
          <span className="brand-mark">R</span>
          Rakib
        </Link>
        <nav className="dashboard-nav" aria-label="Main navigation">
          <Link href="/">Overview</Link>
          <Link href="/schedules">Schedules</Link>
          <Link href="/schedules-areas">By area</Link>
          <Link href="/areas">Service areas</Link>
          <Link href="/outage">Outages</Link>
          <Link href="/substation">Substations</Link>
          <Link href="/feeder">Feeders</Link>
          <Link href="/zone">Zones</Link>
          <Link href="/payments">Payments</Link>
          <Link href="/users">Users</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/analytics">Analytics</Link>
          <Link href="/audit-log">Audit log</Link>
        </nav>
        <div className="header-user">
          <span className="admin-role-badge">
            {data.user.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
          </span>
          <ProfileImageControl imageUrl={data.user.imageUrl} name={data.user.name} onImageUploaded={onImageUploaded} />
          <span className="header-user-name">{data.user.name}</span>
          <button className="text-button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">SYSTEM OVERVIEW</span>
            <h1>Welcome back, {data.user.name.split(" ")[0]}.</h1>
            <p>Monitor users, infrastructure, outages, and payments.</p>
          </div>
          <div className="live-pill"><span /> Live platform data</div>
        </div>

        <div className="stats-grid admin-stats-grid">
          <article className="stat-card">
            <span className="stat-icon green">♙</span>
            <span className="stat-label">Total users</span>
            <strong>{stats.users.total}</strong>
            <span className="stat-foot">
              {stats.users.customers} customers · {stats.users.operators} operators
            </span>
          </article>
          <article className="stat-card">
            <span className="stat-icon amber">⌖</span>
            <span className="stat-label">Service areas</span>
            <strong>{stats.infrastructure.areas}</strong>
            <span className="stat-foot">areas in the network</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon blue">◷</span>
            <span className="stat-label">Load schedules</span>
            <strong>{stats.infrastructure.schedules}</strong>
            <span className="stat-foot">published schedules</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon amber">ϟ</span>
            <span className="stat-label">Active outages</span>
            <strong>{stats.outages.active}</strong>
            <span className="stat-foot">{stats.outages.total} reports total</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon green">✓</span>
            <span className="stat-label">Resolved outages</span>
            <strong>{stats.outages.completed}</strong>
            <span className="stat-foot">restored or closed</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon blue">৳</span>
            <span className="stat-label">Successful payments</span>
            <strong>{stats.payments.successful}</strong>
            <span className="stat-foot">
              ৳{stats.payments.successfulAmount.toLocaleString()} collected
            </span>
          </article>
        </div>

        <div className="dashboard-columns admin-dashboard-columns">
          <section className="panel schedule-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">NETWORK ACTIVITY</span>
                <h2>Upcoming schedules</h2>
              </div>
              <span className="panel-count">{stats.infrastructure.schedules} total</span>
            </div>
            {recentSchedules.length ? (
              <div className="schedule-list">
                {recentSchedules.map((schedule) => (
                  <article className="schedule-row" key={schedule.id}>
                    <div className="schedule-date">
                      <span>{formatDate(schedule.startTime).split(",")[0]}</span>
                      <strong>{new Date(schedule.startTime).getDate()}</strong>
                      <span>
                        {new Intl.DateTimeFormat("en", { month: "short" }).format(
                          new Date(schedule.startTime),
                        )}
                      </span>
                    </div>
                    <div className="schedule-info">
                      <h3>{schedule.title}</h3>
                      <p>{schedule.area.name} <span>·</span> {schedule.area.code}</p>
                    </div>
                    <div className="schedule-time">
                      <strong>{formatTime(schedule.startTime)}</strong>
                      <span>to {formatTime(schedule.endTime)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">◷</span>
                <h3>No schedules yet</h3>
                <p>Published load schedules will appear here.</p>
              </div>
            )}
          </section>

          <section className="panel areas-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">NETWORK COVERAGE</span>
                <h2>Service areas</h2>
              </div>
              <span className="panel-count">{stats.infrastructure.areas} total</span>
            </div>
            {data.areas.length ? (
              <ul className="area-list">
                {data.areas.slice(0, 8).map((area) => (
                  <li key={area.id}>
                    <span className="area-pin">⌖</span>
                    <span>{area.name}</span>
                    <span className="area-code">{area.code}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state compact-empty">
                <p>No service areas are available yet.</p>
              </div>
            )}
          </section>
        </div>
        <p className="dashboard-note">Platform statistics are provided by the service backend.</p>
        <OperationsWorkspace user={data.user} areas={data.areas} schedules={data.schedules} />
      </section>
    </main>
  );
}

function Dashboard({ data, onLogout, onImageUploaded }: { data: DashboardData; onLogout: () => void; onImageUploaded: (imageUrl: string) => void }) {
  const upcoming = data.schedules
    .filter((schedule) => new Date(schedule.endTime).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

  return (
    <main className="dashboard-shell">
      <header className="site-header dashboard-header">
        <Link className="brand" href="/" aria-label="Rakib home">
          <span className="brand-mark">R</span>
          Rakib
        </Link>
        <nav className="dashboard-nav" aria-label="Main navigation">
          <Link href="/">Overview</Link>
          <Link href="/schedules">Schedules</Link>
          <Link href="/schedules-areas">By area</Link>
          <Link href="/areas">Service areas</Link>
          <Link href="/outage">Outages</Link>
          <Link href="/substation">Substations</Link>
          <Link href="/feeder">Feeders</Link>
          {data.user.role !== "OPERATOR" && <Link href="/payments">Payments</Link>}
          {["ADMIN", "SUPER_ADMIN"].includes(data.user.role) && <Link href="/zone">Zones</Link>}
          {["ADMIN", "SUPER_ADMIN"].includes(data.user.role) && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="header-user">
          <ProfileImageControl imageUrl={data.user.imageUrl} name={data.user.name} onImageUploaded={onImageUploaded} />
          <span className="header-user-name">{data.user.name}</span>
          <button className="text-button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">
              {data.user.role === "CUSTOMER" ? "YOUR CUSTOMER DASHBOARD" : "YOUR SERVICE DASHBOARD"}
            </span>
            <h1>Good to see you, {data.user.name.split(" ")[0]}.</h1>
            <p>Here’s what’s happening across your service areas.</p>
          </div>
          <div className="live-pill"><span /> Live service information</div>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon amber">◷</span>
            <span className="stat-label">Upcoming schedules</span>
            <strong>{upcoming.length}</strong>
            <span className="stat-foot">in the current schedule feed</span>
          </article>
          <article className="stat-card">
            <span className="stat-icon green">⌖</span>
            <span className="stat-label">Service areas</span>
            <strong>{data.areas.length}</strong>
            <span className="stat-foot">areas available to explore</span>
          </article>
          <article className="stat-card featured-stat">
            <span className="stat-icon blue">↗</span>
            <span className="stat-label">Your account</span>
            <strong className="account-status">Active</strong>
            <span className="stat-foot">{data.user.email}</span>
          </article>
        </div>

        <div className="dashboard-columns">
          <section className="panel schedule-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">STAY ONE STEP AHEAD</span>
                <h2>Load schedules</h2>
              </div>
              <span className="panel-count">{upcoming.length} upcoming</span>
            </div>
            {upcoming.length ? (
              <div className="schedule-list">
                {upcoming.map((schedule) => (
                  <article className="schedule-row" key={schedule.id}>
                    <div className="schedule-date">
                      <span>{formatDate(schedule.startTime).split(",")[0]}</span>
                      <strong>{new Date(schedule.startTime).getDate()}</strong>
                      <span>
                        {new Intl.DateTimeFormat("en", { month: "short" }).format(
                          new Date(schedule.startTime),
                        )}
                      </span>
                    </div>
                    <div className="schedule-info">
                      <h3>{schedule.title}</h3>
                      <p>
                        {schedule.area.name} <span>·</span> {schedule.area.code}
                      </p>
                      {schedule.area.feeder && (
                        <span className="schedule-location">
                          {schedule.area.feeder.name}
                          {schedule.area.feeder.substation
                            ? ` · ${schedule.area.feeder.substation.name}`
                            : ""}
                          {schedule.area.feeder.substation?.zone
                            ? ` · ${schedule.area.feeder.substation.zone.name}`
                            : ""}
                        </span>
                      )}
                    </div>
                    <div className="schedule-time">
                      <strong>{formatTime(schedule.startTime)}</strong>
                      <span>to {formatTime(schedule.endTime)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">◷</span>
                <h3>No upcoming schedules</h3>
                <p>There are no upcoming load schedules in the current feed.</p>
              </div>
            )}
          </section>

          <section className="panel areas-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">COVERAGE</span>
                <h2>Service areas</h2>
              </div>
              <span className="panel-count">{data.areas.length} areas</span>
            </div>
            {data.areas.length ? (
              <ul className="area-list">
                {data.areas.slice(0, 8).map((area) => (
                  <li key={area.id}>
                    <span className="area-pin">⌖</span>
                    <span>{area.name}</span>
                    <span className="area-code">{area.code}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state compact-empty">
                <p>No service areas are available yet.</p>
              </div>
            )}
          </section>
        </div>
        <p className="dashboard-note">
          Schedule and area information is provided by your service operator.
        </p>
        <OperationsWorkspace user={data.user} areas={data.areas} schedules={data.schedules} />
      </section>
    </main>
  );
}

function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="site-header landing-header">
        <Link className="brand" href="/" aria-label="Rakib home">
          <span className="brand-mark">R</span>
          Rakib
        </Link>
        <nav className="landing-nav">
          <a href="#how-it-works">How it works</a>
          <Link href="/login">Log in</Link>
          <Link className="button button-dark nav-cta" href="/register">
            Create account <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> POWER, WITH A PLAN</span>
          <h1>Stay ahead of<br />the <span>switch.</span></h1>
          <p className="hero-description">
            Clear, timely load schedule updates for your area—so your day can
            keep moving, whatever the grid is doing.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" href="/register">
              Get started <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-light" href="/login">I have an account</Link>
          </div>
          <div className="hero-proof">
            <span className="proof-avatars"><i>R</i><i>M</i><i>A</i></span>
            <span>Helping communities stay in the know</span>
          </div>
        </div>
        <div className="hero-art" aria-label="Illustration of a power schedule dashboard">
          <div className="sun-glow" />
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="power-line line-one" />
          <div className="power-line line-two" />
          <div className="tower tower-left"><i /><i /><i /><b /><em /></div>
          <div className="tower tower-right"><i /><i /><i /><b /><em /></div>
          <div className="hero-schedule-card">
            <div className="preview-top"><span className="preview-dot" /> SCHEDULE PREVIEW <span className="preview-live">LIVE</span></div>
            <div className="preview-area"><span className="preview-pin">⌖</span><span><b>Your area</b><small>Power schedule</small></span><span className="preview-chevron">↗</span></div>
            <div className="preview-divider" />
            <div className="preview-event"><span className="event-icon">ϟ</span><span><b>Plan around your day</b><small>Verified updates, all in one place</small></span></div>
            <div className="preview-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="preview-chart-labels"><span>6 am</span><span>12 pm</span><span>6 pm</span><span>12 am</span></div>
          </div>
          <div className="floating-note"><span className="note-check">✓</span><span><b>Stay in the loop</b><small>Know what to expect</small></span></div>
          <div className="art-ground" />
        </div>
      </section>

      <section className="feature-strip" id="how-it-works">
        <div className="feature-intro">
          <span className="eyebrow">A LITTLE MORE CERTAINTY</span>
          <h2>Make room for what matters.</h2>
          <p>Useful power information, without the guesswork.</p>
        </div>
        <article className="feature-item">
          <span className="feature-icon icon-calendar">▦</span>
          <h3>Schedules at a glance</h3>
          <p>See upcoming load schedules for supported service areas.</p>
        </article>
        <article className="feature-item">
          <span className="feature-icon icon-pin">⌖</span>
          <h3>Find your area</h3>
          <p>Browse service locations and the areas around you.</p>
        </article>
        <article className="feature-item">
          <span className="feature-icon icon-bolt">ϟ</span>
          <h3>Updates you can use</h3>
          <p>Plan ahead with clear, operator-provided information.</p>
        </article>
      </section>
      <footer className="landing-footer">
        <Link className="brand footer-brand" href="/"><span className="brand-mark">R</span>Rakib</Link>
        <span>Clearer days start with better information.</span>
        <span>© {new Date().getFullYear()} Rakib</span>
      </footer>
    </main>
  );
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    async function loadDashboard(accessToken: string) {
      try {
        const [profile, schedulesResponse, areasResponse] = await Promise.all([
          apiRequest<User>("/api/v1/auth/me", {}, accessToken),
          apiRequest<PaginatedData<Schedule>>(
            "/api/v1/schedule?limit=100&sortBy=startTime&sortOrder=asc",
            {},
            accessToken,
          ),
          apiRequest<PaginatedData<Area>>(
            "/api/v1/area?limit=100&sortBy=name&sortOrder=asc",
            {},
            accessToken,
          ),
        ]);
        const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(profile.data.role);
        const adminStatsResponse = isAdmin
          ? await apiRequest<AdminStats>("/api/v1/admin/dashboard-stats", {}, accessToken)
          : null;
        setData({
          user: profile.data,
          schedules: schedulesResponse.data.data,
          areas: areasResponse.data.data,
          adminStats: adminStatsResponse?.data ?? null,
        });
      } catch (requestError) {
        clearAccessToken();
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard(token);
  }, []);

  function logout() {
    clearAccessToken();
    setData(null);
  }

  function updateProfileImage(imageUrl: string) {
    setData((current) => current ? {
      ...current,
      user: { ...current.user, imageUrl },
    } : current);
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">R</span>
        <span>Getting your dashboard ready…</span>
      </main>
    );
  }

  if (data) {
    if (["ADMIN", "SUPER_ADMIN"].includes(data.user.role)) {
      return <AdminDashboard data={data} onLogout={logout} onImageUploaded={updateProfileImage} />;
    }
    return <Dashboard data={data} onLogout={logout} onImageUploaded={updateProfileImage} />;
  }

  return (
    <>
      {error && (
        <div className="notice-bar" role="status">
          {error} Please log in again.
          <Link href="/login">Log in</Link>
        </div>
      )}
      <LandingPage />
    </>
  );
}
