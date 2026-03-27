import express from 'express' ; 
import { createUser, deleteUser, getAllnonStudentUsers, getAllStudentUsers, getUserById, updateUser } from '../controllers/userController';
import { login, me } from '../controllers/auth/auth';
import { authMiddleware } from '../middlewares/auth';
import { check } from '../middlewares/check-permission';

const router = express.Router() ;

router.get( '/users', authMiddleware , check( "GET_USERS" ) , getAllnonStudentUsers ) ; 
router.get( '/users/students' , getAllStudentUsers ) ; 
router.get( '/users/:id' , getUserById ) ;
router.post( '/users' , createUser ) ; 
router.put( '/users/:id' , updateUser ) ;
router.delete( '/users/:id' , deleteUser ) ; 


router.post( '/auth/login' , login ) ;
router.get( '/auth/me' , me )
export default router ; 
