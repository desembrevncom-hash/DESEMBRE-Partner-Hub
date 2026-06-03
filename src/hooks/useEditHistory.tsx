import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { saveProductOverride, type OverrideRow } from "@/lib/saveOverride";
import { useEditUnlock } from "@/hooks/useEditUnlock";
import { toast } from "sonner";

type Snapshot = {
  no: number;
  prev: OverrideRow | null; // null = row didn't exist
  label: string;
};

type Ctx = {
  canUndo: boolean;
  count: number;
  snapshot: (no: number, prev: OverrideRow | undefined | null, label: string) => void;
  undo: () => Promise<void>;
  clear: () => void;
};

const HistoryContext = createContext<Ctx | null>(null);

const MAX_HISTORY = 10;

type Props = {
  children: ReactNode;
  applyRestore: (no: number, row: OverrideRow | null) => void;
};

export const EditHistoryProvider = ({ children, applyRestore }: Props) => {
  const { getPassword } = useEditUnlock();
  const [stack, setStack] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);

  const snapshot = useCallback(
    (no: number, prev: OverrideRow | undefined | null, label: string) => {
      setStack((s) => {
        const next = [...s, { no, prev: prev ?? null, label }];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
    },
    [],
  );

  const undo = useCallback(async () => {
    if (busy) return;
    const last = stack[stack.length - 1];
    if (!last) return;
    const password = getPassword();
    if (!password) {
      toast.error("Cần mở khoá KEY");
      return;
    }
    setBusy(true);
    try {
      if (!last.prev) {
        // Row didn't exist before — remove it entirely
        const res = await saveProductOverride({ action: "hard_delete", no: last.no });
        if (!res.ok) {
          toast.error(res.error ?? "Hoàn tác thất bại");
          return;
        }
        applyRestore(last.no, null);
      } else {
        const p = last.prev;
        const res = await saveProductOverride({
          no: p.no,
          image_url: p.image_url,
          link_url: p.link_url,
          section: p.section,
          name: p.name,
          desc: p.desc,
          retail_size: p.retail_size,
          retail_price: p.retail_price,
          salon_size: p.salon_size,
          salon_price: p.salon_price,
          deleted: p.deleted,
        });
        if (!res.ok || !res.row) {
          toast.error(res.error ?? "Hoàn tác thất bại");
          return;
        }
        applyRestore(p.no, res.row);
      }
      setStack((s) => s.slice(0, -1));
      toast.success(`Đã hoàn tác: ${last.label}`);
    } finally {
      setBusy(false);
    }
  }, [stack, busy, getPassword, applyRestore]);

  const clear = useCallback(() => setStack([]), []);

  return (
    <HistoryContext.Provider
      value={{ canUndo: stack.length > 0 && !busy, count: stack.length, snapshot, undo, clear }}
    >
      {children}
    </HistoryContext.Provider>
  );
};

export const useEditHistory = () => {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useEditHistory must be used within EditHistoryProvider");
  return ctx;
};
