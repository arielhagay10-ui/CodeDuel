import { ApiRequestError } from "./api-error.ts";

/** Shared transport for the live API; mocks never invoke it. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : "Request failed.";
    throw new ApiRequestError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body.trim() ? JSON.parse(body) : undefined) as T;
}
