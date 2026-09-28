export const Kbd = ({ k, small }: { k: string; small?: boolean }) => (
  <span className={small ? 'kbd kbd-sm' : 'kbd'}>{k}</span>
);
