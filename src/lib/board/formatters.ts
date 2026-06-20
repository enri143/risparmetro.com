const fmtEur2 = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEur4 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtEur6 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
const fmtPct = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtNum = new Intl.NumberFormat("it-IT");

export const eur = (v: number) => fmtEur2.format(v);
export const eurUnit = (v: number) => fmtEur6.format(v);
export const eur4 = (v: number) => fmtEur4.format(v);
export const pct = (v: number) => `${fmtPct.format(v)}%`;
export const num = (v: number) => fmtNum.format(v);
