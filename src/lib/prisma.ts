import "dotenv/config" ;
import { PrismaPg  } from "@prisma/adapter-pg" ;
import { PrismaClient } from "../generated/prisma/client" ; 

const connection = `${ process.env.DATABASE_URL }` ; 
const adapter = new PrismaPg( { connectionString : connection } ) ; 
const prisma = new PrismaClient( { adapter } ) ;

export { prisma } ; 
