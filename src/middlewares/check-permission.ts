
import { NextFunction, Request , Response } from "express"
import permissions from '../lib/permissions.json' ;
export const check = ( required : string ) => {

    return ( req : Request , res : Response , next : NextFunction ) => {

        const user = req.user ;

        if( !user ) { return res.status( 403 ).json( "UNAUTHORIZED Or Don't Have Permission" ) ; }
        const rolePermissions = (permissions as any )[ user.role ] ;
        const userPermissions = rolePermissions.CAN ;
        if( userPermissions.includes( "ALL" ) ) { return next() ; } 
        if( !userPermissions.includes( required ) ) {
            return res.status( 403 ).json( "UNAUTHORIZED Or Don't Have Permission"  ) ;
        }
        next() ; 
    }

} 