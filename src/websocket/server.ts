// websocket/server.ts

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';

interface UserSocket {
  userId: number;
  role: string;
  socketId: string;
}

export class WebSocketServer {
  private io: SocketServer;
  private connectedUsers: Map<string, UserSocket> = new Map(); // socketId -> user
  private userSockets: Map<number, string[]> = new Map(); // userId -> socketIds[]

  constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    
    this.initialize();
  }

  private initialize() {
    this.io.use(async (socket, next) => {
      // Authenticate socket connection
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        (socket as any).userId = decoded.id;
        (socket as any).userRole = decoded.role;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`User connected: ${socket.id}`);
      this.handleConnection(socket);
      
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
      
      socket.on('join-room', (room: string) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
      });
      
      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
      });
    });
  }

  private handleConnection(socket: Socket) {
    const userId = (socket as any).userId;
    const userRole = (socket as any).userRole;
    
    // Store user connection
    this.connectedUsers.set(socket.id, {
      userId,
      role: userRole,
      socketId: socket.id,
    });
    
    // Update userSockets map
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, []);
    }
    this.userSockets.get(userId)!.push(socket.id);
    
    // Join user to role-based room
    socket.join(`role:${userRole}`);
    socket.join(`user:${userId}`);
    
    console.log(`User ${userId} (${userRole}) connected. Total users: ${this.connectedUsers.size}`);
    
    // Broadcast user online status
    this.broadcastUserStatus(userId, 'online');
  }

  private handleDisconnect(socket: Socket) {
    const user = this.connectedUsers.get(socket.id);
    if (user) {
      // Remove from connected users
      this.connectedUsers.delete(socket.id);
      
      // Remove from userSockets
      const userSockets = this.userSockets.get(user.userId);
      if (userSockets) {
        const index = userSockets.indexOf(socket.id);
        if (index !== -1) userSockets.splice(index, 1);
        if (userSockets.length === 0) {
          this.userSockets.delete(user.userId);
        }
      }
      
      console.log(`User ${user.userId} disconnected`);
      
      // Broadcast user offline status if no other connections
      if (!this.userSockets.has(user.userId)) {
        this.broadcastUserStatus(user.userId, 'offline');
      }
    }
  }

  // ============== EMIT METHODS ==============

  // Send to specific user
  emitToUser(userId: number, event: string, data: any) {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  // Send to all users in a role
  emitToRole(role: string, event: string, data: any) {
    this.io.to(`role:${role}`).emit(event, data);
  }

  // Send to specific room
  emitToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  // Broadcast to all connected users
  broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }

  // Send to all except a specific socket
  broadcastExcept(socketId: string, event: string, data: any) {
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.id !== socketId) {
        socket.emit(event, data);
      }
    });
  }

  private broadcastUserStatus(userId: number, status: 'online' | 'offline') {
    this.io.emit('user-status', { userId, status });
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get user connections count
  getUserConnections(userId: number): number {
    return this.userSockets.get(userId)?.length || 0;
  }
}

export let wsServer: WebSocketServer;

export const initializeWebSocket = (server: HttpServer) => {
  wsServer = new WebSocketServer(server);
  return wsServer;
};