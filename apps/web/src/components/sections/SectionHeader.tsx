interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  body?: string;
  dark?: boolean;
  id?: string;
}

export function SectionHeader({ eyebrow, title, body, dark = false, id }: SectionHeaderProps) {
  return (
    <header className="mx-auto mb-12 max-w-3xl text-center">
      <p className={`eyebrow mb-4 ${dark ? 'text-gold' : 'text-rose'}`}>{eyebrow}</p>
      <h2 id={id} className={`display text-4xl sm:text-5xl ${dark ? 'text-paper' : 'text-plum'}`}>
        {title}
      </h2>
      {body ? (
        <p className={`mx-auto mt-5 max-w-2xl text-lg ${dark ? 'text-blush/80' : 'text-mist'}`}>
          {body}
        </p>
      ) : null}
    </header>
  );
}
