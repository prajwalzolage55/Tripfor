// ─── SMS Reader: Bank Sender ID Filter & Regex Parser ───────────────────────
// Implements TRAI DLT whitelist and multi-bank regex extractor

import type { ParsedSmsTransaction, TransactionDirection, BankSenderPattern } from './types';

// ─── TRAI DLT Bank Sender Whitelist (Part 3 Spec) ───────────────────────────
// Formats: XX-BANKCD (e.g. VM-HDFCBK, AD-SBIINB, AX-ICICIB)

export const BANK_SENDERS_WHITELIST: BankSenderPattern[] = [
  // Public Sector Banks
  { code: 'SBIINB', name: 'State Bank of India', category: 'public' },
  { code: 'SBISMS', name: 'State Bank of India', category: 'public' },
  { code: 'UNIONB', name: 'Union Bank of India', category: 'public' },
  { code: 'PNBSMS', name: 'Punjab National Bank', category: 'public' },
  { code: 'BOBIBD', name: 'Bank of Baroda', category: 'public' },
  { code: 'CANBNK', name: 'Canara Bank', category: 'public' },
  { code: 'INDBNK', name: 'Indian Bank', category: 'public' },
  { code: 'CENTBK', name: 'Central Bank of India', category: 'public' },
  { code: 'ANDHBK', name: 'Andhra Bank', category: 'public' },
  { code: 'ALLBKS', name: 'Allahabad Bank', category: 'public' },
  { code: 'SYNBNK', name: 'Syndicate Bank', category: 'public' },
  { code: 'UCOBNK', name: 'UCO Bank', category: 'public' },
  // Private Sector Banks
  { code: 'HDFCBK', name: 'HDFC Bank', category: 'private' },
  { code: 'ICICIB', name: 'ICICI Bank', category: 'private' },
  { code: 'AXISBK', name: 'Axis Bank', category: 'private' },
  { code: 'YESBNK', name: 'Yes Bank', category: 'private' },
  { code: 'INDUSB', name: 'IndusInd Bank', category: 'private' },
  { code: 'KOTKBK', name: 'Kotak Mahindra Bank', category: 'private' },
  { code: 'RBLBNK', name: 'RBL Bank', category: 'private' },
  { code: 'IDBIBK', name: 'IDBI Bank', category: 'private' },
  { code: 'FEDBKS', name: 'Federal Bank', category: 'private' },
  { code: 'CSFBNK', name: 'CSB Bank', category: 'private' },
  { code: 'AUSFBN', name: 'AU Small Finance Bank', category: 'private' },
  { code: 'DCBBNK', name: 'DCB Bank', category: 'private' },
  // Small Finance Banks
  { code: 'UJJIVN', name: 'Ujjivan Small Finance Bank', category: 'small_finance' },
  { code: 'EQUTAS', name: 'Equitas Small Finance Bank', category: 'small_finance' },
  { code: 'SURYOD', name: 'Suryoday Small Finance Bank', category: 'small_finance' },
  { code: 'FINCAR', name: 'Fincare Small Finance Bank', category: 'small_finance' },
  // Payments Banks
  { code: 'AIRBNK', name: 'Airtel Payments Bank', category: 'payments' },
  { code: 'PAYTMB', name: 'Paytm Payments Bank', category: 'payments' },
  { code: 'INDPBK', name: 'India Post Payments Bank', category: 'payments' },
  { code: 'FINOBN', name: 'Fino Payments Bank', category: 'payments' },
  // Wallets / UPI Providers
  { code: 'PAYTMW', name: 'Paytm Wallet', category: 'wallet_upi' },
  { code: 'PHONEPE', name: 'PhonePe', category: 'wallet_upi' },
  { code: 'GPAYMS', name: 'Google Pay', category: 'wallet_upi' },
  { code: 'CREDAP', name: 'CRED', category: 'wallet_upi' },
  { code: 'AMZPAY', name: 'Amazon Pay', category: 'wallet_upi' },
];

/**
 * Checks whether the incoming sender address belongs to a registered Indian bank/financial institution.
 * Strips 2-letter TRAI prefix (e.g. VM-, AD-, AX-, BZ-, etc.)
 */
export function isBankSender(sender: string): boolean {
  if (!sender) return false;
  // Strip 2-letter prefix if present (e.g. "VM-HDFCBK" -> "HDFCBK")
  const normalized = sender.trim().replace(/^[A-Za-z]{2}-/, '').toUpperCase();
  return BANK_SENDERS_WHITELIST.some(b => normalized.includes(b.code));
}

export function getBankInfo(sender: string): BankSenderPattern | undefined {
  if (!sender) return undefined;
  const normalized = sender.trim().replace(/^[A-Za-z]{2}-/, '').toUpperCase();
  return BANK_SENDERS_WHITELIST.find(b => normalized.includes(b.code));
}

// ─── Layer 1 Regex Parser (Part 4 Spec) ─────────────────────────────────────

const AMOUNT_REGEX = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DIRECTION_REGEX = /\b(debited|credited|debit|credit|withdrawn|received|spent|paid)\b/i;
const ACCOUNT_REGEX = /(?:A\/c|Acct|account|card)[\s\w]*?(?:XX+|\*+)(\d{4})/i;
const UPI_REF_REGEX = /(?:UPI[\/\s]Ref|Ref No|UTR|Ref)[\s:]*(\d{8,20})/i;
const MERCHANT_REGEX = /(?:to|at|via)\s+([A-Z0-9][A-Za-z0-9\s&.'\-]{2,35})(?:\s+on|\s+via|\s+Ref|\.|\s*$)/i;

/**
 * Calculates a confidence score (0.0 to 1.0) based on extracted fields.
 */
export function calculateConfidence(
  amount: number | null,
  direction: TransactionDirection | null,
  account: string | null,
  upiRef: string | null,
  merchant: string | null
): number {
  let score = 0;
  if (amount !== null && amount > 0) score += 0.4;
  if (direction !== null) score += 0.2;
  if (account !== null) score += 0.2;
  if (upiRef !== null) score += 0.1;
  if (merchant !== null) score += 0.1;
  return Math.round(score * 100) / 100;
}

/**
 * Parses an Indian Bank transaction SMS body and extracts structured fields.
 */
export function parseBankSms(
  body: string,
  sender: string = 'BANK',
  timestamp: number = Date.now()
): ParsedSmsTransaction | null {
  if (!body) return null;

  // 1. Amount Extraction
  const amountMatch = body.match(AMOUNT_REGEX);
  if (!amountMatch) return null;
  const cleanAmountStr = amountMatch[1].replace(/,/g, '');
  const amount = parseFloat(cleanAmountStr);
  if (isNaN(amount) || amount <= 0) return null;

  // 2. Direction Extraction
  const directionMatch = body.match(DIRECTION_REGEX);
  let direction: TransactionDirection = 'DEBIT';
  if (directionMatch) {
    const rawDir = directionMatch[1].toLowerCase();
    if (['debited', 'debit', 'withdrawn', 'spent', 'paid'].includes(rawDir)) {
      direction = 'DEBIT';
    } else if (['credited', 'credit', 'received'].includes(rawDir)) {
      direction = 'CREDIT';
    }
  }

  // 3. Account Last 4 Digits
  const accountMatch = body.match(ACCOUNT_REGEX);
  const accountLast4 = accountMatch ? accountMatch[1] : undefined;

  // 4. UPI Reference ID
  const upiMatch = body.match(UPI_REF_REGEX);
  const upiRef = upiMatch ? upiMatch[1] : undefined;

  // 5. Merchant / Payee
  const merchantMatch = body.match(MERCHANT_REGEX);
  let merchant = merchantMatch ? merchantMatch[1].trim() : undefined;
  // Clean trailing punctuation or noise
  if (merchant) {
    merchant = merchant.replace(/[\.\,\-]+$/, '').trim();
    if (merchant.toLowerCase().startsWith('your ') || merchant.toLowerCase().includes('account')) {
      merchant = undefined;
    }
  }

  // 6. Confidence Score
  const confidence = calculateConfidence(
    amount,
    direction,
    accountLast4 ?? null,
    upiRef ?? null,
    merchant ?? null
  );

  return {
    id: `sms-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
    amount,
    direction,
    accountLast4,
    merchant,
    upiRef,
    timestamp,
    sender,
    rawSms: body.trim(),
    confidence,
    parsedAt: new Date(timestamp).toISOString(),
  };
}

// ─── Bank-Specific Sample Templates for Demo & Testing ──────────────────────

export const SAMPLE_BANK_SMSES = [
  {
    sender: 'VM-HDFCBK',
    bankName: 'HDFC Bank',
    body: 'HDFC Bank: Rs.2,400.00 debited from A/c xx1234 on 27-Sep-26 via UPI to ZOSTEL HOSPITALITY. Ref No 123456789012. Bal: Rs.8,200.00',
    expectedAmount: 2400,
    expectedMerchant: 'ZOSTEL HOSPITALITY',
  },
  {
    sender: 'AD-SBIINB',
    bankName: 'State Bank of India',
    body: 'Your a/c XX5678 debited by Rs.1500.00 on 27-Sep-26 to HIMALAYAN TAXIS via UPI. Ref No 987654321012. Available Bal: Rs.14,200',
    expectedAmount: 1500,
    expectedMerchant: 'HIMALAYAN TAXIS',
  },
  {
    sender: 'AX-ICICIB',
    bankName: 'ICICI Bank',
    body: 'ICICI Bank Acct XX9012 debited with Rs.750.00 on 27-Sep-2026. Paid to CAFE 1947 via UPI. UTR 456789012345',
    expectedAmount: 750,
    expectedMerchant: 'CAFE 1947',
  },
  {
    sender: 'VK-AXISBK',
    bankName: 'Axis Bank',
    body: 'Rs.3200.00 debited from Axis Bank Acct no. XX3456 on 27-Sep-26 to BEAS RIVER RAFTING. UPI Ref 345678901234',
    expectedAmount: 3200,
    expectedMerchant: 'BEAS RIVER RAFTING',
  },
  {
    sender: 'BP-PHONEPE',
    bankName: 'PhonePe',
    body: 'Paid Rs.1,200 to OLD MANALI DHABA via PhonePe UPI. Txn Ref: 890123456789 from HDFC Bank **1234',
    expectedAmount: 1200,
    expectedMerchant: 'OLD MANALI DHABA',
  },
];
