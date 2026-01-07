'use client';

import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, Battery, CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useCurrent } from '@/features/auth/api/use-current';

import { useToggleDuty } from '../api/use-toggle-duty';
import { useUpdateLocation } from '../api/use-update-location';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  isMoving?: boolean;
  batteryLevel?: number;
}

export function DriverLocationTracker() {
  const { data: user } = useCurrent();
  const { mutate: updateLocation } = useUpdateLocation();
  const { mutate: toggleDuty, isPending: isTogglingDuty } = useToggleDuty();

  const [isTracking, setIsTracking] = useState(false);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get battery level if available
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));

        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }
  }, []);

  // Start/stop location tracking
  useEffect(() => {
    if (!isTracking || !isOnDuty) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    // Check if geolocation is supported
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      setIsTracking(false);
      return;
    }

    let lastPosition: GeolocationPosition | null = null;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Watch position with high accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
          batteryLevel: batteryLevel ?? undefined,
        };

        // Calculate if moving (speed > 1 km/h or position changed significantly)
        if (lastPosition) {
          const distance = calculateDistance(
            lastPosition.coords.latitude,
            lastPosition.coords.longitude,
            position.coords.latitude,
            position.coords.longitude,
          );

          locationData.isMoving = (position.coords.speed ?? 0) > 0.28 || distance > 10; // 0.28 m/s = 1 km/h
        }

        lastPosition = position;
        setCurrentLocation(locationData);
        setError(null);

        // Send update to server
        updateLocation(locationData, {
          onSuccess: () => {
            setLastUpdateTime(new Date());
          },
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError(error.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: isMobile,
        timeout: isMobile ? 10000 : 15000,
        maximumAge: 0,
      },
    );

    // Set up periodic updates every 30 seconds even if position hasn't changed
    updateIntervalRef.current = setInterval(() => {
      if (lastPosition) {
        const locationData: LocationData = {
          latitude: lastPosition.coords.latitude,
          longitude: lastPosition.coords.longitude,
          accuracy: lastPosition.coords.accuracy,
          speed: lastPosition.coords.speed ?? undefined,
          heading: lastPosition.coords.heading ?? undefined,
          isMoving: (lastPosition.coords.speed ?? 0) > 0.28,
          batteryLevel: batteryLevel ?? undefined,
        };

        updateLocation(locationData, {
          onSuccess: () => {
            setLastUpdateTime(new Date());
          },
        });
      }
    }, 30000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isTracking, isOnDuty, updateLocation, batteryLevel]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleToggleDuty = (checked: boolean) => {
    if (!user?.id) return;

    toggleDuty(
      { driverId: user.id, isOnDuty: checked },
      {
        onSuccess: () => {
          setIsOnDuty(checked);
          if (checked) {
            setIsTracking(true);
            toast.success('You are now on duty');
          } else {
            setIsTracking(false);
            toast.success('You are now off duty');
          }
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleStartTracking = () => {
    if (!isOnDuty) {
      toast.error('Please go on duty first');
      return;
    }
    setIsTracking(true);
    toast.success('Location tracking started');
  };

  const handleStopTracking = () => {
    setIsTracking(false);
    toast.success('Location tracking stopped');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Tracking
            </CardTitle>
            <CardDescription>Manage your duty status and location updates</CardDescription>
          </div>
          <Badge variant={isOnDuty ? 'default' : 'secondary'} className="text-sm">
            {isOnDuty ? 'On Duty' : 'Off Duty'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Duty Status Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="duty-status" className="text-base font-medium">
              Duty Status
            </Label>
            <p className="text-sm text-muted-foreground">Toggle your availability for deliveries</p>
          </div>
          <Switch id="duty-status" checked={isOnDuty} onCheckedChange={handleToggleDuty} disabled={isTogglingDuty} />
        </div>

        <Separator />

        {/* Tracking Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Tracking Status</h3>
            {isTracking ? (
              <Badge variant="default" className="gap-1">
                <Activity className="h-3 w-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                Inactive
              </Badge>
            )}
          </div>

          {!isOnDuty && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-500" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">Go on duty to start tracking</p>
                <p className="text-muted-foreground">Toggle the duty status switch above to begin</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Location Error</p>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          {isOnDuty && !isTracking && !error && (
            <Button onClick={handleStartTracking} className="w-full">
              <MapPin className="mr-2 h-4 w-4" />
              Start Location Tracking
            </Button>
          )}

          {isTracking && (
            <Button onClick={handleStopTracking} variant="outline" className="w-full">
              Stop Tracking
            </Button>
          )}
        </div>

        {/* Current Location Info */}
        {currentLocation && isTracking && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Current Location</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Coordinates */}
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Coordinates</p>
                    <p className="text-xs font-medium">
                      {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>

                {/* Accuracy */}
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <Navigation className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                    <p className="font-medium">±{Math.round(currentLocation.accuracy || 0)}m</p>
                  </div>
                </div>

                {/* Speed */}
                {currentLocation.speed !== undefined && (
                  <div className="flex items-start gap-2 rounded-lg border p-3">
                    <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Speed</p>
                      <p className="font-medium">{Math.round((currentLocation.speed || 0) * 3.6)} km/h</p>
                    </div>
                  </div>
                )}

                {/* Battery */}
                {batteryLevel !== null && (
                  <div className="flex items-start gap-2 rounded-lg border p-3">
                    <Battery className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Battery</p>
                      <p className="font-medium">{batteryLevel}%</p>
                    </div>
                  </div>
                )}

                {/* Last Update */}
                {lastUpdateTime && (
                  <div className="col-span-2 flex items-start gap-2 rounded-lg border p-3">
                    <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Last Update</p>
                      <p className="font-medium">{formatDistanceToNow(lastUpdateTime, { addSuffix: true })}</p>
                    </div>
                  </div>
                )}
              </div>

              {currentLocation.isMoving && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <p className="text-sm font-medium text-green-500">Vehicle in motion</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
