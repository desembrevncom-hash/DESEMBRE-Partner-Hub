import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Play, Activity } from "lucide-react";
import { M9_SAFETY_COPY } from "../utils/m9SafetyCopy";

interface DispatchActionPanelProps {
  batchId: string | null;
  onPreview: () => void;
  onCreate: () => void;
  onRefreshStatus: () => void;
  isProcessing: boolean;
}

export function DispatchActionPanel({
  batchId,
  onPreview,
  onCreate,
  onRefreshStatus,
  isProcessing,
}: DispatchActionPanelProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-bold">Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 flex flex-col gap-3">
        <Button
          variant="outline"
          onClick={onPreview}
          disabled={!batchId || isProcessing}
          className="w-full justify-start font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
        >
          <Eye className="w-4 h-4 mr-2" /> {M9_SAFETY_COPY.LABELS.PREVIEW}
        </Button>
        <Button
          onClick={onCreate}
          disabled={!batchId || isProcessing}
          className="w-full justify-start font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Play className="w-4 h-4 mr-2" /> {M9_SAFETY_COPY.LABELS.CREATE}
        </Button>
        <Button
          variant="outline"
          onClick={onRefreshStatus}
          disabled={!batchId || isProcessing}
          className="w-full justify-start font-semibold"
        >
          <Activity className="w-4 h-4 mr-2" /> {M9_SAFETY_COPY.LABELS.STATUS}
        </Button>
      </CardContent>
    </Card>
  );
}
