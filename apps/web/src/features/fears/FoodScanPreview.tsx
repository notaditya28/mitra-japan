/**
 * Mini menu-scanner preview for the "Will I find veg food?" gate.
 * DEMO PATH: pre-baked result, no OCR. The live scanner is milestone 6.
 */
const LINES = [
  { jp: '野菜ラーメン', en: 'Vegetable ramen', flag: null },
  { jp: 'かつお出汁', en: 'Bonito (fish) stock', flag: 'avoid' },
  { jp: '味噌', en: 'Miso', flag: null },
  { jp: 'ラード', en: 'Lard (pork fat)', flag: 'avoid' },
] as const;

export function FoodScanPreview() {
  return (
    <div
      className="rounded-2xl border border-blush bg-paper p-4 text-sm"
      aria-label="Example scan of a ramen menu"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-lg text-plum">野菜ラーメン</span>
        <span className="rounded-full bg-torii/10 px-2.5 py-0.5 text-xs font-semibold text-torii">
          Avoid
        </span>
      </div>
      <ul className="space-y-1.5">
        {LINES.map((l) => (
          <li
            key={l.jp}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
              l.flag ? 'bg-torii/10 text-torii' : 'text-ink'
            }`}
          >
            <span lang="ja">{l.jp}</span>
            <span className="text-xs font-medium">{l.en}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-mist">
        Looks vegetarian, but the broth is made with fish and pork fat.
      </p>
    </div>
  );
}
