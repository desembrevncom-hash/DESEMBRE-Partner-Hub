import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConsentChannel, ConsentStatus, ConsentSource } from "@/types/marketing_m8";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onUpdate: (payload: any) => Promise<void>;
  loading: boolean;
}

export function ConsentUpdateModal({ open, onOpenChange, customerId, onUpdate, loading }: Props) {
  const [channel, setChannel] = useState<ConsentChannel>("email");
  const [status, setStatus] = useState<ConsentStatus>("pending");
  const [proofType, setProofType] = useState("");
  const [proofRef, setProofRef] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [effectiveAt, setEffectiveAt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      p_customer_id: customerId,
      p_channel: channel,
      p_status: status,
      p_source: "manual_admin" as ConsentSource,
      p_proof_type: proofType || null,
      p_proof_reference: proofRef || null,
      p_proof_note: proofNote || null,
      p_effective_at: effectiveAt ? new Date(effectiveAt).toISOString() : new Date().toISOString(),
      p_idempotency_key: crypto.randomUUID(),
    };
    await onUpdate(payload);
    onOpenChange(false);
  };

  const requiresProof = status === "opt_in" || status === "opt_out";
  const hasProof = !!proofRef || !!proofNote;
  const isSubmitDisabled = loading || (requiresProof && !hasProof);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Consent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v: ConsentChannel) => setChannel(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="zalo_zns">Zalo ZNS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: ConsentStatus) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opt_in">Opt In</SelectItem>
                <SelectItem value="opt_out">Opt Out</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Proof Type</Label>
            <Input value={proofType} onChange={(e) => setProofType(e.target.value)} placeholder="e.g. Email Reply, Signed Form" />
          </div>

          <div className="space-y-2">
            <Label>Proof Reference {requiresProof && <span className="text-rose-500">*</span>}</Label>
            <Input value={proofRef} onChange={(e) => setProofRef(e.target.value)} placeholder="Link or exact reference" />
          </div>

          <div className="space-y-2">
            <Label>Proof Note {requiresProof && <span className="text-rose-500">*</span>}</Label>
            <Textarea value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="Additional context" rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Effective Date (Optional)</Label>
            <Input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />
            <p className="text-[10px] text-slate-500">Defaults to now if empty</p>
          </div>

          {requiresProof && !hasProof && (
            <p className="text-xs text-rose-500 font-medium">Opt In / Opt Out requires either a Proof Reference or a Proof Note.</p>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitDisabled} className="bg-indigo-600 hover:bg-indigo-700">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Consent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
