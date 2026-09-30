import type { Redis } from "ioredis";

export interface DelegationRecord {
  delegationId: string;
  granteeUserId: string;
  ownerTenantId: string;
  resourceType: string;
  actions: string;
  expiresAt: number;
  isValid?: boolean;
}

export class DelegationRepository {
  constructor(private readonly redis: Redis) {}

  /**
   * Helper to format Redis key: deleg:{granteeUserId}:{ownerTenantId}:{resourceType}
   */
  getKey(granteeUserId: string, ownerTenantId: string, resourceType: string): string {
    return `deleg:${granteeUserId}:${ownerTenantId}:${resourceType}`;
  }

  /**
   * Parses delegationId string "granteeUserId:ownerTenantId:resourceType" into its parts
   */
  parseDelegationId(delegationId: string): {
    granteeUserId: string;
    ownerTenantId: string;
    resourceType: string;
  } | null {
    const parts = delegationId.split(":");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return null;
    }
    return {
      granteeUserId: parts[0],
      ownerTenantId: parts[1],
      resourceType: parts[2],
    };
  }

  /**
   * Stores delegation in Redis hash.
   */
  async setDelegation(
    granteeUserId: string,
    ownerTenantId: string,
    resourceType: string,
    actions: string[] | string,
    expiresAt: number,
  ): Promise<DelegationRecord> {
    const key = this.getKey(granteeUserId, ownerTenantId, resourceType);
    const actionsStr = Array.isArray(actions) ? actions.join(",") : actions;

    await this.redis.hset(key, {
      actions: actionsStr,
      expiresAt: String(expiresAt),
    });

    const delegationId = `${granteeUserId}:${ownerTenantId}:${resourceType}`;
    const now = Math.floor(Date.now() / 1000);

    return {
      delegationId,
      granteeUserId,
      ownerTenantId,
      resourceType,
      actions: actionsStr,
      expiresAt,
      isValid: now < expiresAt,
    };
  }

  /**
   * Retrieves delegation from Redis hash and evaluates expiration.
   */
  async getDelegation(
    granteeUserId: string,
    ownerTenantId: string,
    resourceType: string,
  ): Promise<DelegationRecord | null> {
    const key = this.getKey(granteeUserId, ownerTenantId, resourceType);
    const data = await this.redis.hgetall(key);

    if (!data || Object.keys(data).length === 0 || !data["actions"] || !data["expiresAt"]) {
      return null;
    }

    const expiresAt = Number(data["expiresAt"]);
    const now = Math.floor(Date.now() / 1000);
    const isValid = now < expiresAt;

    const delegationId = `${granteeUserId}:${ownerTenantId}:${resourceType}`;

    return {
      delegationId,
      granteeUserId,
      ownerTenantId,
      resourceType,
      actions: data["actions"],
      expiresAt,
      isValid,
    };
  }

  /**
   * Deletes delegation from Redis.
   */
  async deleteDelegation(
    granteeUserId: string,
    ownerTenantId: string,
    resourceType: string,
  ): Promise<boolean> {
    const key = this.getKey(granteeUserId, ownerTenantId, resourceType);
    const deletedCount = await this.redis.del(key);
    return deletedCount > 0;
  }
}
