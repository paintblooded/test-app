import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, setToken, getToken } from "@/src/api/client";

export type SonaraUser = {
  user_id: string;
  email: string;
  name?: string;
  username?: string;
  profile_photo?: string;
  banner?: string;
  role?: string;
  skill_level?: string;
  genres?: string[];
  goals?: string[];
  city?: string;
  location?: string;
  bio?: string;
  availability?: string;
  portfolio?: any;
  demo_reels?: any[];
  onboarded?: boolean;
  reliability_score?: number;
  verified?: boolean;
  badges?: string[];
  is_admin?: boolean;
};

type AuthCtx = {
  user: SonaraUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: SonaraUser | null) => void;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SonaraUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const data = await api<{ user: SonaraUser }>("/auth/me");
      setUser(data.user);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  const processSessionId = useCallback(async (sessionId: string) => {
    const data = await api<{ session_token: string; user: SonaraUser }>(
      "/auth/google-callback",
      { method: "POST", body: { session_id: sessionId }, auth: false }
    );
    await setToken(data.session_token);
    setUser(data.user);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Web: check for session_id in URL on mount
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const url = window.location.href;
        const hashMatch = window.location.hash.match(/session_id=([^&]+)/);
        const queryMatch = window.location.search.match(/session_id=([^&]+)/);
        const sid = hashMatch?.[1] || queryMatch?.[1];
        if (sid) {
          try {
            await processSessionId(decodeURIComponent(sid));
            window.history.replaceState(null, "", window.location.pathname);
            if (mounted) setLoading(false);
            return;
          } catch (e) {
            console.warn("Auth callback error", e);
          }
        }
      } else {
        // Cold start on mobile
        const initial = await Linking.getInitialURL();
        if (initial) {
          const m = initial.match(/session_id=([^&#]+)/);
          if (m) {
            try {
              await processSessionId(decodeURIComponent(m[1]));
              if (mounted) setLoading(false);
              return;
            } catch (e) {
              console.warn("Cold start auth error", e);
            }
          }
        }
      }
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh, processSessionId]);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const redirect = window.location.origin + "/";
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirect = Linking.createURL("auth");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
    if (result.type === "success" && result.url) {
      const m = result.url.match(/session_id=([^&#]+)/);
      if (m) {
        await processSessionId(decodeURIComponent(m[1]));
      }
    }
  }, [processSessionId]);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await setToken(null);
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, signInWithGoogle, signOut, refresh, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
