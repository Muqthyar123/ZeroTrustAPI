import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { Redis } from "ioredis";
import { OwnershipRepository } from "../redis/ownershipRepository.js";

interface PutOwnershipBody {
  resourceType?: string;
  objectId?: string;
  tenantId?: string;
  ownerUserId?: string;
}

export function createOwnershipRoutes(redis: Redis): FastifyPluginAsync {
  const repo = new OwnershipRepository(redis);

  return async (app: FastifyInstance) => {
    /**
     * PUT /v1/ownership
     * Creates or updates ownership record in Redis.
     */
    app.put<{ Body: PutOwnershipBody }>("/v1/ownership", async (request, reply) => {
      const { resourceType, objectId, tenantId, ownerUserId } = request.body || {};

      if (!resourceType || !objectId || !tenantId || !ownerUserId) {
        return reply.status(400).send({
          error: "resourceType, objectId, tenantId, and ownerUserId are required",
        });
      }

      const record = await repo.setOwnership(
        resourceType,
        objectId,
        tenantId,
        ownerUserId,
      );

      return reply.status(200).send(record);
    });

    /**
     * GET /v1/ownership/:resourceType/:objectId
     * Retrieves ownership record from Redis.
     */
    app.get<{ Params: { resourceType: string; objectId: string } }>(
      "/v1/ownership/:resourceType/:objectId",
      async (request, reply) => {
        const { resourceType, objectId } = request.params;
        const record = await repo.getOwnership(resourceType, objectId);

        if (!record) {
          return reply.status(404).send({
            error: "ownership record not found",
          });
        }

        return reply.status(200).send(record);
      },
    );

    /**
     * DELETE /v1/ownership/:resourceType/:objectId
     * Deletes ownership record from Redis.
     */
    app.delete<{ Params: { resourceType: string; objectId: string } }>(
      "/v1/ownership/:resourceType/:objectId",
      async (request, reply) => {
        const { resourceType, objectId } = request.params;
        const deleted = await repo.deleteOwnership(resourceType, objectId);

        if (!deleted) {
          return reply.status(404).send({
            error: "ownership record not found",
          });
        }

        return reply.status(200).send({
          success: true,
          message: "ownership record deleted",
          resourceType,
          objectId,
        });
      },
    );
  };
}
