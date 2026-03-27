import { Request , Response } from "express";
import { prisma } from "../../lib/prisma";
import { loginSchema } from "../../validators/login";
import bcrypt from 'bcrypt' ; 
import jwt from 'jsonwebtoken' ; 
import { JWT_EXPIRES_IN , JWT_SECRET } from "../../config/auth";
export const login = async( req : Request , res : Response ) => {

    try{
        const data = loginSchema.parse( req.body ) ; 
        const user = await prisma.user.findUnique({
            where : {
                userName : data.userName
            }
        }); 
        if( !user ) { return res.status( 400 ).json({ "ERROR" : "Wrong Credentials" } ) ; } 
        const matched = await bcrypt.compare( data.password , user.password )
        if( !matched ) { return res.status( 400 ).json({ "ERROR" : "Wrong Password"} ) ; }

        const token = jwt.sign(
            { id : user.id , role : user.role } , 
            JWT_SECRET , 
            { expiresIn : JWT_EXPIRES_IN } 
        ) ; 

        return res.status( 200 ).json({ "access" : token , "expires_in" : JWT_EXPIRES_IN } ) ; 

    } catch( err ) {

        return res.status( 400 ).json( { "ERROR" : err } ) ;
    }

}

export const me = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ ERROR: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ ERROR: "Invalid token format" });
    }

    // verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // get user from DB
    const user = await prisma.user.findUnique({
      where: { id : decoded.id },
      select: {
        id: true,
        userName: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (!user) {
      return res.status(404).json({ ERROR: "User not found" });
    }

    return res.status(200).json(user);

  } catch (err) {
    return res.status(401).json({ ERROR: "Invalid or expired token" });
  }
};