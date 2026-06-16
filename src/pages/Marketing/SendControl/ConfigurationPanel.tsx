import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { UIState } from '@/hooks/marketing/useM7SendControl';

interface ConfigurationPanelProps {
  uiState: UIState;
  onPreview: (campaignId: string, providerId: string, mappingId: string, channel: string) => void;
  onCreate: (campaignId: string, providerId: string, mappingId: string, channel: string) => void;
}

export function ConfigurationPanel({ uiState, onPreview, onCreate }: ConfigurationPanelProps) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedMapping, setSelectedMapping] = useState('');

  useEffect(() => {
    async function loadData() {
      // 1. Load Campaigns
      const { data: camps } = await supabase
        .from('marketing_campaigns')
        .select('id, name, approval_status, approved_snapshot_version')
        .eq('approval_status', 'approved')
        .gt('approved_snapshot_version', 0);
      if (camps) setCampaigns(camps);

      // 2. Load Providers
      const { data: provs } = await supabase
        .from('marketing_provider_accounts')
        .select('id, provider_name, channel, readiness_status, configured_externally, secret_status')
        .eq('readiness_status', 'ready')
        .eq('configured_externally', true)
        .not('secret_status', 'in', '("missing","invalid_reference")');
      if (provs) setProviders(provs);
    }
    loadData();
  }, []);

  useEffect(() => {
    async function loadMappings() {
      if (!selectedProvider) {
        setMappings([]);
        return;
      }
      const { data: maps } = await supabase
        .from('marketing_provider_template_mappings')
        .select('id, provider_account_id, marketing_template_id, provider_template_id, mapping_status, readiness_status')
        .eq('provider_account_id', selectedProvider)
        .eq('mapping_status', 'active')
        .eq('readiness_status', 'ready')
        .not('provider_template_id', 'is', null)
        .neq('provider_template_id', '');
      
      if (maps) setMappings(maps);
    }
    loadMappings();
  }, [selectedProvider]);

  const disabled = uiState !== 'idle' && uiState !== 'previewed';

  return (
    <Card className="rounded-[32px] border-none shadow-sm bg-white">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-black text-slate-900 uppercase tracking-widest">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Campaign</label>
          <select 
            className="w-full p-3 rounded-xl border border-slate-200" 
            value={selectedCampaign} 
            onChange={e => setSelectedCampaign(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Campaign</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name} (V{c.approved_snapshot_version})</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Provider Account</label>
          <select 
            className="w-full p-3 rounded-xl border border-slate-200" 
            value={selectedProvider} 
            onChange={e => setSelectedProvider(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Provider</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.provider_name} ({p.channel})</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Template Mapping</label>
          <select 
            className="w-full p-3 rounded-xl border border-slate-200" 
            value={selectedMapping} 
            onChange={e => setSelectedMapping(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select Mapping</option>
            {mappings.map(m => <option key={m.id} value={m.id}>{m.provider_template_id}</option>)}
          </select>
        </div>
        
        <div className="pt-4 flex gap-4">
          <Button 
            className="w-full rounded-xl" 
            disabled={!selectedCampaign || !selectedProvider || !selectedMapping || disabled}
            onClick={() => {
              const prov = providers.find(p => p.id === selectedProvider);
              onPreview(selectedCampaign, selectedProvider, selectedMapping, prov?.channel || '');
            }}
          >
            Preview Simulation
          </Button>

          {uiState === 'previewed' && (
            <Button 
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700" 
              onClick={() => {
                const prov = providers.find(p => p.id === selectedProvider);
                onCreate(selectedCampaign, selectedProvider, selectedMapping, prov?.channel || '');
              }}
            >
              Create Dry-Run Batch
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
