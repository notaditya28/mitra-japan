const STEPS = [
  'Passport valid for your whole trip, with blank pages',
  'Visa application form and a recent passport photo',
  'Day-by-day itinerary and hotel bookings',
  'Recent bank statements and income tax returns',
  'Apply via Japan eVISA or an authorised visa centre',
];

export function VisaChecklist() {
  return (
    <div className="rounded-2xl border border-blush bg-paper p-4">
      <ol className="space-y-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-matcha/30 text-[11px] font-bold text-plum">
              {i + 1}
            </span>
            <span className="text-ink">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-mist">
        Rules change. Always confirm on the Embassy of Japan in India website before applying.
      </p>
    </div>
  );
}
