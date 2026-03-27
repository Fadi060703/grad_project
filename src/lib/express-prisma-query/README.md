## Express Prisma Query (helper)

This is a small helper to build "list" endpoints in **Express + TypeScript + Prisma** with:
- pagination: `page`, `pagesize`
- filtering: `filters` (JSON)
- sorting: `sort` (JSON)
- search: `search`

### Example

```ts
import express from "express";
import { PrismaClient } from "@prisma/client";
import { createListHandler } from "./lib/express-prisma-query";

const prisma = new PrismaClient();
const app = express();

app.get(
  "/users",
  createListHandler({
    prisma: prisma.user,
    allowedSortFields: ["id", "email", "createdAt"],
    fieldTypes: { id: "number", email: "text", createdAt: "date" },
    searchableFields: ["email"],
    findManyArgs: { select: { id: true, email: true, createdAt: true } } as any,
    handleFindArgs: ({ req, findManyArgs }) => {
      // Example: scope results to current tenant (pseudo-code)
      const tenantId = (req as any).user?.tenantId;
      return tenantId ? { where: { ...(findManyArgs.where || {}), tenantId } } : {};
    },
  })
);
```

### Query params

- `page`: number (default 1)
- `pagesize`: number (default 10)
- `filters`: JSON array (default `[]`)
- `sort`: JSON array (default `[]`)
- `search`: string (optional)
- `joinOperator`: `"and" | "or"` (default `"and"`)

