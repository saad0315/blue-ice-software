'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useDriverLocationUpdates, useDriverPresenceUpdates, useSocketStatus } from '@/hooks/use-socket';
import { DriverLocationEvent, DriverPresenceEvent } from '@/lib/socket-events';

import { useLiveLocations } from '../api/use-live-locations';

export interface RealtimeDriverLocation {
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
  isOnline: boolean;
  lastUpdate: Date;
}

export function useDriverLocationsRealtime() {
  const queryClient = useQueryClient();
  const { isConnected, status } = useSocketStatus();
  const [realtimeDrivers, setRealtimeDrivers] = useState<Map<string, RealtimeDriverLocation>>(new Map());

  // Fallback to polling when WebSocket is disconnected
  // Use longer interval (30s) when connected, shorter (10s) when disconnected
  const {
    data: pollingDrivers,
    isLoading,
    error,
  } = useLiveLocations();

  // Handle driver location updates from WebSocket
  const handleLocationUpdate = useCallback((data: DriverLocationEvent) => {
    setRealtimeDrivers((prev) => {
      const updated = new Map(prev);
      updated.set(data.driverId, {
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
        isOnline: true,
        lastUpdate: new Date(data.timestamp),
      });
      return updated;
    });

    // Also update the React Query cache for consistency
    queryClient.invalidateQueries({ queryKey: ['live-locations'] });
  }, [queryClient]);

  // Handle driver presence updates from WebSocket
  const handlePresenceUpdate = useCallback((data: DriverPresenceEvent) => {
    setRealtimeDrivers((prev) => {
      const updated = new Map(prev);
      const existing = updated.get(data.driverId);

      if (existing) {
        updated.set(data.driverId, {
          ...existing,
          isOnDuty: data.isOnDuty,
          isOnline: data.isOnline,
          lastUpdate: new Date(data.timestamp),
        });
      } else if (data.isOnline) {
        // New driver came online
        updated.set(data.driverId, {
          driverId: data.driverId,
          driverName: data.driverName,
          latitude: 0,
          longitude: 0,
          isOnDuty: data.isOnDuty,
          isOnline: true,
          lastUpdate: new Date(data.timestamp),
        });
      }

      // Remove driver if they went offline
      if (!data.isOnline) {
        updated.delete(data.driverId);
      }

      return updated;
    });
  }, []);

  // Subscribe to WebSocket events
  useDriverLocationUpdates(handleLocationUpdate);
  useDriverPresenceUpdates(handlePresenceUpdate);

  // Sync polling data with realtime state when WebSocket is disconnected
  useEffect(() => {
    if (!isConnected && pollingDrivers) {
      const newMap = new Map<string, RealtimeDriverLocation>();
      pollingDrivers.forEach((driver: any) => {
        newMap.set(driver.id, {
          driverId: driver.id,
          driverName: driver.user?.name || 'Unknown',
          latitude: driver.lastLatitude || 0,
          longitude: driver.lastLongitude || 0,
          accuracy: driver.locationAccuracy,
          speed: driver.speed,
          heading: driver.heading,
          isMoving: driver.isMoving,
          batteryLevel: driver.batteryLevel,
          isOnDuty: driver.isOnDuty,
          isOnline: driver.isOnDuty, // Consider on-duty drivers as online
          lastUpdate: new Date(driver.lastLocationUpdate || Date.now()),
        });
      });
      setRealtimeDrivers(newMap);
    }
  }, [isConnected, pollingDrivers]);

  // Merge realtime and polling data
  const drivers = Array.from(realtimeDrivers.values());

  return {
    drivers,
    isLoading,
    error,
    isConnected,
    connectionStatus: status,
    // Helper to check if we're using real-time or polling
    isRealtime: isConnected,
  };
}

// Hook for getting a single driver's location in real-time
export function useDriverLocationRealtime(driverId: string) {
  const { drivers, isConnected, connectionStatus, isLoading, error } = useDriverLocationsRealtime();

  const driver = drivers.find((d) => d.driverId === driverId);

  return {
    driver,
    isLoading,
    error,
    isConnected,
    connectionStatus,
    isRealtime: isConnected,
  };
}
