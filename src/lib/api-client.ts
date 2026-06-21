const API_BASE_URL = "/api/v1";

type JsonBody = Record<string, unknown> | unknown[];
type RequestBody = BodyInit | JsonBody | null;

interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  auth?: boolean;
}

export class ApiClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

function getAuthToken() {
  return localStorage.getItem("adminToken") ?? localStorage.getItem("token");
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isJsonBody(body: RequestBody | undefined): body is JsonBody {
  if (body === null || body === undefined) {
    return false;
  }

  if (
    typeof FormData !== "undefined" && body instanceof FormData ||
    typeof Blob !== "undefined" && body instanceof Blob ||
    typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams ||
    typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer ||
    typeof ReadableStream !== "undefined" && body instanceof ReadableStream ||
    typeof body === "string"
  ) {
    return false;
  }

  return typeof body === "object";
}

function isJsonStringBody(body: RequestBody | undefined) {
  if (typeof body !== "string") {
    return false;
  }

  const trimmedBody = body.trim();
  return trimmedBody.startsWith("{") || trimmedBody.startsWith("[");
}

function normalizeHeaders(headers: HeadersInit | undefined, body: RequestBody | undefined, auth: boolean) {
  const normalizedHeaders = new Headers(headers);

  if ((isJsonBody(body) || isJsonStringBody(body)) && !normalizedHeaders.has("Content-Type")) {
    normalizedHeaders.set("Content-Type", "application/json");
  }

  if (auth && !normalizedHeaders.has("Authorization")) {
    const token = getAuthToken();

    if (token) {
      normalizedHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  return normalizedHeaders;
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }

  return text;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

async function request<T>(method: string, path: string, body?: RequestBody, options: ApiRequestOptions = {}) {
  const { auth = true, headers, ...requestOptions } = options;
  const hasBody = body !== undefined && body !== null;
  const response = await fetch(buildUrl(path), {
    ...requestOptions,
    method,
    headers: normalizeHeaders(headers, body, auth),
    body: hasBody ? (isJsonBody(body) ? JSON.stringify(body) : body) : undefined,
  });
  const payload = await parseResponse(response).catch(() => undefined);

  if (!response.ok) {
    throw new ApiClientError(
      getErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export const apiClient = {
  request<T>(path: string, init: ApiRequestOptions & { method?: string; body?: RequestBody } = {}) {
    const { method = "GET", body, ...options } = init;
    return request<T>(method, path, body, options);
  },
  get<T>(path: string, options?: ApiRequestOptions) {
    return request<T>("GET", path, undefined, options);
  },
  post<T>(path: string, body?: RequestBody, options?: ApiRequestOptions) {
    return request<T>("POST", path, body, options);
  },
  put<T>(path: string, body?: RequestBody, options?: ApiRequestOptions) {
    return request<T>("PUT", path, body, options);
  },
  patch<T>(path: string, body?: RequestBody, options?: ApiRequestOptions) {
    return request<T>("PATCH", path, body, options);
  },
  delete<T>(path: string, options?: ApiRequestOptions) {
    return request<T>("DELETE", path, undefined, options);
  },
};
