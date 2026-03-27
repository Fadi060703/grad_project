import { StringValue } from "ms";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
export const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "1d") as StringValue | number;
export const SALT_ROUNDS = 10;