import heritage from '../../data/heritage.json';

export function RootsTeaser() {
  return (
    <ul className="grid grid-cols-1 gap-2 rounded-2xl border border-blush bg-paper p-4 text-sm sm:grid-cols-2">
      {heritage.deities.slice(0, 4).map((d) => (
        <li
          key={d.id}
          className="flex items-baseline justify-between gap-2 rounded-lg bg-gold/15 px-3 py-2"
        >
          <span className="font-semibold text-plum">{d.indian.split(' ')[0]}</span>
          <span className="text-xs text-mist">
            <span lang="ja">{d.kanji}</span> {d.japanese}
          </span>
        </li>
      ))}
    </ul>
  );
}
