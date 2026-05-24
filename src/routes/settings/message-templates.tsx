import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Save, ShieldAlert, X } from 'lucide-react';
import { renderTemplate } from '@/lib/messageTemplates';

export const Route = createFileRoute('/settings/message-templates')({
  component: MessageTemplatesSettings,
});

interface Template {
  id: string;
  title: string;
  platform: string;
  category: string;
  content: string;
  is_shared: boolean;
  is_active: boolean;
  created_by: string;
}

function MessageTemplatesSettings() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState('');

  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  const [form, setForm] = useState<Partial<Template>>({
    title: '',
    platform: 'all',
    category: 'Chăm sóc',
    content: '',
    is_shared: false
  });

  const previewContext = {
    customer_name: 'Chị Mai',
    spa_name: 'Desembre Hà Nội',
    sale_name: 'Hương',
    phone: '0987654321',
    city: 'Hà Nội',
    primary_channel: 'zalo'
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    setUserId(user.user.id);

    const { data: roles } = await supabase.rpc('get_my_roles');
    const admin = roles?.includes('admin') || roles?.includes('sub_admin');
    setIsAdmin(admin);

    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTemplates(data as Template[]);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) {
      toast.error('Vui lòng nhập Tiêu đề và Nội dung');
      return;
    }

    if (form.platform === 'all' && !isAdmin) {
      toast.error('Chỉ Quản trị viên mới được tạo mẫu cho Tất cả nền tảng');
      return;
    }

    if (isEditing) {
      const { error } = await supabase
        .from('message_templates')
        .update({
          title: form.title,
          platform: form.platform,
          category: form.category,
          content: form.content,
          is_shared: form.is_shared
        })
        .eq('id', isEditing);

      if (error) toast.error('Lỗi khi lưu');
      else {
        toast.success('Đã lưu mẫu');
        setIsEditing(null);
        resetForm();
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from('message_templates')
        .insert({
          title: form.title,
          platform: form.platform,
          category: form.category,
          content: form.content,
          is_shared: isAdmin ? form.is_shared : false,
          created_by: userId
        });

      if (error) toast.error('Lỗi khi tạo');
      else {
        toast.success('Đã tạo mẫu tin nhắn');
        resetForm();
        fetchData();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xoá mẫu này?')) return;
    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (error) toast.error('Lỗi khi xoá');
    else {
      toast.success('Đã xoá');
      fetchData();
    }
  };

  const startEdit = (t: Template) => {
    setIsEditing(t.id);
    setForm({
      title: t.title,
      platform: t.platform,
      category: t.category,
      content: t.content,
      is_shared: t.is_shared
    });
  };

  const resetForm = () => {
    setIsEditing(null);
    setForm({
      title: '',
      platform: isAdmin ? 'all' : 'zalo',
      category: 'Chăm sóc',
      content: '',
      is_shared: false
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex gap-6 items-start">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">Quản lý Mẫu tin nhắn</h1>
        
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Danh sách mẫu</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Đang tải...</div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Chưa có mẫu nào</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {templates.map(t => (
                <li key={t.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        {t.title}
                        {t.is_shared && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded uppercase">Dùng chung</span>}
                        {t.platform === 'all' && <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase">Mọi nền tảng</span>}
                        {t.platform !== 'all' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded uppercase">{t.platform}</span>}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-md">{t.content}</p>
                    </div>
                    {t.created_by === userId || isAdmin ? (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="w-[400px] sticky top-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700">{isEditing ? 'Sửa mẫu' : 'Tạo mẫu mới'}</h2>
            {isEditing && (
              <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-800 flex items-center"><X className="w-3 h-3 mr-1"/> Huỷ sửa</button>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tiêu đề</label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full text-sm border-slate-200 rounded-xl" placeholder="VD: Nhắc lịch hẹn" />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Nền tảng</label>
                <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} className="w-full text-sm border-slate-200 rounded-xl">
                  {isAdmin && <option value="all">Tất cả</option>}
                  <option value="zalo">Zalo</option>
                  <option value="facebook">Facebook</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone/Note</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Phân loại</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full text-sm border-slate-200 rounded-xl">
                  <option value="Chăm sóc">Chăm sóc</option>
                  <option value="Bán hàng">Bán hàng</option>
                  <option value="Liên lạc">Liên lạc</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nội dung (hỗ trợ biến)</label>
              <p className="text-[10px] text-slate-400 mb-2">Biến: {'{{customer_name}}, {{spa_name}}, {{sale_name}}, {{phone}}'}</p>
              <textarea 
                value={form.content} 
                onChange={e => setForm({...form, content: e.target.value})} 
                className="w-full text-sm border-slate-200 rounded-xl h-24 resize-none" 
                placeholder="Chào {{customer_name}},..."
              />
            </div>

            {isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_shared} onChange={e => setForm({...form, is_shared: e.target.checked})} className="rounded text-primary focus:ring-primary" />
                <span className="text-sm font-medium text-slate-700">Dùng chung cho toàn hệ thống</span>
              </label>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Xem trước</span>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                {renderTemplate(form.content || '', previewContext)}
              </p>
            </div>

            <button onClick={handleSave} className="w-full bg-primary text-white h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90">
              <Save className="w-4 h-4" /> Lưu mẫu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
