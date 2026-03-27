import { endOfDay, parseISO, startOfDay } from "date-fns";

export type FieldType = "number" | "text" | "date" | "boolean";

export const operatorMap = {
  number: {
    eq: (value: number) => value,
    ne: (value: number) => ({ not: value }),
    gt: (value: number) => ({ gt: value }),
    lt: (value: number) => ({ lt: value }),
    gte: (value: number) => ({ gte: value }),
    lte: (value: number) => ({ lte: value }),
    isBetween: (values: number[]) => ({ gte: values[0], lte: values[1] }),
    isEmpty: () => ({ equals: undefined }),
    isNotEmpty: () => ({ not: { equals: undefined } }),
  },
  text: {
    eq: (value: string) => ({ equals: value }),
    ne: (value: string) => ({ not: value }),
    iLike: (value: string) => ({ contains: value, mode: "insensitive" as const }),
    notILike: (value: string) => ({
      not: { contains: value, mode: "insensitive" as const },
    }),
    contains: (value: string) => ({ contains: value }),
    isEmpty: () => ({ equals: "" }),
    isNotEmpty: () => ({ not: { equals: "" } }),
  },
  date: {
    eq: (value: Date) => ({ gte: startOfDay(value), lte: endOfDay(value) }),
    ne: (value: Date) => ({
      not: { gte: startOfDay(value), lte: endOfDay(value) },
    }),
    gt: (value: Date) => ({ gt: endOfDay(value) }),
    lt: (value: Date) => ({ lt: startOfDay(value) }),
    gte: (value: Date) => ({ gte: startOfDay(value) }),
    lte: (value: Date) => ({ lte: endOfDay(value) }),
    isBetween: (values: string[]) => {
      const [start, end] = values.map((d) => parseISO(d));
      return { gte: startOfDay(start), lte: endOfDay(end) };
    },
    isEmpty: () => ({ equals: null }),
    isNotEmpty: () => ({ not: { equals: null } }),
  },
  boolean: {
    eq: (value: boolean) => value,
    ne: (value: boolean) => ({ not: value }),
    isEmpty: () => ({ equals: null }),
    isNotEmpty: () => ({ not: { equals: null } }),
  },
} as const;

