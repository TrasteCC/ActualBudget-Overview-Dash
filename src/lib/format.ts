// Number formatting follows the LOCALE / CURRENCY settings sent with the payload.
export interface Fmt {
  money: (v: number) => string;   // 1.234,56 €
  money0: (v: number) => string;  // 1.235 €
  short: (v: number) => string;   // 1,2k
  signed: (v: number, f: (n: number) => string) => string;
  time: (iso: string) => string;
}

export function makeFmt(locale: string, currency: string): Fmt {
  const nf2 = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const plain0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const plain1 = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    money: v => nf2.format(v),
    money0: v => nf0.format(v),
    short: v => (Math.abs(v) >= 1000 ? `${plain1.format(v / 1000)}k` : plain0.format(v)),
    signed: (v, f) => (v >= 0 ? '+' : '') + f(v),
    time: iso => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}
