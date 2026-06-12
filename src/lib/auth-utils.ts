import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { getSessionSecret } from "../config/env.js";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getClientIp(request: {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

export function getUserAgent(request: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const ua = request.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

export function getBearerToken(
  authorization: string | string[] | undefined,
): string | null {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice(7);
}

export function makeVolunteerToken(userId: number, role: string): string {
  return jwt.sign(
    { sub: userId, role, portal: "volunteer" },
    getSessionSecret(),
    { expiresIn: "24h" },
  );
}

export function verifyVolunteerToken(
  token: string,
): { sub: number; role: string } | null {
  try {
    const decoded = jwt.verify(token, getSessionSecret()) as unknown as {
      sub: number;
      role: string;
      portal: string;
    };
    if (decoded.portal !== "volunteer") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function makeTelehealthToken(userId: number, role: string): string {
  return jwt.sign({ sub: userId, role }, getSessionSecret(), { expiresIn: "15m" });
}

export function verifyTelehealthToken(
  token: string,
): { sub: number; role: string } | null {
  try {
    return jwt.verify(token, getSessionSecret()) as unknown as {
      sub: number;
      role: string;
    };
  } catch {
    return null;
  }
}
