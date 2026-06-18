export function generateIdempotencyKey(
  existingKey: string | null | undefined,
  dispatchId: string,
  channel: string,
  providerAccountId: string
): string {
  if (existingKey && existingKey.trim() !== "") {
    return existingKey;
  }
  return `${dispatchId}_${channel}_${providerAccountId}`;
}
