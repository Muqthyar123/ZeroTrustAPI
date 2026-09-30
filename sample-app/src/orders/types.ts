export interface OrderItem {
  item: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  tenantId: string;
  ownerUserId: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "processing" | "completed" | "shipped" | "cancelled" | string;
  createdAt: string;
}

export interface CreateOrderBody {
  items?: OrderItem[] | undefined;
  totalAmount?: number | undefined;
  status?: string | undefined;
  description?: string | undefined;
}
