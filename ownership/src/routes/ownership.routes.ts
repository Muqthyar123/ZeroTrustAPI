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
    const putHandler = async (request: any, reply: any) => {
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
    };

    const getHandler = async (request: any, reply: any) => {
      const { resourceType, objectId } = request.params;
      const record = await repo.getOwnership(resourceType, objectId);

      if (!record) {
        return reply.status(404).send({
          error: "ownership record not found",
        });
      }

      return reply.status(200).send(record);
    };

    const deleteHandler = async (request: any, reply: any) => {
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
    };

    app.put<{ Body: PutOwnershipBody }>("/v1/ownership", putHandler);
    app.put<{ Body: PutOwnershipBody }>("/ownership", putHandler);

    app.get<{ Params: { resourceType: string; objectId: string } }>(
      "/v1/ownership/:resourceType/:objectId",
      getHandler,
    );
    app.get<{ Params: { resourceType: string; objectId: string } }>(
      "/ownership/:resourceType/:objectId",
      getHandler,
    );

    app.delete<{ Params: { resourceType: string; objectId: string } }>(
      "/v1/ownership/:resourceType/:objectId",
      deleteHandler,
    );
    app.delete<{ Params: { resourceType: string; objectId: string } }>(
      "/ownership/:resourceType/:objectId",
      deleteHandler,
    );
  };
}
