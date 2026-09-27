// ─── SMS Reader: Capacitor Native Bridge & Client ───────────────────────────
// Connects the Next.js web application to the Android SmsReaderPlugin with fallback

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { ParsedSmsTransaction, TripMatchResult } from './types';
import { parseBankSms, isBankSender } from './sms-parser';
import { matchTransactionToTrip } from './trip-matcher';
import type { TripState } from '../ledger';

/** Raw SMS message returned from the native plugin */
export interface RawSmsMessage {
  sender: string;
  body: string;
  timestamp: number;
  isBank?: boolean;
}

export interface SmsReaderPluginInterface {
  readBankSms(options?: { limit?: number }): Promise<{
    messages: RawSmsMessage[];
    count: number;
  }>;
  readAllSms(options?: { limit?: number }): Promise<{
    messages: RawSmsMessage[];
    count: number;
  }>;
  checkPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' }>;
  requestPermissions(): Promise<{ sms: 'granted' | 'denied' | 'prompt' }>;
  isSupported(): Promise<{ supported: boolean; platform: string }>;
  addListener(
    eventName: 'smsReceived',
    listenerFunc: (data: { sender: string; body: string; timestamp: number }) => void
  ): Promise<PluginListenerHandle>;
}

// Register native plugin
export const SmsReader = registerPlugin<SmsReaderPluginInterface>('SmsReader');

/**
 * Checks if running on a native Android device with SMS reader capability.
 */
export async function isNativeSmsSupported(): Promise<boolean> {
  try {
    const res = await SmsReader.isSupported();
    return !!res.supported;
  } catch {
    return false;
  }
}

/**
 * Reads bank SMS messages from the device inbox (if on Android) or returns empty list for fallback.
 */
export async function readDeviceBankSms(limit: number = 50): Promise<ParsedSmsTransaction[]> {
  try {
    // Check/request permissions
    const perm = await SmsReader.checkPermissions();
    if (perm.sms !== 'granted') {
      const requested = await SmsReader.requestPermissions();
      if (requested.sms !== 'granted') {
        throw new Error('READ_SMS permission was denied by the user.');
      }
    }

    const { messages } = await SmsReader.readBankSms({ limit });
    const parsedTransactions: ParsedSmsTransaction[] = [];

    for (const msg of messages) {
      if (isBankSender(msg.sender)) {
        const parsed = parseBankSms(msg.body, msg.sender, msg.timestamp);
        if (parsed && parsed.confidence >= 0.4) {
          parsedTransactions.push(parsed);
        }
      }
    }

    return parsedTransactions;
  } catch (err) {
    console.warn('Native SMS inbox read unavailable, using web fallback mode:', err);
    return [];
  }
}

/**
 * Reads ALL SMS messages from the device inbox (not just bank SMS).
 * Returns raw messages with sender, body, timestamp, and whether the sender is a known bank.
 * Throws on permission denial so the UI can show a proper error.
 */
export async function readAllDeviceSms(limit: number = 200): Promise<RawSmsMessage[]> {
  // Check/request permissions
  const perm = await SmsReader.checkPermissions();
  if (perm.sms !== 'granted') {
    const requested = await SmsReader.requestPermissions();
    if (requested.sms !== 'granted') {
      throw new Error('READ_SMS permission was denied by the user. Please grant SMS permission in Settings.');
    }
  }

  const { messages } = await SmsReader.readAllSms({ limit });
  return messages;
}

/**
 * Scans SMS messages and matches them against the active trip events.
 */
export function matchSmsListToTrip(
  transactions: ParsedSmsTransaction[],
  state: TripState
): TripMatchResult[] {
  return transactions.map(tx => matchTransactionToTrip(tx, state));
}

