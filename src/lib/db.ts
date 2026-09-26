import { db } from './firebase';
import { 
  collection, doc, getDoc, getDocs, query, where, orderBy, 
  setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction
} from 'firebase/firestore';
import type { Trip } from './types';

export async function getTrips(userId: string) {
  // To get trips for a user, we first need to query trip_members
  const membersRef = collection(db, 'trip_members');
  const q = query(membersRef, where('user_id', '==', userId));
  const memberDocs = await getDocs(q);
  
  const tripIds = memberDocs.docs.map(d => d.data().trip_id);
  
  if (tripIds.length === 0) return [];

  // Query trips in batches of 10 if necessary, for now assume < 10
  const tripsRef = collection(db, 'trips');
  const tripQ = query(tripsRef, where('id', 'in', tripIds));
  const tripDocs = await getDocs(tripQ);
  
  const trips = tripDocs.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
  return trips.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
}

export async function createTrip(tripData: any, userId: string, displayName: string) {
  const tripRef = doc(collection(db, 'trips'));
  const tripId = tripRef.id;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newTrip = {
    id: tripId,
    name: tripData.name,
    destination: tripData.destination || null,
    start_date: tripData.start_date || null,
    end_date: tripData.end_date || null,
    created_by: userId,
    invite_code: inviteCode,
    created_at: new Date().toISOString()
  };

  await setDoc(tripRef, newTrip);

  const memberRef = doc(collection(db, 'trip_members'));
  await setDoc(memberRef, {
    id: memberRef.id,
    trip_id: tripId,
    user_id: userId,
    display_name: displayName,
    joined_at: new Date().toISOString()
  });

  return newTrip;
}

export async function joinTripByCode(code: string, userId: string, displayName: string) {
  const tripsRef = collection(db, 'trips');
  const q = query(tripsRef, where('invite_code', '==', code.toUpperCase()));
  const tripDocs = await getDocs(q);

  if (tripDocs.empty) {
    throw new Error('Invalid invite code');
  }

  const tripId = tripDocs.docs[0].id;

  const membersRef = collection(db, 'trip_members');
  const memberQ = query(membersRef, where('trip_id', '==', tripId), where('user_id', '==', userId));
  const memberDocs = await getDocs(memberQ);

  if (!memberDocs.empty) {
    // Already joined, maybe update name
    const memberId = memberDocs.docs[0].id;
    await updateDoc(doc(db, 'trip_members', memberId), { display_name: displayName });
    return tripId;
  }

  const newMemberRef = doc(collection(db, 'trip_members'));
  await setDoc(newMemberRef, {
    id: newMemberRef.id,
    trip_id: tripId,
    user_id: userId,
    display_name: displayName,
    joined_at: new Date().toISOString()
  });

  return tripId;
}

export async function getTrip(tripId: string) {
  const tripDoc = await getDoc(doc(db, 'trips', tripId));
  if (!tripDoc.exists()) return null;
  return { id: tripDoc.id, ...tripDoc.data() } as Trip;
}

export async function saveTripPreferences(prefs: any) {
  const prefRef = doc(collection(db, 'trip_preferences'));
  await setDoc(prefRef, {
    id: prefRef.id,
    ...prefs,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return prefRef.id;
}

