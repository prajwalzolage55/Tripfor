// ─── SMS Module Public API ──────────────────────────────────────────────────

export type {
  TransactionDirection,
  ParsedSmsTransaction,
  MatchConfidenceLevel,
  TripMatchResult,
  BankSenderPattern,
} from './types';

export {
  BANK_SENDERS_WHITELIST,
  isBankSender,
  getBankInfo,
  calculateConfidence,
  parseBankSms,
  SAMPLE_BANK_SMSES,
} from './sms-parser';

export {
  fuzzyStringScore,
  matchTransactionToTrip,
} from './trip-matcher';
