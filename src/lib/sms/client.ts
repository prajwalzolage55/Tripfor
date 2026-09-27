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
  readAllSms(options?: { limit?: number; bankOnly?: boolean }): Promise<{
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

// ─── Transaction SMS detection (body content based) ──────────────────────────
const AMOUNT_RE = /(?:(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d{1,2})?)|(?:(?:debited|credited|spent|withdrawn|paid|received|deposited|transfer(?:red)?\s+of)\s+(?:by|for|with|of)?\s*(?:Rs\.?|INR|₹)?\s*[\d,]+(?:\.\d{1,2})?)/i;

const OTP_OR_SPAM_RE = /\b(?:otp|one\s*time\s*password|verification\s*code|secret\s*code|security\s*code|pre-?approved|apply\s*now|instant\s*loan|win\s+up\s+to|congratulations)\b/i;

const TX_KEYWORDS = [
  'debited', 'credited', 'debit', 'credit',
  'withdrawn', 'deposited', 'transferred',
  'spent', 'received', 'paid',
  'transaction', 'txn', 'sent rs', 'received rs',
  'refund', 'cashback'
];

const FINANCIAL_CONTEXT_KEYWORDS = [
  'a/c', 'acct', 'account', 'card',
  'upi', 'neft', 'imps', 'rtgs', 'vpa',
  'ref no', 'ref:', 'utr', 'txn ref',
  'bal', 'balance', 'avl bal', 'avail bal', 'available bal',
  'atm', 'pos', 'ecom', 'mandate', 'autopay'
];

/**
 * Detects if an SMS body contains bank/financial transaction content.
 * Filters out OTPs and promotional loan messages.
 */
export function isTransactionSms(body: string): boolean {
  if (!body || !body.trim()) return false;
  const lower = body.toLowerCase();

  // Reject OTP and loan spam
  if (OTP_OR_SPAM_RE.test(lower)) return false;

  // Must match amount
  if (!AMOUNT_RE.test(body)) return false;

  // Must have transaction keyword
  const hasTx = TX_KEYWORDS.some(kw => lower.includes(kw));
  if (!hasTx) return false;

  // Must have financial context
  const hasContext = FINANCIAL_CONTEXT_KEYWORDS.some(ctx => lower.includes(ctx));
  return hasContext;
}

/**
 * Returns true if an SMS is a bank/transaction message (by sender OR body content).
 */
export function isBankOrTransactionSms(sender: string, body: string): boolean {
  if (!body || !body.trim()) return false;
  const lower = body.toLowerCase();

  if (OTP_OR_SPAM_RE.test(lower)) return false;
  if (isTransactionSms(body)) return true;
  if (isBankSender(sender) && AMOUNT_RE.test(body)) return true;

  return false;
}

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
      if (msg.isBank || isBankOrTransactionSms(msg.sender, msg.body)) {
        const parsed = parseBankSms(msg.body, msg.sender, msg.timestamp);
        if (parsed && parsed.confidence >= 0.3) {
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
 * Reads SMS messages from the device inbox.
 * Defaults to bankOnly = true so only genuine bank/transaction SMS are retrieved.
 */
export async function readAllDeviceSms(
  limit: number = 500,
  bankOnly: boolean = true
): Promise<RawSmsMessage[]> {
  // Check/request permissions
  const perm = await SmsReader.checkPermissions();
  if (perm.sms !== 'granted') {
    const requested = await SmsReader.requestPermissions();
    if (requested.sms !== 'granted') {
      throw new Error('READ_SMS permission was denied by the user. Please grant SMS permission in Settings.');
    }
  }

  const { messages } = await SmsReader.readAllSms({ limit, bankOnly });

  // Secondary TypeScript-side verification
  if (bankOnly) {
    return (messages || []).filter(m => m.isBank || isBankOrTransactionSms(m.sender, m.body));
  }

  return (messages || []).map(m => ({
    ...m,
    isBank: m.isBank || isBankOrTransactionSms(m.sender, m.body),
  }));
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
