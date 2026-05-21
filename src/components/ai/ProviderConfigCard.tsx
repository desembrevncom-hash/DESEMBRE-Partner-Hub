// src/components/ai/ProviderConfigCard.tsx
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface ProviderConfig {
  provider: string;
  chat_model: string;
  embedding_model: string;
}

interface Props {
  settings: ProviderConfig | null;
  onChange?: (updated: Partial<ProviderConfig>) => void;
}

export const ProviderConfigCard: React.FC<Props> = ({ settings, onChange }) => {
  if (!settings) return null;

  const handleChatModelChange = (value: string) => {
    onChange?.({ chat_model: value });
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-800">Provider & Model Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">AI Provider (MVP)</span>
          <Select disabled value={settings.provider}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (enabled)</SelectItem>
              <SelectItem value="gemini" disabled>Gemini (coming soon)</SelectItem>
              <SelectItem value="anthropic" disabled>Anthropic (coming soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Chat Model</span>
          <Select value={settings.chat_model} onValueChange={handleChatModelChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini">GPT‑4o‑mini</SelectItem>
              <SelectItem value="gpt-4o">GPT‑4o</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Embedding Model</span>
          <Select disabled value={settings.embedding_model}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select embedding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text-embedding-3-small">text‑embedding‑3‑small (OpenAI)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-400">
          API Key status: Use "Test Connection" button to verify. Embedding model is fixed to OpenAI in MVP.
        </p>
      </CardContent>
    </Card>
  );
};

export default ProviderConfigCard;
