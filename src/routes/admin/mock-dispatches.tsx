import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MockDispatchDashboard } from '../../components/admin/mock-dispatches/MockDispatchDashboard';

export const Route = createFileRoute('/admin/mock-dispatches')({
  component: MockDispatchesGuard,
});

function MockDispatchesGuard() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthorized(false);
        return;
      }
      
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .in('role', ['admin', 'sub_admin'])
        .limit(1)
        .maybeSingle();

      if (roleData) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    }
    
    checkAuth();
  }, []);

  if (authorized === null) {
    return <div className="p-6">Verifying access...</div>;
  }

  if (authorized === false) {
    return (
      <div className="p-6 text-red-500">
        <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
        <p>You do not have permission to view this page. Admin or Sub-admin role is required.</p>
        <button onClick={() => navigate({ to: '/' })} className="mt-4 text-blue-500 underline">Return Home</button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Mock Dispatch Control Center (Read-only)</h1>
      <MockDispatchDashboard />
    </div>
  );
}
