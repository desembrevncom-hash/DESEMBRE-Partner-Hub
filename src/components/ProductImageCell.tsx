import { useRef, useState } from "react";
import { Sparkles, Upload, Link2, X, Pencil, Lock, Loader2 } from "lucide-react";
import { useEditUnlock } from "@/hooks/useEditUnlock";
import UnlockDialog from "@/components/UnlockDialog";
import { saveProductOverride } from "@/lib/saveOverride";
import { toast } from "sonner";

type Props = {
  productNo: number;
  src?: string;
  onChange: (src: string | undefined) => void;
};

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5MB

const ProductImageCell = ({ productNo, src, onChange }: Props) => {
  const { unlocked, getPassword } = useEditUnlock();
  const [open, setOpen] = useState(false);
  const [askUnlock, setAskUnlock] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const requestOpen = () => {
    if (!unlocked) {
      setAskUnlock(true);
      return;
    }
    setOpen((v) => !v);
  };

  const persist = async (payload: { image_data_url?: string | null; image_url?: string | null }) => {
    const password = getPassword();
    if (!password) {
      toast.error("Cần mở khoá KEY trước khi lưu");
      setAskUnlock(true);
      return null;
    }
    setSaving(true);
    const res = await saveProductOverride({ no: productNo, ...payload });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Lưu thất bại");
      return null;
    }
    toast.success("Đã lưu ảnh");
    return res.row as { image_url: string | null } | undefined;
  };

  const requestDelete = async () => {
    if (!unlocked) {
      setAskUnlock(true);
      return;
    }
    const row = await persist({ image_data_url: null });
    if (row) onChange(undefined);
  };

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp ảnh.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Ảnh quá lớn (tối đa 1.5MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const row = await persist({ image_data_url: dataUrl });
      if (row?.image_url) {
        onChange(row.image_url);
        setOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyUrl = async () => {
    const v = urlInput.trim();
    if (!v) return;
    const row = await persist({ image_url: v });
    if (row) {
      onChange(v);
      setUrlInput("");
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-block group">
      <div className="product-img-box overflow-hidden">
        {src ? (
          <img
            src={src}
            alt={`Sản phẩm ${productNo}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Sparkles className="w-7 h-7 text-primary/40" strokeWidth={1.25} />
        )}
      </div>

      {unlocked && (
        <button
          type="button"
          onClick={requestOpen}
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition flex items-center justify-center"
          aria-label="Chỉnh sửa ảnh"
          title="Chỉnh sửa ảnh"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}

      {unlocked && src && (
        <button
          type="button"
          onClick={requestDelete}
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition flex items-center justify-center"
          aria-label="Xoá ảnh"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <UnlockDialog
        open={askUnlock}
        onOpenChange={setAskUnlock}
        onUnlocked={() => setOpen(true)}
      />

      {open && unlocked && (
        <div className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-card border border-border rounded-md shadow-xl p-3 text-left">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Ảnh sản phẩm #{String(productNo).padStart(2, "0")}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition mb-2"
          >
            <Upload className="w-3.5 h-3.5" /> Tải ảnh từ máy
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Hoặc dán URL ảnh</span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={applyUrl}
              className="h-9 px-3 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              OK
            </button>
          </div>

          {error && <p className="text-[11px] text-destructive mt-2">{error}</p>}

          <div className="flex justify-between mt-3 pt-2 border-t border-border">
            {src ? (
              <button
                type="button"
                onClick={async () => {
                  const row = await persist({ image_data_url: null });
                  if (row) {
                    onChange(undefined);
                    setOpen(false);
                  }
                }}
                disabled={saving}
                className="text-[11px] text-destructive hover:underline disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Xoá ảnh"}
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductImageCell;
