import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CommunicationPlatform } from '@/lib/launchers';
import { Plus, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';

export const Route = createFileRoute('/settings/communication')({
  component: CommunicationSettings,
});

interface Account {
  id: string;
  platform: CommunicationPlatform;
  account_name: string;
  account_identifier: string;
  is_default: boolean;
  is_active: boolean;
}

function CommunicationSettings() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlatform, setNewPlatform] = useState<CommunicationPlatform>('zalo');
  const [newName, setNewName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from('user_communication_accounts')
      .select('*')
      .eq('user_id', user.user.id)
      .order('platform', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAccounts(data as Account[]);
    }
    setLoading(false);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    if (!newName.trim() || !newIdentifier.trim()) {
      toast.error('Vui lòng nhập đủ thông tin');
      return;
    }

    // Check if this is the first account for this platform
    const isFirst = !accounts.find(a => a.platform === newPlatform);

    const { error } = await supabase.from('user_communication_accounts').insert({
      user_id: user.user.id,
      platform: newPlatform,
      account_name: newName.trim(),
      account_identifier: newIdentifier.trim(),
      is_default: isFirst // Auto set as default if it's the first one
    });

    if (error) {
      toast.error('Lỗi khi thêm tài khoản');
      console.error(error);
    } else {
      toast.success('Đã thêm tài khoản');
      setNewName('');
      setNewIdentifier('');
      fetchAccounts();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xoá tài khoản này?')) return;
    const { error } = await supabase.from('user_communication_accounts').delete().eq('id', id);
    if (error) {
      toast.error('Lỗi khi xoá');
    } else {
      toast.success('Đã xoá tài khoản');
      fetchAccounts();
    }
  };

  const handleSetDefault = async (id: string, platform: CommunicationPlatform) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    // Remove default from others in same platform
    await supabase
      .from('user_communication_accounts')
      .update({ is_default: false })
      .eq('user_id', user.user.id)
      .eq('platform', platform);

    // Set new default
    const { error } = await supabase
      .from('user_communication_accounts')
      .update({ is_default: true })
      .eq('id', id);

    if (error) {
      toast.error('Lỗi khi set mặc định');
    } else {
      toast.success('Đã thay đổi tài khoản mặc định');
      fetchAccounts();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Cài đặt Tài khoản Liên lạc</h1>
      
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Thêm tài khoản mới</h2>
        <form onSubmit={handleAddAccount} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Kênh liên lạc</label>
            <select 
              value={newPlatform} 
              onChange={e => setNewPlatform(e.target.value as CommunicationPlatform)}
              className="w-full text-sm border-slate-200 rounded-xl"
            >
              <option value="zalo">Zalo</option>
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
              <option value="phone">Điện thoại</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Tên gợi nhớ (VD: Zalo Công ty)</label>
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-xl"
              placeholder="Nhập tên..."
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">ID (SĐT, Email, Username)</label>
            <input 
              type="text" 
              value={newIdentifier} 
              onChange={e => setNewIdentifier(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-xl"
              placeholder="Nhập ID..."
            />
          </div>
          <button type="submit" className="bg-primary text-white h-[42px] px-4 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Thêm
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">Tài khoản của bạn</h2>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md font-medium">
            {accounts.length} tài khoản
          </span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Đang tải...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center text-slate-500">
            <ShieldAlert className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm">Chưa có tài khoản nào được lưu.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {accounts.map(acc => (
              <li key={acc.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase">
                    {acc.platform.substring(0,2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {acc.account_name}
                      {acc.is_default && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-wide">Mặc định</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kênh: <span className="font-medium capitalize">{acc.platform}</span> · ID: <span className="font-medium">{acc.account_identifier}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!acc.is_default && (
                    <button 
                      onClick={() => handleSetDefault(acc.id, acc.platform)}
                      className="text-xs text-slate-500 hover:text-emerald-600 font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                    >
                      Set Mặc định
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(acc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xoá"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
