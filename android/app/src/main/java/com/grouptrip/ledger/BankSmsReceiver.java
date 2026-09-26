package com.grouptrip.ledger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

/**
 * Real-time BroadcastReceiver for incoming bank transaction SMSes (Part 2 Step 3).
 * Intercepts SMS messages, applies the TRAI DLT Bank Whitelist, and forwards to SmsReaderPlugin.
 */
public class BankSmsReceiver extends BroadcastReceiver {
    private static final String TAG = "BankSmsReceiver";

    // Known Indian Bank Sender Substrings (TRAI DLT Whitelist)
    private static final String[] BANK_SENDERS = {
        "SBIINB", "SBISMS", "UNIONB", "PNBSMS", "BOBIBD", "CANBNK",
        "INDBNK", "CENTBK", "ANDHBK", "ALLBKS", "SYNBNK", "UCOBNK",
        "HDFCBK", "ICICIB", "AXISBK", "YESBNK", "INDUSB", "KOTKBK",
        "RBLBNK", "IDBIBK", "FEDBKS", "CSFBNK", "AUSFBN", "DCBBNK",
        "UJJIVN", "EQUTAS", "SURYOD", "FINCAR",
        "AIRBNK", "PAYTMB", "INDPBK", "FINOBN",
        "PAYTMW", "PHONEPE", "GPAYMS"
    };

    public static boolean isBankSender(String sender) {
        if (sender == null || sender.isEmpty()) return false;
        // Strip 2-letter TRAI DLT prefix (e.g. "VM-HDFCBK" -> "HDFCBK")
        String normalized = sender.replaceAll("^[A-Za-z]{2}-", "").toUpperCase();
        for (String bank : BANK_SENDERS) {
            if (normalized.contains(bank)) {
                return true;
            }
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

                if (isBankSender(sender)) {
                    Log.d(TAG, "Bank SMS detected from: " + sender);
                    SmsReaderPlugin.onNewBankSms(sender, body, timestamp);
                }
            }
        }
    }
}
