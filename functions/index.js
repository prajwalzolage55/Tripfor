const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function triggered automatically when any user records an expense.
 * Dispatches high-priority FCM push notification to all trip members even if app is closed.
 */
exports.onExpenseCreated = onDocumentCreated("expenses/{expenseId}", async (event) => {
  const expense = event.data?.data();
  if (!expense) return;

  const { trip_id, amount, paid_by, note } = expense;
  if (!trip_id) return;

  try {
    const db = admin.firestore();

    // 1. Fetch Trip Name
    const tripDoc = await db.collection("trips").doc(trip_id).get();
    const tripName = tripDoc.exists ? tripDoc.data().name : "Group Trip";

    // 2. Fetch Payer Details
    let payerName = "A member";
    let payerUserId = null;
    if (paid_by) {
      const payerDoc = await db.collection("trip_members").doc(paid_by).get();
      if (payerDoc.exists) {
        payerName = payerDoc.data().display_name || "A member";
        payerUserId = payerDoc.data().user_id;
      }
    }

    // 3. Query all other members in the trip
    const membersSnap = await db
      .collection("trip_members")
      .where("trip_id", "==", trip_id)
      .get();

    const recipientUserIds = membersSnap.docs
      .map(doc => doc.data().user_id)
      .filter(uid => uid && uid !== payerUserId);

    if (recipientUserIds.length === 0) {
      console.log(`No other trip members to notify for trip ${trip_id}.`);
      return;
    }

    // 4. Retrieve FCM device tokens from user_profiles
    const tokens = [];
    for (const uid of recipientUserIds) {
      const userSnap = await db.collection("user_profiles").doc(uid).get();
      if (userSnap.exists) {
        const userData = userSnap.data();
        if (userData.fcm_token) tokens.push(userData.fcm_token);
        if (Array.isArray(userData.fcm_tokens)) {
          tokens.push(...userData.fcm_tokens);
        }
      }
    }

    const uniqueTokens = [...new Set(tokens.filter(Boolean))];
    if (uniqueTokens.length === 0) {
      console.log(`No active FCM device tokens found for trip ${trip_id} members.`);
      return;
    }

    // 5. Build and send multicast notification
    const formattedAmount = `₹${Number(amount || 0).toLocaleString("en-IN")}`;
    const description = note ? `for "${note}"` : "for a trip expense";

    const payload = {
      tokens: uniqueTokens,
      notification: {
        title: `New Expense in ${tripName} 💸`,
        body: `${payerName} paid ${formattedAmount} ${description}.`
      },
      data: {
        tripId: trip_id,
        expenseId: event.params.expenseId,
        url: `/trip/${trip_id}/expenses`
      },
      android: {
        priority: "high",
        notification: {
          channelId: "trip_expenses",
          sound: "default",
          icon: "ic_notification",
          color: "#4f46e5",
          clickAction: "FCM_PLUGIN_ACTIVITY"
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    console.log(`Successfully dispatched expense push notification to ${response.successCount}/${uniqueTokens.length} devices.`);
  } catch (err) {
    console.error("Error sending expense push notifications:", err);
  }
});
