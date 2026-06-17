import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomerConsentSearch({ onSelectCustomer }: { onSelectCustomer: (customer: any) => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, business_name, email, phone")
        .or(`name.ilike.%${query}%,business_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search customer by name, email, or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="max-w-md"
        />
        <Button onClick={handleSearch} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {results.length > 0 && (
        <div className="border rounded-xl shadow-sm divide-y">
          {results.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div>
                <p className="font-semibold text-slate-900">{c.name || c.business_name || "Unnamed Customer"}</p>
                <div className="text-sm text-slate-500 flex gap-4 mt-1">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => onSelectCustomer(c)}>
                Select
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
