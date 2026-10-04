"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { WorkspacePage } from "../components/workspace-page";

type UserRole = "CUSTOMER" | "OPERATOR" | "ADMIN" | "SUPER_ADMIN";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt: string;
};

type UsersResult = {
  data: UserRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
};

const roles: UserRole[] = ["CUSTOMER", "OPERATOR", "ADMIN", "SUPER_ADMIN"];

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function UsersDirectory({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState("");
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

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: "10",
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        if (appliedSearch) query.set("search", appliedSearch);
        if (roleFilter) query.set("role", roleFilter);

        const response = await apiRequest<UsersResult>(
          `/api/v1/admin/users?${query.toString()}`,
          {},
          accessToken,
        );
        setUsers(response.data.data);
        setTotal(response.data.meta.total);
        setTotalPages(Math.max(response.data.meta.totalPage, 1));
      } catch (requestError) {
        setError(messageFor(requestError, "Unable to load users."));
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [appliedSearch, page, roleFilter]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = search.trim();
    if (nextSearch === appliedSearch && page === 1) return;
    setAppliedSearch(nextSearch);
    setPage(1);
  }

  async function updateRole(user: UserRecord, role: UserRole) {
    const token = getAccessToken();
    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setUpdatingUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await apiRequest<UserRecord>(
        `/api/v1/admin/users/${encodeURIComponent(user.id)}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        },
        token,
      );
      if (roleFilter && role !== roleFilter) {
        setUsers((currentUsers) =>
          currentUsers.filter((currentUser) => currentUser.id !== response.data.id),
        );
        setTotal((currentTotal) => Math.max(0, currentTotal - 1));
        if (users.length === 1 && page > 1) {
          setPage((currentPage) => currentPage - 1);
        }
      } else {
        setUsers((currentUsers) =>
          currentUsers.map((currentUser) =>
            currentUser.id === response.data.id ? response.data : currentUser,
          ),
        );
      }
      setNotice(`Role updated for ${response.data.name}.`);
    } catch (requestError) {
      setError(messageFor(requestError, "Unable to update the user role."));
    } finally {
      setUpdatingUserId("");
    }
  }

  return (
    <section className="workspace-card" aria-labelledby="users-heading">
      <div className="workspace-card-heading">
        <div>
          <span className="eyebrow">PLATFORM ACCOUNTS</span>
          <h3 id="users-heading">User directory</h3>
        </div>
        <span className="panel-count">{total} users</span>
      </div>

      <form className="workspace-filters" onSubmit={submitSearch}>
        <input
          aria-label="Search users"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or email"
          type="search"
          value={search}
        />
        <select
          aria-label="Filter users by role"
          onChange={(event) => {
            setRoleFilter(event.target.value);
            setPage(1);
          }}
          value={roleFilter}
        >
          <option value="">All roles</option>
          {roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
        </select>
        <button className="button button-light filter-submit" disabled={loading} type="submit">
          Search
        </button>
      </form>

      {error && <p className="workspace-message workspace-error" role="alert">{error}</p>}
      {notice && <p className="workspace-message workspace-success" role="status">{notice}</p>}

      {loading ? (
        <div className="workspace-empty">Loading users…</div>
      ) : users.length ? (
        <>
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><span>{user.email}</span></td>
                    <td>
                      <select
                        aria-label={`Role for ${user.name}`}
                        disabled={updatingUserId === user.id || user.id === currentUserId}
                        onChange={(event) => {
                          const nextRole = roles.find((role) => role === event.target.value);
                          if (nextRole) void updateRole(user, nextRole);
                        }}
                        value={user.role}
                      >
                        {roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                      </select>
                    </td>
                    <td>{user.status.replaceAll("_", " ").toLowerCase()}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="workspace-pagination">
            <span>
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}
            </span>
            <div>
              <button
                className="button button-light"
                disabled={loading || page <= 1}
                onClick={() => setPage((currentPage) => currentPage - 1)}
                type="button"
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                className="button button-light"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="workspace-empty">
          {appliedSearch || roleFilter
            ? "No users match the selected search and filters."
            : "There are no users to display yet."}
        </div>
      )}
    </section>
  );
}

export default function UsersPage() {
  return (
    <WorkspacePage page="users">
      {(user) => <UsersDirectory currentUserId={user.id} />}
    </WorkspacePage>
  );
}
