import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const RouterCtx = createContext({
  path: typeof window !== "undefined" && window.location ? window.location.pathname || "/" : "/",
  navigate: () => {},
});

export function RouterProvider({ children }) {
  const [path, setPath] = useState(() => {
    if (typeof window === "undefined" || !window.location) return "/";
    try {
      return window.location.pathname || "/";
    } catch {
      return "/";
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePop = () => {
      try {
        setPath(window.location.pathname || "/");
      } catch {
        setPath("/");
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigate = (to, options = {}) => {
    if (!to) return;
    if (typeof window === "undefined" || !window.history || !window.location) {
      setPath(to);
      return;
    }
    const next = to;
    if (next === path) return;
    try {
      if (options.replace) {
        window.history.replaceState({}, "", next);
      } else {
        window.history.pushState({}, "", next);
      }
    } catch {
      // ignore navigation errors in non-browser environments
    }
    setPath(next);
  };

  const value = useMemo(() => ({ path, navigate }), [path]);
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

export function useRouter() {
  return useContext(RouterCtx);
}

export function parseRoute(path) {
  if (!path || path === "") return { name: "root", params: {} };
  if (path === "/") return { name: "root", params: {} };
  if (path.startsWith("/login")) return { name: "login", params: {} };
  if (path.startsWith("/my")) return { name: "my", params: {} };
  if (path.startsWith("/requests")) return { name: "requests", params: {} };
  if (path.startsWith("/settings")) return { name: "settings", params: {} };
  const match = path.match(/^\/schedule\/(\d{4}-\d{2}-\d{2})/);
  if (match) return { name: "schedule", params: { week: match[1] } };
  if (path.startsWith("/schedule")) return { name: "schedule", params: {} };
  return { name: "unknown", params: {} };
}

