import { Server } from 'socket.io';

import { cacheDriverLocation, publishDriverLocation, publishDriverPresence, publishOrderUpdate } from './redis';
import {
  ClientToServerEvents,
  DriverLocationEvent,
  DriverPresenceEvent,
  InterServerEvents,
  OrderStatusEvent,
  ROOMS,
  ServerToClientEvents,
  SOCKET_EVENTS,
  SocketData,
} from './socket-events';

// Type-safe Socket.IO server
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Get the global Socket.IO instance
function getIO(): TypedServer | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (global as any).io || null;
}

// Emit driver location update
export async function emitDriverLocation(data: DriverLocationEvent): Promise<void> {
  const io = getIO();

  // Cache in Redis
  await cacheDriverLocation({
    driverId: data.driverId,
    driverName: data.driverName,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
    speed: data.speed,
    heading: data.heading,
    isMoving: data.isMoving,
    batteryLevel: data.batteryLevel,
    isOnDuty: data.isOnDuty,
    timestamp: data.timestamp.toISOString(),
  });

  // Publish to Redis for multi-instance support
  await publishDriverLocation({
    driverId: data.driverId,
    driverName: data.driverName,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
    speed: data.speed,
    heading: data.heading,
    isMoving: data.isMoving,
    batteryLevel: data.batteryLevel,
    isOnDuty: data.isOnDuty,
    timestamp: data.timestamp.toISOString(),
  });

  // If Socket.IO is available, emit directly
  if (io) {
    io.to(ROOMS.ADMINS).emit(SOCKET_EVENTS.DRIVER_LOCATION, data);
  }
}

// Emit driver presence update
export async function emitDriverPresence(data: DriverPresenceEvent): Promise<void> {
  const io = getIO();

  // Publish to Redis for multi-instance support
  await publishDriverPresence(data);

  // If Socket.IO is available, emit directly
  if (io) {
    io.to(ROOMS.ADMINS).emit(SOCKET_EVENTS.DRIVER_PRESENCE, data);
  }
}

// Emit order status update
export async function emitOrderStatus(data: OrderStatusEvent): Promise<void> {
  const io = getIO();

  // Publish to Redis for multi-instance support
  await publishOrderUpdate(data);

  // If Socket.IO is available, emit directly
  if (io) {
    // Emit to admins
    io.to(ROOMS.ADMINS).emit(SOCKET_EVENTS.ORDER_STATUS, data);

    // Emit to the specific customer
    io.to(ROOMS.customer(data.customerId)).emit(SOCKET_EVENTS.ORDER_STATUS, data);
  }
}

// Emit to a specific room (untyped for flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emitToRoom(room: string, event: string, data: any): void {
  const io = getIO();
  if (io) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    io.to(room).emit(event as any, data);
  }
}

// Emit to a specific socket by user ID (untyped for flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emitToUser(userId: string, event: string, data: any): void {
  const io = getIO();
  if (io) {
    // Find sockets for this user
    io.sockets.sockets.forEach((socket) => {
      if (socket.data.userId === userId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.emit(event as any, data);
      }
    });
  }
}

// Check if Socket.IO is available
export function isSocketIOAvailable(): boolean {
  return getIO() !== null;
}

// Get connected socket count
export function getConnectedSocketCount(): number {
  const io = getIO();
  return io ? io.sockets.sockets.size : 0;
}

// Get connected users in a room
export function getRoomUsers(room: string): string[] {
  const io = getIO();
  if (!io) return [];

  const users: string[] = [];
  const socketsInRoom = io.sockets.adapter.rooms.get(room);

  if (socketsInRoom) {
    socketsInRoom.forEach((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket?.data.userName) {
        users.push(socket.data.userName);
      }
    });
  }

  return users;
}
