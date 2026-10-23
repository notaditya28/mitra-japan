/** "Show this to staff" card for the language gate. HI/GU need native review (see TODO.md). */
export function PhrasePreview() {
  return (
    <div className="rounded-2xl border border-blush bg-paper p-4">
      <p className="eyebrow mb-2 text-rose">Show this to staff</p>
      <p lang="ja" className="font-display text-xl leading-snug text-plum">
        魚のだし（かつお節など）を使わないでください。
      </p>
      <div className="mt-3 space-y-1 border-t border-blush pt-3 text-sm text-mist">
        <p lang="hi">कृपया इसमें मछली का शोरबा न डालें।</p>
        <p lang="gu">કૃપા કરીને આમાં માછલીનો સૂપ ન નાખશો.</p>
        <p lang="en">Please do not use fish stock (like bonito flakes).</p>
      </div>
    </div>
  );
}
