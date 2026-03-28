import { Request , Response } from "express"
import { createSectionSchema , getSectionsSchema } from "../validators/sections"
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod" ; 
export const getAllSections = createListHandler({
  prisma: prisma.section,

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
    },
  } as any,

  mapResult: ({ data }) => z.array(getSectionsSchema).parse(data),
});

export const createSection = async( req : Request , res : Response ) => {

    try{
        const data = createSectionSchema.parse( req.body ) ; 
        const created = await prisma.section.create({
            data : {
                name : data.name ,
                year : {
                    connect : {
                        id : data.year_id
                    }
                }
            } , 
            
        }) ;
        
        return res.status( 201 ).json( created ) ;
    }
    catch( err ) {

        return res.status( 400 ).json( { "ERROR" : err }) ;

    }
}