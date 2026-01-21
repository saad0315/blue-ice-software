
import { PrismaClient, User, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// 1. Create a variable that will hold the mock
let prismaMock: ReturnType<typeof mockDeep<PrismaClient>>;

// 3. Use `vi.hoisted` to create the container
const prismaMockContainer = vi.hoisted(() => {
    return {
        prisma: {
            user: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                create: vi.fn(),
            },
        }
    };
});

// 2. Mock the module.
vi.mock('@prisma/client', () => {
    return {
        PrismaClient: class {
            constructor() {
                return prismaMockContainer.prisma;
            }
        },
        UserRole: {
            ADMIN: 'ADMIN',
            CUSTOMER: 'CUSTOMER',
            DRIVER: 'DRIVER',
            SUPER_ADMIN: 'SUPER_ADMIN',
        },
    }
});


// 4. Import SUT
import { authenticateUser, generateToken, hashPassword, verifyPassword, verifyToken } from './authenticate';

// Mock process.env
process.env.JWT_SECRET = 'test-secret';

describe('Authentication Logic', () => {
  beforeEach(() => {
    // Reset the mocks inside the container
    vi.clearAllMocks();

    // Assign typings for easier usage in tests
    prismaMock = prismaMockContainer.prisma as any;
  });

  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');
    });

    it('should verify a correct password', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Token Generation & Verification', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CUSTOMER' as UserRole,
    };

    it('should generate a valid JWT', () => {
      const token = generateToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should verify a valid token and return user', async () => {
      const token = generateToken(mockUser);

      // Mock DB finding user
      (prismaMock.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        password: 'hashedpassword',
        passwordChangedAt: null,
      });

      const user = await verifyToken(token);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(mockUser.id);
    });

    it('should return null for invalid token', async () => {
      const user = await verifyToken('invalid-token');
      expect(user).toBeNull();
    });

    it('should invalidate token if password changed after issue', async () => {
      const token = generateToken(mockUser);

      // Verify immediate works
      (prismaMock.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        password: 'hashedpassword',
        passwordChangedAt: new Date(Date.now() + 10000),
      });

      const user = await verifyToken(token);
      expect(user).toBeNull();
    });
  });

  describe('User Authentication', () => {
    const mockUserInDb = {
      id: 'user-123',
      email: 'test@example.com',
      phoneNumber: '1234567890',
      password: '', // Will fill in test
      role: 'CUSTOMER',
    };

    it('should authenticate with valid email and password', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      (prismaMock.user.findFirst as any).mockResolvedValue({
        ...mockUserInDb,
        password: hash,
      });

      const user = await authenticateUser('test@example.com', password);
      expect(user.id).toBe(mockUserInDb.id);
    });

    it('should authenticate with valid phone and password', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      (prismaMock.user.findFirst as any).mockResolvedValue({
        ...mockUserInDb,
        password: hash,
      });

      const user = await authenticateUser('1234567890', password);
      expect(user.id).toBe(mockUserInDb.id);
    });

    it('should fail with incorrect password', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      (prismaMock.user.findFirst as any).mockResolvedValue({
        ...mockUserInDb,
        password: hash,
      });

      await expect(authenticateUser('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('should fail if user not found', async () => {
      (prismaMock.user.findFirst as any).mockResolvedValue(null);
      await expect(authenticateUser('nonexistent@example.com', 'password')).rejects.toThrow('Invalid credentials');
    });
  });
});
