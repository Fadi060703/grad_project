/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { paginationSchema } from "./pagination-schemas";
import { Filter, filterSchema } from "./schema";
import { buildWhereClause } from "./utils/filter-parser";
import { safeJsonParse } from "./utils/json";
import { buildPrismaOrderBy } from "./utils/sorting";
import type { FieldType } from "./utils/operator-map";

type PrismaListDelegate = {
  /**
   * Prisma delegates use fairly complex generic types for args/payload.
   * To keep this helper easy to plug into any Prisma model, we type these as `any`.
   */
  findMany: (args?: any) => Promise<any[]>;
  count: (args?: any) => Promise<number>;
};

export type CreateListHandlerOptions<TResult = any> = {
  prisma: PrismaListDelegate;
  /**
   * Base args merged into findMany() (e.g. include/select).
   * `skip/take/where/orderBy` are added on top.
   */
  findManyArgs?: any;

  allowedSortFields?: readonly string[];
  fieldTypes: Record<string, FieldType>;
  searchableFields?: readonly string[];

  /**
   * Extra query params (besides paginationSchema) to validate.
   * Example: z.object({ status: z.string().optional() })
   */
  querySchema?: z.ZodObject<z.ZodRawShape>;

  /**
   * Customize the Prisma args before querying (e.g. auth scoping).
   */
  handleFindArgs?: (ctx: {
    req: Request;
    query: z.infer<typeof paginationSchema> & Record<string, any>;
    parsedFilters: Filter[];
    findManyArgs: any;
  }) => any;

  /**
   * Transform the rows before responding.
   */
  mapResult?: (ctx: { req: Request; data: any[] }) => Promise<TResult[]> | TResult[];
};

export function createListHandler<TResult = any>(
  options: CreateListHandlerOptions<TResult>
): RequestHandler {
  const {
    prisma,
    findManyArgs,
    allowedSortFields,
    fieldTypes,
    searchableFields,
    querySchema,
    handleFindArgs,
    mapResult,
  } = options;

  const fullQuerySchema = querySchema
    ? paginationSchema.extend(querySchema.shape)
    : paginationSchema;

  return async (req: Request, res: Response) => {
    const query = fullQuerySchema.parse(req.query);
    const { page, pagesize, filters, sort, search, joinOperator } = query;

    const parsedFiltersUnknown = safeJsonParse<unknown>(filters, []);
    const parsedSortUnknown = safeJsonParse<unknown>(sort, []);

    const parsedFilters = Array.isArray(parsedFiltersUnknown)
      ? parsedFiltersUnknown
          .map((f) => {
            const r = filterSchema.safeParse(f);
            return r.success ? r.data : null;
          })
          .filter(Boolean) as Filter[]
      : [];

    const where = buildWhereClause({
      filters: parsedFilters,
      search,
      joinOperator,
      fieldTypes,
      searchableFields,
    });

    const orderBy = buildPrismaOrderBy(parsedSortUnknown, allowedSortFields);

    const mergedArgs: any = {
      ...(findManyArgs || {}),
      skip: (Number(page) - 1) * Number(pagesize),
      take: Number(pagesize),
      where,
      orderBy,
    };

    const finalArgs = handleFindArgs
      ? { ...mergedArgs, ...handleFindArgs({ req, query, parsedFilters, findManyArgs: mergedArgs }) }
      : mergedArgs;

    const [data, total] = await Promise.all([
      prisma.findMany(finalArgs),
      prisma.count({ where: finalArgs.where }),
    ]);

    const out = mapResult ? await mapResult({ req, data }) : data;

    return res.json({
      data: out,
      meta: {
        total,
        page: Number(page),
        pageSize: Number(pagesize),
        totalPages: Math.ceil(total / Number(pagesize)),
      },
    });
  };
}

