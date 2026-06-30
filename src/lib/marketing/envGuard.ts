export function isProductionEnv(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url.includes('xhfqjupiidexvlltstal');
}
