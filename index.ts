import express, { Application } from 'express';
import { createServer } from 'http';
import { join } from 'path';
// import { Server as SocketServer } from 'socket.io';
import router from './src/router/router';
import { getLocalExternalIPv4 } from './src/lib/getIPv4';
import cors from "cors";
import { logger } from './src/middlewares/logger';
import { notFound } from './src/middlewares/404';
import { errorHandler } from './src/middlewares/errorHandler';
// import { initializeWebSocket } from './src/websocket/server';
import { initCron } from './src/lib/cron';

const app: Application = express();
const host = '0.0.0.0';
const port = 8001;
const uploadsDir = join(process.cwd(), 'public', 'uploads');

// CORS middleware
// app.use(cors({
//   origin: 'https://1f4e-185-183-34-110.ngrok-free.app', // exact origin, not * (the new ngrok frontend url)
//   credentials: true
// }))


app.use(cors({
    origin: /.*/,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
}));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.get('/attendance-test.html', (_req, res) => {
    res.sendFile(join(process.cwd(), 'src', 'router', 'attendance-test.html'));
});
app.get('/api/attendance-test.html', (_req, res) => {
    res.sendFile(join(process.cwd(), 'src', 'router', 'attendance-test.html'));
});
app.get('/sw.js', (_req, res) => {
    res.sendFile(join(process.cwd(), 'public', 'sw.js'));
});
app.get('/test-push.html', (_req, res) => {
    res.sendFile(join(process.cwd(), 'public', 'test-push.html'));
});
app.get('/test-ai-study-materials.html', (_req, res) => {
    res.sendFile(join(process.cwd(), 'public', 'test-ai-study-materials.html'));
});
app.use('/api', router);
app.use(notFound);
app.use(logger);
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// WebSocket is disabled for now while push notifications are being added.
// initializeWebSocket(server);

// Initialize cron jobs
initCron();

// Start the HTTP server
server.listen(port, host, () => {
    const networkIpv4 = getLocalExternalIPv4();
    console.log(`✓ Server running on:`);
    console.log(`  Local:   127.0.0.1:${port}`);
    console.log(`  Network: ${networkIpv4}:${port}`);
    // console.log(`✓ WebSocket server ready on same port`);
});