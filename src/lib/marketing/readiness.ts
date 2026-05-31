export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.includes('@');
}

export function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false;
  return phone.length >= 9;
}

export function getExclusionReason(c: any, channel: 'email' | 'zalo', isDuplicate: boolean, consentMap: Map<string, any[]>, zaloProfileMap: Map<string, any>): string {
  const isBlocked = c.status === 'blocked' || c.status === 'lost' || c.status === 'inactive';
  if (isBlocked) return 'Trạng thái Blocked/Lost';
  if (isDuplicate) return 'Bị trùng lặp';

  const cConsents = consentMap.get(c.id) || [];
  const hasOptOut = cConsents.some(x => x.opt_out_at != null);

  if (channel === 'email') {
    const emailConsent = cConsents.find(x => x.channel === 'email');
    if (hasOptOut || (emailConsent && emailConsent.is_opt_in === false)) return 'Đã Opt-out';
    if (!isValidEmail(c.email)) return 'Email không hợp lệ';
    if (emailConsent && emailConsent.is_opt_in) return 'Đã Opt-in';
    return 'Không có consent record';
  } else {
    const zaloConsent = cConsents.find(x => x.channel === 'zalo' || x.channel === 'zalo_oa');
    if (hasOptOut || (zaloConsent && zaloConsent.is_opt_in === false)) return 'Đã Opt-out';
    if (!isValidPhone(c.phone)) return 'SĐT không hợp lệ';
    if ((zaloConsent && zaloConsent.is_opt_in) || (zaloProfileMap.has(c.id) && zaloProfileMap.get(c.id)!.zalo_id)) {
      return 'Đã Opt-in / Đã Follow OA';
    }
    return 'Không có consent record / profile';
  }
}

export function getReadinessStatus(c: any, channel: 'email' | 'zalo', isDuplicate: boolean, consentMap: Map<string, any[]>, zaloProfileMap: Map<string, any>): 'ready' | 'no_consent' | 'excluded' | 'invalid_contact' {
  const isBlocked = c.status === 'blocked' || c.status === 'lost' || c.status === 'inactive';
  if (isBlocked || isDuplicate) return 'excluded';

  const cConsents = consentMap.get(c.id) || [];
  const hasOptOut = cConsents.some(x => x.opt_out_at != null);

  if (channel === 'email') {
    const emailConsent = cConsents.find(x => x.channel === 'email');
    if (hasOptOut || (emailConsent && emailConsent.is_opt_in === false)) return 'excluded';
    if (!isValidEmail(c.email)) return 'invalid_contact';
    if (emailConsent && emailConsent.is_opt_in) return 'ready';
    return 'no_consent';
  } else {
    const zaloConsent = cConsents.find(x => x.channel === 'zalo' || x.channel === 'zalo_oa');
    if (hasOptOut || (zaloConsent && zaloConsent.is_opt_in === false)) return 'excluded';
    if (!isValidPhone(c.phone)) return 'invalid_contact';
    if ((zaloConsent && zaloConsent.is_opt_in) || (zaloProfileMap.has(c.id) && zaloProfileMap.get(c.id)!.zalo_id)) {
      return 'ready';
    }
    return 'no_consent';
  }
}

export function buildAudiencePreview(
  customers: any[],
  channel: 'email' | 'zalo',
  duplicateIds: Set<string>,
  consentMap: Map<string, any[]>,
  zaloProfileMap: Map<string, any>
) {
  return customers.filter(c => {
    const status = getReadinessStatus(c, channel, duplicateIds.has(c.id), consentMap, zaloProfileMap);
    return status === 'ready';
  }).map(c => {
    const reason = getExclusionReason(c, channel, duplicateIds.has(c.id), consentMap, zaloProfileMap);
    return { ...c, reason, channel };
  });
}
