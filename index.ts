import express, { Application, Request, Response } from 'express';
import router from './src/router/router';
import { getLocalExternalIPv4 } from './src/lib/getIPv4';
import cors from "cors" ; 
import { logger } from './src/middlewares/logger';
import { notFound } from './src/middlewares/404';


const app : Application = express();
const path = 'localhost';
const port = 8000;
app.use( cors({
    origin : [ 'http://127.0.0.1:3000' , 'http://localhost:3000' ] ,
    credentials : true , 
    methods : [ "GET" , "POST" , "PUT" , "PATCH" , "DELETE" , "OPTIONS" ] ,
    allowedHeaders : [ "Content-Type" , "Authorization" , "Accept"] 
}))

app.use(express.json());
app.use('/api', router);
app.use( notFound ) ; 
app.use( logger ) ;  
app.listen(port, path, () => {
    const networkIpv4 = getLocalExternalIPv4();
    console.log(
        `         Server running on :
         Local:   127.0.0.1:${port}
         Network: ${networkIpv4}:${port}`
    );
}); 
