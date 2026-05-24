export interface TemplateContext {
  customer_name?: string;
  spa_name?: string;
  sale_name?: string;
  phone?: string;
  city?: string;
  primary_channel?: string;
}

export function renderTemplate(content: string, context: TemplateContext): string {
  if (!content) return '';
  let rendered = content;
  
  for (const [key, value] of Object.entries(context)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, value || '');
  }
  
  return rendered;
}

export function getTemplateContext(customer: any, currentUser: any, channels: any[]): TemplateContext {
  const primaryChannel = channels?.find((c: any) => c.is_primary)?.channel_type || '';
  
  return {
    customer_name: customer?.name || customer?.full_name || 'anh/chị',
    spa_name: 'Desembre', // Có thể mở rộng lấy từ company profile sau
    sale_name: currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || 'Sale',
    phone: customer?.phone || '',
    city: customer?.city || customer?.province || '',
    primary_channel: primaryChannel
  };
}
