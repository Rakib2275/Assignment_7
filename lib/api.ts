import { clearAccessToken, saveAccessToken } from "./session";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

let refreshRequest: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const response = await fetch("/api/v1/auth/refresh-token", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const result: unknown = await response.json().catch(() => null);
        if (
          !response.ok ||
          typeof result !== "object" ||
          result === null ||
          !("data" in result) ||
          typeof result.data !== "object" ||
          result.data === null ||
          !("accessToken" in result.data) ||
          typeof result.data.accessToken !== "string"
        ) {
          clearAccessToken();
          return null;
        }

        saveAccessToken(result.data.accessToken);
        return result.data.accessToken;
      } catch {
        clearAccessToken();
        return null;
      } finally {
        refreshRequest = null;
      }
    })();
  }

  return refreshRequest;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<ApiResponse<T>> {
  async function send(token?: string) {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);

    return fetch(path, {
      ...options,
      headers,
      credentials: "include",
    });
  }

  let response = await send(accessToken);
  if (
    response.status === 401 &&
    accessToken &&
    path !== "/api/v1/auth/refresh-token"
  ) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await send(refreshedToken);
  }

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String(result.message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (
    typeof result !== "object" ||
    result === null ||
    !("data" in result) ||
    !("success" in result)
  ) {
    throw new Error("The server returned an unexpected response.");
  }

  return result as ApiResponse<T>;
}
