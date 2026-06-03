// src/components/ai/ProviderConfigCard.tsx
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

interface ProviderConfig {
  provider: string;
  chat_model: string;
  embedding_model: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  anthropic_api_key?: string;
}

interface Props {
  settings: ProviderConfig | null;
  onChange?: (updated: Partial<ProviderConfig>) => void;
}

export const ProviderConfigCard: React.FC<Props> = ({ settings, onChange }) => {
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  if (!settings) return null;

  const handleProviderChange = (value: string) => {
    const defaultModel = value === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini";
    onChange?.({ provider: value, chat_model: defaultModel });
  };

  const handleChatModelChange = (value: string) => {
    onChange?.({ chat_model: value });
  };

  const chatModels =
    settings.provider === "gemini"
      ? [
          { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
          { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
        ]
      : [
          { value: "gpt-4o-mini", label: "GPT-4o Mini" },
          { value: "gpt-4o", label: "GPT-4o" },
        ];

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-800">Provider & Model Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">AI Provider</span>
          <Select value={settings.provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (enabled)</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="anthropic" disabled>
                Anthropic (coming soon)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Chat Model</span>
          <Select value={settings.chat_model} onValueChange={handleChatModelChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {chatModels.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">Embedding Model</span>
          <Select disabled value={settings.embedding_model}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select embedding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text-embedding-3-small">
                text‑embedding‑3‑small (OpenAI)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-slate-100 my-4 pt-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">API Credentials</h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500" htmlFor="openai_api_key">
              OpenAI API Key
            </label>
            <div className="relative">
              <Input
                id="openai_api_key"
                type={showOpenAIKey ? "text" : "password"}
                placeholder="sk-proj-..."
                value={settings.openai_api_key || ""}
                onChange={(e) => onChange?.({ openai_api_key: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showOpenAIKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500" htmlFor="gemini_api_key">
              Gemini API Key
            </label>
            <div className="relative">
              <Input
                id="gemini_api_key"
                type={showGeminiKey ? "text" : "password"}
                placeholder="AIzaSy..."
                value={settings.gemini_api_key || ""}
                onChange={(e) => onChange?.({ gemini_api_key: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500" htmlFor="anthropic_api_key">
              Anthropic API Key (Coming Soon)
            </label>
            <div className="relative">
              <Input
                id="anthropic_api_key"
                type={showAnthropicKey ? "text" : "password"}
                placeholder="sk-ant-..."
                value={settings.anthropic_api_key || ""}
                onChange={(e) => onChange?.({ anthropic_api_key: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showAnthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          API Key status: Use "Test Connection" button to verify. Embedding model is fixed to OpenAI
          in MVP.
        </p>
      </CardContent>
    </Card>
  );
};

export default ProviderConfigCard;
