package com.grouptrip.ledger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import java.util.regex.Pattern;

/**
 * Real-time BroadcastReceiver for incoming bank transaction SMSes.
 * Detects bank SMS via sender ID whitelist AND body content analysis.
 */
public class BankSmsReceiver extends BroadcastReceiver {
    private static final String TAG = "BankSmsReceiver";

    // Known Indian Bank & Fintech Sender Substrings (TRAI DLT Whitelist & Common Headers)
    private static final String[] BANK_SENDERS = {
        "SBI", "SBIINB", "SBISMS", "SBIBNK", "SBIPSG", "SBIUPI", "SBMSMS",
        "HDFC", "HDFCBK", "HDFCBN", "ABORIG",
        "ICICI", "ICICIB", "ICIBNK",
        "AXIS", "AXISBK", "AXISBN",
        "KOTAK", "KOTKBK", "KOTAKB",
        "BOB", "BOBIBD", "BOBTXN", "BARB",
        "PNB", "PNBSMS", "PNBUPI",
        "CANBNK", "CANARA", "CNRB",
        "UNIONB", "UNION", "UBISMS", "UBI",
        "INDBNK", "INDIANB", "CENTBK", "CBIBNK", "CBSSMS", "ANDHBK", "ALLBKS", "SYNBNK", "UCOBNK",
        "IDFC", "IDFCFB", "IDFCBK",
        "YES", "YESBNK", "INDUS", "INDUSB", "INDUSIND",
        "RBL", "RBLBNK", "IDBI", "IDBIBK", "FEDBKS", "FEDERAL", "CSFBNK", "AUSFBN", "AUBANK", "DCBBNK",
        "UJJIVN", "EQUTAS", "SURYOD", "FINCAR", "BANDHAN", "BNDHAN",
        "AIRBNK", "PAYTMB", "INDPBK", "FINOBN", "PAYTM", "PAYTMW",
        "PHONEPE", "GPAY", "GPAYMS", "JIOMNY",
        "CRED", "CREDAP", "AMZPAY", "BHARPE", "MOBIKW", "JUPITR", "FIBANK", "SLICE",
        "BAJFIN", "MUTFND", "LICIFL",
        "CITI", "HSBC", "SCBANK", "SCBL", "DENABN", "MAHBNK",
        "NPSBNK", "IOBSMS"
    };

    // Transaction action keywords
    private static final String[] TRANSACTION_KEYWORDS = {
        "debited", "credited", "debit", "credit",
        "withdrawn", "deposited", "transferred",
        "spent", "received", "paid",
        "transaction", "txn", "sent rs", "received rs",
        "refund", "cashback"
    };

    // Financial context markers (confirming genuine transaction, not casual chat)
    private static final String[] FINANCIAL_CONTEXT = {
        "a/c", "acct", "account", "card",
        "upi", "neft", "imps", "rtgs", "vpa",
        "ref no", "ref:", "utr", "txn ref",
        "bal", "balance", "avl bal", "avail bal", "available bal",
        "atm", "pos", "ecom", "mandate", "autopay"
    };

    // Keywords indicating OTP, login codes, or promotional loan offers (EXCLUDE)
    private static final String[] EXCLUDE_KEYWORDS = {
        "otp", "one time password", "verification code", "secret code",
        "security code", "pre-approved", "apply now", "instant loan",
        "win up to", "congratulations"
    };

    // Amount pattern: Rs, Rs., INR, ₹ followed by digits, or debited/credited by amount
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
        "(?:(?:Rs\\.?|INR|₹)\\s*[\\d,]+(?:\\.\\d{1,2})?)|(?:(?:debited|credited|spent|withdrawn|paid|received)\\s+(?:by|for|with|of)?\\s*(?:Rs\\.?|INR|₹)?\\s*[\\d,]+(?:\\.\\d{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    /**
     * Checks sender ID against the bank whitelist.
     */
    public static boolean isBankSender(String sender) {
        if (sender == null || sender.isEmpty()) return false;
        String clean = sender.toUpperCase().replaceAll("[^A-Z0-9]", "");
        for (String bank : BANK_SENDERS) {
            if (clean.contains(bank)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Detects if an SMS body contains bank/financial transaction content.
     */
    public static boolean isTransactionSms(String body) {
        if (body == null || body.trim().isEmpty()) return false;
        String lower = body.toLowerCase();

        // 1. Exclude OTPs and promotional loan spam
        for (String exclude : EXCLUDE_KEYWORDS) {
            if (lower.contains(exclude)) {
                return false;
            }
        }

        // 2. Must contain an amount
        if (!AMOUNT_PATTERN.matcher(body).find()) return false;

        // 3. Must contain at least one transaction action keyword
        boolean hasTx = false;
        for (String kw : TRANSACTION_KEYWORDS) {
            if (lower.contains(kw)) {
                hasTx = true;
                break;
            }
        }
        if (!hasTx) return false;

        // 4. Must contain financial context (a/c, UPI, balance, card, etc.)
        for (String ctx : FINANCIAL_CONTEXT) {
            if (lower.contains(ctx)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns true if the SMS is a bank/transaction message.
     */
    public static boolean isBankOrTransactionSms(String sender, String body) {
        if (body == null || body.trim().isEmpty()) return false;
        String lower = body.toLowerCase();

        // Always reject OTP and loan promotional spam
        for (String exclude : EXCLUDE_KEYWORDS) {
            if (lower.contains(exclude)) {
                return false;
            }
        }

        // If body has amount + transaction keyword + financial context
        if (isTransactionSms(body)) {
            return true;
        }

        // If from a known bank sender AND contains an amount
        if (isBankSender(sender) && AMOUNT_PATTERN.matcher(body).find()) {
            return true;
        }

        return false;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages == null) return;

            for (SmsMessage sms : messages) {
                String sender = sms.getOriginatingAddress();
                String body = sms.getMessageBody();
                long timestamp = sms.getTimestampMillis();

                if (isBankOrTransactionSms(sender, body)) {
                    Log.d(TAG, "Bank/transaction SMS detected from: " + sender);
                    SmsReaderPlugin.onNewBankSms(sender, body, timestamp);
                }
            }
        }
    }
}
