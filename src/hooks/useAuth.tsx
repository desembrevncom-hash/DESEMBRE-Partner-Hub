import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "sub_admin" | "sale" | "tele_lead" | "telesale";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isManager: boolean;
  isSale: boolean;
  isTeleLead: boolean;
  isTelesale: boolean;
  isTeleUser: boolean;
  isSalesUser: boolean;
  isSalesLine: boolean;
  isTeleLine: boolean;
  canManageUsers: boolean;
  canManageLeads: boolean;
  canViewReports: boolean;
  canCreateSubAdmin: boolean;
  mustChangePassword?: boolean;
  signIn: (email: string, password?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshRoles: () => Promise<void>;
  updateProfile: (data: { email?: string; display_name?: string; phone?: string; avatar_url?: string }) => Promise<{ error?: string }>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkProfilePasswordFlag = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", uid)
      .maybeSingle();

    if (data?.must_change_password) {
      setMustChangePassword(true);
    } else {
      setMustChangePassword(false);
    }
  };

  const loadRoles = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setMustChangePassword(false);
      return;
    }

    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const dbRoles = (data ?? []).map((r: any) => r.role as AppRole);

    setRoles(dbRoles);
    await checkProfilePasswordFlag(uid);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, sess: any) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setTimeout(() => loadRoles(sess?.user?.id), 0);
    });

    Promise.race([
      supabase.auth.getSession(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 2000))
    ])
      .then(({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        loadRoles(sess?.user?.id).finally(() => setLoading(false));
      })
      .catch((err: any) => {
        console.warn("Supabase auth timeout/error", err);
        setLoading(false);
      });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password?: string) => {
    if (!password) {
      return { error: "Vui lòng nhập mật khẩu để đăng nhập hệ thống." };
    }

    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      await checkProfilePasswordFlag(data.user.id);
    }
    return {};
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

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };

    if (user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
      setMustChangePassword(false);
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setMustChangePassword(false);
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

  const contextValue = useMemo(() => {
    const isAdmin = roles.includes("admin");
    const isSubAdmin = roles.includes("sub_admin");
    const isManager = isAdmin || isSubAdmin;
    const isSale = roles.includes("sale");
    const isTeleLead = roles.includes("tele_lead");
    const isTelesale = roles.includes("telesale");

    const isTeleUser = isTeleLead || isTelesale;
    const isSalesUser = isSale;

    const isSalesLine = isSale;
    const isTeleLine = isTeleLead;

    return {
      user,
      session,
      roles,
      loading,
      isAdmin,
      isSubAdmin,
      isManager,
      isSale,
      isTeleLead,
      isTelesale,
      isTeleUser,
      isSalesUser,
      isSalesLine,
      isTeleLine,
      canManageUsers: isManager,
      canManageLeads: isManager,
      canViewReports: isManager,
      canCreateSubAdmin: isAdmin,
      mustChangePassword,
      signIn,
      signUp,
      signOut,
      changePassword,
      refreshRoles: () => loadRoles(user?.id),
      updateProfile,
    };
  }, [user, session, roles, loading, mustChangePassword]);

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
