export const anonymousDraftLifetimeMs = 24 * 60 * 60 * 1_000;

export const isAnonymousDraftExpired = (lastActivityAt: number, now: number): boolean => (
  lastActivityAt + anonymousDraftLifetimeMs <= now
);
