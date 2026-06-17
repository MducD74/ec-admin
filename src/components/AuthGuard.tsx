import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
}

interface JwtPayload {
  role?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(paddedPayload)) as JwtPayload;
  } catch {
    return null;
  }
}

function getStoredToken() {
  return localStorage.getItem("adminToken") ?? localStorage.getItem("token");
}

function hasValidAdminToken() {
  const token = getStoredToken();

  if (!token) {
    return false;
  }

  const payload = decodeJwtPayload(token);
  const nowInSeconds = Math.floor(Date.now() / 1000);

  return payload?.role === "ADMIN" && typeof payload.exp === "number" && payload.exp > nowInSeconds;
}

function redirectToLogin() {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("token");
  window.history.replaceState(null, "", "/login");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState(() => hasValidAdminToken());

  useEffect(() => {
    const authorized = hasValidAdminToken();
    setIsAuthorized(authorized);

    if (!authorized) {
      redirectToLogin();
    }
  }, []);

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;
