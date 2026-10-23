import { create } from 'zustand';
import type { DemoBooking } from '../trips/tripsStore';
import type { TripDocument } from './tripDocument';

interface PrintState {
  doc: TripDocument | null;
  booking: DemoBooking | null;
  print: (doc: TripDocument, booking?: DemoBooking | null) => void;
  done: () => void;
}

/**
 * The printable trip is rendered off-screen, then the browser's print dialog
 * opens ("Save as PDF"). Printing keeps Devanagari, Gujarati and Japanese text
 * in the system's own fonts, so nothing has to be embedded.
 */
export const usePrint = create<PrintState>()((set) => ({
  doc: null,
  booking: null,
  print: (doc, booking = null) => set({ doc, booking }),
  done: () => set({ doc: null, booking: null }),
}));
