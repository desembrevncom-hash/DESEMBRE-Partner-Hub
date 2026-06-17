import { useState } from "react";
import { ConsentSafetyBanner } from "./ConsentSafetyBanner";
import { CustomerConsentSearch } from "./CustomerConsentSearch";
import { ConsentSummaryCard } from "./ConsentSummaryCard";
import { ConsentAuditTimeline } from "./ConsentAuditTimeline";
import { ConsentUpdateModal } from "./ConsentUpdateModal";
import { BulkConsentImportPanel } from "./BulkConsentImportPanel";
import { useM8ConsentRegistry } from "@/hooks/marketing/useM8ConsentRegistry";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function ConsentDashboard() {
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { getSummary, getHistory, updateConsent, loading } = useM8ConsentRegistry();

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    await refreshData(customer.id);
  };

  const refreshData = async (customerId: string) => {
    const [sumData, histData] = await Promise.all([
      getSummary(customerId),
      getHistory(customerId)
    ]);
    setSummary(sumData);
    setHistory(histData);
  };

  const handleUpdate = async (payload: any) => {
    await updateConsent(payload);
    if (selectedCustomer) {
      await refreshData(selectedCustomer.id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <ConsentSafetyBanner />
      
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Consent Registry</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage centralized marketing consent and view audit history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Customer Lookup</h2>
            <CustomerConsentSearch onSelectCustomer={handleSelectCustomer} />
            
            {selectedCustomer && (
              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{selectedCustomer.name || selectedCustomer.business_name || "Unnamed"}</h3>
                    <p className="text-sm text-slate-500">{selectedCustomer.email} • {selectedCustomer.phone}</p>
                  </div>
                  <Button onClick={() => setModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Update Consent
                  </Button>
                </div>
                
                <h4 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Current Status</h4>
                <ConsentSummaryCard summary={summary} />
                
                <ConsentAuditTimeline history={history} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <BulkConsentImportPanel />
        </div>
      </div>

      {selectedCustomer && (
        <ConsentUpdateModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          customerId={selectedCustomer.id}
          onUpdate={handleUpdate}
          loading={loading}
        />
      )}
    </div>
  );
}
