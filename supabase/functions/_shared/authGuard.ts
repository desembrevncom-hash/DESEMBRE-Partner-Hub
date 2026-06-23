import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || token.split('.').length !== 3) {
    throw new Error('Unauthorized: Invalid JWT format');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Server misconfigured: Missing Supabase environment variables');
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { user }, error: userError } = await authClient.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Unauthorized: Invalid JWT');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: roleData, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'sub_admin'])
    .limit(1)
    .maybeSingle();

  if (roleError) {
    throw new Error('Forbidden: Role lookup failed');
  }

  if (!roleData) {
    throw new Error('Forbidden: Requires admin/sub_admin role');
  }

  return adminClient;
}
