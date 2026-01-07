'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { ClientToServerEvents, ServerToClientEvents } from './socket-events';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: TypedSocket | null;
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<TypedSocket | null>(null);

  const connect = useCallback(() => {
    // Don't connect if we're on the server
    if (typeof window === 'undefined') return;

    // Clean up existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket: TypedSocket = io(process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);

      // Don't show error for intentional disconnects
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        setConnectionError(`Disconnected: ${reason}`);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
      setConnectionError(error.message);
    });

    newSocket.on('connection:error', (data) => {
      console.error('Socket server error:', data.message);
      setConnectionError(data.message);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, []);

  const reconnect = useCallback(() => {
    setConnectionError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return <SocketContext.Provider value={{ socket, isConnected, connectionError, reconnect }}>{children}</SocketContext.Provider>;
}

export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}

// Optional: A hook that returns null if not connected (for conditional rendering)
export function useOptionalSocketContext(): SocketContextValue | null {
  return useContext(SocketContext);
}
