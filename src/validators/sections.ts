import z from "zod";


export const getSectionsSchema = z.object({
    id : z.number().positive() , 
    name : z.string().min( 3 )  
}) ;

export const createSectionSchema = z.object({
    year_id : z.int().positive() , 
    name : z.string().min( 3 ) 
}) ; 

export type getSectionDTO = z.infer< typeof getSectionsSchema > ;
export type createSectionDTO = z.infer< typeof createSectionSchema > ; 