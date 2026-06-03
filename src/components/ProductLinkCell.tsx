import { useEffect, useRef, useState } from "react";
import { Pencil, X, ExternalLink, Check, Lock, Loader2 } from "lucide-react";
import { useEditUnlock } from "@/hooks/useEditUnlock";
import UnlockDialog from "@/components/UnlockDialog";
import { saveProductOverride } from "@/lib/saveOverride";
import { toast } from "sonner";

type Props = {
  productNo: number;
  href?: string;
  onChange: (href: string | undefined) => void;
  isReadOnly?: boolean;
};

const normalize = (raw: string): string | undefined => {
  const v = raw.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
};

const ProductLinkCell = ({ productNo, href, onChange, isReadOnly = false }: Props) => {
  const { unlocked: editUnlocked, getPassword } = useEditUnlock();
  const unlocked = isReadOnly ? false : editUnlocked;
  const [open, setOpen] = useState(false);
  const [askUnlock, setAskUnlock] = useState(false);
  const [value, setValue] = useState(href ?? "");
  const [saving, setSaving] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const requestOpen = () => {
    if (isReadOnly) return;
    if (!unlocked) {
      setAskUnlock(true);
      return;
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    setValue(href ?? "");
  }, [href]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        popRef.current &&
        !popRef.current.contains(e.target as Node) &&
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const persist = async (link_url: string | null) => {
    const password = getPassword();
    if (!password) {
      toast.error("Cần mở khoá KEY trước khi lưu");
      setAskUnlock(true);
      return false;
    }
    setSaving(true);
    const res = await saveProductOverride({ no: productNo, link_url });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Lưu thất bại");
      return false;
    }
    toast.success("Đã lưu liên kết");
    return true;
  };

  const save = async () => {
    const next = normalize(value);
    const ok = await persist(next ?? null);
    if (ok) {
      onChange(next);
      setOpen(false);
    }
  };

  const clear = async () => {
    const ok = await persist(null);
    if (ok) {
      setValue("");
      onChange(undefined);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1.5 group">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="link-badge"
          title={href}
          data-pdf-link={href}
        >
          Link
          <ExternalLink className="w-3 h-3 ml-1 inline-block opacity-70" />
        </a>
      ) : unlocked ? (
        <button
          type="button"
          onClick={requestOpen}
          className="link-badge opacity-60 hover:opacity-100 inline-flex items-center gap-1"
          title="Thêm liên kết"
        >
          + Link
        </button>
      ) : (
        <span className="text-[11px] text-muted-foreground/60">—</span>
      )}

      {unlocked && href && (
        <button
          type="button"
          onClick={requestOpen}
          className="opacity-0 group-hover:opacity-100 transition w-6 h-6 inline-flex items-center justify-center rounded border border-border bg-background hover:bg-accent/20 text-muted-foreground"
          aria-label="Chỉnh sửa liên kết"
          title="Chỉnh sửa liên kết"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}

      <UnlockDialog open={askUnlock} onOpenChange={setAskUnlock} onUnlocked={() => setOpen(true)} />

      {open && unlocked && (
        <div
          ref={popRef}
          className="absolute z-30 right-0 top-full mt-2 w-72 bg-card border border-border rounded-md shadow-lg p-3"
        >
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Liên kết sản phẩm #{String(productNo).padStart(2, "0")}
          </label>
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder="https://..."
            className="w-full h-9 px-2.5 text-sm rounded border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <button
              type="button"
              onClick={clear}
              disabled={saving}
              className="h-8 px-2.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Xoá
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-8 px-3 text-xs rounded border border-border text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-8 px-3 text-xs rounded bg-primary text-primary-foreground font-semibold inline-flex items-center gap-1 hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductLinkCell;
