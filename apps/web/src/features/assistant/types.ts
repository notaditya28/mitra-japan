import type { Itinerary } from '../planner/itinerary';

/** Mirrors apps/api/rag/models.py and rag/patching.py. */
export type Confidence = 'high' | 'medium' | 'low' | 'abstained';
export type StatementKind = 'fact' | 'suggestion' | 'estimate';
export type Intent = 'info' | 'plan_change' | 'emergency' | 'smalltalk' | 'clarify';

export interface Citation {
  n: number;
  chunk_id: string;
  doc_id: string;
  title: string;
  section: string;
  source_name: string;
  source_url: string | null;
  source_type: string;
  status: string;
  volatility: string;
  last_verified: string | null;
  excerpt: string;
}

export interface Statement {
  text: string;
  kind: StatementKind;
  citations: number[];
}

export interface EmergencyContact {
  label: string;
  value: string;
  kind: 'phone' | 'url' | 'email' | 'text';
  note: string;
  source_url: string | null;
}

export interface EmergencyPayload {
  kind: string;
  title: string;
  urgent_action: string;
  steps: string[];
  contacts: EmergencyContact[];
  replan_prompt: string;
  disclaimer: string;
  status: string;
  last_verified: string | null;
  sources: string[];
  offline?: boolean;
}

export interface StopDiff {
  name: string;
  kind: string;
  status: 'kept' | 'added' | 'removed' | 'moved-in' | 'moved-out' | 'replaced';
  pinned: boolean;
}

export interface DayDiff {
  day: number;
  cityId: string;
  title: string;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  stops: StopDiff[];
}

export interface Diff {
  days: DayDiff[];
  changed: number;
  unchanged_stops: number;
  added_stops: number;
  removed_stops: number;
}

export interface PatchOp {
  op: string;
  day?: number;
  to_day?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface Patch {
  summary: string;
  ops: PatchOp[];
  booking_notes: string[];
}

export interface ProposedPatch {
  patch: Patch;
  diff: Diff | null;
  warnings: string[];
}

export interface AssistantResponse {
  answer: string;
  statements: Statement[];
  language: string;
  citations: Citation[];
  confidence: Confidence;
  freshness_note: string | null;
  suggested_next_steps: string[];
  proposed_patch: ProposedPatch | null;
  needs_clarification: string | null;
  intent: Intent;
  emergency: EmergencyPayload | null;
  mode: 'live' | 'demo';
  mode_label: string;
  notices: string[];
  trip_context: TripContextJson | null;
}

/** The parts of the server's TripContext the browser reads back. */
export interface TripContextJson {
  session_id: string;
  diet?: { value: { diet: string; custom: string[] }; provenance: string; note: string } | null;
  [key: string]: unknown;
}

export interface ApplyResult {
  itinerary: Itinerary;
  undo_token: string;
  diff: Diff | null;
  warnings: string[];
}
