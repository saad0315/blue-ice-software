import Redis from 'ioredis';

// Singleton Redis client
let redis: Redis | null = null;
let subscriber: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      // tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  return redis;
}

// Separate client for pub/sub (Redis requires dedicated connection for subscriptions)
export function getRedisSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    subscriber.on('error', (err) => {
      console.error('Redis Subscriber Error:', err);
    });
  }

  return subscriber;
}

// Driver location caching
export interface CachedDriverLocation {
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
  timestamp: string;
}

const DRIVER_LOCATIONS_KEY = 'driver:locations';
const DRIVER_ONLINE_PREFIX = 'driver:online:';
const LOCATION_TTL = 60; // 60 seconds
const PRESENCE_TTL = 90; // 90 seconds

export async function cacheDriverLocation(location: CachedDriverLocation): Promise<void> {
  const redis = getRedisClient();
  await redis.hset(DRIVER_LOCATIONS_KEY, location.driverId, JSON.stringify(location));
  await redis.expire(DRIVER_LOCATIONS_KEY, LOCATION_TTL);
}

export async function getDriverLocation(driverId: string): Promise<CachedDriverLocation | null> {
  const redis = getRedisClient();
  const data = await redis.hget(DRIVER_LOCATIONS_KEY, driverId);
  return data ? JSON.parse(data) : null;
}

export async function getAllDriverLocations(): Promise<CachedDriverLocation[]> {
  const redis = getRedisClient();
  const data = await redis.hgetall(DRIVER_LOCATIONS_KEY);
  return Object.values(data).map((item) => JSON.parse(item));
}

export async function removeDriverLocation(driverId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.hdel(DRIVER_LOCATIONS_KEY, driverId);
}

// Driver presence (online/offline status)
export async function setDriverOnline(driverId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.setex(`${DRIVER_ONLINE_PREFIX}${driverId}`, PRESENCE_TTL, '1');
}

export async function setDriverOffline(driverId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${DRIVER_ONLINE_PREFIX}${driverId}`);
}

export async function isDriverOnline(driverId: string): Promise<boolean> {
  const redis = getRedisClient();
  const result = await redis.get(`${DRIVER_ONLINE_PREFIX}${driverId}`);
  return result === '1';
}

export async function getOnlineDriverIds(): Promise<string[]> {
  const redis = getRedisClient();
  const keys = await redis.keys(`${DRIVER_ONLINE_PREFIX}*`);
  return keys.map((key) => key.replace(DRIVER_ONLINE_PREFIX, ''));
}

// Pub/Sub channels
export const CHANNELS = {
  DRIVER_LOCATIONS: 'driver-locations',
  ORDER_UPDATES: 'order-updates',
  DRIVER_PRESENCE: 'driver-presence',
} as const;

export async function publishDriverLocation(location: CachedDriverLocation): Promise<void> {
  const redis = getRedisClient();
  await redis.publish(CHANNELS.DRIVER_LOCATIONS, JSON.stringify(location));
}

export async function publishOrderUpdate(data: unknown): Promise<void> {
  const redis = getRedisClient();
  await redis.publish(CHANNELS.ORDER_UPDATES, JSON.stringify(data));
}

export async function publishDriverPresence(data: unknown): Promise<void> {
  const redis = getRedisClient();
  await redis.publish(CHANNELS.DRIVER_PRESENCE, JSON.stringify(data));
}

// Cleanup function for graceful shutdown
export async function closeRedisConnections(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}
