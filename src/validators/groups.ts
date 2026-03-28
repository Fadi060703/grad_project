import { z } from 'zod' ; 

export const getGroupsSchema = z.object({

    id : z.number() , 
    name : z.string()

}) ;

export const createGroupSchema = z.object({
    name : z.string().min( 2 ) ,
    section_id : z.number().positive() 
}) ;


export type createGroupDTO = z.infer< typeof createGroupSchema > ; 
export type getGroupsDTO = z.infer< typeof getGroupsSchema > ;