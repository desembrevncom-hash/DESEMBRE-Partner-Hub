import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CommunicationPlatform = 'zalo' | 'facebook' | 'email' | 'phone' | 'tiktok';

export const getLauncherUrl = (platform: CommunicationPlatform, identifier: string): string => {
  // Clean identifier (remove spaces etc)
  const cleanId = identifier.trim();
  
  switch (platform) {
    case 'zalo':
      // Zalo uses phone number or user id
      return `https://zalo.me/${cleanId}`;
    case 'facebook':
      // Facebook uses username or page id
      return `https://m.me/${cleanId}`;
    case 'email':
      return `mailto:${cleanId}`;
    case 'phone':
      return `tel:${cleanId}`;
    case 'tiktok':
      // TikTok uses @username
      const ttId = cleanId.startsWith('@') ? cleanId : `@${cleanId}`;
      return `https://www.tiktok.com/${ttId}`;
    default:
      return '#';
  }
};

export const launchAndTrack = async (
  platform: CommunicationPlatform, 
  customerId: string, 
  accountId: string | null, 
  customerIdentifier: string,
  templateId?: string,
  templateTitle?: string,
  contactChannelId?: string,
  result: string = 'launched',
  contentPreview?: string,
  trackEnabled: boolean = true
) => {
  if (!customerIdentifier) {
    toast.error('Không có thông tin liên lạc cho kênh này');
    return false;
  }

  const url = getLauncherUrl(platform, customerIdentifier);

  // 1. Launch the app/link only if result is launched
  if (result === 'launched') {
    try {
      if (platform === 'phone' || platform === 'email') {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      result = 'failed';
    }
  }

  // 2. Track interaction in background
  if (trackEnabled) {
    try {
      const interactionType = platform === 'phone' ? 'outbound_call' : 'outbound_message';
      
      await supabase.rpc('log_communication_interaction', {
        p_customer_id: customerId,
        p_platform: platform,
        p_account_id: accountId,
        p_interaction_type: interactionType,
        p_template_id: templateId || null,
        p_template_title: templateTitle || null,
        p_contact_channel_id: contactChannelId || null,
        p_result: result,
        p_content_preview: contentPreview || null
      });
      
      // Dispatch event so Timeline can refresh
      window.dispatchEvent(new Event('customer_timeline_refresh'));
    } catch (error) {
      console.error('Failed to log communication interaction', error);
    }
  }

  return result !== 'failed';
};
