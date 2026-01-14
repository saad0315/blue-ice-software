import * as admin from 'firebase-admin';

import { db } from './db';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.warn('Firebase Admin Init Failed (Expected in Test/Dev if credentials missing):', error);
  }
}

export const sendPushNotification = async (userIds: string[], title: string, body: string, data?: Record<string, string>) => {
  try {
    // 1. Save to Database (In-App History)
    // Casting db to any to avoid type check failure before client generation
    const prisma = db as any;

    await prisma.$transaction(
      userIds.map((userId: string) =>
        prisma.notification.create({
          data: {
            userId,
            title,
            body,
            data: data || {},
            type: data?.type || 'GENERAL',
          },
        }),
      ),
    );

    // 2. Send FCM Push
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { fcmTokens: true },
    });

    const tokens = users.flatMap((user) => user.fcmTokens || []);

    if (tokens.length === 0) {
      console.log('No FCM tokens found for users, but saved to DB');
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'OPEN_TASK',
      },
      tokens,
    };

    try {
      await admin.messaging().sendEachForMulticast(message);
    } catch (fcmError) {
      console.error('FCM Send Error (DB saved ok):', fcmError);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
