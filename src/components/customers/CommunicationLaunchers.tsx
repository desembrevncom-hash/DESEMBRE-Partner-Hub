import React, { useState, useEffect } from 'react';
import { PhoneCall, MessageCircle, Facebook, Mail, Music2, ChevronDown, Plus, Check, Sparkles, CalendarCheck } from 'lucide-react';
import { CommunicationPlatform, launchAndTrack } from '@/lib/launchers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { renderTemplate, getTemplateContext, TemplateContext } from '@/lib/messageTemplates';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Account {
  id: string;
  platform: CommunicationPlatform;
  account_name: string;
  account_identifier: string;
  is_default: boolean;
}

interface Channel {
  channel_type: string;
  channel_value: string;
  is_primary: boolean;
}

interface Template {
  id: string;
  name: string;
  channel: string;
  purpose: string;
  body_template: string;
}

interface Props {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCity?: string;
  userAccounts: Account[];
  customerChannels: Channel[];
  interactionSummary?: any;
  quickAction?: string | null;
  setQuickAction?: (action: string | null) => void;
  overdueFollowup?: boolean;
}

export const CommunicationLaunchers: React.FC<Props> = ({ 
  customerId,
  customerName,
  customerPhone, 
  customerEmail,
  customerCity,
  userAccounts, 
  customerChannels,
  interactionSummary,
  quickAction,
  setQuickAction,
  overdueFollowup
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [context, setContext] = useState<TemplateContext>({});
  
  const [selectedPlatform, setSelectedPlatform] = useState<CommunicationPlatform | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [renderedContent, setRenderedContent] = useState<string>('');
  
  const [dialogOpen, setDialogOpen] = useState(false);

  const { hasPilotAccess } = useAuth();
  const hasCommOS = hasPilotAccess('communication_os');
  const hasMsgTpl = hasPilotAccess('message_templates');
  const hasInteractionTracking = hasPilotAccess('interaction_tracking');

  useEffect(() => {
    fetchTemplates();
    buildContext();
  }, [customerId, customerChannels]);

  const fetchTemplates = async () => {
    const { data } = await supabase.from('message_templates').select('*').eq('is_active', true);
    if (data) setTemplates(data as Template[]);
  };

  const buildContext = async () => {
    const { data: user } = await supabase.auth.getUser();
    const ctx = getTemplateContext(
      { name: customerName, phone: customerPhone, city: customerCity },
      user.user,
      customerChannels
    );
    setContext(ctx);
  };

  const getCustomerIdentifierObj = (platform: CommunicationPlatform): { value: string, id?: string } => {
    const primaryChannel = customerChannels.find(c => c.channel_type === platform && c.is_primary);
    if (primaryChannel?.channel_value) return { value: primaryChannel.channel_value, id: (primaryChannel as any).id };
    const anyChannel = customerChannels.find(c => c.channel_type === platform);
    if (anyChannel?.channel_value) return { value: anyChannel.channel_value, id: (anyChannel as any).id };
    if ((platform === 'zalo' || platform === 'phone') && customerPhone) return { value: customerPhone };
    if (platform === 'email' && customerEmail) return { value: customerEmail };
    return { value: '' };
  };

  const handleOpenDialog = (platform: CommunicationPlatform) => {
    const accounts = userAccounts.filter(a => a.platform === platform);
    setSelectedPlatform(platform);
    setSelectedAccount(accounts.find(a => a.is_default)?.id || accounts[0]?.id || null);
    setSelectedTemplate(null);
    setRenderedContent('');
    setDialogOpen(true);
  };

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = templates.find(x => x.id === e.target.value);
    if (t) {
      setSelectedTemplate(t);
      setRenderedContent(renderTemplate(t.body_template, context));
    } else {
      setSelectedTemplate(null);
      setRenderedContent('');
    }
  };

  const executeAction = async (openApp: boolean) => {
    if (!selectedPlatform) return;
    const identifierObj = getCustomerIdentifierObj(selectedPlatform);
    
    if (renderedContent) {
      await navigator.clipboard.writeText(renderedContent);
      toast.success('Đã copy nội dung!');
    }

    const resultStatus = openApp ? 'launched' : 'copied';

    await launchAndTrack(
      selectedPlatform, 
      customerId, 
      selectedAccount, 
      identifierObj.value, 
      selectedTemplate?.id, 
      selectedTemplate?.name,
      identifierObj.id,
      resultStatus,
      renderedContent,
      hasInteractionTracking
    );
    
    if (!openApp && hasInteractionTracking) {
      toast.success('Đã lưu log tương tác!');
    }
    
    setDialogOpen(false);
  };

  const platforms: { id: CommunicationPlatform, icon: React.ElementType, label: string, color: string, activeColor: string }[] = [
    { id: 'phone', icon: PhoneCall, label: 'Call', color: 'text-slate-400', activeColor: 'text-emerald-500' },
    { id: 'zalo', icon: MessageCircle, label: 'Zalo', color: 'text-slate-400', activeColor: 'text-sky-500' },
    { id: 'facebook', icon: Facebook, label: 'Facebook', color: 'text-slate-400', activeColor: 'text-blue-600' },
    { id: 'email', icon: Mail, label: 'Email', color: 'text-slate-400', activeColor: 'text-amber-500' },
    { id: 'tiktok', icon: Music2, label: 'TikTok', color: 'text-slate-400', activeColor: 'text-slate-900' }
  ];

  return (
    <>
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* HEADER: Summary */}
      {interactionSummary && (
        <div className="bg-slate-50 border-b border-slate-100 p-3 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Trung tâm giao tiếp</span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {interactionSummary.total_interactions} tương tác
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 mt-1">
            <div>
              Gần nhất: <span className="font-medium text-slate-700">{interactionSummary.last_interaction_at ? new Date(interactionSummary.last_interaction_at).toLocaleDateString('vi-VN') : '-'}</span>
            </div>
            <div>
              Kênh chính: <span className="font-medium text-slate-700 capitalize">{interactionSummary.most_used_platform || '-'}</span>
            </div>
          </div>
          {interactionSummary.last_template_used && (
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              Mẫu vừa dùng: <span className="font-medium text-slate-700 italic">{interactionSummary.last_template_used}</span>
            </div>
          )}
        </div>
      )}

      {/* BODY: Channels */}
      <div className={`p-3 grid grid-cols-5 gap-2 ${overdueFollowup ? 'bg-amber-50/50' : ''}`}>
        {platforms.map(p => {
          const hasIdentifier = !!getCustomerIdentifierObj(p.id).value;
          const disabled = !hasCommOS || !hasIdentifier;
          const isWarning = overdueFollowup && hasIdentifier;
          
          return (
            <button
              key={p.id}
              onClick={() => handleOpenDialog(p.id)}
              disabled={disabled}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border transition-all 
                ${disabled ? 'opacity-40 bg-slate-50 border-slate-100 cursor-not-allowed' : 
                  isWarning ? 'bg-amber-100 border-amber-200 hover:bg-amber-200 text-amber-900 shadow-sm' : 
                  'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm'}
              `}
            >
              <p.icon className={`w-4 h-4 ${disabled ? p.color : (isWarning ? 'text-amber-600' : p.activeColor)}`} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{p.label}</span>
            </button>
          )
        })}
      </div>

      {/* FOOTER: Quick Actions */}
      {setQuickAction && (
        <div className="bg-slate-50 border-t border-slate-100 p-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => setQuickAction(quickAction === "note" ? null : "note")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-md text-[10px] font-bold transition-colors ${
              quickAction === "note" ? "bg-primary text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Plus className="w-3 h-3" /> Ghi chú
          </button>
          <button
            onClick={() => setQuickAction(quickAction === "task" ? null : "task")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-md text-[10px] font-bold transition-colors ${
              quickAction === "task" ? "bg-primary text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Check className="w-3 h-3" /> Việc cần làm
          </button>
          <button
            onClick={() => setQuickAction(quickAction === "followup" ? null : "followup")}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-md text-[10px] font-bold transition-colors ${
              quickAction === "followup" ? "bg-primary text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <CalendarCheck className="w-3 h-3" /> Hẹn lịch
          </button>
        </div>
      )}
    </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Soạn tin nhắn qua {selectedPlatform?.toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tài khoản gửi đi</label>
              <select 
                value={selectedAccount || ''} 
                onChange={e => setSelectedAccount(e.target.value || null)}
                className="w-full text-sm border-slate-200 rounded-xl"
              >
                <option value="">-- Mặc định (Ứng dụng gốc) --</option>
                {userAccounts.filter(a => a.platform === selectedPlatform).map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                ))}
              </select>
            </div>

            {hasMsgTpl ? (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mẫu tin nhắn</label>
              <select 
                value={selectedTemplate?.id || ''}
                onChange={handleTemplateSelect}
                className="w-full text-sm border-slate-200 rounded-xl"
              >
                <option value="">-- Tự nhập nội dung --</option>
                {templates.filter(t => t.channel === selectedPlatform || t.channel === 'all').map(t => (
                  <option key={t.id} value={t.id}>{t.purpose}: {t.name}</option>
                ))}
              </select>
            </div>
            ) : (
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">Mẫu tin nhắn hiện đang tắt.</div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nội dung gửi</label>
              <textarea 
                value={renderedContent}
                onChange={e => setRenderedContent(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-xl h-28 resize-none"
                placeholder="Nhập nội dung cần gửi..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button 
              onClick={() => executeAction(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Copy & Lưu Log
            </button>
            <button 
              onClick={() => executeAction(true)}
              className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-sm"
            >
              Copy & Mở App
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
