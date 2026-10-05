"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type Zone = { id: string; name: string; code: string };
type Substation = {
  id: string;
  name: string;
  code: string;
  zone: Zone;
  _count?: { feeders: number };
};
type SubstationInput = { name: string; code: string; zoneId: string };

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SubstationDirectory({ role }: { role: string }) {
  const canCreate = role === "ADMIN" || role === "SUPER_ADMIN";
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [form, setForm] = useState<SubstationInput>({ name: "", code: "", zoneId: "" });
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
        if (zoneId) query.set("zoneId", zoneId);
        const [substationResponse, zoneResponse] = await Promise.all([
          apiRequest<Substation[]>(`/api/v1/substation${query.size ? `?${query}` : ""}`, {}, accessToken),
          apiRequest<Zone[]>("/api/v1/zone", {}, accessToken),
        ]);
        if (cancelled) return;
        setSubstations(substationResponse.data);
        setZones(zoneResponse.data);
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load substations."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [search, zoneId]);

  async function createSubstation(event: FormEvent<HTMLFormElement>) {
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
      await apiRequest<Substation>(
        "/api/v1/substation",
        {
          method: "POST",
          body: JSON.stringify({ ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() }),
        },
        token,
      );
      setForm({ name: "", code: "", zoneId: "" });
      setNotice("Substation added successfully.");
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (zoneId) query.set("zoneId", zoneId);
      const response = await apiRequest<Substation[]>(
        `/api/v1/substation${query.size ? `?${query}` : ""}`,
        {},
        token,
      );
      setSubstations(response.data);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to add the substation."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`workspace-grid infrastructure-page-grid substation-page-grid${canCreate ? "" : " substation-directory-only"}`}>
      {canCreate && (
        <section className="workspace-card">
          <div className="workspace-card-heading">
            <div><span className="eyebrow">ADMINISTRATION</span><h3>Add a substation</h3></div>
          </div>
          <form className="workspace-form" onSubmit={createSubstation}>
            <label htmlFor="substation-name">Substation name</label>
            <input id="substation-name" maxLength={100} minLength={2} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
            <label htmlFor="substation-code">Substation code</label>
            <input id="substation-code" maxLength={20} minLength={2} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required value={form.code} />
            <label htmlFor="substation-zone">Distribution zone</label>
            <select id="substation-zone" onChange={(event) => setForm({ ...form, zoneId: event.target.value })} required value={form.zoneId}>
              <option value="">Select a zone</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.code}</option>)}
            </select>
            <button className="button button-dark workspace-submit" disabled={saving || !zones.length} type="submit">{saving ? "Saving…" : "Add substation"}</button>
          </form>
        </section>
      )}

      <section className="workspace-card" aria-labelledby="substation-directory-heading">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">GRID INFRASTRUCTURE</span><h3 id="substation-directory-heading">Substation directory</h3></div>
          <span className="panel-count">{substations.length} substations</span>
        </div>
        <div className="workspace-filters infrastructure-search">
          <input aria-label="Search substations" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or code" type="search" value={search} />
          <select aria-label="Filter substations by zone" onChange={(event) => setZoneId(event.target.value)} value={zoneId}>
            <option value="">All zones</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.code}</option>)}
          </select>
        </div>
        {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
        {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}
        {loading ? <div className="workspace-empty">Loading substations…</div> : substations.length ? (
          <div className="workspace-table-wrap">
            <table className="workspace-table substation-directory-table">
              <thead><tr><th>Substation</th><th>Zone</th><th>Feeders</th></tr></thead>
              <tbody>
                {substations.map((substation) => (
                  <tr key={substation.id}>
                    <td><strong>{substation.name}</strong><span>{substation.code}</span></td>
                    <td><strong>{substation.zone.name}</strong><span>{substation.zone.code}</span></td>
                    <td><span className="substation-feeder-count">{substation._count?.feeders ?? 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="workspace-empty">{search || zoneId ? "No substations match these filters." : "No substations have been added yet."}</div>}
      </section>
    </div>
  );
}

export default function SubstationPage() {
  return <WorkspacePage page="substations">{(user) => <SubstationDirectory role={user.role} />}</WorkspacePage>;
}
