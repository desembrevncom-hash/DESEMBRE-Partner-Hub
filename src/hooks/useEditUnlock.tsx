import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

type Ctx = {
  unlocked: boolean;
  verifying: boolean;
  unlock: (password: string) => Promise<{ ok: boolean; error?: string }>;
  lock: () => void;
  getPassword: () => string | null;
};

const EditUnlockContext = createContext<Ctx | null>(null);

export const EditUnlockProvider = ({ children }: { children: ReactNode }) => {
  const { isAdmin, signOut } = useAuth();
  const value: Ctx = {
    unlocked: isAdmin,
    verifying: false,
    unlock: async () => ({ ok: false, error: "Vui lòng đăng nhập tài khoản ADMIN" }),
    lock: () => { signOut(); },
    getPassword: () => "n/a",
  };
  return <EditUnlockContext.Provider value={value}>{children}</EditUnlockContext.Provider>;
};

export const useEditUnlock = () => {
  const ctx = useContext(EditUnlockContext);
  if (!ctx) throw new Error("useEditUnlock must be used within EditUnlockProvider");
  return ctx;
};
