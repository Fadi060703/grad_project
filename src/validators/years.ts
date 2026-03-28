import { z } from "zod";
import { getSectionsSchema } from "./sections";

export const yearSchema = z.object({
  id: z.number(),
  name: z.string(),
  sections : z.array( getSectionsSchema ) 
});
export const createYearSchema = z.object({
  name: z.string(),
});


export type yearDTO = z.infer< typeof yearSchema > ;
export type createYearDTO = z.infer< typeof createYearSchema > ;