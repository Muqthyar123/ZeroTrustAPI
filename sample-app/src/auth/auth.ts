import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import type { User } from "./users.js";

const JWT_SECRET = process.env.JWT_SECRET || "development-secret";

const secret = new TextEncoder().encode(JWT_SECRET);

export interface AuthJwtPayload extends JWTPayload {
  sub: string;
  tenant_id: string;
  org_id: string;
  scope: string[];
}

export async function createToken(user: User): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    tenant_id: user.tenantId,
    org_id: user.orgId,
    scope: user.scope,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setSubject(user.userId)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthJwtPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    ...payload,
    sub: (payload.sub as string) || "",
    tenant_id: (payload["tenant_id"] as string) || "",
    org_id: (payload["org_id"] as string) || "",
    scope: (payload["scope"] as string[]) || [],
  };
}
