export interface ApiMeta {
  model_id?: string | null;
  latency_ms?: number | null;
  request_id?: string | null;
  extra?: Record<string, unknown> | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiResponse<T> {
  data: T | null;
  meta?: ApiMeta | null;
  error?: ApiError | null;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

function buildHeaders(inputHeaders?: HeadersInit, body?: BodyInit | null): Headers {
  const headers = new Headers(inputHeaders);
  if (!(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(resolveUrl(path), {
    ...options,
    headers: buildHeaders(options.headers, options.body),
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === "object") {
    const envelope = parsed as Partial<ApiResponse<T>>;
    if ("data" in envelope || "error" in envelope || "meta" in envelope) {
      return {
        data: (envelope.data ?? null) as T | null,
        meta: envelope.meta ?? null,
        error: envelope.error ?? null,
      };
    }
  }

  if (!response.ok) {
    return {
      data: null,
      error: {
        code: `HTTP_${response.status}`,
        message: response.statusText || "Request failed",
      },
    };
  }

  return {
    data: parsed as T,
    meta: null,
    error: null,
  };
}

export function getSystemHealth(): Promise<ApiResponse<SystemHealthData>> {
  return apiClient<SystemHealthData>("/api/v1/health");
}

export function getDbHealth(): Promise<ApiResponse<DbHealthData>> {
  return apiClient<DbHealthData>("/api/v1/health/db");
}
