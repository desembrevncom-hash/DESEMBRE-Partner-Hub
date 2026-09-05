import { useState, useEffect } from "react";
import { Package } from "lucide-react";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackIconSize?: number;
  showWatermark?: boolean;
}

export function CatalogProductImage({
  src,
  alt,
  className = "w-full h-full object-contain",
  containerClassName = "w-full h-full flex items-center justify-center bg-slate-50",
  fallbackIconSize = 24,
  showWatermark = false,
}: Props) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isValidSrc = Boolean(src && src.trim().length > 0 && !hasError);

  if (!isValidSrc) {
    return (
      <div className={containerClassName}>
        <div className="flex flex-col items-center justify-center text-slate-300 gap-1 select-none">
          <Package
            style={{ width: fallbackIconSize, height: fallbackIconSize }}
            className="stroke-1"
          />
          {showWatermark && (
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
              Desembre
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <img
      src={src!}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
