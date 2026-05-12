import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "sale";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isSale: boolean;
  signIn: (email: string, password?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  updateProfile: (data: { email?: string; display_name?: string; phone?: string; avatar_url?: string }) => Promise<{ error?: string }>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | undefined, userEmail?: string) => {
    if (!uid) return setRoles([]);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const dbRoles = (data ?? []).map((r) => r.role as AppRole);

    // Force admin role for the specific owner email desembrevn.com@gmail.com if standard DB record is absent
    if (userEmail === "desembrevn.com@gmail.com" && !dbRoles.includes("admin")) {
      dbRoles.push("admin");
    }

    setRoles(dbRoles);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      // defer DB call to avoid deadlock
      setTimeout(() => loadRoles(sess?.user?.id, sess?.user?.email), 0);
    });

    Promise.race([
      supabase.auth.getSession(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 2000))
    ])
      .then(({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        loadRoles(sess?.user?.id, sess?.user?.email).finally(() => setLoading(false));
      })
      .catch((err) => {
        console.warn("Supabase auth timeout/error", err);
        setLoading(false);
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password?: string) => {
    if (!password) {
      return { error: "Vui lòng nhập mật khẩu để đăng nhập hệ thống." };
    }

    let { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: { email?: string; display_name?: string; phone?: string; avatar_url?: string }) => {
    const { data, error } = await supabase.auth.updateUser({
      email: updates.email,
      data: {
        display_name: updates.display_name,
        phone: updates.phone,
        avatar_url: updates.avatar_url,
      }
    });

    if (error) return { error: error.message };
    if (data.user) {
      setUser(data.user);
    }
    return {};
  };

  const contextValue = useMemo(() => ({
    user,
    session,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isSale: roles.includes("sale"),
    signIn,
    signUp,
    signOut,
    refreshRoles: () => loadRoles(user?.id, user?.email),
    updateProfile,
  }), [user, session, roles, loading]);

  return (
    <Ctx.Provider value={contextValue}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
