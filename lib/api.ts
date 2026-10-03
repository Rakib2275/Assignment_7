export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

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
