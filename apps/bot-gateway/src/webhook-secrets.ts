import { timingSafeEqual } from "node:crypto";

export const matchesWebhookSecret = (received: string | null, expected: string | undefined): boolean => {
  if (!received || !expected) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
};
