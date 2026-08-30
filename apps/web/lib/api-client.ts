/**
 * OmniText API Client
 * Typed wrapper around fetch supporting standard response envelope.
 */

export interface ResponseMeta {
  model_id?: string | null;
  latency_ms?: number | null;
  request_id?: string | null;
  extra?: Record<string, unknown> | null;
}

export interface ResponseError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ResponseEnvelope<T> {
  data: T | null;
  meta: ResponseMeta | null;
  error: ResponseError | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown> | null;
  status: number;

  constructor(error: ResponseError, status: number) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.code;
    this.details = error.details;
    this.status = status;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ResponseEnvelope<T>> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const envelope: ResponseEnvelope<T> = await response.json().catch(() => ({
    data: null,
    meta: null,
    error: {
      code: `HTTP_${response.status}`,
      message: response.statusText || "Network request failed",
    },
  }));

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("omnitext_token");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login?expired=true";
        // Return a pending promise that never resolves to block downstream UI updates
        return new Promise(() => {});
      }
    }
  }

  if (!response.ok || envelope.error) {
    const errorObj = envelope.error || {
      code: `HTTP_${response.status}`,
      message: response.statusText || "Request failed",
    };
    throw new ApiError(errorObj, response.status);
  }

  return envelope;
}

export interface SystemHealthData {
  status: string;
  environment: string;
  version: string;
  service: string;
}

export interface DbHealthData {
  status: string;
  database: string;
  healthy: boolean;
}

export async function getSystemHealth(): Promise<ResponseEnvelope<SystemHealthData>> {
  return apiClient<SystemHealthData>("/api/v1/health");
}

export async function getDbHealth(): Promise<ResponseEnvelope<DbHealthData>> {
  return apiClient<DbHealthData>("/api/v1/health/db");
}
