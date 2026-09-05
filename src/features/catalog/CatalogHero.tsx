import { Sparkles, PhoneCall, LogIn, ArrowRight, ShieldCheck, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  onOpenContact: () => void;
  totalProducts: number;
}

export function CatalogHero({ onOpenContact, totalProducts }: Props) {
  const { user } = useAuth();

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-6 sm:py-8 px-4 sm:px-8 rounded-2xl sm:rounded-3xl shadow-lg border border-indigo-900/30">
      {/* Subtle decorative background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-indigo-500/10 blur-[90px] rounded-full pointer-events-none" />

      <div className="container mx-auto max-w-7xl relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        {/* Left side: Branding & description */}
        <div className="space-y-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Dược Mỹ Phẩm Sinh Học Hàn Quốc
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 text-[11px] font-bold">
              <Zap className="w-3 h-3 text-amber-400" />
              {totalProducts > 0 ? `${totalProducts}+ sản phẩm` : "Đầy đủ danh mục"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight text-white">
            DESEMBRE{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
              Product Catalog
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
            Danh mục sản phẩm chính thức từ Hyunjin C&amp;T (Hàn Quốc) tại Việt Nam. Giải pháp làm
            sạch, phục hồi &amp; liệu trình chuyên sâu cho Spa &amp; Thẩm mỹ viện.
          </p>

          {/* Trust badges inline */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1 text-[11px] font-semibold text-slate-300">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Chính hãng Hàn Quốc</span>
            </div>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Chuẩn Spa &amp; Clinic</span>
            </div>
          </div>
        </div>

        {/* Right side: Compact CTAs */}
        <div className="flex flex-row md:flex-col lg:flex-row items-center gap-2.5 shrink-0 pt-2 md:pt-0">
          <Button
            onClick={onOpenContact}
            size="sm"
            className="flex-1 sm:flex-initial h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
            Liên hệ tư vấn
          </Button>

          {user ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial h-10 px-5 rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs backdrop-blur-md transition-all cursor-pointer"
            >
              <Link to="/workspace">
                Hub làm việc
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial h-10 px-5 rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs backdrop-blur-md transition-all cursor-pointer"
            >
              <Link to="/login">
                <LogIn className="w-3.5 h-3.5 mr-1.5 text-indigo-300" />
                Đăng nhập Partner
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
