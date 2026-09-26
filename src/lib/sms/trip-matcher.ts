// ─── SMS Reader: Trip Matching Logic ─────────────────────────────────────────
// Implements Part 5 of the SMS Reader Guide
// Matches extracted SMS transactions to open trip bookings and itinerary items

import type { ParsedSmsTransaction, TripMatchResult, MatchConfidenceLevel } from './types';
import type { TripState, DerivedBooking } from '../ledger';

/**
 * Computes Levenshtein similarity between two strings (0.0 to 1.0).
 */
export function fuzzyStringScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const distance = dp[m][n];
  const maxLen = Math.max(m, n);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Matches a parsed transaction against open trip bookings.
 */
export function matchTransactionToTrip(
  tx: ParsedSmsTransaction,
  state: TripState
): TripMatchResult {
  const tripName = state.tripName || 'the trip';

  // 1. Exact Match on UPI Ref if any booking or existing payment logged it
  if (tx.upiRef) {
    const exactBooking = state.bookings.find(b => b.vendorName?.includes(tx.upiRef!) || b.label.includes(tx.upiRef!));
    if (exactBooking) {
      return {
        transaction: tx,
        matchedBookingId: exactBooking.itemId,
        matchedBookingLabel: exactBooking.label,
        matchedVendor: exactBooking.vendorName || exactBooking.label,
        confidenceLevel: 'exact',
        confidenceScore: 1.0,
        promptText: `Exact match: ₹${tx.amount.toLocaleString('en-IN')} verified for "${exactBooking.label}" (UPI Ref ${tx.upiRef}).`,
        needsConfirmation: false,
        autoConfirmed: true,
      };
    }
  }

  // 2. Scan open/active bookings in the trip
  const activeBookings = state.bookings.filter(b => b.status === 'active');
  const candidates: {
    booking: DerivedBooking;
    score: number;
    amountDiff: number;
    nameScore: number;
  }[] = [];

  for (const b of activeBookings) {
    const amountDiff = Math.abs(b.cost - tx.amount);
    const vendorOrLabel = b.vendorName || b.label;
    const nameScore = tx.merchant ? fuzzyStringScore(tx.merchant, vendorOrLabel) : 0.3;

    // Time gap check (24 hours = 86,400,000 ms)
    let timeClose = true;
    if (b.startTime) {
      const bTime = new Date(b.startTime).getTime();
      if (!isNaN(bTime)) {
        const gapHours = Math.abs(tx.timestamp - bTime) / (1000 * 60 * 60);
        if (gapHours > 48) timeClose = false;
      }
    }

    // Weight score
    let score = 0;
    if (amountDiff <= 1.0) {
      score += 0.5; // exact amount match
    } else if (amountDiff <= tx.amount * 0.1) {
      score += 0.2; // within 10%
    }

    if (nameScore >= 0.7) {
      score += 0.4;
    } else if (nameScore >= 0.4) {
      score += 0.2;
    }

    if (timeClose) score += 0.1;

    if (score >= 0.4) {
      candidates.push({ booking: b, score, amountDiff, nameScore });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best && best.score >= 0.75) {
    const label = best.booking.label;
    const vendor = best.booking.vendorName || label;
    return {
      transaction: tx,
      matchedBookingId: best.booking.itemId,
      matchedBookingLabel: label,
      matchedVendor: vendor,
      confidenceLevel: 'high',
      confidenceScore: Math.round(best.score * 100) / 100,
      promptText: `Confirm: Was this ₹${tx.amount.toLocaleString('en-IN')} payment to ${tx.merchant || vendor} for "${label}" on ${tripName}?`,
      needsConfirmation: true,
      autoConfirmed: false,
    };
  }

  if (best && best.score >= 0.4) {
    const label = best.booking.label;
    const vendor = best.booking.vendorName || label;
    return {
      transaction: tx,
      matchedBookingId: best.booking.itemId,
      matchedBookingLabel: label,
      matchedVendor: vendor,
      confidenceLevel: 'medium',
      confidenceScore: Math.round(best.score * 100) / 100,
      promptText: `Potential match: ₹${tx.amount.toLocaleString('en-IN')} may match "${label}". Would you like to link this payment?`,
      needsConfirmation: true,
      autoConfirmed: false,
    };
  }

  // Unmatched
  return {
    transaction: tx,
    confidenceLevel: 'unmatched',
    confidenceScore: 0.1,
    promptText: `Unlinked payment: ₹${tx.amount.toLocaleString('en-IN')} to ${tx.merchant || 'merchant'}. Link to a custom trip expense?`,
    needsConfirmation: true,
    autoConfirmed: false,
  };
}
