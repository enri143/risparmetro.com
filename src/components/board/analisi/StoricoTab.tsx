import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCw, Phone, Trash2 } from "lucide-react";
import type { DatiCliente, NoteCliente } from "@/lib/board/types";
import { eur } from "@/lib/board/formatters";
import { toast } from "sonner";
import { BOARD_PWD_KEY } from "@/pages/BoardLogin";

interface Riga {
  id: string;
  nome_cliente: string | null;
  telefono: string | null;
  note: string | null;
  tipo_utenza: string | null;
  consumo_luce_kwh: number | null;
  prezzo_luce_attuale: number | null;
  fisso_luce_mese: number | null;
  consumo_gas_smc: number | null;
  prezzo_gas_attuale: number | null;
  fisso_gas_mese: number | null;
  potenza_kw: number | null;
  residente: boolean | null;
  miglior_risparmio_luce: number | null;
  miglior_risparmio_gas: number | null;
  created_at: string;
}

export function StoricoTab({ onRicarica }: { onRicarica: (d: DatiCliente, n: NoteCliente) => void }) {
  const [rows, setRows] = useState<Riga[] | null>(null);

  const carica = useCallback(async () => {
    const password = sessionStorage.getItem(BOARD_PWD_KEY) ?? "";
    const { data, error } = await supabase.functions.invoke("board-storico", { body: { action: "list", password } });
    if (error || data?.error) {
      toast.error("Errore caricamento storico");
      setRows([]);
      return;
    }
    setRows((data?.items ?? []) as Riga[]);
  }, []);

  useEffect(() => { carica(); }, [carica]);

  const ricarica = (r: Riga) => {
    onRicarica(
      {
        segmento: r.tipo_utenza === "business" ? "business" : "family",
        potenzaKw: r.potenza_kw ?? 3,
        residente: r.residente ?? true,
        canoneRai: r.residente ?? true,
        consumoLuce: r.consumo_luce_kwh ?? 0,
        prezzoLuce: Number(r.prezzo_luce_attuale ?? 0),
        fissoLuceMese: Number(r.fisso_luce_mese ?? 0),
        consumoGas: r.consumo_gas_smc ?? 0,
        prezzoGas: Number(r.prezzo_gas_attuale ?? 0),
        fissoGasMese: Number(r.fisso_gas_mese ?? 0),
      },
      { nomeCliente: r.nome_cliente ?? "", telefono: r.telefono ?? "", note: r.note ?? "" },
    );
    toast.success("Dati ricaricati nel form");
  };

  const elimina = async (id: string) => {
    if (!confirm("Eliminare questa analisi?")) return;
    const password = sessionStorage.getItem(BOARD_PWD_KEY) ?? "";
    await supabase.functions.invoke("board-storico", { body: { action: "delete", password, id } });
    carica();
  };

  if (rows === null) return <Skeleton className="h-64" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-12 text-center">Nessuna analisi salvata.</p>;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const data = new Date(r.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" });
        return (
          <Card key={r.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{r.nome_cliente || "Senza nome"}</div>
              <div className="text-xs text-muted-foreground">{data}</div>
            </div>
            {r.telefono && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{r.telefono}</div>}
            <div className="text-xs text-muted-foreground">⚡ {r.consumo_luce_kwh ?? 0} kWh · 🔥 {r.consumo_gas_smc ?? 0} Smc</div>
            <div className="text-sm font-medium text-green-700">
              Risparmio: +{eur(Number(r.miglior_risparmio_luce ?? 0))} luce · +{eur(Number(r.miglior_risparmio_gas ?? 0))} gas
            </div>
            {r.note && <div className="text-xs italic text-muted-foreground">📝 "{r.note}"</div>}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => ricarica(r)} className="gap-1">
                <RotateCw className="w-3 h-3" /> Ricarica
              </Button>
              <Button size="sm" variant="ghost" onClick={() => elimina(r.id)} className="gap-1 text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
