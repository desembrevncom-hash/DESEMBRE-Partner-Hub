import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, XCircle, Plus, Trash2, Target } from "lucide-react";

interface EligibilityResult {
  is_active: boolean;
  has_valid_email: boolean;
  has_consent: boolean;
  has_suppression: boolean;
  has_duplicate: boolean;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  eligibility: EligibilityResult | null;
}

export function LimitedPilotPreparation({ campaignId, onSuccess }: { campaignId: string, onSuccess?: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 3) {
      toast.error("Vui lòng nhập ít nhất 3 ký tự để tìm kiếm.");
      return;
    }

    try {
      setIsSearching(true);
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone, business_name, contact_name, facility_name, marketing_opt_in")
        .or(`email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,business_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%,facility_name.ilike.%${searchTerm}%`)
        .order("marketing_opt_in", { ascending: false, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
      if (data?.length === 0) {
        toast.info("Không tìm thấy khách hàng nào khớp. Hãy thử tìm theo tên spa, email, hoặc sđt.");
      }
    } catch (e: any) {
      toast.error("Lỗi tìm kiếm: " + e.message);
    } finally {
      setIsSearching(false);
    }
  };

  const checkEligibilityAndAdd = async (customer: any) => {
    if (candidates.some(c => c.id === customer.id)) {
      toast.warning("Khách hàng này đã có trong danh sách chờ.");
      return;
    }
    
    if (candidates.length >= 10) {
      toast.error("Chỉ được thêm tối đa 10 khách hàng cho Pilot.");
      return;
    }

    try {
      setIsChecking(true);
      const { data, error } = await supabase.rpc("admin_check_pilot_eligibility", {
        p_campaign_id: campaignId,
        p_customer_id: customer.id
      });

      if (error) throw error;

      const eligibility = data as unknown as EligibilityResult;
      
      const newCandidate: Candidate = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        eligibility
      };

      setCandidates(prev => [...prev, newCandidate]);
      setSearchResults([]); // clear search after add
      setSearchTerm("");
    } catch (e: any) {
      toast.error("Lỗi kiểm tra tính hợp lệ: " + e.message);
    } finally {
      setIsChecking(false);
    }
  };

  const removeCandidate = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
  };

  const isAllEligible = candidates.length > 0 && candidates.every(c => 
    c.eligibility?.is_active &&
    c.eligibility?.has_valid_email &&
    c.eligibility?.has_consent &&
    !c.eligibility?.has_suppression &&
    !c.eligibility?.has_duplicate
  );

  const handlePrepare = async () => {
    if (!isAllEligible) {
      toast.error("Tất cả ứng viên phải hợp lệ (PASS) mới có thể tạo Pilot.");
      return;
    }

    const input = window.prompt("Xác nhận tạo tệp Pilot tĩnh (Static Segment) ghi đè lên Audience hiện tại.\n\nGõ chính xác: PREPARE_LIMITED_PILOT_AUDIENCE");
    if (input !== "PREPARE_LIMITED_PILOT_AUDIENCE") {
      toast.error("Lỗi xác nhận. Đã hủy.");
      return;
    }

    try {
      setIsPreparing(true);
      const { data, error } = await supabase.rpc("admin_prepare_limited_pilot_audience", {
        p_campaign_id: campaignId,
        p_customer_ids: candidates.map(c => c.id)
      });

      if (error) {
        if (error.message.includes("does not exist") || error.message.includes("column") || error.message.includes("relation")) {
           throw new Error("Audience segment schema mismatch. Please update RPC.");
        }
        throw error;
      }
      
      toast.success("Đã tạo Pilot Audience thành công!");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      toast.error("Lỗi khi prepare: " + e.message);
    } finally {
      setIsPreparing(false);
    }
  };

  const renderBadge = (condition: boolean, label: string) => {
    if (condition) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/>{label} PASS</Badge>;
    }
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1"/>{label} FAIL</Badge>;
  };

  return (
    <Card className="border-indigo-100 shadow-sm mt-6">
      <CardHeader className="bg-indigo-50/50 pb-4">
        <CardTitle className="text-indigo-900 flex items-center text-lg">
          <Target className="w-5 h-5 mr-2 text-indigo-600" />
          Limited Pilot Audience Preparation
        </CardTitle>
        <CardDescription>
          Chuẩn bị tệp 5-10 khách hàng an toàn cho chiến dịch Pilot. Chỉ được chọn người có Consent Proof.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        
        {/* Search Section */}
        <div className="flex gap-2">
          <Input 
            placeholder="Tìm theo email, tên, SĐT..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isSearching} variant="secondary">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {searchResults.length === 0 && searchTerm.length >= 3 && !isSearching && (
          <div className="p-4 text-center text-slate-500 bg-slate-50 border border-slate-100 rounded-lg text-sm">
            <p className="font-bold text-slate-700">No matching customers found.</p>
            <p className="mt-1">Try searching by customer name, email, phone, or spa name.</p>
            <p className="mt-1 text-xs text-amber-600">Note: Only customers with valid email can be added.</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">Kết quả tìm kiếm</div>
            {searchResults.map(customer => (
              <div key={customer.id} className="p-3 flex items-center justify-between border-b last:border-0 hover:bg-slate-50">
                <div>
                  <div className="font-medium text-sm">{customer.name}</div>
                  <div className="text-xs text-slate-500">
                    {customer.email ? `${customer.email.substring(0, 3)}***@...` : 'No email'} 
                    {customer.phone && ` - ${customer.phone.substring(0, 3)}***`}
                  </div>
                  {(customer.business_name || customer.spa_name || customer.facility_name) && (
                    <div className="text-xs text-indigo-500 mt-1 italic">
                      {customer.business_name || customer.spa_name || customer.facility_name}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => checkEligibilityAndAdd(customer)} disabled={isChecking}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Selected Candidates */}
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3 flex justify-between">
            <span>Danh sách chờ (Candidates)</span>
            <span>{candidates.length} / 10</span>
          </h4>
          
          {candidates.length === 0 ? (
            <div className="text-sm text-slate-400 italic py-4 text-center border border-dashed rounded-lg">Chưa có ứng viên nào</div>
          ) : (
            <div className="space-y-3">
              {candidates.map(c => (
                <div key={c.id} className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col gap-2 relative group">
                  <div className="flex justify-between items-start pr-8">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </div>
                  </div>
                  
                  {c.eligibility && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {renderBadge(c.eligibility.is_active, "Allowed Status")}
                      {renderBadge(c.eligibility.has_valid_email, "Email")}
                      {renderBadge(c.eligibility.has_consent, "Consent")}
                      {renderBadge(!c.eligibility.has_suppression, "Not Suppressed")}
                      {renderBadge(!c.eligibility.has_duplicate, "No Duplicate")}
                    </div>
                  )}

                  <button 
                    onClick={() => removeCandidate(c.id)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action */}
        <div className="pt-4 border-t flex justify-end">
          <Button 
            onClick={handlePrepare} 
            disabled={candidates.length < 5 || !isAllEligible || isPreparing}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold"
          >
            {isPreparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
            Xác nhận tạo tệp Pilot ({candidates.length} người)
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
