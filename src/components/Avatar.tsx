export type Who = { name: string; initial: string; avatarUrl?: string; isGuest: boolean };

export function Avatar({ who, large }: { who: Who; large?: boolean }) {
  const cls = 'avatar' + (large ? ' lg' : '');
  if (who.avatarUrl) return <img className={cls} src={who.avatarUrl} alt="" />;
  return (
    <span className={cls} style={{ background: who.isGuest ? 'var(--comment)' : 'var(--purple)' }}>
      {who.initial}
    </span>
  );
}
