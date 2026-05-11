import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  updateProfile: (data: { email?: string; display_name?: string; phone?: string; avatar_url?: string }) => Promise<{ error?: string }>;
};

const Ctx = createContext<AuthCtx | null>(null);

const MOCK_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "desembrevn.com@gmail.com",
  user_metadata: { display_name: "Admin Desembre" },
  app_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as any;

const MOCK_SESSION: Session = {
  access_token: "mock-token",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "mock-refresh",
  user: MOCK_USER,
} as any;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | undefined, userEmail?: string) => {
    if (!uid) return setRoles([]);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const dbRoles = (data ?? []).map((r) => r.role as AppRole);

    // Force admin role for the specific email desembrevn.com@gmail.com
    if (userEmail === "desembrevn.com@gmail.com" && !dbRoles.includes("admin")) {
      dbRoles.push("admin");
    }

    setRoles(dbRoles);
  };

  useEffect(() => {
    const savedMock = localStorage.getItem("mock_session");
    if (savedMock) {
      const sess = JSON.parse(savedMock);
      setSession(sess);
      setUser(sess.user);

      // Correctly load roles for the mock session user
      const mockRoles = JSON.parse(localStorage.getItem("mock_roles") || "[]");
      const userRoles = mockRoles.filter((r: any) => r.user_id === sess.user.id).map((r: any) => r.role);

      // If it's the hardcoded admin email, ensure they have admin role
      if (sess.user.email === "desembrevn.com@gmail.com") {
        if (!userRoles.includes("admin")) userRoles.push("admin");
      }

      // Default to sale if no roles found for non-admin email
      if (userRoles.length === 0) userRoles.push("sale");

      setRoles(userRoles);
      setLoading(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      // defer DB call to avoid deadlock
      setTimeout(() => loadRoles(sess?.user?.id, sess?.user?.email), 0);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      loadRoles(sess?.user?.id, sess?.user?.email).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password?: string) => {
    // Local bypass for the requested admin account
    if (email === "desembrevn.com@gmail.com" && password === "12345678") {
      setSession(MOCK_SESSION);
      setUser(MOCK_USER);
      setRoles(["admin"]);
      localStorage.setItem("mock_session", JSON.stringify(MOCK_SESSION));
      return {};
    }

    // Passwordless login for SALE
    if (!password) {
      const cleanEmail = email.trim().toLowerCase();
      const mockUsers = JSON.parse(localStorage.getItem("mock_users") || "[]");
      let foundMock = mockUsers.find((u: any) => {
        const uEmail = (u.email || u.user_email || "").trim().toLowerCase();
        return uEmail === cleanEmail;
      });

      // AUTO-REGISTER FALLBACK: If not found, create them locally on the fly
      if (!foundMock) {
        const userId = crypto.randomUUID();
        foundMock = {
          id: userId,
          email: cleanEmail,
          display_name: cleanEmail.split("@")[0],
          created_at: new Date().toISOString()
        };
        mockUsers.push(foundMock);
        localStorage.setItem("mock_users", JSON.stringify(mockUsers));

        const mockRoles = JSON.parse(localStorage.getItem("mock_roles") || "[]");
        mockRoles.push({ user_id: userId, role: "sale" });
        localStorage.setItem("mock_roles", JSON.stringify(mockRoles));
      }

      const mockRoles = JSON.parse(localStorage.getItem("mock_roles") || "[]");
      const userRoles = mockRoles.filter((r: any) => r.user_id === foundMock.id).map((r: any) => r.role);
      const hasSale = userRoles.includes("sale") || userRoles.length === 0;

      if (hasSale) {
        const sess = {
          ...MOCK_SESSION,
          user: {
            ...MOCK_USER,
            id: foundMock.id,
            email: foundMock.email || cleanEmail,
            user_metadata: { display_name: foundMock.display_name || foundMock.email }
          }
        } as any;
        setSession(sess);
        setUser(sess.user);
        setRoles(["sale"]);
        localStorage.setItem("mock_session", JSON.stringify(sess));
        return {};
      }

      return { error: `Tài khoản '${email}' không có quyền SALE.` };
    }

    let { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    const isMockMode = !!localStorage.getItem("mock_session");

    // If successful OR mock mode / 422 error
    if (!error || error.status === 422 || isMockMode) {
      const mockUsers = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const userId = data?.user?.id || crypto.randomUUID();
      const newUser = {
        id: userId,
        email,
        display_name: displayName || email,
        created_at: new Date().toISOString()
      };

      if (!mockUsers.find((u: any) => u.email === email)) {
        mockUsers.push(newUser);
        localStorage.setItem("mock_users", JSON.stringify(mockUsers));

        // Also add a default 'sale' role for the user in mock roles
        const mockRoles = JSON.parse(localStorage.getItem("mock_roles") || "[]");
        mockRoles.push({ user_id: userId, role: "sale" });
        localStorage.setItem("mock_roles", JSON.stringify(mockRoles));
      }

      return error && error.status !== 422 ? { error: error.message } : {};
    }

    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    localStorage.removeItem("mock_session");
    await supabase.auth.signOut();
    setRoles([]);
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (updates: { email?: string; display_name?: string; phone?: string; avatar_url?: string }) => {
    if (localStorage.getItem("mock_session") && user) {
      const mockUsers = JSON.parse(localStorage.getItem("mock_users") || "[]");
      const idx = mockUsers.findIndex((u: any) => u.id === user.id);
      if (idx >= 0) {
        if (updates.email) mockUsers[idx].email = updates.email;
        if (updates.display_name !== undefined) mockUsers[idx].display_name = updates.display_name;
        if (updates.phone !== undefined) mockUsers[idx].phone = updates.phone;
        if (updates.avatar_url !== undefined) mockUsers[idx].avatar_url = updates.avatar_url;
        localStorage.setItem("mock_users", JSON.stringify(mockUsers));
      }

      const sess = JSON.parse(localStorage.getItem("mock_session") || "{}");
      if (sess.user) {
        if (updates.email) sess.user.email = updates.email;
        sess.user.user_metadata = sess.user.user_metadata || {};
        if (updates.display_name !== undefined) sess.user.user_metadata.display_name = updates.display_name;
        if (updates.phone !== undefined) sess.user.user_metadata.phone = updates.phone;
        if (updates.avatar_url !== undefined) sess.user.user_metadata.avatar_url = updates.avatar_url;
        localStorage.setItem("mock_session", JSON.stringify(sess));
        setUser(sess.user);
        setSession(sess);
      }
      return {};
    }

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

  return (
    <Ctx.Provider
      value={{
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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
