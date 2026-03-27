import { z }from 'zod' ; 

export const loginSchema = z.object({
    userName : z.string().min( 3 ).max( 50 ) ,
    password : z.string().min( 8 )
});


export type loginDTO = z.infer< typeof loginSchema > ;