import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { Redis } from "ioredis";
import { DelegationRepository } from "../redis/delegationRepository.js";

interface PostDelegationBody {
  granteeUserId?: string;
  ownerTenantId?: string;
  resourceType?: string;
  actions?: string[] | string;
  expiresAt?: number;
}

export function createDelegationRoutes(redis: Redis): FastifyPluginAsync {
  const repo = new DelegationRepository(redis);

  return async (app: FastifyInstance) => {
    /**
     * POST /v1/delegations
     * Creates or updates a delegation record.
     */
    app.post<{ Body: PostDelegationBody }>("/v1/delegations", async (request, reply) => {
      const { granteeUserId, ownerTenantId, resourceType, actions, expiresAt } = request.body || {};

      if (!granteeUserId || !ownerTenantId || !resourceType || actions === undefined || expiresAt === undefined) {
        return reply.status(400).send({
          error: "granteeUserId, ownerTenantId, resourceType, actions, and expiresAt are required",
        });
      }

      const record = await repo.setDelegation(
        granteeUserId,
        ownerTenantId,
        resourceType,
        actions,
        expiresAt,
      );

      return reply.status(201).send(record);
    });

    /**
     * GET /v1/delegations/:delegationId
     * Retrieves delegation by ID ("granteeUserId:ownerTenantId:resourceType") or composite params.
     */
    app.get<{ Params: { delegationId: string } }>(
      "/v1/delegations/:delegationId",
      async (request, reply) => {
        const { delegationId } = request.params;
        const parsed = repo.parseDelegationId(delegationId);

        if (!parsed) {
          return reply.status(400).send({
            error: "invalid delegationId format. Expected format: granteeUserId:ownerTenantId:resourceType",
          });
        }

        const record = await repo.getDelegation(
          parsed.granteeUserId,
          parsed.ownerTenantId,
          parsed.resourceType,
        );

        if (!record) {
          return reply.status(404).send({
            error: "delegation not found",
          });
        }

        if (!record.isValid) {
          return reply.status(410).send({
            error: "delegation expired",
            delegation: record,
          });
        }

        return reply.status(200).send(record);
      },
    );

    /**
     * GET /v1/delegations/:granteeUserId/:ownerTenantId/:resourceType
     * Direct parameterized lookup for delegation.
     */
    app.get<{ Params: { granteeUserId: string; ownerTenantId: string; resourceType: string } }>(
      "/v1/delegations/:granteeUserId/:ownerTenantId/:resourceType",
      async (request, reply) => {
        const { granteeUserId, ownerTenantId, resourceType } = request.params;
        const record = await repo.getDelegation(granteeUserId, ownerTenantId, resourceType);

        if (!record) {
          return reply.status(404).send({
            error: "delegation not found",
          });
        }

        if (!record.isValid) {
          return reply.status(410).send({
            error: "delegation expired",
            delegation: record,
          });
        }

        return reply.status(200).send(record);
      },
    );

    /**
     * DELETE /v1/delegations/:delegationId
     * Deletes delegation by ID ("granteeUserId:ownerTenantId:resourceType").
     */
    app.delete<{ Params: { delegationId: string } }>(
      "/v1/delegations/:delegationId",
      async (request, reply) => {
        const { delegationId } = request.params;
        const parsed = repo.parseDelegationId(delegationId);

        if (!parsed) {
          return reply.status(400).send({
            error: "invalid delegationId format. Expected format: granteeUserId:ownerTenantId:resourceType",
          });
        }

        const deleted = await repo.deleteDelegation(
          parsed.granteeUserId,
          parsed.ownerTenantId,
          parsed.resourceType,
        );

        if (!deleted) {
          return reply.status(404).send({
            error: "delegation not found",
          });
        }

        return reply.status(200).send({
          success: true,
          message: "delegation deleted",
          delegationId,
        });
      },
    );

    /**
     * DELETE /v1/delegations/:granteeUserId/:ownerTenantId/:resourceType
     */
    app.delete<{ Params: { granteeUserId: string; ownerTenantId: string; resourceType: string } }>(
      "/v1/delegations/:granteeUserId/:ownerTenantId/:resourceType",
      async (request, reply) => {
        const { granteeUserId, ownerTenantId, resourceType } = request.params;
        const deleted = await repo.deleteDelegation(granteeUserId, ownerTenantId, resourceType);

        if (!deleted) {
          return reply.status(404).send({
            error: "delegation not found",
          });
        }

        return reply.status(200).send({
          success: true,
          message: "delegation deleted",
          delegationId: `${granteeUserId}:${ownerTenantId}:${resourceType}`,
        });
      },
    );
  };
}
