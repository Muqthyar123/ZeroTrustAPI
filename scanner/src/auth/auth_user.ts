import type { JwtClaims } from "./jwt.js";

export interface AuthenticatedUser {
  username: string;
  token: string;
  claims: JwtClaims;
}