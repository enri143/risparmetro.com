import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SgScaglione {
  codice_offerta?: string;
  scaglione_da?: number;
  scaglione_a?: number | null;
  acquisizione?: number;
  sepa?: number;
  variabile_anticipato?: number;
  variabile?: number;
  integrativo?: number;
}

export interface SgProvvigioneCalcolata {
  acquisizione: number;
  sepa: number;
  unaTantum: number;
  ricorrenteAnnua: number;
  scaglioneLabel: string;
  integrativo: number;
  tuttiScaglioni: SgScaglione[];
  scaglioneApplicato: SgScaglione;
}

export function calcolaProvvigioneSg(
  scaglioni: SgScaglione[] | undefined,
  consumo: number,
): SgProvvigioneCalcolata | null {
  if (!scaglioni || scaglioni.length === 0) return null;

  const sorted = [...scaglioni].sort((a, b) => (a.scaglione_da ?? 0) - (b.scaglione_da ?? 0));

  let matched = sorted[sorted.length - 1];
  for (const s of sorted) {
    const da = s.scaglione_da ?? 0;
    const a = s.scaglione_a;
    if (consumo >= da && (a == null || a === 0 || consumo <= a)) {
      matched = s;
      break;
    }
  }

  const acquisizione = matched.acquisizione ?? 0;
  const sepa = matched.sepa ?? 0;
  const unaTantum = acquisizione + sepa;
  const ricUnit = (matched.variabile_anticipato ?? 0) + (matched.variabile ?? 0);
  const ricorrenteAnnua = ricUnit * consumo;
  const da = matched.scaglione_da ?? 0;
  const aVal = matched.scaglione_a;
  const aLabel = aVal == null || aVal >= 1_000_000 || aVal === 0 ? "∞" : aVal.toLocaleString("it-IT");
  const scaglioneLabel = `${da.toLocaleString("it-IT")}–${aLabel}`;
  const integrativo = matched.integrativo ?? 0;

  return {
    acquisizione,
    sepa,
    unaTantum,
    ricorrenteAnnua,
    scaglioneLabel,
    integrativo,
    tuttiScaglioni: sorted,
    scaglioneApplicato: matched,
  };
}

export function useSgProvvigioni(): Record<string, SgScaglione[]> | undefined {
  const [map, setMap] = useState<Record<string, SgScaglione[]> | undefined>(undefined);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from("sg_provvigioni" as string)
          .select("*");
        if (!data) { setMap({}); return; }
        const result: Record<string, SgScaglione[]> = {};
        for (const row of data as SgScaglione[]) {
          const key = row.codice_offerta ?? "";
          if (!key) continue;
          if (!result[key]) result[key] = [];
          result[key].push(row);
        }
        setMap(result);
      } catch {
        setMap({});
      }
    }
    void load();
  }, []);

  return map;
}
