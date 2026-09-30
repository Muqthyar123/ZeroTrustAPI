import type { Redis } from "ioredis";

export interface OwnershipRecord {
  resourceType: string;
  objectId: string;
  tenantId: string;
  ownerUserId: string;
}

export class OwnershipRepository {
  constructor(private readonly redis: Redis) {}

  /**
   * Helper to format Redis key: obj:{resourceType}:{objectId}
   */
  private getKey(resourceType: string, objectId: string): string {
    return `obj:${resourceType}:${objectId}`;
  }

  /**
   * Sets or updates ownership record in Redis hash.
   * Write-through operation.
   */
  async setOwnership(
    resourceType: string,
    objectId: string,
    tenantId: string,
    ownerUserId: string,
  ): Promise<OwnershipRecord> {
    const key = this.getKey(resourceType, objectId);
    await this.redis.hset(key, {
      tenantId,
      ownerUserId,
    });

    return {
      resourceType,
      objectId,
      tenantId,
      ownerUserId,
    };
  }

  /**
   * Retrieves ownership record from Redis hash.
   * Returns null if key does not exist or has no fields.
   */
  async getOwnership(
    resourceType: string,
    objectId: string,
  ): Promise<OwnershipRecord | null> {
    const key = this.getKey(resourceType, objectId);
    const data = await this.redis.hgetall(key);

    if (!data || Object.keys(data).length === 0 || !data["tenantId"] || !data["ownerUserId"]) {
      return null;
    }

    return {
      resourceType,
      objectId,
      tenantId: data["tenantId"],
      ownerUserId: data["ownerUserId"],
    };
  }

  /**
   * Deletes ownership record from Redis.
   * Returns true if deleted, false if not found.
   */
  async deleteOwnership(resourceType: string, objectId: string): Promise<boolean> {
    const key = this.getKey(resourceType, objectId);
    const deletedCount = await this.redis.del(key);
    return deletedCount > 0;
  }
}
