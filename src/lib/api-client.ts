import axios from "axios";
import { useAuthStore } from "@/stores/auth-store";

// Smart fallback:
// - NEXT_PUBLIC_BACKEND_URL set → FastAPI on Render (/api/v1)
// - Not set → Next.js built-in API routes (/api)
const _backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const BASE_URL = _backendUrl ? `${_backendUrl}/api/v1` : "/api";

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ── Request: Attach JWT ───────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response: Auto-refresh on 401 ────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401 && !error.config?._retry) {
      error.config._retry = true;

      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("refresh_token")
          : null;

      if (!refreshToken) {
        if (typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      try {
        const refreshUrl = _backendUrl
          ? `${_backendUrl}/api/v1/auth/refresh`
          : "/api/auth/refresh";

        const { data } = await axios.post(refreshUrl, {
          refresh_token: refreshToken,
        });
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        apiClient.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
        error.config.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(error.config);
      } catch {
        if (typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
