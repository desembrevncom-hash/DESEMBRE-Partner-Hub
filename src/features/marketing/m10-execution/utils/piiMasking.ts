export function maskContactValue(contactValue: string): string {
  if (!contactValue) return "";
  
  if (contactValue.includes("@")) {
    const [name, domain] = contactValue.split("@");
    if (name.length <= 3) return `***@${domain}`;
    return `${name.substring(0, 3)}***@${domain}`;
  }

  const cleaned = contactValue.replace(/[^0-9+]/g, '');
  if (cleaned.length < 6) return "******";
  const start = cleaned.substring(0, 3);
  const end = cleaned.substring(cleaned.length - 3);
  const stars = "*".repeat(cleaned.length - 6);
  return `${start}${stars}${end}`;
}
