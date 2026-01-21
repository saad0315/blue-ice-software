// import { zValidator } from '@hono/zod-validator';
// import { Hono } from 'hono';
// import { deleteCookie, setCookie } from 'hono/cookie';
// import { ID } from 'node-appwrite';
// import { z } from 'zod';
// import { AUTH_COOKIE } from '@/features/auth/constants';
// import { signInFormSchema, signUpFormSchema } from '@/features/auth/schema';
// import { createAdminClient } from '@/lib/appwrite';
// import { sessionMiddleware } from '@/lib/session-middleware';
// const app = new Hono()
//   .get(
//     '/',
//     zValidator(
//       'query',
//       z.object({
//         userId: z.string().trim().min(1),
//         secret: z.string().trim().min(1),
//       }),
//     ),
//     async (ctx) => {
//       const { userId, secret } = ctx.req.valid('query');
//       const { account } = await createAdminClient();
//       const session = await account.createSession(userId, secret);
//       setCookie(ctx, AUTH_COOKIE, session.secret, {
//         path: '/',
//         httpOnly: true,
//         secure: true,
//         sameSite: 'strict',
//         maxAge: 60 * 60 * 24 * 30,
//       });
//       return ctx.redirect(process.env.NEXT_PUBLIC_APP_BASE_URL);
//     },
//   )
//   .get('/current', sessionMiddleware, (ctx) => {
//     const user = ctx.get('user');
//     return ctx.json({ data: user });
//   })
//   .post('/login', zValidator('json', signInFormSchema), async (ctx) => {
//     const { email, password } = ctx.req.valid('json');
//     const { account } = await createAdminClient();
//     const session = await account.createEmailPasswordSession(email, password);
//     setCookie(ctx, AUTH_COOKIE, session.secret, {
//       path: '/',
//       httpOnly: true,
//       secure: true,
//       sameSite: 'strict',
//       maxAge: 60 * 60 * 24 * 30,
//     });
//     return ctx.json({ success: true });
//   })
//   .post('/register', zValidator('json', signUpFormSchema), async (ctx) => {
//     const { name, email, password } = ctx.req.valid('json');
//     const { account } = await createAdminClient();
//     await account.create(ID.unique(), email, password, name);
//     const session = await account.createEmailPasswordSession(email, password);
//     setCookie(ctx, AUTH_COOKIE, session.secret, {
//       path: '/',
//       httpOnly: true,
//       secure: true,
//       sameSite: 'strict',
//       maxAge: 60 * 60 * 24 * 30,
//     });
//     return ctx.json({ success: true });
//   })
//   .post('/logout', sessionMiddleware, async (ctx) => {
//     const account = ctx.get('account');
//     deleteCookie(ctx, AUTH_COOKIE);
//     await account.deleteSession('current');
//     return ctx.json({ success: true });
//   });
// export default app;
import { zValidator } from '@hono/zod-validator';
import { Prisma, UserRole } from '@prisma/client';
import crypto from 'crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { AUTH_COOKIE } from '@/features/auth/constants';
import { resetPasswordSchema, signInFormSchema, signUpFormSchema, updateProfileSchema } from '@/features/auth/schema';
import { authenticateUser, createUser, generateToken, hashPassword, verifyToken } from '@/lib/authenticate';
import { db } from '@/lib/db';
import { authRateLimiter } from '@/lib/rate-limiter';
import { sendMail } from '@/lib/send-mail';
import { sessionMiddleware } from '@/lib/session-middleware';
import { deleteFile, uploadFile } from '@/lib/upload';

const app = new Hono()
  .get('/current', async (ctx) => {
    const session = getCookie(ctx, AUTH_COOKIE); // Use ctx.cookie, not ctx.req.cookie
    if (!session) {
      return ctx.json({ data: null });
    }

    const user = await verifyToken(session);
    if (!user) {
      deleteCookie(ctx, AUTH_COOKIE);
      return ctx.json({ data: null });
    }

    return ctx.json({ data: user });
  })
  .post('/login', authRateLimiter, zValidator('json', signInFormSchema), async (ctx) => {
    const { emailOrPhone, password } = ctx.req.valid('json');

    try {
      const user = await authenticateUser(emailOrPhone, password);
      // 🔒 Check if suspended
      if (user.suspended) {
        return ctx.json({ error: 'Your account has been suspended' }, 403);
      }
      // 🔒 Check if account is active
      if (!user.isActive) {
        return ctx.json({ error: 'Your account has been deactivated' }, 403);
      }
      const token = generateToken(user);

      setCookie(ctx, AUTH_COOKIE, token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return ctx.json({ data: user });
    } catch (error) {
      return ctx.json({ error: 'Invalid credentials' }, 401);
    }
  })
  .post('/register', authRateLimiter, zValidator('json', signUpFormSchema), async (ctx) => {
    const { name, email, phoneNumber, password, role } = ctx.req.valid('json');
    try {
      const user = await createUser(name, email ?? null, phoneNumber, password, role);
      const token = generateToken(user);

      setCookie(ctx, AUTH_COOKIE, token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return ctx.json({ data: user });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          return ctx.json({ error: 'Email already exists' }, 400);
        }
        if (target.includes('phoneNumber')) {
          return ctx.json({ error: 'Phone number already exists' }, 400);
        }
        return ctx.json({ error: 'User already exists' }, 400);
      }
      return ctx.json({ error: 'Something went wrong' }, 500);
    }
  })
  .get(
    '/users',
    sessionMiddleware,
    zValidator(
      'query',
      z.object({
        search: z.string().nullish(),
        suspended: z.string().optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
      }),
    ),
    async (ctx) => {
      const { search, suspended, page, limit } = ctx.req.valid('query');

      const pageNumber = parseInt(page || '1');
      const limitNumber = parseInt(limit || '10');
      const skip = (pageNumber - 1) * limitNumber;

      try {
        const where: Prisma.UserWhereInput = {
          AND: [
            search
              ? {
                  OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }],
                }
              : {},
            suspended !== undefined ? { suspended: suspended === 'true' } : {},
          ],
        };

        const [users, totalCount] = await Promise.all([
          db.user.findMany({
            where,
            skip,
            take: limitNumber,
            orderBy: { createdAt: 'desc' },
          }),
          db.user.count({ where }),
        ]);

        return ctx.json({
          data: users,
          pagination: {
            total: totalCount,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(totalCount / limitNumber),
          },
        });
      } catch (error) {
        console.error('[GET_USERS]:', error);
        return ctx.json({ error: 'Internal Server Error' }, 500);
      }
    },
  )
  .post('/token', zValidator('json', z.object({ token: z.string().min(10) })), async (ctx) => {
    const { token } = ctx.req.valid('json');

    const authCookie = getCookie(ctx, AUTH_COOKIE);
    if (!authCookie) return ctx.json({ error: 'Unauthorized cookie' }, 401);

    const user = await verifyToken(authCookie);
    if (!user) return ctx.json({ error: 'Unauthorized token' }, 401);

    const existingUser = await db.user.findUnique({
      where: { id: user.id },
      select: { fcmTokens: true },
    });

    if (!existingUser) return ctx.json({ error: 'User not found' }, 404);

    // Only add token if it doesn't already exist
    if (!existingUser.fcmTokens.includes(token)) {
      await db.user.update({
        where: { id: user.id },
        data: {
          fcmTokens: {
            push: token,
          },
        },
      });
    }

    return ctx.json({
      data: token,
    });
  })
  .patch('/profile', sessionMiddleware, zValidator('form', updateProfileSchema), async (ctx) => {
    const user = ctx.get('user'); // set by sessionMiddleware
    const { name, image, phoneNumber, birthDate, gender, designation } = ctx.req.valid('form');

    const userData = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!userData) {
      return ctx.json({ error: 'User not found' }, 404);
    }

    let uploadedImageId: string | undefined = userData.imageUrl ?? undefined;

    if (image instanceof File) {
      uploadedImageId = await uploadFile(image, 'users');
      if (userData.imageUrl) {
        await deleteFile(userData.imageUrl);
      }
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        name,
        imageUrl: uploadedImageId,
        phoneNumber,
        birthDate,
        designation,
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        phoneNumber: true,
        birthDate: true,
        designation: true,
      },
    });

    return ctx.json({ data: updatedUser });
  })
  .patch(
    '/:userId',
    sessionMiddleware,
    zValidator(
      'json',
      z.object({
        suspended: z.boolean().optional(),
        role: z.nativeEnum(UserRole).optional(),
      }),
    ),
    async (ctx) => {
      const user = ctx.get('user');
      const { suspended, role } = ctx.req.valid('json');

      const { userId } = ctx.req.param();

      // Authorization Logic
      if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        // SUPER_ADMIN and ADMIN can update roles and status
      } else {
        // Others cannot access this endpoint
        return ctx.json({ error: 'Unauthorized access' }, 403);
      }

      try {
        const updatedUser = await db.user.update({
          where: { id: userId },
          data: {
            ...(suspended !== undefined && { suspended }),
            ...(role !== undefined && { role }),
          },
          select: {
            id: true,
            name: true,
            suspended: true,
            role: true,
          },
        });

        return ctx.json({ data: updatedUser });
      } catch (error) {
        return ctx.json({ error: 'Failed to update user' }, 500);
      }
    },
  )
  .post('/logout', (ctx) => {
    deleteCookie(ctx, AUTH_COOKIE);
    return ctx.json({ success: true });
  })
  .post(
    '/forgot',
    authRateLimiter,
    zValidator(
      'json',
      z.object({
        email: z.string().email(),
      }),
    ),
    async (ctx) => {
      const { email } = ctx.req.valid('json');
      try {
        // Find user by email
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          return ctx.json({ error: "User doesn't exist" }, 404);
        }
        if (user.suspended) {
          return ctx.json({ error: 'This User Has been Suspended' });
        }

        // Generate reset token (similar to your Express implementation)
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set token expiry (30 minutes from now)
        const resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);

        // Update user with reset token info
        await db.user.update({
          where: { id: user.id },
          data: {
            resetPasswordToken,
            resetPasswordExpire,
          },
        });

        // Create reset URL
        const resetUrl = `${ctx.req.header('x-forwarded-proto') || 'http'}://${ctx.req.header('host')}/password/reset/${resetToken}`;

        // Prepare email message
        const message = `Your password reset token is:- \n\n ${resetUrl} \n\nIf you have not requested this email then, please ignore it`;

        // Send email
        await sendMail({
          email: process.env.SMTP_SERVER_USERNAME || '',
          sendTo: email,
          subject: 'Password Recovery',
          text: message,
        });

        return ctx.json({
          success: true,
          message: `Email sent to ${user.email} successfully`,
        });
      } catch (error) {
        // If email sending fails, clear the reset token
        if (email) {
          await db.user.update({
            where: { email },
            data: {
              resetPasswordToken: null,
              resetPasswordExpire: null,
            },
          });
        }

        console.error('[FORGOT_PASSWORD]:', error);
        return ctx.json({ error: 'Failed to send password reset email' }, 500);
      }
    },
  )
  .post('/reset/:resetToken', authRateLimiter, zValidator('json', resetPasswordSchema), async (ctx) => {
    const { password, confirmPassword } = ctx.req.valid('json');
    // const { resetToken } = ctx.req.param();
    const { resetToken } = ctx.req.param() as { resetToken: string };

    // Validate password match
    if (password !== confirmPassword) {
      return ctx.json({ error: 'Password and confirm password do not match' }, 400);
    }

    try {
      // Hash the token to compare with stored token
      const resetPasswordToken: string = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Find user with valid token
      const user = await db.user.findFirst({
        where: {
          resetPasswordToken,
          resetPasswordExpire: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return ctx.json(
          {
            error: 'Reset password token is invalid or has expired',
          },
          400,
        );
      }

      const hashedPassword = await hashPassword(password);
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpire: null,
          passwordChangedAt: new Date(), // Invalidate all existing JWT tokens
        },
      });

      // Generate JWT token for the user
      const token = generateToken(updatedUser);

      setCookie(ctx, AUTH_COOKIE, token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return ctx.json({ data: updatedUser });
    } catch (error) {
      console.error('[RESET_PASSWORD]:', error);
      return ctx.json({ error: 'Failed to reset password' }, 500);
    }
  });

export default app;
