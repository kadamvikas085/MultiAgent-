/**
 * Thin fetch wrapper for the backend API.
 *
 * Dev: requests go to relative "/api/v1/..." paths, which vite.config.js
 * proxies to http://localhost:8000. In production, set VITE_API_BASE_URL
 * to point at the deployed backend (or keep it same-origin behind a
 * reverse proxy and leave this empty).
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const API_PREFIX = "/api/v1";

const ACCESS_TOKEN_KEY = "catalyst_access_token";
const REFRESH_TOKEN_KEY = "catalyst_refresh_token";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(tokens) {
    if (tokens.access_token) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    if (tokens.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = "GET", body, auth = false, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  const res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expired — try one silent refresh, then replay the request.
  if (res.status === 401 && auth && retry && tokenStore.refresh) {
    try {
      const refreshed = await authApi.refresh(tokenStore.refresh);
      tokenStore.set(refreshed);
      return request(path, { method, body, auth, retry: false });
    } catch {
      tokenStore.clear();
      throw new ApiError("Session expired — please sign in again.", 401);
    }
  }

  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(typeof detail === "string" ? detail : "Request failed", res.status, detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const authApi = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  verifyOtp: (payload) => request("/auth/verify-otp", { method: "POST", body: payload }),
  refresh: (refresh_token) => request("/auth/refresh", { method: "POST", body: { refresh_token } }),
  me: () => request("/auth/me", { auth: true }),
  /** DEV-ONLY — see Backend/app/api/v1/endpoints/auth.py::dev_set_role. */
  devSetRole: (role) => request(`/auth/dev/set-role?role=${role}`, { method: "POST", auth: true }),
};

async function requestForm(path, formData) {
  const headers = {};
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
  const res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
    method: "POST",
    headers, // no Content-Type — the browser sets the multipart boundary
    body: formData,
  });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(typeof detail === "string" ? detail : "Upload failed", res.status, detail);
  }
  return res.json();
}

export const uploadApi = {
  file: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return requestForm("/upload/file", formData);
  },
  website: (url, depth = 1) => request("/upload/website", { method: "POST", body: { url, depth }, auth: true }),
};

export const pipelineApi = {
  getJob: (jobId) =>
    request(`/pipeline/jobs/${jobId}`, { auth: true }),

  getAgentResults: (jobId) =>
    request(`/pipeline/jobs/${jobId}/agent-results`, { auth: true }),

  /**
   * Opens a WebSocket for live stage updates.
   */
  watchJob: (jobId, onMessage, onError) => {
    const wsProtocol =
      window.location.protocol === "https:" ? "wss:" : "ws:";

    // Frontend: localhost:5173
    // Backend:  localhost:8000
    const backendHost =
      window.location.hostname === "localhost"
        ? "localhost:8000"
        : window.location.host;

    const token = tokenStore.access;
    const tokenQs = token
      ? `?token=${encodeURIComponent(token)}`
      : "";

    const ws = new WebSocket(
      `${wsProtocol}//${backendHost}${API_PREFIX}/pipeline/ws/${jobId}${tokenQs}`
    );

    ws.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {
        // Ignore malformed WebSocket messages
      }
    };

    ws.onerror = (err) => {
      onError?.(err);
    };

    return () => {
      ws.close();
    };
  },
};
export const productsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
    ).toString();
    return request(`/products${qs ? `?${qs}` : ""}`, { auth: true });
  },
  get: (id) => request(`/products/${id}`, { auth: true }),
  update: (id, payload) => request(`/products/${id}`, { method: "PATCH", body: payload, auth: true }),
  bulkAction: (productIds, action) =>
    request(`/products/bulk-action?action=${action}`, { method: "POST", body: productIds, auth: true }),
};

export const exportApi = {
  /**
   * Export endpoints require a Bearer token, so a plain window.open() (no
   * custom headers) would 401 — fetch with auth instead, then hand the
   * browser a blob URL to download.
   */
  async downloadProductJson(productId, fileName = `product-${productId}.json`) {
    const data = await request(`/export/products/${productId}/json`, { auth: true });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
  async downloadProductsCsv(fileName = "products_export.csv") {
    const headers = {};
    if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
    const res = await fetch(`${BASE_URL}${API_PREFIX}/export/products/csv`, { headers });
    if (!res.ok) throw new ApiError("Export failed", res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const validationApi = {
  getQueue: () => request("/validation/queue", { auth: true }),
  getEvidence: (productId) => request(`/validation/${productId}/evidence`, { auth: true }),
  approve: (productId) => request(`/validation/${productId}/approve`, { method: "POST", auth: true }),
  reject: (productId, reason) =>
    request(`/validation/${productId}/reject?reason=${encodeURIComponent(reason)}`, { method: "POST", auth: true }),
};

export const analyticsApi = {
  overview: (days = 30) => request(`/analytics/overview?days=${days}`, { auth: true }),
  timeSeries: (days = 14) => request(`/analytics/processing-time-series?days=${days}`, { auth: true }),
};

export const knowledgeGraphApi = {
  listNodes: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`/knowledge-graph/nodes${qs ? `?${qs}` : ""}`, { auth: true });
  },
  listEdges: () => request("/knowledge-graph/edges", { auth: true }),
  // expandNode exists on the backend but currently returns only a raw
  // record count (no usable node/edge shape yet), so the UI doesn't call
  // it — the full nodes+edges lists above are used instead.
};

export const searchApi = {
  query: (q, params = {}) => {
    const qs = new URLSearchParams({ q, ...params }).toString();
    return request(`/search?${qs}`, { auth: true });
  },
};

export const copilotApi = {
  query: (question, productId = null) =>
    request("/copilot/query", {
      method: "POST",
      body: { question, ...(productId ? { product_id: productId } : {}) },
      auth: true,
    }),
};

export const notificationsApi = {
  list: () => request("/notifications", { auth: true }),
};

export const auditApi = {
  list: (page = 1, page_size = 50) => request(`/audit?page=${page}&page_size=${page_size}`, { auth: true }),
};

export { ApiError, request };
