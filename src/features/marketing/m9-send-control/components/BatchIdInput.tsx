import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateUuid } from "../utils/validateUuid";
import { toast } from "sonner";

interface BatchIdInputProps {
  onBatchIdSelect: (id: string) => void;
}

export function BatchIdInput({ onBatchIdSelect }: BatchIdInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSearch = () => {
    if (!inputValue) return;
    if (!validateUuid(inputValue)) {
      toast.error("Batch ID không hợp lệ: Vui lòng nhập đúng định dạng UUID.");
      return;
    }
    onBatchIdSelect(inputValue);
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-bold text-slate-700">Nhập mã Send Batch ID</label>
      <div className="flex gap-3">
        <Input
          placeholder="VD: b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e (hoặc nhập '1' để test)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="max-w-md font-mono text-sm rounded-xl"
        />
        <Button onClick={handleSearch} className="rounded-xl bg-blue-600 hover:bg-blue-700 gap-2">
          <Search className="w-4 h-4" /> Tải Batch
        </Button>
      </div>
    </div>
  );
}
