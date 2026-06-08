import express, { Application } from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import router from './src/router/router';
import { getLocalExternalIPv4 } from './src/lib/getIPv4';
import cors from "cors";
import { logger } from './src/middlewares/logger';
import { notFound } from './src/middlewares/404';
import { errorHandler } from './src/middlewares/errorHandler';
import { initializeWebSocket } from './src/websocket/server';
import { initCron } from './src/lib/cron';

const app: Application = express();
const path = '0.0.0.0';
const port = 8000;

// CORS middleware
app.use(cors({
    origin: /.*/,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

app.use(express.json());
app.use('/api', router);
app.use(notFound);
app.use(logger);
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket on the same server
initializeWebSocket(server);

// Initialize cron jobs
initCron();

// Start both HTTP and WebSocket on the same port
server.listen(port, path, () => {
    const networkIpv4 = getLocalExternalIPv4();
    console.log(`✓ Server running on:`);
    console.log(`  Local:   127.0.0.1:${port}`);
    console.log(`  Network: ${networkIpv4}:${port}`);
    console.log(`✓ WebSocket server ready on same port`);
});