import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS } from "@/data/products";
import { Sparkles, ArrowRight, CheckCircle2, TrendingUp, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  customer: any;
  orders: any[];
  items: any[];
}

export const CustomerKnowledgeUpsell: React.FC<Props> = ({ customer, orders, items }) => {
  const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        const { data, error } = await supabase
          .from("product_knowledge")
          .select("*")
          .eq("is_active", true);
        if (!error && data) {
          setKnowledgeList(data);
        }
      } catch (err) {
        console.error("Error fetching product knowledge:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchKnowledge();
  }, []);

  const suggestions = useMemo(() => {
    if (loading || knowledgeList.length === 0) return [];

    // 1. Identify purchased products and their last purchase date
    const purchasedMap = new Map<number, string>();
    items.forEach((it) => {
      // Find product ID from name or no
      const pIdStr = it.product_no || it.product_id;
      let pId = parseInt(pIdStr);
      if (isNaN(pId) && it.product_name) {
        const p = PRODUCTS.find(
          (p) => p.name.includes(it.product_name) || it.product_name.includes(p.name),
        );
        if (p) pId = p.id;
      }

      if (!isNaN(pId)) {
        const dateStr = it.order?.created_at || it.created_at;
        const existing = purchasedMap.get(pId);
        if (!existing || new Date(dateStr) > new Date(existing)) {
          purchasedMap.set(pId, dateStr);
        }
      }
    });

    // Extract all cross-sell targets from purchased items
    const allCrossSells = new Set<number>();
    purchasedMap.forEach((_, pId) => {
      const k = knowledgeList.find((k) => k.product_id === pId);
      if (k && k.cross_sell_products) {
        k.cross_sell_products.forEach((cp: number) => allCrossSells.add(cp));
      }
    });

    // Customer skin concerns (if available on customer object, otherwise fallback to empty array)
    // Note: We use customer.skin_concern_focus or customer.skin_concerns or parse tags if needed
    const customerConcerns: string[] = Array.isArray(customer?.skin_concerns)
      ? customer.skin_concerns
      : customer?.skin_concern_focus
        ? [customer.skin_concern_focus]
        : [];

    // 2. Score knowledge list
    const scored = knowledgeList.map((k) => {
      let score = 0;
      const reasons: string[] = [];
      const isPurchased = purchasedMap.has(k.product_id);

      // Rule 1: Cross-sell priority
      if (allCrossSells.has(k.product_id) && !isPurchased) {
        score += 50;
        reasons.push("Sản phẩm mua kèm lý tưởng");
      }

      // Rule 2: Skin concerns match
      if (k.skin_concerns && customerConcerns.length > 0) {
        const matches = k.skin_concerns.filter((c: string) => customerConcerns.includes(c));
        if (matches.length > 0) {
          score += 30 * matches.length;
          reasons.push(`Phù hợp vấn đề da (${matches.join(", ")})`);
        }
      }

      // Rule 3: Restock cycle
      if (isPurchased && k.restock_cycle_days > 0) {
        const lastDate = purchasedMap.get(k.product_id)!;
        const daysSince = Math.floor(
          (new Date().getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSince >= k.restock_cycle_days - 7) {
          score += 80; // High priority for restock
          reasons.push(`Khách sắp dùng hết (Chu kỳ ${k.restock_cycle_days} ngày)`);
        } else {
          // If recently purchased and not ready to restock, we probably shouldn't suggest it right now
          score -= 100;
        }
      }

      // If it's a completely cold product (not purchased, not cross-sell, no skin match)
      if (score === 0 && !isPurchased) {
        score += 10;
        reasons.push("Gợi ý trải nghiệm sản phẩm mới");
      }

      return {
        ...k,
        score,
        reasons,
        isRestock: isPurchased,
      };
    });

    // 3. Filter and sort
    return scored
      .filter((k) => k.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3
  }, [knowledgeList, items, customer, loading]);

  const getProductName = (id: number) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return p ? p.name : `Sản phẩm #${id}`;
  };

  if (loading) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl border border-indigo-100 shadow-3xs space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-[11px] font-black uppercase text-indigo-700 tracking-wider">
          AI / Rule-based Gợi ý Upsell
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div
            key={s.product_id}
            className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden group"
          >
            {s.isRestock && (
              <div className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase">
                Tái Đặt Hàng
              </div>
            )}

            <div className="pr-12">
              <h4 className="text-xs font-black text-slate-800 leading-snug">
                {i + 1}. {getProductName(s.product_id)}
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{s.benefits}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.reasons.map((r: string, idx: number) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-[9px] bg-slate-50 border-slate-200 text-slate-600 px-1.5 font-bold uppercase"
                >
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
