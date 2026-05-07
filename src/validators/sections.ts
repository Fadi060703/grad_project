import z from "zod";

export const getSectionsSchema = z.object({
    id: z.number().positive(),
    name: z.string().min(3),
    yearId: z.number().positive(), // Added to match Prisma and frontend
    year: z.object({  // Added to match frontend interface
        id: z.number().positive(),
        name: z.string()
    }).optional(),
    groups: z.array(z.any()).optional() // Added to match frontend interface
});

export const createSectionSchema = z.object({
    name: z.string().min(3),
    year_id: z.number().positive() // Keeping as year_id for frontend compatibility
});

export const updateSectionSchema = z.object({
    name: z.string().min(3).optional(),
    year_id: z.number().positive().optional()
});

// Export types
export type getSectionDTO = z.infer<typeof getSectionsSchema>;
export type createSectionDTO = z.infer<typeof createSectionSchema>;
export type updateSectionDTO = z.infer<typeof updateSectionSchema>;