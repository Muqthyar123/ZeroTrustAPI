export interface JwtClaims {
  sub?: string;
  tenant_id?: string;
  org_id?: string;
  scope?: string[];
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function decodeJwt(token: string): JwtClaims {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid JWT format.");
  }

  const payload = parts[1];

  if (!payload) {
    throw new Error("JWT payload is missing.");
  }

  try {
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const decoded = Buffer.from(normalized, "base64").toString(
      "utf-8"
    );

    return JSON.parse(decoded) as JwtClaims;
  } catch {
    throw new Error("Unable to decode JWT payload.");
  }
}