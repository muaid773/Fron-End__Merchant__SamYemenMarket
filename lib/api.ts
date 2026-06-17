import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  getRegion,
} from "@/lib/auth";

const API_BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  formData?: FormData;
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

let refreshPromise: Promise<RefreshResponse> | null = null;

function buildHeaders(
  extraHeaders?: Record<string, string>,
  isFormData = false
): HeadersInit {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {}),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail;
    }
  } catch {
    // ignore
  }

  return `Request failed (${res.status})`;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

async function refreshAccessToken(): Promise<RefreshResponse> {
  if (typeof window === "undefined") {
    throw new Error("Refresh is only available in the browser");
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh_token = getRefreshToken();
      const phone_number = localStorage.getItem("user_phone") || "";
      const region = getRegion();

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token,
          phone_number,
          region,
        }),
      });

      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new ApiError(res.status, message);
      }

      const data = (await res.json()) as RefreshResponse;

      if (!data?.access_token || !data?.refresh_token) {
        throw new ApiError(500, "Invalid refresh response");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function sendRequest<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
  retryOn401 = true
): Promise<T> {
  const isFormData = options.formData instanceof FormData;

  // Strip trailing slash (except root "/") to avoid 307 redirects
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path;

  const res = await fetch(`${API_BASE}${normalizedPath}`, {
    method,
    headers: buildHeaders(options.headers, isFormData),
    body: isFormData
      ? options.formData
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  if (res.status === 401) {
    const isAuthEndpoint =
      path.startsWith("/auth/login") || path.startsWith("/auth/refresh");

    if (retryOn401 && !isAuthEndpoint) {
      try {
        await refreshAccessToken();
        return sendRequest<T>(method, path, options, false);
      } catch {
        clearAuth();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new ApiError(401, "Unauthorized");
      }
    }

    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new ApiError(res.status, message);
  }

  return parseResponse<T>(res);
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    sendRequest<T>("GET", path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    sendRequest<T>("POST", path, { body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    sendRequest<T>("PUT", path, { body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    sendRequest<T>("PATCH", path, { body, headers }),
  delete: <T>(path: string, headers?: Record<string, string>) =>
    sendRequest<T>("DELETE", path, { headers }),
  postForm: <T>(path: string, data: FormData, headers?: Record<string, string>) =>
    sendRequest<T>("POST", path, { formData: data, headers }),
};