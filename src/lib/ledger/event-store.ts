// ─── Event Store: Append-Only Event Log in Firestore ────────────────────────
// Events are stored as a subcollection: trips/{tripId}/events/{eventId}
// Events are NEVER updated or deleted. Only appended.
// Version numbers are monotonically increasing per trip for ordering guarantees.

import { db } from '../firebase';
import {
  collection, doc, setDoc, getDocs, query, orderBy, where,
  getDoc, runTransaction, limit, startAfter
} from 'firebase/firestore';
import type {
  LedgerEvent, LedgerEventType, LedgerEventPayload
} from './event-types';

// ─── Write: Append a New Event ──────────────────────────────────────────────

/**
 * Appends a new immutable event to the trip's event stream.
 * Uses a Firestore transaction to guarantee monotonic version numbers.
 */
export async function appendEvent(
  tripId: string,
  type: LedgerEventType,
  actorId: string,
  payload: LedgerEventPayload,
  metadata?: LedgerEvent['metadata']
): Promise<LedgerEvent> {
  const eventsRef = collection(db, 'trips', tripId, 'events');

  // Get the next version number using a transaction on the trip's version counter
  const tripRef = doc(db, 'trips', tripId);

  let newEvent: LedgerEvent | null = null;

  await runTransaction(db, async (transaction) => {
    const tripDoc = await transaction.get(tripRef);

    // Get current version (or start at 0)
    const currentVersion = tripDoc.exists()
      ? (tripDoc.data().event_version ?? 0)
      : 0;
    const nextVersion = currentVersion + 1;

    // Create the event document
    const eventRef = doc(eventsRef);
    const event: LedgerEvent = {
      id: eventRef.id,
      tripId,
      type,
      timestamp: new Date().toISOString(),
      actorId,
      version: nextVersion,
      payload,
      metadata: {
        source: 'web',
        whatIfBranch: null,
        ...metadata,
      },
    };

    // Write the event (append-only — never update)
    transaction.set(eventRef, event);

    // Update the version counter on the trip document
    transaction.update(tripRef, { event_version: nextVersion });

    newEvent = event;
  });

  if (!newEvent) {
    throw new Error('Failed to append event — transaction did not produce an event');
  }

  return newEvent;
}

// ─── Read: Fetch Event Stream ───────────────────────────────────────────────

/**
 * Fetches the complete ordered event stream for a trip.
 * Events are ordered by version number (ascending = chronological).
 */
export async function getEventStream(
  tripId: string,
  options?: {
    fromVersion?: number;     // only events after this version
    eventTypes?: LedgerEventType[];  // filter by type
    maxEvents?: number;       // limit results
  }
): Promise<LedgerEvent[]> {
  const eventsRef = collection(db, 'trips', tripId, 'events');

  let q = query(eventsRef, orderBy('version', 'asc'));

  // Apply version filter
  if (options?.fromVersion) {
    q = query(eventsRef, orderBy('version', 'asc'), where('version', '>', options.fromVersion));
  }

  // Apply limit
  if (options?.maxEvents) {
    q = query(eventsRef, orderBy('version', 'asc'), limit(options.maxEvents));
  }

  const snapshot = await getDocs(q);
  let events = snapshot.docs.map(d => d.data() as LedgerEvent);

  // Client-side type filter (Firestore can't combine where('type', 'in', ...) with orderBy on a different field without a composite index)
  if (options?.eventTypes && options.eventTypes.length > 0) {
    const typeSet = new Set(options.eventTypes);
    events = events.filter(e => typeSet.has(e.type));
  }

  return events;
}

/**
 * Fetches events for a specific item/booking across the trip.
 * Useful for the "Why do I owe this?" trace.
 */
export async function getEventsForItem(
  tripId: string,
  itemId: string
): Promise<LedgerEvent[]> {
  const allEvents = await getEventStream(tripId);

  return allEvents.filter(event => {
    const p = event.payload as any;
    return (
      p.itemId === itemId ||
      p.linkedItemId === itemId ||
      p.expenseId === itemId
    );
  });
}

/**
 * Fetches events involving a specific member.
 * Used for the Personal Lens view.
 */
export async function getEventsForMember(
  tripId: string,
  memberId: string
): Promise<LedgerEvent[]> {
  const allEvents = await getEventStream(tripId);

  return allEvents.filter(event => {
    const p = event.payload as any;
    return (
      event.actorId === memberId ||
      p.memberId === memberId ||
      p.userId === memberId ||
      p.paidByMemberId === memberId ||
      p.fromMemberId === memberId ||
      p.toMemberId === memberId ||
      p.receivedByMemberId === memberId ||
      p.cancelledBy === memberId ||
      (Array.isArray(p.participantMemberIds) && p.participantMemberIds.includes(memberId)) ||
      (Array.isArray(p.distributions) && p.distributions.some((d: any) => d.memberId === memberId))
    );
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Gets the current version number for a trip's event stream.
 */
export async function getCurrentVersion(tripId: string): Promise<number> {
  const tripDoc = await getDoc(doc(db, 'trips', tripId));
  if (!tripDoc.exists()) return 0;
  return tripDoc.data().event_version ?? 0;
}

/**
 * Counts total events in a trip's stream.
 */
export async function getEventCount(tripId: string): Promise<number> {
  const events = await getEventStream(tripId);
  return events.length;
}

// ─── Batch Append (for migrations / seeding) ────────────────────────────────

/**
 * Appends multiple events in sequence. Used for:
 * - Migrating existing CRUD data into the event stream
 * - Pre-seeding demo scenarios
 * Each event gets its own version number.
 */
export async function appendEvents(
  tripId: string,
  eventDefs: { type: LedgerEventType; actorId: string; payload: LedgerEventPayload }[]
): Promise<LedgerEvent[]> {
  const results: LedgerEvent[] = [];

  for (const def of eventDefs) {
    const event = await appendEvent(
      tripId,
      def.type,
      def.actorId,
      def.payload,
      { source: 'system' }
    );
    results.push(event);
  }

  return results;
}
