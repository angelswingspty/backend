import type { Database } from "../db/index.js";
import { auditLogsTable } from "../db/schema/telehealth.js";

export async function logAudit(
  db: Database,
  action: string,
  options: {
    userId?: number | null;
    resourceType?: string;
    resourceId?: string | number;
    details?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  } = {},
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: options.userId ?? null,
      action,
      resourceType: options.resourceType ?? null,
      resourceId: options.resourceId != null ? String(options.resourceId) : null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      details: options.details ?? null,
    });
  } catch {
    // Audit log failures must never crash the main request
  }
}
