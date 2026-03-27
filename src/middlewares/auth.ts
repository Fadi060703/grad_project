
import { Request , Response , NextFunction } from "express" ; 
import jwt from 'jsonwebtoken' ;
import { JWT_SECRET  } from "../config/auth" ;

export const authMiddleware = ( req : Request , res : Response , next : NextFunction ) => {
    const authHeader = req.headers.authorization ; 
    if( !authHeader || !authHeader.startsWith( "Bearer " ) ) {
        return res.status( 401 ).json({ error : "NO" }) ; 
    }

    const token = authHeader.split( " " )[ 1 ] ; 
    try {
        const decoded = jwt.verify( token , JWT_SECRET ) ;
        req.user = decoded ; 
        next() ; 
    }
    catch( err ){
        return res.status( 401 ).send( { error : "NO" }) ; 
    }
}