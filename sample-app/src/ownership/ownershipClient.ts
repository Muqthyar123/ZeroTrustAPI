export interface OwnershipClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class OwnershipClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(opts: OwnershipClientOptions = {}) {
    this.baseUrl = (
      opts.baseUrl ||
      process.env.OWNERSHIP_BASE_URL ||
      process.env.OWNERSHIP_SERVICE_URL ||
      "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
    this.fetchFn = opts.fetchFn || globalThis.fetch;
  }

  /**
   * Registers ownership of a newly created object with the Ownership Service.
   * Uses PUT /v1/ownership
   */
  async registerOwnership(params: {
    resourceType: string;
    objectId: string;
    tenantId: string;
    ownerUserId: string;
  }): Promise<void> {
    const url = `${this.baseUrl}/v1/ownership`;
    const response = await this.fetchFn(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceType: params.resourceType,
        objectId: params.objectId,
        tenantId: params.tenantId,
        ownerUserId: params.ownerUserId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Ownership Service responded with status ${response.status}: ${errorText || response.statusText}`,
      );
    }
  }

  /**
   * Removes ownership of a deleted object from the Ownership Service.
   * Uses DELETE /v1/ownership/:resourceType/:objectId
   */
  async deleteOwnership(resourceType: string, objectId: string): Promise<void> {
    const url = `${this.baseUrl}/v1/ownership/${encodeURIComponent(resourceType)}/${encodeURIComponent(objectId)}`;
    const response = await this.fetchFn(url, {
      method: "DELETE",
    });

    // 200 or 404 is acceptable when synchronizing deletion
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Ownership Service responded with status ${response.status}: ${errorText || response.statusText}`,
      );
    }
  }
}

// Default singleton client instance
export const defaultOwnershipClient = new OwnershipClient();
