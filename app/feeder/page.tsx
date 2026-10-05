"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type Substation = {
  id: string;
  name: string;
  code: string;
  zone?: { name: string; code: string };
};
type Feeder = {
  id: string;
  name: string;
  code: string;
  substation: Substation;
  _count?: { areas: number };
};
type FeederInput = { name: string; code: string; substationId: string };

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function FeederDirectory({ role }: { role: string }) {
  const canCreate = role === "ADMIN" || role === "SUPER_ADMIN";
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [search, setSearch] = useState("");
  const [substationId, setSubstationId] = useState("");
  const [form, setForm] = useState<FeederInput>({ name: "", code: "", substationId: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        if (substationId) query.set("substationId", substationId);
        const [feederResponse, substationResponse] = await Promise.all([
          apiRequest<Feeder[]>(`/api/v1/feeder${query.size ? `?${query}` : ""}`, {}, accessToken),
          apiRequest<Substation[]>("/api/v1/substation", {}, accessToken),
        ]);
        if (cancelled) return;
        setFeeders(feederResponse.data);
        setSubstations(substationResponse.data);
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load feeders."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [search, substationId]);

  async function createFeeder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<Feeder>(
        "/api/v1/feeder",
        {
          method: "POST",
          body: JSON.stringify({ ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() }),
        },
        token,
      );
      setForm({ name: "", code: "", substationId: "" });
      setNotice("Feeder added successfully.");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (substationId) query.set("substationId", substationId);
      const response = await apiRequest<Feeder[]>(
        `/api/v1/feeder${query.size ? `?${query}` : ""}`,
        {},
        token,
      );
      setFeeders(response.data);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to add the feeder."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`workspace-grid infrastructure-page-grid feeder-page-grid${canCreate ? "" : " feeder-directory-only"}`}>
      {canCreate && (
        <section className="workspace-card">
          <div className="workspace-card-heading">
            <div><span className="eyebrow">ADMINISTRATION</span><h3>Add a feeder</h3></div>
          </div>
          <form className="workspace-form" onSubmit={createFeeder}>
            <label htmlFor="feeder-name">Feeder name</label>
            <input id="feeder-name" maxLength={100} minLength={2} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
            <label htmlFor="feeder-code">Feeder code</label>
            <input id="feeder-code" maxLength={20} minLength={2} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required value={form.code} />
            <label htmlFor="feeder-substation">Substation</label>
            <select id="feeder-substation" onChange={(event) => setForm({ ...form, substationId: event.target.value })} required value={form.substationId}>
              <option value="">Select a substation</option>
              {substations.map((substation) => <option key={substation.id} value={substation.id}>{substation.name} · {substation.code}</option>)}
            </select>
            <button className="button button-dark workspace-submit" disabled={saving || !substations.length} type="submit">{saving ? "Saving…" : "Add feeder"}</button>
          </form>
        </section>
      )}

      <section className="workspace-card" aria-labelledby="feeder-directory-heading">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">GRID INFRASTRUCTURE</span><h3 id="feeder-directory-heading">Feeder directory</h3></div>
          <span className="panel-count">{feeders.length} feeders</span>
        </div>
        <div className="workspace-filters infrastructure-search">
          <input aria-label="Search feeders" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or code" type="search" value={search} />
          <select aria-label="Filter feeders by substation" onChange={(event) => setSubstationId(event.target.value)} value={substationId}>
            <option value="">All substations</option>
            {substations.map((substation) => <option key={substation.id} value={substation.id}>{substation.name} · {substation.code}</option>)}
          </select>
        </div>
        {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
        {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}
        {loading ? <div className="workspace-empty">Loading feeders…</div> : feeders.length ? (
          <div className="workspace-table-wrap">
            <table className="workspace-table feeder-directory-table">
              <thead><tr><th>Feeder</th><th>Substation</th><th>Zone</th><th>Service areas</th></tr></thead>
              <tbody>
                {feeders.map((feeder) => (
                  <tr key={feeder.id}>
                    <td><strong>{feeder.name}</strong><span>{feeder.code}</span></td>
                    <td><strong>{feeder.substation.name}</strong><span>{feeder.substation.code}</span></td>
                    <td><strong>{feeder.substation.zone?.name ?? "Not assigned"}</strong><span>{feeder.substation.zone?.code ?? ""}</span></td>
                    <td><span className="feeder-area-count">{feeder._count?.areas ?? 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="workspace-empty">{search || substationId ? "No feeders match these filters." : "No feeders have been added yet."}</div>}
      </section>
    </div>
  );
}

export default function FeederPage() {
  return <WorkspacePage page="feeders">{(user) => <FeederDirectory role={user.role} />}</WorkspacePage>;
}
