import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Download, RefreshCw } from 'lucide-react';

export function ActionControls({ m7State }: { m7State: any }) {
  const { uiState, enqueueSnapshot, processDryRun, cancelBatch, reset } = m7State;

  return (
    <Card className="rounded-[32px] border-none shadow-sm bg-slate-900 text-white sticky top-24">
      <CardHeader className="pb-4 border-b border-slate-800">
        <CardTitle className="text-lg font-black uppercase tracking-widest text-slate-100">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        
        <Button 
          className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold justify-start"
          disabled={uiState !== 'created' && uiState !== 'enqueued'}
          onClick={enqueueSnapshot}
        >
          <Download className="w-4 h-4 mr-3" />
          Enqueue Snapshot
        </Button>

        <Button 
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold justify-start"
          disabled={uiState !== 'enqueued'}
          onClick={processDryRun}
        >
          <Play className="w-4 h-4 mr-3" />
          Start Dry-Run Simulation
        </Button>

        <Button 
          variant="destructive"
          className="w-full h-12 rounded-xl font-bold justify-start"
          disabled={uiState !== 'processing' && uiState !== 'enqueued'}
          onClick={cancelBatch}
        >
          <Square className="w-4 h-4 mr-3" />
          Cancel Simulation
        </Button>

        {(uiState === 'completed' || uiState === 'cancelled' || uiState === 'error') && (
          <Button 
            variant="outline"
            className="w-full h-12 rounded-xl text-slate-900 font-bold justify-start mt-8"
            onClick={reset}
          >
            <RefreshCw className="w-4 h-4 mr-3" />
            Start New Session
          </Button>
        )}

      </CardContent>
    </Card>
  );
}
