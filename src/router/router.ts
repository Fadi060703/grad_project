import express from 'express' ; 
import { createStudent, createUser, deleteUser, getAllnonStudentUsers, getAllStudentUsers, getUserById, updateUser } from '../controllers/userController';
import { login, me } from '../controllers/auth/auth';
import { authMiddleware } from '../middlewares/auth';
import { check } from '../middlewares/check-permission';
import { createYear, getAllYears } from '../controllers/yearController';
import { createSection, getAllSections } from '../controllers/sectionController';

const router = express.Router() ;

router.get( '/users' , getAllnonStudentUsers ) ; 
router.get( '/students' , getAllStudentUsers ) ;
router.post( '/students' , createStudent ) ;  
router.get( '/users/:id' , getUserById ) ;
router.post( '/users' , createUser ) ; 
router.put( '/users/:id' , updateUser ) ;
router.delete( '/users/:id' , deleteUser ) ; 
router.post( '/auth/login' , login ) ;
router.get( '/auth/me' , authMiddleware , me ) ; 
router.get( '/years' , getAllYears ) ; 
router.post( '/years' , createYear ) ; 
router.get( '/sections' , getAllSections ) ; 
router.post( '/sections' , createSection ) ; 


export default router ; 
