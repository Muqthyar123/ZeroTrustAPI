export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "ZeroTrustAPI Sample Application",
    version: "1.0.0",
    description:
      "Reference multi-tenant testbed API for ZeroTrustAPI BOLA authorization demonstration.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health Check",
        description: "Returns the health and status of the service.",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string", example: "sample-app" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "User Login",
        description: "Authenticates a user and returns a signed JWT.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Authentication successful",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginResponse",
                },
              },
            },
          },
          "400": {
            description: "Missing required fields",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/orders": {
      post: {
        summary: "Create Order",
        description:
          "Creates a new order bound to authenticated tenant and owner. Synchronously writes ownership to the Ownership Service.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateOrderRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Order created successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Order",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "502": {
            description: "Ownership Service registration failure",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/orders/{orderId}": {
      get: {
        summary: "Get Order by ID",
        description:
          "Retrieves an order by ID. In APP_MODE=vulnerable, ownership authorization is omitted to demonstrate BOLA.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            description: "Unique identifier of the order",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Order found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Order",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden (in secure mode when cross-tenant access is denied)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Order not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      delete: {
        summary: "Delete Order",
        description:
          "Deletes an order by ID and synchronizes deletion with the Ownership Service.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            description: "Unique identifier of the order",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Order deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "order deleted successfully" },
                    order: { $ref: "#/components/schemas/Order" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden (in secure mode)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Order not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/invoices/{invoiceId}": {
      get: {
        summary: "Get Invoice by ID",
        description: "Retrieves an invoice by ID.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "invoiceId",
            in: "path",
            required: true,
            description: "Unique identifier of the invoice",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Invoice found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "inv_101" },
                    orderId: { type: "string", example: "101" },
                    tenantId: { type: "string", example: "tenantA" },
                    amount: { type: "number", example: 120.0 },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Invoice not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/users/{userId}/documents/{documentId}": {
      get: {
        summary: "Get User Document by ID",
        description: "Retrieves a document belonging to a specific user.",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            description: "User ID owning the document",
            schema: {
              type: "string",
            },
          },
          {
            name: "documentId",
            in: "path",
            required: true,
            description: "Unique document identifier",
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Document found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    documentId: { type: "string", example: "doc_01" },
                    userId: { type: "string", example: "userA1" },
                    title: { type: "string", example: "Invoice Receipt" },
                    content: { type: "string", example: "Receipt details" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Document not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/_test/fixtures": {
      get: {
        summary: "Get Test Fixtures",
        description:
          "Returns deterministic test fixture data for CI scanner and test automation. Does not expose secrets or passwords.",
        responses: {
          "200": {
            description: "Deterministic test fixtures",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tenants: { type: "array", items: { type: "object" } },
                    users: { type: "array", items: { type: "object" } },
                    objects: { type: "object" },
                    delegations: { type: "array", items: { type: "object" } },
                    expectedAuthorization: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        summary: "OpenAPI Specification",
        description: "Returns the OpenAPI 3.0 document describing the Sample App API.",
        responses: {
          "200": {
            description: "OpenAPI specification document",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard JSON Web Token passed as Bearer <token>",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "userA1@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "password123",
          },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
            description: "Signed JWT bearer token",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
        },
      },
      OrderItem: {
        type: "object",
        required: ["item", "quantity", "price"],
        properties: {
          item: {
            type: "string",
            example: "Mechanical Keyboard",
          },
          quantity: {
            type: "integer",
            example: 1,
          },
          price: {
            type: "number",
            example: 120.0,
          },
        },
      },
      Order: {
        type: "object",
        required: [
          "id",
          "tenantId",
          "ownerUserId",
          "items",
          "totalAmount",
          "status",
          "createdAt",
        ],
        properties: {
          id: {
            type: "string",
            example: "101",
          },
          tenantId: {
            type: "string",
            example: "tenantA",
          },
          ownerUserId: {
            type: "string",
            example: "userA1",
          },
          items: {
            type: "array",
            items: {
              $ref: "#/components/schemas/OrderItem",
            },
          },
          totalAmount: {
            type: "number",
            example: 120.0,
          },
          status: {
            type: "string",
            example: "completed",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2026-09-01T10:00:00.000Z",
          },
        },
      },
      CreateOrderRequest: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              $ref: "#/components/schemas/OrderItem",
            },
          },
          totalAmount: {
            type: "number",
            example: 49.99,
          },
          status: {
            type: "string",
            example: "pending",
          },
          description: {
            type: "string",
            example: "Order description",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "order not found",
          },
          details: {
            type: "string",
            example: "Additional error context",
          },
        },
      },
    },
  },
};
