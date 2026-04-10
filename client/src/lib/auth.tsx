import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getSessionToken, setSessionToken, clearSessionToken } from "@/lib/queryClient";

interface SubscriptionInfo {
  status: string;
  trialEndsAt?: string | null;
  trialExpired: boolean;
  daysRemaining?: number | null;
  planCode?: string | null;
  planName?: string | null;
}

interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  email?: string;
  tenantId?: number | null;
  subscription?: SubscriptionInfo | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean, recaptchaToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function authMeHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAuthMe(maxRetries = 3, baseDelay = 2000): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("/api/auth/me", { headers: authMeHeaders(), credentials: "include" });
      if (res.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed after retries");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const checkAuth = useCallback(async (retry: boolean) => {
    try {
      const res = retry ? await fetchAuthMe(3, 2000) : await fetch("/api/auth/me", { headers: authMeHeaders(), credentials: "include" });
      if (res.status === 503) {
        setUser(null);
        setLocation("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return;
      }
      setUser(null);
    } catch {
      if (!retry) setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => {
    fetchAuthMe(5, 2000)
      .then(async res => {
        if (res.status === 503) {
          try {
            const errData = await res.json();
            if (errData.recoveryMode) {
              setUser(null);
              setLocation("/recovery");
              throw new Error("RecoveryMode");
            }
          } catch (e: any) {
            if (e.message === "RecoveryMode") throw e;
          }
          setUser(null);
          setLocation("/login");
          throw new Error("Maintenance");
        }
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then(data => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        checkAuth(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, checkAuth]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/auth/me", { headers: authMeHeaders(), credentials: "include" });
        if (res.status === 401 || res.status === 403) {
          clearInterval(interval);
          clearSessionToken();
          queryClient.clear();
          setUser(null);
          sessionStorage.setItem("session_kicked", "1");
          setLocation("/login");
        }
      } catch {}
    }, 300000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (username: string, password: string, rememberMe?: boolean, recaptchaToken?: string) => {
    const boardToken = sessionStorage.getItem("shared_board_token") || undefined;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const existingToken = getSessionToken();
    if (existingToken) headers["Authorization"] = `Bearer ${existingToken}`;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password, rememberMe, recaptchaToken, boardToken }),
      credentials: "include",
    });
    if (!res.ok) {
      let msg = "เข้าสู่ระบบไม่สำเร็จ";
      try {
        const errData = await res.json();
        if (errData.message) msg = errData.message;
      } catch {}
      throw new Error(msg);
    }
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่");
    }
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
    }
    queryClient.clear();
    localStorage.removeItem("etax_selected_company");
    setUser(data);
    const returnTo = sessionStorage.getItem("returnTo");
    if (data.role === "client_external") {
      sessionStorage.removeItem("returnTo");
      setLocation(returnTo || "/external-board");
    } else if (returnTo) {
      sessionStorage.removeItem("returnTo");
      setLocation(returnTo);
    } else if (data.role === "super_admin") {
      setLocation("/platform");
    } else if ((data.role === "employee" || data.role === "accountant") && data.tenantType === "accounting_firm") {
      setLocation("/hr/attendance");
    } else if (data.role === "cashier") {
      setLocation("/pos/sessions");
    } else if (data.role === "employee") {
      setLocation("/ess");
    } else {
      setLocation("/");
    }
  };

  const refetchUser = async () => {
    try {
      const headers: Record<string, string> = {};
      const token = getSessionToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/auth/me", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch {}
  };

  const logout = async () => {
    const headers: Record<string, string> = {};
    const token = getSessionToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch("/api/auth/logout", { method: "POST", headers, credentials: "include" });
    clearSessionToken();
    queryClient.clear();
    localStorage.removeItem("etax_selected_company");
    setUser(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
