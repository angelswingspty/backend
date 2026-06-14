import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  telehealthEmailOtpsTable,
  telehealthUsersTable,
} from "../db/schema/telehealth.js";
import { sendTelehealthOtpEmail } from "./email.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateEmailOtpCode(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export function hashEmailOtp(code: string): string {
  return crypto.createHash("sha256").update(code.trim()).digest("hex");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export async function createAndSendEmailOtp(
  db: Database,
  user: Pick<typeof telehealthUsersTable.$inferSelect, "id" | "email" | "name">,
): Promise<{ maskedEmail: string }> {
  const code = generateEmailOtpCode();

  await db
    .delete(telehealthEmailOtpsTable)
    .where(eq(telehealthEmailOtpsTable.userId, user.id));

  await db.insert(telehealthEmailOtpsTable).values({
    userId: user.id,
    codeHash: hashEmailOtp(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendTelehealthOtpEmail(user.email, user.name, code);

  return {
    maskedEmail: maskEmail(user.email),
  };
}

export async function verifyEmailOtp(
  db: Database,
  userId: number,
  code: string,
): Promise<"valid" | "invalid" | "expired" | "locked"> {
  const [otp] = await db
    .select()
    .from(telehealthEmailOtpsTable)
    .where(eq(telehealthEmailOtpsTable.userId, userId))
    .limit(1);

  if (!otp) {
    return "invalid";
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    return "locked";
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    await db
      .delete(telehealthEmailOtpsTable)
      .where(eq(telehealthEmailOtpsTable.id, otp.id));
    return "expired";
  }

  const isValid = hashEmailOtp(code) === otp.codeHash;

  if (!isValid) {
    await db
      .update(telehealthEmailOtpsTable)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(telehealthEmailOtpsTable.id, otp.id));
    return "invalid";
  }

  await db
    .delete(telehealthEmailOtpsTable)
    .where(eq(telehealthEmailOtpsTable.id, otp.id));

  return "valid";
}
