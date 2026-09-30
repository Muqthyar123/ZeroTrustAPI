import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type AuthJwtPayload } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthJwtPayload;
  }
}

/**
 * Authentication preHandler hook.
 * Verifies JWT from Authorization: Bearer <token> and sets request.user.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: "unauthorized: missing or invalid authorization header",
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return reply.status(401).send({
      error: "unauthorized: missing token",
    });
  }

  try {
    const payload = await verifyToken(token);
    request.user = payload;
  } catch (err) {
    return reply.status(401).send({
      error: "unauthorized: invalid or expired token",
    });
  }
}
