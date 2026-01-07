'use client';

import { Loader2, Radio, Wifi, WifiOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useDriverLocationsRealtime } from '../hooks/use-driver-locations-realtime';
import { DriverSidebar } from './driver-sidebar';

interface LiveMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  showSidebar?: boolean;
}

const LiveMapCore = dynamic(() => import('./live-map-core'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border bg-muted/20">
      <Skeleton className="h-full w-full" />
    </div>
  ),
});

// Connection status indicator component
function ConnectionStatus({ isConnected, isRealtime }: { isConnected: boolean; isRealtime: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="absolute right-2 top-2 z-[1000] gap-1.5">
            {isConnected ? (
              <>
                <Radio className="h-3 w-3 animate-pulse" />
                Real-time
              </>
            ) : isRealtime ? (
              <>
                <WifiOff className="h-3 w-3" />
                Reconnecting...
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" />
                Polling
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="left">
          {isConnected
            ? 'Connected via WebSocket - Receiving real-time updates'
            : 'Using polling fallback - Updates every 10 seconds'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LiveMap({ showSidebar = true, ...mapProps }: LiveMapProps) {
  const { drivers, isLoading, error, isConnected, isRealtime } = useDriverLocationsRealtime();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [fitAllTrigger, setFitAllTrigger] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Transform realtime drivers to the format expected by LiveMapCore
  const mappedDrivers = drivers.map((driver) => ({
    driverId: driver.driverId,
    name: driver.driverName,
    phoneNumber: '', // Not available in realtime data
    imageUrl: null, // Not available in realtime data
    vehicleNo: null, // Not available in realtime data
    latitude: driver.latitude,
    longitude: driver.longitude,
    lastUpdate: driver.lastUpdate?.toISOString() || null,
    isOnDuty: driver.isOnDuty,
    isMoving: driver.isMoving,
    batteryLevel: driver.batteryLevel,
    speed: driver.speed,
    currentOrder: null, // Will be populated from polling data if needed
  }));

  const handleDriverSelect = (driver: { driverId: string }) => {
    setSelectedDriverId(driver.driverId);
  };

  const handleFitAllDrivers = () => {
    setFitAllTrigger((prev) => prev + 1);
    setSelectedDriverId(null);
  };

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-destructive bg-destructive/10"
        style={{ height: mapProps.height || '600px' }}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">Failed to load live locations</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading && drivers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-muted/20" style={{ height: mapProps.height || '600px' }}>
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading live locations...</p>
        </div>
      </div>
    );
  }

  if (!showSidebar) {
    return (
      <div className="relative h-full w-full">
        <ConnectionStatus isConnected={isConnected} isRealtime={isRealtime} />
        <LiveMapCore
          {...mapProps}
          drivers={mappedDrivers}
          selectedDriverId={selectedDriverId}
          onDriverSelect={setSelectedDriverId}
          fitAllTrigger={fitAllTrigger}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full gap-0">
      {/* Driver Sidebar */}
      <DriverSidebar
        drivers={mappedDrivers as any}
        selectedDriverId={selectedDriverId}
        onDriverSelect={handleDriverSelect}
        onFitAllDrivers={handleFitAllDrivers}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Map */}
      <div className="relative flex-1">
        <ConnectionStatus isConnected={isConnected} isRealtime={isRealtime} />
        <LiveMapCore
          {...mapProps}
          drivers={mappedDrivers}
          selectedDriverId={selectedDriverId}
          onDriverSelect={setSelectedDriverId}
          fitAllTrigger={fitAllTrigger}
        />
      </div>
    </div>
  );
}
