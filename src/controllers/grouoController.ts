import { Request , Response  } from "express";
import { createGroupSchema , getGroupsSchema } from "../validators/groups";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from 'zod' ; 

export const getAllGroups = createListHandler({
  prisma: prisma.group,

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

  mapResult: ({ data }) => z.array(getGroupsSchema).parse(data),
});

export const createGroup = async( req : Request , res : Response ) => {

    try{
        const data = createGroupSchema.parse( req.body ) ;
        const created = await prisma.group.create({
            data : {
                name : data.name , 
                section : {
                    connect : {
                        id : data.section_id 
                    }
                }
            }
        }) ;
        return res.status( 201 ).json( created ) ;
    }
    catch( err ) {
        return res.status( 400 ).json({ "ERROR" : err } ) ;
    }

}