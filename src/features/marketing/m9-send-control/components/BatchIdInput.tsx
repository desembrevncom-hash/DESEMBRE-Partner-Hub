import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateUuid } from "../utils/validateUuid";
import { useToast } from "@/hooks/use-toast";

interface BatchIdInputProps {
  onBatchIdSelect: (id: string) => void;
}

export function BatchIdInput({ onBatchIdSelect }: BatchIdInputProps) {
  const [inputValue, setInputValue] = useState("");
  const { toast } = useToast();

  const handleSearch = () => {
    if (!inputValue) return;
    if (!validateUuid(inputValue)) {
      toast({
        title: "Invalid Batch ID",
        description: "Please enter a valid UUID format.",
        variant: "destructive",
      });
      return;
    }
    onBatchIdSelect(inputValue);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700">Enter Send Batch ID</label>
      <div className="flex items-center gap-2">
        <Input
          placeholder="e.g. b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="font-mono text-sm max-w-md"
        />
        <Button onClick={handleSearch} className="flex items-center gap-2">
          <Search className="w-4 h-4" /> Load Batch
        </Button>
      </div>
    </div>
  );
}
