export interface User {
  userId: string;
  email: string;
  password: string;
  tenantId: string;
  orgId: string;
  scope: string[];
}

export const users: User[] = [
  {
    userId: "userA1",
    email: "userA1@example.com",
    password: "password123",
    tenantId: "tenantA",
    orgId: "tenantA",
    scope: ["orders:read"],
  },

  {
    userId: "userA2",
    email: "userA2@example.com",
    password: "password123",
    tenantId: "tenantA",
    orgId: "tenantA",
    scope: ["orders:read:tenant"],
  },

  {
    userId: "userB1",
    email: "userB1@example.com",
    password: "password123",
    tenantId: "tenantB",
    orgId: "tenantB",
    scope: ["orders:read"],
  },
];
