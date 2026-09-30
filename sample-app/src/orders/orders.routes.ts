import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { orderStore } from "./orderStore.js";
import type { CreateOrderBody } from "./types.js";
import { defaultOwnershipClient, OwnershipClient } from "../ownership/ownershipClient.js";

export interface OrderRoutesOptions {
  ownershipClient?: OwnershipClient;
}

/**
 * Orders API Routes (Milestone 2)
 *
 * NOTE ON SECURITY ARCHITECTURE:
 * In APP_MODE=vulnerable (the default), GET /api/orders/:orderId and
 * DELETE /api/orders/:orderId intentionally omit object ownership / tenant
 * isolation checks after authentication.
 *
 * This intentionally demonstrates Broken Object Level Authorization (BOLA / IDOR),
 * allowing authenticated users (e.g. userA1 in tenantA) to access or delete objects
 * belonging to other tenants (e.g. order 201 in tenantB).
 *
 * Protection against this vulnerability will be enforced at the ZeroTrustAPI gateway layer.
 *
 * Setting APP_MODE=secure activates application-level ownership and tenant validation.
 */
export function createOrderRoutes(client: OwnershipClient = defaultOwnershipClient): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    // Apply authentication to all order routes
    app.addHook("preHandler", requireAuth);

    /**
     * GET /api/orders/:orderId
     * Retrieves an order by ID.
     */
    app.get<{ Params: { orderId: string } }>(
      "/api/orders/:orderId",
      async (request, reply) => {
        const { orderId } = request.params;
        const order = orderStore.getById(orderId);

        if (!order) {
          return reply.status(404).send({
            error: "order not found",
          });
        }

        const appMode = process.env.APP_MODE || "vulnerable";
        if (appMode === "vulnerable") {
          // Intentionally vulnerable: returns order regardless of owner or tenant
          return reply.status(200).send(order);
        }

        // Secure mode authorization check:
        const user = request.user!;
        if (order.tenantId !== user.tenant_id) {
          return reply.status(403).send({
            error: "forbidden: cross-tenant access denied",
          });
        }

        const isOwner = order.ownerUserId === user.sub;
        const hasTenantReadScope = user.scope?.includes("orders:read:tenant");

        if (!isOwner && !hasTenantReadScope) {
          return reply.status(403).send({
            error: "forbidden: access denied to this order",
          });
        }

        return reply.status(200).send(order);
      },
    );

    /**
     * POST /api/orders
     * Creates a new order for the authenticated user's tenant and registers ownership with Ownership Service.
     */
    app.post<{ Body: CreateOrderBody }>(
      "/api/orders",
      async (request, reply) => {
        const user = request.user!;
        const body = request.body || {};

        const createdOrder = orderStore.create({
          tenantId: user.tenant_id,
          ownerUserId: user.sub,
          items: body.items,
          totalAmount: body.totalAmount,
          status: body.status,
        });

        // Register write-through ownership with Ownership Service
        try {
          await client.registerOwnership({
            resourceType: "orders",
            objectId: createdOrder.id,
            tenantId: user.tenant_id,
            ownerUserId: user.sub,
          });
        } catch (err: any) {
          // Rollback local order creation on failure so state is not corrupt
          orderStore.delete(createdOrder.id);
          request.log.error({ err, orderId: createdOrder.id }, "Failed to register ownership with Ownership Service");
          return reply.status(502).send({
            error: "failed to register order ownership with Ownership Service",
            details: err?.message || String(err),
          });
        }

        return reply.status(201).send(createdOrder);
      },
    );

    /**
     * DELETE /api/orders/:orderId
     * Deletes an order by ID and synchronizes deletion with Ownership Service.
     */
    app.delete<{ Params: { orderId: string } }>(
      "/api/orders/:orderId",
      async (request, reply) => {
        const { orderId } = request.params;
        const order = orderStore.getById(orderId);

        if (!order) {
          return reply.status(404).send({
            error: "order not found",
          });
        }

        const appMode = process.env.APP_MODE || "vulnerable";
        if (appMode !== "vulnerable") {
          // Secure mode authorization check:
          const user = request.user!;
          if (order.tenantId !== user.tenant_id || order.ownerUserId !== user.sub) {
            return reply.status(403).send({
              error: "forbidden: cross-tenant or unowned order deletion denied",
            });
          }
        }

        const deleted = orderStore.delete(orderId);

        // Synchronize ownership record deletion
        try {
          await client.deleteOwnership("orders", orderId);
        } catch (err: any) {
          request.log.warn({ err, orderId }, "Failed to delete ownership from Ownership Service");
        }

        return reply.status(200).send({
          success: true,
          message: "order deleted successfully",
          order: deleted,
        });
      },
    );
  };
}

export const orderRoutes = createOrderRoutes();
