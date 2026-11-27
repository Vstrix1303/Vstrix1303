// Prices are kept in the old unit (16 to the rupee) so every price in the game stays balanced,
// and shown in the decimal coinage India adopted in April 1957: rupees and naye paise.
export function fmtMoney(a) {
  const np = Math.round(Math.abs(a) * 100 / 16), r = Math.floor(np / 100), p = np % 100;
  if (!r) return `${p} np`;
  return p ? `Rs ${r}.${String(p).padStart(2, '0')}` : `Rs ${r}`;
}
