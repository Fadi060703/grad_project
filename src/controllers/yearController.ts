import { Request , Response } from "express";
import { createListHandler } from "../lib/express-prisma-query";
import { prisma  } from "../lib/prisma";
import { yearSchema , createYearSchema } from "../validators/years" ; 
import { z } from 'zod' ;

export const getAllYears = createListHandler({
  prisma: prisma.year,
  allowedSortFields: ["id", "name"],
  fieldTypes: {
    id: "number",
    name: "text",
  },
  searchableFields: ["name"],
findManyArgs: {
  select: {
    id: true,
    name: true,

    sections: {
      select: {
        id: true,
        name: true,
        yearId: true,
      }
    }
  },
} as any,
  mapResult: ({ data }) => z.array(yearSchema).parse(data),
});

export const createYear = async ( req : Request , res : Response ) => {
    try{
        const data = createYearSchema.parse( req.body ) ; 
        const created = await prisma.year.create({
            data : {
                name : data.name 
            }
        }) ;

        return res.status( 201 ).json( created ) ;
    }
    catch( err ) {
        return res.status( 400 ).json({ "ERROR" : err } ) ;
    }
}