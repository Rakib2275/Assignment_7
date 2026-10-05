"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type Zone = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  _count?: { substations: number };
};

type ZoneForm = {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

const emptyForm: ZoneForm = { name: "", code: "", description: "", isActive: true };

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ZoneDirectory() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm);
  const [reloadKey, setReloadKey] = useState(0);
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

    async function fetchZones() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        if (activeFilter) query.set("isActive", activeFilter);
        const response = await apiRequest<Zone[]>(
          `/api/v1/zone${query.size ? `?${query.toString()}` : ""}`,
          {},
          accessToken,
        );
        if (!cancelled) setZones(response.data);
      } catch (requestError) {
        if (!cancelled) setError(messageFor(requestError, "Unable to load zones."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchZones();
    return () => { cancelled = true; };
  }, [activeFilter, reloadKey, search]);

  function beginEdit(zone: Zone) {
    setEditing(zone);
    setForm({
      name: zone.name,
      code: zone.code,
      description: zone.description ?? "",
      isActive: zone.isActive,
    });
    setNotice("");
    setError("");
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await apiRequest<Zone>(
          `/api/v1/zone/${encodeURIComponent(editing.id)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
          token,
        );
        setNotice("Zone updated successfully.");
      } else {
        await apiRequest<Zone>(
          "/api/v1/zone/register",
          { method: "POST", body: JSON.stringify(payload) },
          token,
        );
        setNotice("Zone created successfully.");
      }
      cancelEdit();
      setReloadKey((currentKey) => currentKey + 1);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to save the zone."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-grid zone-page-grid">
      <section className="workspace-card" aria-labelledby="zone-editor-heading">
        <div className="workspace-card-heading">
          <div>
            <span className="eyebrow">{editing ? "ZONE SETTINGS" : "ADMINISTRATION"}</span>
            <h3 id="zone-editor-heading">{editing ? "Edit zone" : "Add a distribution zone"}</h3>
          </div>
          {editing && <button className="back-link" onClick={cancelEdit} type="button">Cancel edit</button>}
        </div>
        <form className="workspace-form" onSubmit={submitZone}>
          <label htmlFor="zone-name">Zone name</label>
          <input id="zone-name" maxLength={100} minLength={2} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
          <label htmlFor="zone-code">Zone code</label>
          <input id="zone-code" maxLength={20} minLength={2} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required value={form.code} />
          <label htmlFor="zone-description">Description <span className="optional-label">(optional)</span></label>
          <textarea id="zone-description" maxLength={500} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} />
          {editing && (
            <label className="zone-active-toggle">
              <input checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} type="checkbox" />
              Zone is active
            </label>
          )}
          <button className="button button-dark workspace-submit" disabled={saving} type="submit">
            {saving ? "Saving…" : editing ? "Save zone" : "Create zone"}
          </button>
        </form>
      </section>

      <section className="workspace-card" aria-labelledby="zone-directory-heading">
        <div className="workspace-card-heading">
          <div><span className="eyebrow">NETWORK INFRASTRUCTURE</span><h3 id="zone-directory-heading">Distribution zones</h3></div>
          <span className="panel-count">{zones.length} zones</span>
        </div>
        <form className="workspace-filters zone-filters" onSubmit={(event) => event.preventDefault()}>
          <input aria-label="Search zones" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, or description" type="search" value={search} />
          <select aria-label="Filter zones by status" onChange={(event) => setActiveFilter(event.target.value)} value={activeFilter}>
            <option value="">All zones</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </form>
        {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
        {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}
        {loading ? <div className="workspace-empty">Loading zones…</div> : zones.length ? (
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead><tr><th>Zone</th><th>Status</th><th>Substations</th><th>Actions</th></tr></thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id}>
                    <td><strong>{zone.name}</strong><span>{zone.code}{zone.description ? ` · ${zone.description}` : ""}</span></td>
                    <td><span className={`status-badge status-${zone.isActive ? "active" : "blocked"}`}>{zone.isActive ? "Active" : "Inactive"}</span></td>
                    <td>{zone._count?.substations ?? 0}</td>
                    <td><button className="table-action" onClick={() => beginEdit(zone)} type="button">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="workspace-empty">{search || activeFilter ? "No zones match these filters." : "No distribution zones have been created yet."}</div>}
      </section>
    </div>
  );
}

export default function ZonePage() {
  return (
    <WorkspacePage page="zone">
      {() => <ZoneDirectory />}
    </WorkspacePage>
  );
}
