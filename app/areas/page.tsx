"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/session";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Feeder = {
  id: string;
  name: string;
  code: string;
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
      zone?: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
};

type AreaPageData = {
  data: Area[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type AreaForm = { name: string; code: string; feederId: string };

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load service areas.";
}

export default function AreasPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [feederId, setFeederId] = useState("");
  const [areaForm, setAreaForm] = useState<AreaForm>({ name: "", code: "", feederId: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [profileLoading, setProfileLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(true);
  const [savingArea, setSavingArea] = useState(false);
  const [areaNotice, setAreaNotice] = useState("");
  const [areaReloadKey, setAreaReloadKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setProfileLoading(false);
      setAreasLoading(false);
      return;
    }
    const accessToken = token;

    async function loadProfileAndFeeders() {
      try {
        const [profileResponse, feederResponse] = await Promise.all([
          apiRequest<User>("/api/v1/auth/me", {}, accessToken),
          apiRequest<Feeder[]>("/api/v1/feeder", {}, accessToken),
        ]);
        setUser(profileResponse.data);
        setFeeders(feederResponse.data);
      } catch (requestError) {
        clearAccessToken();
        setError(messageFor(requestError));
      } finally {
        setProfileLoading(false);
      }
    }

    void loadProfileAndFeeders();
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setAreasLoading(false);
      return;
    }
    const accessToken = token;

    async function loadAreas() {
      setAreasLoading(true);
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: "12",
          sortBy: "name",
          sortOrder: "asc",
        });
        if (appliedSearch) query.set("search", appliedSearch);
        if (feederId) query.set("feederId", feederId);

        const response = await apiRequest<AreaPageData>(
          `/api/v1/area?${query.toString()}`,
          {},
          accessToken,
        );
        setAreas(response.data.data);
        setTotal(response.data.meta.total);
        setTotalPages(Math.max(response.data.meta.totalPages, 1));
        setError("");
      } catch (requestError) {
        setError(messageFor(requestError));
      } finally {
        setAreasLoading(false);
      }
    }

    void loadAreas();
  }, [appliedSearch, feederId, page, areaReloadKey]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = search.trim();
    if (nextSearch === appliedSearch && page === 1) return;
    setAppliedSearch(nextSearch);
    setPage(1);
  }

  async function createArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setSavingArea(true);
    setError("");
    setAreaNotice("");
    try {
      await apiRequest<Area>(
        "/api/v1/area",
        {
          method: "POST",
          body: JSON.stringify({
            name: areaForm.name.trim(),
            code: areaForm.code.trim().toUpperCase(),
            feederId: areaForm.feederId,
          }),
        },
        token,
      );
      setAreaForm({ name: "", code: "", feederId: "" });
      setAreaNotice("Service area created successfully.");
      setPage(1);
      setAreaReloadKey((currentKey) => currentKey + 1);
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setSavingArea(false);
    }
  }

  function logout() {
    clearAccessToken();
    router.replace("/login");
  }

  if (profileLoading) {
    return (
      <main className="loading-screen">
        <span className="brand-mark">R</span>
        <span>Loading service areas…</span>
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
        <p>{error || "Sign in to explore service areas in your network."}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Link className="button button-dark" href="/login">
          Go to log in <span aria-hidden="true">→</span>
        </Link>
      </main>
    );
  }

  const admin = ["ADMIN", "SUPER_ADMIN"].includes(user.role);
  const operator = user.role === "OPERATOR";

  return (
    <main className="dashboard-shell workspace-route">
      <header className="site-header dashboard-header workspace-route-header">
        <Link className="brand" href="/" aria-label="Rakib dashboard">
          <span className="brand-mark">R</span>Rakib
        </Link>
        <nav className="workspace-route-nav" aria-label="Main navigation">
          <Link href="/">Overview</Link>
          <Link href="/schedules">Schedules</Link>
          <Link href="/schedules-areas">By area</Link>
          <Link aria-current="page" href="/areas">Service areas</Link>
          <Link href="/outage">Outages</Link>
          <Link href="/substation">Substations</Link>
          <Link href="/feeder">Feeders</Link>
          {(admin || user.role === "CUSTOMER") && <Link href="/payments">Payments</Link>}
          {admin && <Link href="/users">Users</Link>}
          {admin && <Link href="/analytics">Analytics</Link>}
          {admin && <Link href="/zone">Zones</Link>}
          {admin && <Link href="/admin">Admin</Link>}
          {admin && <Link href="/audit-log">Audit log</Link>}
        </nav>
        <div className="header-user">
          {admin && (
            <span className="admin-role-badge">
              {user.role === "SUPER_ADMIN" ? "SUPER ADMIN" : "ADMIN"}
            </span>
          )}
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
          <span className="header-user-name">{user.name}</span>
          <button className="text-button" onClick={logout} type="button">Sign out</button>
        </div>
      </header>

      <section className="dashboard-content workspace-route-content">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">
              {admin ? "NETWORK CONTROL" : operator ? "SERVICE WORKSPACE" : "YOUR SERVICE"}
            </span>
            <h1>Service areas</h1>
            <p>Explore the locations, feeders, substations, and zones covered by the network.</p>
          </div>
          <Link className="button button-light workspace-back-link" href="/">
            ← Back to overview
          </Link>
        </div>

        <section className="workspace-card" aria-labelledby="area-directory-heading">
          <div className="workspace-card-heading">
            <div>
              <span className="eyebrow">NETWORK COVERAGE</span>
              <h2 id="area-directory-heading">Service area directory</h2>
            </div>
            <span className="panel-count">{total} areas</span>
          </div>

          {admin && (
            <form className="area-create-form" onSubmit={createArea}>
              <div>
                <span className="eyebrow">ADMINISTRATION</span>
                <h3>Add a service area</h3>
              </div>
              <label>
                Area name
                <input
                  maxLength={100}
                  minLength={2}
                  onChange={(event) => setAreaForm({ ...areaForm, name: event.target.value })}
                  required
                  value={areaForm.name}
                />
              </label>
              <label>
                Area code
                <input
                  maxLength={20}
                  minLength={2}
                  onChange={(event) => setAreaForm({ ...areaForm, code: event.target.value.toUpperCase() })}
                  required
                  value={areaForm.code}
                />
              </label>
              <label>
                Feeder
                <select
                  onChange={(event) => setAreaForm({ ...areaForm, feederId: event.target.value })}
                  required
                  value={areaForm.feederId}
                >
                  <option value="">Select a feeder</option>
                  {feeders.map((feeder) => (
                    <option key={feeder.id} value={feeder.id}>{feeder.name} · {feeder.code}</option>
                  ))}
                </select>
              </label>
              <button className="button button-dark" disabled={savingArea || !feeders.length} type="submit">
                {savingArea ? "Creating…" : "Create area"}
              </button>
            </form>
          )}

          {areaNotice && <p className="workspace-message workspace-success" role="status">{areaNotice}</p>}
          <form className="workspace-filters" onSubmit={submitSearch}>
            <input
              aria-label="Search service areas"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by area name or code…"
              value={search}
            />
            <select
              aria-label="Filter service areas by feeder"
              onChange={(event) => {
                setFeederId(event.target.value);
                setPage(1);
              }}
              value={feederId}
            >
              <option value="">All feeders</option>
              {feeders.map((feeder) => (
                <option key={feeder.id} value={feeder.id}>
                  {feeder.name} · {feeder.code}
                </option>
              ))}
            </select>
            <button className="button button-light filter-submit" type="submit">
              Search
            </button>
          </form>

          {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
          {areasLoading ? (
            <div className="workspace-empty">Loading service areas…</div>
          ) : areas.length ? (
            <>
              <div className="workspace-table-wrap">
                <table className="workspace-table">
                  <thead>
                    <tr>
                      <th>Service area</th>
                      <th>Feeder</th>
                      <th>Substation</th>
                      <th>Zone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((area) => (
                      <tr key={area.id}>
                        <td><strong>{area.name}</strong><span>{area.code}</span></td>
                        <td>
                          {area.feeder?.name ?? "—"}
                          {area.feeder?.code ? ` · ${area.feeder.code}` : ""}
                        </td>
                        <td>
                          {area.feeder?.substation?.name ?? "—"}
                          {area.feeder?.substation?.code
                            ? ` · ${area.feeder.substation.code}`
                            : ""}
                        </td>
                        <td>
                          {area.feeder?.substation?.zone?.name ?? "—"}
                          {area.feeder?.substation?.zone?.code
                            ? ` · ${area.feeder.substation.zone.code}`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination-controls" aria-label="Service area pages">
                <span>
                  Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, total)} of {total}
                </span>
                <div>
                  <button
                    className="button button-light small-action"
                    disabled={page <= 1 || areasLoading}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    className="button button-light small-action"
                    disabled={page >= totalPages || areasLoading}
                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="workspace-empty">
              {appliedSearch || feederId
                ? "No service areas match these filters."
                : "No service areas are available yet."}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
