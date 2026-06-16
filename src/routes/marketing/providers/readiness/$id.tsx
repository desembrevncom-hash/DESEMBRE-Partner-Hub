import { createFileRoute, useParams } from '@tanstack/react-router'
import { ProviderDetailPanel } from '@/components/marketing/providers/ProviderDetailPanel'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, ArrowLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/marketing/providers/readiness/$id')({
  component: ProviderDetailRoute,
})

function ProviderDetailRoute() {
  const { id } = useParams({ from: '/marketing/providers/readiness/$id' });
  const { isAdminOrSubAdmin, loading } = useAuth();
  
  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  
  if (!isAdminOrSubAdmin) {
    return <div className="p-8 text-red-600 font-bold">403 - Không có quyền truy cập. Module M6 chỉ dành cho Admin/Sub Admin.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <Link to="/marketing/providers/readiness" className="text-sm text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
      </Link>
      <ProviderDetailPanel accountId={id} />
    </div>
  )
}
