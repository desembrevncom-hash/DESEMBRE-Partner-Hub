import { createFileRoute } from '@tanstack/react-router'
import { ProviderReadinessDashboard } from '@/components/marketing/providers/ProviderReadinessDashboard'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/marketing/providers/readiness/')({
  component: ProviderReadinessRoute,
})

function ProviderReadinessRoute() {
  const { userRoles, loading } = useAuth();
  
  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  
  const isAdmin = userRoles?.includes('admin') || userRoles?.includes('sub_admin');
  
  if (!isAdmin) {
    return <div className="p-8 text-red-600 font-bold">403 - Không có quyền truy cập. Module M6 chỉ dành cho Admin/Sub Admin.</div>;
  }

  return (
    <div className="p-6">
      <ProviderReadinessDashboard />
    </div>
  )
}
