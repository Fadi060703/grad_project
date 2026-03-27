export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

