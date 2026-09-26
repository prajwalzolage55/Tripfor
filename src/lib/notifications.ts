import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export interface NotificationPayload {
  tripId: string;
  tripName: string;
  payerId: string;
  payerName: string;
  amount: number;
  note?: string | null;
}

/**
 * Register device for push notifications across Native (Capacitor) and Web.
 */
export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (!userId) return null;

  // 1. Native Mobile (Capacitor Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission denied by user.');
        return null;
      }

      // Create notification channel for Android (required for high priority sounds & heads-up alerts)
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'trip_expenses',
          name: 'Trip Expenses & Settlements',
          description: 'Instant alerts when members pay for trip expenses or debts',
          importance: 5, // High importance (heads-up notification + sound)
          visibility: 1,
          sound: 'default',
          vibration: true,
        });
      }

      return new Promise<string | null>((resolve) => {
        PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Native Push Registration Token:', token.value);
          await saveTokenToUserProfile(userId, token.value, 'native');
          resolve(token.value);
        });

        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on native push registration:', error);
          resolve(null);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push notification received in foreground:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          console.log('Push notification action performed:', notification);
          const data = notification.notification.data;
          if (data?.url && typeof window !== 'undefined') {
            window.location.href = data.url;
          }
        });

        PushNotifications.register();
      });
    } catch (err) {
      console.error('Failed to register native push notifications:', err);
      return null;
    }
  }

  // 2. Web Browser Fallback (Firebase Web Messaging)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const { getMessaging, getToken } = await import('firebase/messaging');
        const { app } = await import('./firebase');
        const messaging = getMessaging(app);

        const currentToken = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined,
        }).catch((err) => {
          console.warn('Could not retrieve Web FCM token (VAPID key may not be set):', err);
          return null;
        });

        if (currentToken) {
          await saveTokenToUserProfile(userId, currentToken, 'web');
          return currentToken;
        }
      }
    } catch (err) {
      console.warn('Web notification registration skipped or failed:', err);
    }
  }

  return null;
}

/**
 * Save device FCM token to user's Firestore profile
 */
export async function saveTokenToUserProfile(userId: string, token: string, platform: 'native' | 'web') {
  try {
    const userRef = doc(db, 'user_profiles', userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      await updateDoc(userRef, {
        fcm_token: token,
        fcm_tokens: arrayUnion(token),
        platform,
        last_token_update: new Date().toISOString()
      });
    } else {
      console.warn(`User profile ${userId} not yet created in Firestore.`);
    }
  } catch (err) {
    console.error('Error saving FCM token to user profile:', err);
  }
}

/**
 * Dispatches an expense notification to all members of the trip except the payer.
 * Writes to real-time Firestore notification collection and triggers push API.
 */
export async function dispatchExpenseNotification(payload: NotificationPayload) {
  const { tripId, tripName, payerId, payerName, amount, note } = payload;

  try {
    // 1. Fetch trip members to identify recipients
    const membersRef = collection(db, 'trip_members');
    const q = query(membersRef, where('trip_id', '==', tripId));
    const memberDocs = await getDocs(q);

    // Get all user IDs of trip members excluding the payer
    const recipientUserIds = memberDocs.docs
      .map(d => d.data().user_id)
      .filter((uid): uid is string => Boolean(uid && uid !== payerId));

    if (recipientUserIds.length === 0) {
      console.log('No other trip members to notify.');
      return;
    }

    const formattedAmount = `₹${Number(amount).toLocaleString('en-IN')}`;
    const description = note ? `for "${note}"` : 'for a trip expense';
    const title = `New Expense in ${tripName || 'Trip'} 💸`;
    const message = `${payerName} paid ${formattedAmount} ${description}.`;

    // 2. Record notification in Firestore for in-app feeds & triggers
    await addDoc(collection(db, 'trip_notifications'), {
      trip_id: tripId,
      trip_name: tripName,
      payer_id: payerId,
      payer_name: payerName,
      amount,
      note: note || null,
      title,
      message,
      recipient_user_ids: recipientUserIds,
      created_at: new Date().toISOString(),
      read_by: []
    });

    console.log(`[Push Notification] Recorded notification for ${recipientUserIds.length} trip members.`);
  } catch (err) {
    console.error('Failed to dispatch expense notification:', err);
  }
}
