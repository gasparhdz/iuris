import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "../env.js";

export const swaggerPlugin = fp(async (fastify) => {
  // OpenAPI schema siempre disponible para el type provider; la UI /docs solo en no-prod.
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "Iuris API",
        description: "API endpoints para el SaaS Iuris (Multi-Tenant)",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  if (env.NODE_ENV === "production") return;

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });
});
