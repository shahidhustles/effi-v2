import type { ActorRole } from "@effi/domain";

export type AuthenticatedActor = { externalId: string; role: ActorRole };

const permissionsByRole = {
  citizen: ["report:create", "report:read:self"],
  officer: ["case:read", "case:assign", "case:update"],
  admin: ["case:read", "case:assign", "case:update", "officer:manage"]
} as const;

export type Permission = (typeof permissionsByRole)[keyof typeof permissionsByRole][number];

export const hasPermission = (actor: AuthenticatedActor, permission: Permission): boolean =>
  (permissionsByRole[actor.role] as readonly string[]).includes(permission);
