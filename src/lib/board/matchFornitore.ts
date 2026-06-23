export function matchFornitore(
  nomeEstratto: string,
  fornitori: { id: string; nome: string }[],
): string | null {
  const n = nomeEstratto.trim().toLowerCase();
  if (!n) return null;
  const exact = fornitori.find((f) => f.nome.trim().toLowerCase() === n);
  if (exact) return exact.id;
  if (n.length >= 3) {
    const fuzzy = fornitori.find((f) => {
      const fn = f.nome.trim().toLowerCase();
      return fn.includes(n) || n.includes(fn);
    });
    if (fuzzy) return fuzzy.id;
  }
  return null;
}
