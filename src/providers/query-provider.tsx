"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useAuthStore } from "@/stores/auth-store";

function isLocalApiRequest(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("/api/")) return true;
  if (typeof window === "undefined") return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isAuthRequest(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/api/auth/login") || url.includes("/api/auth/refresh");
}

function withBearer(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const setTokens = useAuthStore((state) => state.setTokens);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,         // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let refreshPromise: Promise<string | null> | null = null;

    const refreshAccessToken = async () => {
      if (refreshPromise) return refreshPromise;
      refreshPromise = (async () => {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) return null;

        const response = await originalFetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) return null;
        const data = await response.json();
        if (!data.access_token) return null;
        setTokens(data.access_token, data.refresh_token || refreshToken);
        return data.access_token as string;
      })().finally(() => {
        refreshPromise = null;
      });
      return refreshPromise;
    };

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      if (
        response.status !== 401 ||
        !isLocalApiRequest(input) ||
        isAuthRequest(input)
      ) {
        return response;
      }

      const newToken = await refreshAccessToken();
      if (!newToken) {
        clearAuth();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return response;
      }

      return originalFetch(input, withBearer(init, newToken));
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [clearAuth, setTokens]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
