import { OrderStatus } from '@prisma/client';

// ============================================
// Server -> Client Events
// ============================================

export interface DriverLocationEvent {
  driverId: string;
  driverName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  isMoving?: boolean;
  batteryLevel?: number;
  isOnDuty: boolean;
  timestamp: Date;
}

export interface DriverPresenceEvent {
  driverId: string;
  driverName: string;
  isOnline: boolean;
  isOnDuty: boolean;
  timestamp: Date;
}

export interface OrderStatusEvent {
  orderId: string;
  readableId: number;
  status: OrderStatus;
  previousStatus: OrderStatus;
  customerId: string;
  customerName: string;
  driverId?: string;
  driverName?: string;
  timestamp: Date;
}

// ============================================
// Client -> Server Events
// ============================================

export interface ClientDriverLocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  isMoving?: boolean;
  batteryLevel?: number;
}

export interface ClientDutyToggle {
  isOnDuty: boolean;
}

// ============================================
// Socket.IO Event Names
// ============================================

export const SOCKET_EVENTS = {
  // Server -> Client
  DRIVER_LOCATION: 'driver:location',
  DRIVER_PRESENCE: 'driver:presence',
  ORDER_STATUS: 'order:status',
  CONNECTION_ERROR: 'connection:error',

  // Client -> Server
  UPDATE_LOCATION: 'location:update',
  TOGGLE_DUTY: 'duty:toggle',
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',

  // Built-in events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
} as const;

// ============================================
// Room Names
// ============================================

export const ROOMS = {
  DRIVERS: 'drivers',
  ADMINS: 'admins',
  customer: (userId: string) => `customer:${userId}`,
  order: (orderId: string) => `order:${orderId}`,
} as const;

// ============================================
// Type-safe Event Maps for Socket.IO
// ============================================

export interface ServerToClientEvents {
  [SOCKET_EVENTS.DRIVER_LOCATION]: (data: DriverLocationEvent) => void;
  [SOCKET_EVENTS.DRIVER_PRESENCE]: (data: DriverPresenceEvent) => void;
  [SOCKET_EVENTS.ORDER_STATUS]: (data: OrderStatusEvent) => void;
  [SOCKET_EVENTS.CONNECTION_ERROR]: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.UPDATE_LOCATION]: (data: ClientDriverLocationUpdate) => void;
  [SOCKET_EVENTS.TOGGLE_DUTY]: (data: ClientDutyToggle) => void;
  [SOCKET_EVENTS.JOIN_ROOM]: (room: string) => void;
  [SOCKET_EVENTS.LEAVE_ROOM]: (room: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userName: string;
  userRole: string;
  driverId?: string;
  customerId?: string;
}
