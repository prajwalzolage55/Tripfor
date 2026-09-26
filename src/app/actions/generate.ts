'use server';

// Server actions for background generation if needed
export async function generateTripItineraryAction(tripId: string) {
  return { success: true, tripId };
}
