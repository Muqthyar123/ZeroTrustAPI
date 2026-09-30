import type { Order, OrderItem } from "./types.js";
import { initialOrders } from "./seed.js";

// In-memory mutable orders store initialized from frozen seed data
let orders: Order[] = initialOrders.map((o) => ({ ...o, items: [...o.items] }));
let nextAutoId = 301;

export const orderStore = {
  getAll(): Order[] {
    return orders;
  },

  getById(id: string): Order | undefined {
    return orders.find((o) => o.id === id);
  },

  create(params: {
    tenantId: string;
    ownerUserId: string;
    items?: OrderItem[] | undefined;
    totalAmount?: number | undefined;
    status?: string | undefined;
  }): Order {
    const id = String(nextAutoId++);
    const items = params.items && params.items.length > 0
      ? params.items
      : [{ item: "Standard Item", quantity: 1, price: params.totalAmount || 100.0 }];
    const totalAmount = params.totalAmount !== undefined
      ? params.totalAmount
      : items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const newOrder: Order = {
      id,
      tenantId: params.tenantId,
      ownerUserId: params.ownerUserId,
      items,
      totalAmount,
      status: params.status || "pending",
      createdAt: new Date().toISOString(),
    };

    orders.push(newOrder);
    return newOrder;
  },

  delete(id: string): Order | null {
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) {
      return null;
    }
    const [deleted] = orders.splice(index, 1);
    return deleted ?? null;
  },

  reset(): void {
    orders = initialOrders.map((o) => ({ ...o, items: [...o.items] }));
    nextAutoId = 301;
  },
};
