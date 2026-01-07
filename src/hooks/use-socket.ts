'use client';

import { useCallback, useEffect } from 'react';

import { useSocketContext } from '@/lib/socket-context';
import {
  ClientDriverLocationUpdate,
  ClientDutyToggle,
  DriverLocationEvent,
  DriverPresenceEvent,
  OrderStatusEvent,
  ServerToClientEvents,
  SOCKET_EVENTS,
} from '@/lib/socket-events';

// Main socket hook
export function useSocket() {
  const { socket, isConnected, connectionError, reconnect } = useSocketContext();

  // Emit driver location update
  const updateLocation = useCallback(
    (data: ClientDriverLocationUpdate) => {
      if (socket && isConnected) {
        socket.emit(SOCKET_EVENTS.UPDATE_LOCATION, data);
      }
    },
    [socket, isConnected],
  );

  // Toggle duty status
  const toggleDuty = useCallback(
    (data: ClientDutyToggle) => {
      if (socket && isConnected) {
        socket.emit(SOCKET_EVENTS.TOGGLE_DUTY, data);
      }
    },
    [socket, isConnected],
  );

  // Join a room
  const joinRoom = useCallback(
    (room: string) => {
      if (socket && isConnected) {
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, room);
      }
    },
    [socket, isConnected],
  );

  // Leave a room
  const leaveRoom = useCallback(
    (room: string) => {
      if (socket && isConnected) {
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, room);
      }
    },
    [socket, isConnected],
  );

  return {
    socket,
    isConnected,
    connectionError,
    reconnect,
    updateLocation,
    toggleDuty,
    joinRoom,
    leaveRoom,
  };
}

// Subscribe to driver location updates
export function useDriverLocationUpdates(callback: (data: DriverLocationEvent) => void) {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handler: ServerToClientEvents[typeof SOCKET_EVENTS.DRIVER_LOCATION] = (data) => {
      callback(data);
    };

    socket.on(SOCKET_EVENTS.DRIVER_LOCATION, handler);

    return () => {
      socket.off(SOCKET_EVENTS.DRIVER_LOCATION, handler);
    };
  }, [socket, isConnected, callback]);
}

// Subscribe to driver presence updates
export function useDriverPresenceUpdates(callback: (data: DriverPresenceEvent) => void) {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handler: ServerToClientEvents[typeof SOCKET_EVENTS.DRIVER_PRESENCE] = (data) => {
      callback(data);
    };

    socket.on(SOCKET_EVENTS.DRIVER_PRESENCE, handler);

    return () => {
      socket.off(SOCKET_EVENTS.DRIVER_PRESENCE, handler);
    };
  }, [socket, isConnected, callback]);
}

// Subscribe to order status updates
export function useOrderStatusUpdates(callback: (data: OrderStatusEvent) => void) {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handler: ServerToClientEvents[typeof SOCKET_EVENTS.ORDER_STATUS] = (data) => {
      callback(data);
    };

    socket.on(SOCKET_EVENTS.ORDER_STATUS, handler);

    return () => {
      socket.off(SOCKET_EVENTS.ORDER_STATUS, handler);
    };
  }, [socket, isConnected, callback]);
}

// Generic subscription hook for any event (uses any for flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSocketEvent(event: string, callback: (...args: any[]) => void) {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(event as any, callback);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.off(event as any, callback);
    };
  }, [socket, isConnected, event, callback]);
}

// Connection status indicator
export function useSocketStatus() {
  const { isConnected, connectionError, reconnect } = useSocketContext();

  return {
    isConnected,
    connectionError,
    reconnect,
    status: isConnected ? 'connected' : connectionError ? 'error' : 'disconnected',
  };
}
