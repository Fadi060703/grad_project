import { Request , Response , NextFunction } from "express"

export const logger = ( req : Request , res : Response , next : NextFunction ) => {
    const method = req.method ;
    const url = req.url ; 
    const state = res.statusCode ; 
    console.log( `[ ${ method } ]  ${ url } -> ${ state }` ) ; 
    next() ; 
}