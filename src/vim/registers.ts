// Vim registers: unnamed ("), yank (0), delete history (1-9), small delete
// (-), named (a-z, A-Z appends), black hole (_), clipboard (+ *), and the
// read-only ones (. : / %) which the editor fills in.

export type RegKind = 'char' | 'line' | 'block';
export type RegValue = { text: string; kind: RegKind };

const EMPTY: RegValue = { text: '', kind: 'char' };

export class Registers {
  private regs = new Map<string, RegValue>();
  /** Which register the unnamed register currently points at. */
  private unnamedFrom = '0';
  /** Filled by the editor on read. */
  readonly?: (name: string) => string | null;

  get(name: string): RegValue {
    name = name.toLowerCase() === name ? name : name.toLowerCase();
    if (name === '"') return this.regs.get(this.unnamedFrom) ?? this.regs.get('"') ?? EMPTY;
    if (name === '*') name = '+';
    if ('.:/%'.includes(name)) {
      const t = this.readonly?.(name) ?? '';
      return { text: t, kind: 'char' };
    }
    if (name === '_') return EMPTY;
    return this.regs.get(name) ?? EMPTY;
  }

  has(name: string) {
    return this.get(name).text !== '' || this.regs.has(name.toLowerCase());
  }

  /** Every non-empty register, for :registers. */
  list(): [string, RegValue][] {
    const order = ['"', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '-', '.', ':', '%', '/', '+'];
    return order.map(n => [n, this.get(n)] as [string, RegValue]).filter(([, v]) => v.text !== '');
  }

  /** Explicit write (e.g. :let @a = ... or recording a macro). */
  set(name: string, value: RegValue) {
    if (name === '_') return;
    if (name === '*') name = '+';
    if (/[A-Z]/.test(name)) {
      const low = name.toLowerCase();
      const cur = this.regs.get(low);
      if (cur) {
        const text = cur.kind === 'line' || value.kind === 'line'
          ? stripNl(cur.text) + '\n' + value.text
          : cur.text + value.text;
        this.regs.set(low, { text, kind: cur.kind === 'line' || value.kind === 'line' ? 'line' : cur.kind });
      } else this.regs.set(low, value);
      this.unnamedFrom = low;
      return;
    }
    this.regs.set(name, value);
    this.unnamedFrom = name;
  }

  /** Store a yank. */
  yank(name: string | null, value: RegValue) {
    if (name === '_') return;
    if (name && name !== '"') {
      this.set(name, value);
      if (name === '+' || name === '*') this.unnamedFrom = '+';
      return;
    }
    this.regs.set('0', value);
    this.unnamedFrom = '0';
  }

  /** Store a delete or change. Multi-line and linewise deletes shift 1-9. */
  delete(name: string | null, value: RegValue, forceNumbered = false) {
    if (name === '_') return;
    if (name && name !== '"') {
      this.set(name, value);
      // Vim also shifts "1 for named multi-line deletes.
      if (value.kind === 'line' || value.text.includes('\n')) this.shift(value);
      this.unnamedFrom = name.toLowerCase();
      return;
    }
    if (value.kind === 'line' || value.text.includes('\n') || forceNumbered) {
      this.shift(value);
      this.unnamedFrom = '1';
    } else {
      this.regs.set('-', value);
      this.unnamedFrom = '-';
    }
  }

  private shift(value: RegValue) {
    for (let i = 9; i > 1; i--) {
      const prev = this.regs.get(String(i - 1));
      if (prev) this.regs.set(String(i), prev);
    }
    this.regs.set('1', value);
  }
}

const stripNl = (s: string) => (s.endsWith('\n') ? s.slice(0, -1) : s);

export const isValidRegister = (c: string) => /^[a-zA-Z0-9"\-_+*.:/%=]$/.test(c);
