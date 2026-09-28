import type { ReactNode } from 'react';

/** Inline code chip used in lesson prose. */
export const Code = ({ children }: { children: ReactNode }) => <code className="code">{children}</code>;

/** Monospace text without the chip background. */
export const Mono = ({ children }: { children: ReactNode }) => <span className="mono-inline">{children}</span>;
