import React, { useState, useEffect } from 'react';
import { PhoneCall, MessageCircle, Facebook, Mail, Music2, ChevronDown, Plus, Check, Sparkles } from 'lucide-react';
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
  title: string;
  platform: string;
  category: string;
  content: string;
}

interface Props {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCity?: string;
  userAccounts: Account[];
  customerChannels: Channel[];
}

export const CommunicationLaunchers: React.FC<Props> = ({ 
  customerId,
  customerName,
  customerPhone, 
  customerEmail,
  customerCity,
  userAccounts, 
  customerChannels 
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
      setRenderedContent(renderTemplate(t.content, context));
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
      selectedTemplate?.title,
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

  const platforms: { id: CommunicationPlatform, icon: React.ElementType, label: string, color: string }[] = [
    { id: 'phone', icon: PhoneCall, label: 'Call', color: 'text-emerald-500' },
    { id: 'zalo', icon: MessageCircle, label: 'Zalo', color: 'text-sky-500' },
    { id: 'facebook', icon: Facebook, label: 'Facebook', color: 'text-blue-600' },
    { id: 'email', icon: Mail, label: 'Email', color: 'text-amber-500' },
    { id: 'tiktok', icon: Music2, label: 'TikTok', color: 'text-slate-900' }
  ];

  return (
    <>
      <div className="grid grid-cols-5 gap-2 mt-2">
        {platforms.map(p => {
          const hasIdentifier = !!getCustomerIdentifierObj(p.id).value;
          const disabled = !hasCommOS || !hasIdentifier;
          return (
            <button
              key={p.id}
              onClick={() => handleOpenDialog(p.id)}
              disabled={disabled}
              className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold transition-all ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
              {p.label} <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          )
        })}
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
                {templates.filter(t => t.platform === selectedPlatform || t.platform === 'all').map(t => (
                  <option key={t.id} value={t.id}>{t.category}: {t.title}</option>
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
