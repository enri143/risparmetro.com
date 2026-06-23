import type { RisultatoOfferta } from "@/lib/board/calcoloOfferte";

type SnapshotItem = RisultatoOfferta & { _util?: string };

export function splitSnapshot(snapshot: SnapshotItem[]): {
  luce: RisultatoOfferta[];
  gas: RisultatoOfferta[];
} {
  return {
    luce: snapshot.filter((r) => r._util === "luce"),
    gas: snapshot.filter((r) => r._util === "gas"),
  };
}

export function stripProvvigioni(r: RisultatoOfferta): Omit<RisultatoOfferta, "provvigione" | "provvigione_tipo" | "mesi_storno_rischio"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { provvigione, provvigione_tipo, mesi_storno_rischio, ...clean } = r;
  return clean;
}
