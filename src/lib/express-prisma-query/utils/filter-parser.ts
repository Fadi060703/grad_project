/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseISO } from "date-fns";
import { Filter } from "../schema";
import { FieldType, operatorMap } from "./operator-map";

function parseFieldPath(
  id: string,
  condition: any,
  filter?: Filter
): Record<string, any> {
  const parts = id.split(".").map((part) => {
    if (part.endsWith("[]")) return { name: part.slice(0, -2), isList: true };
    return { name: part, isList: false };
  });

  const relationOperator = filter?.relationOperator || "some";

  if (parts.length === 1) return { [parts[0].name]: condition };

  let nested: any = condition;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.isList) nested = { [relationOperator]: nested };
    nested = { [part.name]: nested };
  }

  return nested;
}

function mergeWhereClause(target: Record<string, any>, source: Record<string, any>) {
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const v = source[key];

    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      target[key] = v;
      continue;
    }

    target[key] = target[key] || {};
    mergeWhereClause(target[key], v);
  }
}

function coerceByType(fieldType: FieldType, value: any, operator: Filter["operator"]) {
  if (fieldType === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value);
    return value;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return value;
  }

  if (fieldType === "date") {
    if (value instanceof Date) return value;
    if (typeof value === "string" && operator !== "isBetween") return parseISO(value);
    return value;
  }

  return value;
}

export function buildWhereClause(props: {
  filters: Filter[];
  search?: string;
  joinOperator?: "and" | "or";
  /**
   * Provide known field types for the *base field name*.
   * Example: { status: "text", createdAt: "date", total: "number" }
   */
  fieldTypes: Record<string, FieldType>;
  /**
   * Provide fields to search in when `search` is provided.
   * Example: ["name", "email", "createdAt"]
   */
  searchableFields?: readonly string[];
}): Record<string, any> {
  const {
    filters,
    search,
    joinOperator = "and",
    fieldTypes,
    searchableFields = [],
  } = props;

  const where: Record<string, any> = {};
  const filterGroups: Record<string, Filter[]> = {};

  for (const f of filters || []) {
    filterGroups[f.id] = filterGroups[f.id] || [];
    filterGroups[f.id].push(f);
  }

  const orConditions: Record<string, any>[] = [];

  for (const fieldId in filterGroups) {
    const fieldFilters = filterGroups[fieldId];
    const baseField = fieldId.split(".")[0]?.replace(/\[\]$/, "");
    const fieldType = fieldTypes[baseField] || (fieldFilters[0].type as FieldType);
    const opsForType = (operatorMap as any)[fieldType];
    if (!opsForType) throw new Error(`Unsupported field type: ${fieldId}`);

    let clause: Record<string, any>;

    if (fieldFilters.length > 1) {
      const allEq = fieldFilters.every((f) => f.operator === "eq");

      if (allEq) {
        const values = fieldFilters.map((f) => coerceByType(fieldType, f.value, f.operator));
        clause = parseFieldPath(fieldId, { in: values }, fieldFilters[0]);
      } else {
        const conditions = fieldFilters.map((f) => {
          const parsedValue = coerceByType(fieldType, f.value, f.operator);
          const condition = opsForType[f.operator](parsedValue);
          return parseFieldPath(fieldId, condition, f);
        });
        clause = joinOperator === "or" ? { OR: conditions } : { AND: conditions };
      }
    } else {
      const f = fieldFilters[0];
      const parsedValue = coerceByType(fieldType, f.value, f.operator);
      const condition = opsForType[f.operator](parsedValue);
      clause = parseFieldPath(fieldId, condition, f);
    }

    if (joinOperator === "or") orConditions.push(clause);
    else mergeWhereClause(where, clause);
  }

  if (joinOperator === "or" && orConditions.length) where.OR = orConditions;

  if (search && search.trim() && searchableFields.length) {
    const s = search.trim();
    const searchConditions = searchableFields
      .map((field) => {
        const t = fieldTypes[field] || "text";
        if (t === "text") return { [field]: { contains: s, mode: "insensitive" as const } };
        if (t === "number") {
          const n = Number(s);
          if (!Number.isFinite(n)) return null;
          return { [field]: { equals: n } };
        }
        if (t === "date") {
          const d = parseISO(s);
          if (Number.isNaN(d.getTime())) return null;
          return operatorMap.date.eq(d);
        }
        return null;
      })
      .filter(Boolean) as Record<string, any>[];

    if (searchConditions.length) {
      where.OR = where.OR || [];
      where.OR.push(...searchConditions);
    }
  }

  return where;
}

