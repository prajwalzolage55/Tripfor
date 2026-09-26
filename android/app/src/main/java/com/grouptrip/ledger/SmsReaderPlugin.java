package com.grouptrip.ledger;

import android.Manifest;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.lang.ref.WeakReference;

@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(
            alias = "sms",
            strings = {
                Manifest.permission.READ_SMS,
                Manifest.permission.RECEIVE_SMS
            }
        )
    }
)
public class SmsReaderPlugin extends Plugin {
    private static final String TAG = "SmsReaderPlugin";
    private static WeakReference<SmsReaderPlugin> instance;

    @Override
    public void load() {
        super.load();
        instance = new WeakReference<>(this);
    }

    /**
     * Called by BankSmsReceiver when a real-time bank SMS arrives (Part 2 Step 3).
     */
    public static void onNewBankSms(String sender, String body, long timestamp) {
        if (instance != null && instance.get() != null) {
            SmsReaderPlugin plugin = instance.get();
            JSObject data = new JSObject();
            data.put("sender", sender);
            data.put("body", body);
            data.put("timestamp", timestamp);
            plugin.notifyListeners("smsReceived", data);
        }
    }

    /**
     * Reads past SMS messages from inbox matching whitelisted Indian bank sender IDs (Part 2 Step 2).
     */
    @PluginMethod
    public void readBankSms(PluginCall call) {
        JSArray smsList = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();

        try {
            Uri inboxUri = Uri.parse("content://sms/inbox");
            String[] projection = new String[]{"_id", "address", "body", "date"};

            Cursor cursor = resolver.query(
                inboxUri,
                projection,
                null,
                null,
                "date DESC"
            );

            if (cursor != null) {
                int bodyIdx = cursor.getColumnIndex("body");
                int addressIdx = cursor.getColumnIndex("address");
                int dateIdx = cursor.getColumnIndex("date");

                int maxCount = call.getInt("limit", 100);
                int count = 0;

                while (cursor.moveToNext() && count < maxCount) {
                    String sender = addressIdx >= 0 ? cursor.getString(addressIdx) : "";
                    String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : "";
                    long date = dateIdx >= 0 ? cursor.getLong(dateIdx) : System.currentTimeMillis();

                    if (BankSmsReceiver.isBankSender(sender)) {
                        JSObject smsObj = new JSObject();
                        smsObj.put("sender", sender);
                        smsObj.put("body", body);
                        smsObj.put("timestamp", date);
                        smsList.put(smsObj);
                        count++;
                    }
                }
                cursor.close();
            }

            JSObject result = new JSObject();
            result.put("messages", smsList);
            result.put("count", smsList.length());
            call.resolve(result);

        } catch (SecurityException se) {
            Log.e(TAG, "SMS permission denied: " + se.getMessage());
            call.reject("READ_SMS permission not granted. Request permission first.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to read SMS: " + e.getMessage());
            call.reject("Failed to read SMS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        ret.put("platform", "android");
        call.resolve(ret);
    }
}
