// ─── SMS Reader: Type Definitions ──────────────────────────────────────────
// On-device Indian Bank Transaction SMS Parser & Trip Matcher Types

export type TransactionDirection = 'DEBIT' | 'CREDIT';

export interface ParsedSmsTransaction {
  id: string;
  amount: number;
  direction: TransactionDirection;
  accountLast4?: string;
  merchant?: string;
  upiRef?: string;
  timestamp: number;
  sender: string;
  rawSms: string;
  confidence: number; // 0.0 to 1.0
  parsedAt: string;
}

export type MatchConfidenceLevel = 'exact' | 'high' | 'medium' | 'unmatched';

export interface TripMatchResult {
  transaction: ParsedSmsTransaction;
  matchedBookingId?: string;
  matchedBookingLabel?: string;
  matchedVendor?: string;
  confidenceLevel: MatchConfidenceLevel;
  confidenceScore: number; // 0.0 to 1.0
  promptText: string;
  needsConfirmation: boolean;
  autoConfirmed: boolean;
}

export interface BankSenderPattern {
  code: string;
  name: string;
  category: 'public' | 'private' | 'small_finance' | 'payments' | 'wallet_upi';
}
