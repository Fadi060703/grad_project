import { z } from "zod" ; 

const studentSchema = z.object({
    rollNum: z.number(),
    userId: z.number(),
    mothersName: z.string(),
    phoneNumber: z.string(),
});

export const getAllUsersrSchema = z.object({
    id : z.number() , 
    email : z.string().optional().nullable() ,
    userName : z.string().min( 8 ).max( 20 ) ,
    role : z.enum( [ 'ADMIN' , 'DOCTOR' , 'TEACHER' , 'STUDENT' ] ) , 
    status : z.boolean() , 
    student : studentSchema.optional().nullable()
}) ;




export const createUserSchema = z.object({

    email : z.string().optional().nullable() ,
    user_name : z.string().min( 8 ).max( 20 ) ,
    role : z.enum( [ 'ADMIN' , 'DOCTOR' , 'TEACHER' ] ) , 
    status : z.boolean().default( true ).optional() , 
    password : z.string().min( 8 ).max( 50 ).regex(/[A-Z]/ , "Must contain at least one Uppercase letter" ).
    regex( /[a-z]/ , 'Must contain at least one Lowercase letter' ).
    regex( /[0-9]/ , "Must contain at least on number" ) 
}) ;

export const createStudentSchema = z.object({

    email : z.string().optional().nullable() ,
    user_name : z.string().min( 8 ).max( 20 ) ,
    role : z.enum( [ 'STUDENT' ] ) , 
    status : z.boolean().default( true ).optional() , 
    password : z.string().min( 8 ).max( 50 ).regex(/[A-Z]/ , "Must contain at least one Uppercase letter" ).
    regex( /[a-z]/ , 'Must contain at least one Lowercase letter' ).
    regex( /[0-9]/ , "Must contain at least on number" ) ,
    rollNum : z.int().positive() , 
    mothersName : z.string() ,
    phoneNumber : z.string()
}) ;



export const updateUserSchema = z.object({
    email : z.string().optional().nullable() ,
    user_name : z.string().min( 8 ).max( 20 ).optional() ,
    role : z.enum( [ 'ADMIN' , 'DOCTOR' , 'TEACHER' , 'STUDENT' ] ).optional() ,
    status : z.boolean().optional() ,
    password : z.string().min( 8 ).max( 50 ).regex(/[A-Z]/ , "Must contain at least one Uppercase letter" ).
    regex( /[a-z]/ , 'Must contain at least one Lowercase letter' ).
    regex( /[0-9]/ , "Must contain at least on number" ).optional()
}) ;

export type getUsersDTO = z.infer< typeof getAllUsersrSchema > ; 
export type createUserDTO = z.infer< typeof createUserSchema > ;
export type createStudentDTO = z.infer< typeof createStudentSchema > ; 
export type updateUserDTO = z.infer< typeof updateUserSchema > ;