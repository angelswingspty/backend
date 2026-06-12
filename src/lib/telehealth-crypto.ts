import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import * as otplib from "otplib";
import { and, eq, gt } from "drizzle-orm";
import { getSessionSecret } from "../config/env.js";
import type { Database } from "../db/index.js";
import { telehealthSessionsTable } from "../db/schema/telehealth.js";
import { hashToken, verifyTelehealthToken } from "./auth-utils.js";

const SESSION_DURATION_MS = 15 * 60 * 1000;
const ENCRYPTION_KEY = crypto.scryptSync(getSessionSecret(), "ghri-salt", 32);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createTelehealthSession(
  db: Database,
  userId: number,
  token: string,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  await db.insert(telehealthSessionsTable).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
}

export async function validateTelehealthSession(
  db: Database,
  token: string,
): Promise<{ userId: number; role: string } | null> {
  const payload = verifyTelehealthToken(token);
  if (!payload) return null;

  const tokenHash = hashToken(token);
  const [session] = await db
    .select()
    .from(telehealthSessionsTable)
    .where(
      and(
        eq(telehealthSessionsTable.tokenHash, tokenHash),
        gt(telehealthSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return null;

  await db
    .update(telehealthSessionsTable)
    .set({ lastActive: new Date() })
    .where(eq(telehealthSessionsTable.tokenHash, tokenHash));

  return { userId: payload.sub, role: payload.role };
}

export async function invalidateTelehealthSession(
  db: Database,
  token: string,
): Promise<void> {
  await db
    .delete(telehealthSessionsTable)
    .where(eq(telehealthSessionsTable.tokenHash, hashToken(token)));
}

export function generateMfaSecret(): string {
  return otplib.generateSecret({ length: 20 });
}

export function getMfaOtpauthUrl(secret: string, email: string): string {
  return otplib.generateURI({
    label: email,
    issuer: "GHRI Telehealth",
    secret,
    strategy: "totp",
  });
}

export function verifyMfaToken(secret: string, token: string): boolean {
  try {
    const result: unknown = otplib.verifySync({ secret, token, strategy: "totp" });
    if (typeof result === "boolean") return result;
    if (result && typeof result === "object" && "valid" in result) {
      return !!(result as { valid: boolean }).valid;
    }
    return !!result;
  } catch {
    return false;
  }
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase(),
  );
}

export function encryptMessage(plaintext: string): { encrypted: string; nonce: string } {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([encrypted, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function decryptMessage(encryptedB64: string, nonceB64: string): string {
  const nonce = Buffer.from(nonceB64, "base64");
  const data = Buffer.from(encryptedB64, "base64");
  const tag = data.slice(data.length - 16);
  const encrypted = data.slice(0, data.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
