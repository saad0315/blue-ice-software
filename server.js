/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3004', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Cookie name for auth (must match AUTH_COOKIE in constants)
const AUTH_COOKIE = 'jira-clone-session';

// Parse cookies from a cookie string
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;

  cookieString.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    cookies[name.trim()] = decodeURIComponent(rest.join('='));
  });

  return cookies;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3004',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Make io globally accessible for API routes
  global.io = io;

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[AUTH_COOKIE];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // We need to verify the token - import verifyToken dynamically
      // Since this is a JS file, we'll use dynamic import
      const { verifyToken } = await import('./src/lib/authenticate.ts');
      const user = await verifyToken(token);

      if (!user) {
        return next(new Error('Invalid or expired session'));
      }

      if (user.suspended || !user.isActive) {
        return next(new Error('Account is suspended or inactive'));
      }

      // Attach user data to socket
      socket.data.userId = user.id;
      socket.data.userName = user.name;
      socket.data.userRole = user.role;

      // For drivers, attach driver profile ID
      if (user.role === 'DRIVER') {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const driverProfile = await prisma.driverProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (driverProfile) {
          socket.data.driverId = driverProfile.id;
        }
        await prisma.$disconnect();
      }

      // For customers, attach customer profile ID
      if (user.role === 'CUSTOMER') {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const customerProfile = await prisma.customerProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (customerProfile) {
          socket.data.customerId = customerProfile.id;
        }
        await prisma.$disconnect();
      }

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Socket.IO connection handler
  io.on('connection', async (socket) => {
    const { userId, userName, userRole, driverId, customerId } = socket.data;
    console.log(`Socket connected: ${userName} (${userRole}) - ${socket.id}`);

    // Join role-based rooms
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'INVENTORY_MGR') {
      socket.join('admins');
      console.log(`${userName} joined admins room`);
    }

    if (userRole === 'DRIVER' && driverId) {
      socket.join('drivers');
      socket.join(`driver:${driverId}`);
      console.log(`${userName} joined drivers room`);

      // Set driver as online in Redis
      try {
        const { setDriverOnline, publishDriverPresence } = await import('./src/lib/redis.ts');
        await setDriverOnline(driverId);

        // Broadcast driver presence to admins
        await publishDriverPresence({
          driverId,
          driverName: userName,
          isOnline: true,
          isOnDuty: false, // Will be updated when they toggle duty
          timestamp: new Date(),
        });

        // Emit to admins room
        io.to('admins').emit('driver:presence', {
          driverId,
          driverName: userName,
          isOnline: true,
          isOnDuty: false,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error setting driver online:', error);
      }
    }

    if (userRole === 'CUSTOMER' && customerId) {
      socket.join(`customer:${customerId}`);
      console.log(`${userName} joined customer:${customerId} room`);
    }

    // Handle driver location updates
    socket.on('location:update', async (data) => {
      if (userRole !== 'DRIVER' || !driverId) {
        socket.emit('connection:error', { message: 'Only drivers can update location' });
        return;
      }

      try {
        const { cacheDriverLocation, publishDriverLocation, setDriverOnline } = await import('./src/lib/redis.ts');

        const locationData = {
          driverId,
          driverName: userName,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy,
          speed: data.speed,
          heading: data.heading,
          isMoving: data.isMoving,
          batteryLevel: data.batteryLevel,
          isOnDuty: data.isOnDuty ?? true,
          timestamp: new Date().toISOString(),
        };

        // Cache in Redis
        await cacheDriverLocation(locationData);

        // Keep driver online
        await setDriverOnline(driverId);

        // Publish to Redis channel (for multi-instance support)
        await publishDriverLocation(locationData);

        // Broadcast to admins
        io.to('admins').emit('driver:location', {
          ...locationData,
          timestamp: new Date(locationData.timestamp),
        });
      } catch (error) {
        console.error('Error handling location update:', error);
        socket.emit('connection:error', { message: 'Failed to update location' });
      }
    });

    // Handle duty toggle
    socket.on('duty:toggle', async (data) => {
      if (userRole !== 'DRIVER' || !driverId) {
        socket.emit('connection:error', { message: 'Only drivers can toggle duty status' });
        return;
      }

      try {
        const { publishDriverPresence } = await import('./src/lib/redis.ts');

        const presenceData = {
          driverId,
          driverName: userName,
          isOnline: true,
          isOnDuty: data.isOnDuty,
          timestamp: new Date(),
        };

        // Publish to Redis
        await publishDriverPresence(presenceData);

        // Broadcast to admins
        io.to('admins').emit('driver:presence', presenceData);
      } catch (error) {
        console.error('Error handling duty toggle:', error);
        socket.emit('connection:error', { message: 'Failed to toggle duty status' });
      }
    });

    // Handle room join requests
    socket.on('room:join', (room) => {
      // Validate room access
      if (room.startsWith('order:')) {
        // Anyone can join order rooms for now (could add validation)
        socket.join(room);
      } else if (room.startsWith('customer:') && room === `customer:${customerId}`) {
        // Customers can only join their own room
        socket.join(room);
      }
    });

    // Handle room leave requests
    socket.on('room:leave', (room) => {
      socket.leave(room);
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${userName} - ${reason}`);

      if (userRole === 'DRIVER' && driverId) {
        try {
          const { setDriverOffline, removeDriverLocation, publishDriverPresence } = await import('./src/lib/redis.ts');

          await setDriverOffline(driverId);
          await removeDriverLocation(driverId);

          // Broadcast driver offline to admins
          await publishDriverPresence({
            driverId,
            driverName: userName,
            isOnline: false,
            isOnDuty: false,
            timestamp: new Date(),
          });

          io.to('admins').emit('driver:presence', {
            driverId,
            driverName: userName,
            isOnline: false,
            isOnDuty: false,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error('Error handling driver disconnect:', error);
        }
      }
    });
  });

  // Set up Redis pub/sub for multi-instance communication
  setupRedisPubSub(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running`);
  });
});

// Redis pub/sub setup for multi-instance support
async function setupRedisPubSub(io) {
  try {
    const { getRedisSubscriber, CHANNELS } = await import('./src/lib/redis.ts');
    const subscriber = getRedisSubscriber();

    await subscriber.subscribe(CHANNELS.DRIVER_LOCATIONS, CHANNELS.ORDER_UPDATES, CHANNELS.DRIVER_PRESENCE);

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);

        switch (channel) {
          case CHANNELS.DRIVER_LOCATIONS:
            io.to('admins').emit('driver:location', data);
            break;

          case CHANNELS.ORDER_UPDATES:
            // Emit to admins
            io.to('admins').emit('order:status', data);
            // Emit to specific customer if they're connected
            if (data.customerId) {
              io.to(`customer:${data.customerId}`).emit('order:status', data);
            }
            break;

          case CHANNELS.DRIVER_PRESENCE:
            io.to('admins').emit('driver:presence', data);
            break;
        }
      } catch (error) {
        console.error('Error processing Redis message:', error);
      }
    });

    console.log('> Redis pub/sub initialized');
  } catch (error) {
    console.warn('> Redis pub/sub not available (Redis may not be running):', error.message);
    console.warn('> Real-time features will work within a single instance only');
  }
}
