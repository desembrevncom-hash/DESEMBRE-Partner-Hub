import React from 'react';
import { SimulationBanner } from './SimulationBanner';
import { ConfigurationPanel } from './ConfigurationPanel';
import { PreviewMetricsCard } from './PreviewMetricsCard';
import { BatchProgressTracker } from './BatchProgressTracker';
import { ActionControls } from './ActionControls';
import { useM7SendControl } from '@/hooks/marketing/useM7SendControl';

export default function SendControlDashboard() {
  const m7State = useM7SendControl();

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <SimulationBanner />
      
      <div className="container mx-auto px-6 max-w-5xl pt-10 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dry-Run Control</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage and simulate M7 marketing send batches.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ConfigurationPanel 
              uiState={m7State.uiState}
              onPreview={(campId, provId, mapId, chan) => m7State.previewBatch(campId, provId, mapId, chan)}
              onCreate={(campId, provId, mapId, chan) => m7State.createBatch(campId, provId, mapId, chan)}
            />
            
            {m7State.previewResult && (
              <PreviewMetricsCard previewResult={m7State.previewResult} />
            )}
            
            {(m7State.uiState !== 'idle' && m7State.uiState !== 'previewing' && m7State.uiState !== 'previewed') && (
              <BatchProgressTracker batchStatus={m7State.batchStatus} uiState={m7State.uiState} />
            )}
          </div>
          
          <div className="lg:col-span-1">
            <ActionControls m7State={m7State} />
          </div>
        </div>
      </div>
    </div>
  );
}
