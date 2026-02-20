import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logAudit(action: string, entityType: string, payload: {
  entityId?: string;
  correlationId?: string;
  payloadJson?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId: payload.entityId,
      correlationId: payload.correlationId,
      payloadJson: payload.payloadJson === undefined ? undefined : (payload.payloadJson as Prisma.InputJsonValue)
    }
  });
}
