import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, Phone, Trash2, Zap, Flame } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/board/formatters";
import { splitSnapshot, stripProvvigioni } from "@/lib/board/storico";
import type { RisultatoOfferta } from "@/lib/board/calcoloOfferte";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClienteJoin {
  nome: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  telefono: string | null;
  email: string | null;
  segmento: string | null;
  indirizzo: string | null;
  comune: string | null;
  cap: string | null;
  provincia: string | null;
  pod: string | null;
  pdr: string | null;
  fornitore_attuale: string | null;
  offerta_attuale: string | null;
  scadenza_offerta: string | null;
}

interface SimulazioneRow {
  id: string;
  dati_input: Record<string, unknown> | null;
  snapshot_offerte: (RisultatoOfferta & { _util?: string })[] | null;
  offerta_scelta_id: string | null;
  risparmio_annuo: number | null;
  risparmio_percentuale: number | null;
  stato: "bozza" | "inviata" | "firmata" | null;
  created_at: string;
  clienti: ClienteJoin | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function nomeCliente(c: ClienteJoin | null) {
  if (!c) return "Senza nome";
  return [c.nome, c.cognome].filter(Boolean).join(" ") || "Senza nome";
}

const STATO_LABEL: Record<string, string> = {
  bozza: "Bozza",
  inviata: "Inviata",
  firmata: "Firmata",
};

const STATO_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  bozza: "secondary",
  inviata: "outline",
  firmata: "default",
};

// ── OfferSnapshotCard ─────────────────────────────────────────────────────────

function OfferSnapshotCard({
  r,
  isSelected,
}: {
  r: ReturnType<typeof stripProvvigioni>;
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-ui bg-white p-4 space-y-2",
        isSelected && "ring-2 ring-brand",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-base">{r.nome}</p>
          <p className="text-xs text-text-muted mt-0.5">{r.fornitore_nome} · {r.tipo_prezzo}</p>
        </div>
        {isSelected && (
          <Badge className="shrink-0 text-[10px]">Scelta</Badge>
        )}
      </div>

      {r.durata_blocco_mesi != null && (
        <p className="text-xs text-text-muted">Bloccato {r.durata_blocco_mesi} mesi</p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border-ui">
        <span className="text-xs text-text-muted">Totale annuo</span>
        <span className="text-sm font-semibold text-text-base">{eur(r.costo_annuo_totale)}</span>
      </div>

      {r.risparmio_annuo > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Risparmio stimato</span>
          <span className="text-sm font-semibold text-savings">
            +{eur(r.risparmio_annuo)} ({r.risparmio_percentuale.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}

// ── ClienteDettaglioSection ───────────────────────────────────────────────────

function ClienteDettaglioSection({ c }: { c: ClienteJoin }) {
  const [open, setOpen] = useState(false);

  const intestatario =
    c.ragione_sociale || [c.nome, c.cognome].filter(Boolean).join(" ") || null;
  const localita = [c.cap, c.comune, c.provincia].filter(Boolean).join(" ");
  const indirizzo = [c.indirizzo, localita].filter(Boolean).join(", ") || null;

  const segmentoLabel: Record<string, string> = {
    residenziale: "Residenziale",
    business: "Business",
    entrambi: "Entrambi",
  };

  const rows: { label: string; value: string | null }[] = [
    { label: "Intestatario", value: intestatario },
    { label: "Segmento", value: c.segmento ? (segmentoLabel[c.segmento] ?? c.segmento) : null },
    { label: "Telefono", value: c.telefono },
    { label: "Email", value: c.email },
    { label: "Indirizzo", value: indirizzo },
    { label: "POD", value: c.pod },
    { label: "PDR", value: c.pdr },
    { label: "Fornitore attuale", value: c.fornitore_attuale },
    { label: "Offerta attuale", value: c.offerta_attuale },
    { label: "Scadenza offerta", value: c.scadenza_offerta },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value));

  if (rows.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-xl border border-border-ui px-4 py-3 text-sm hover:bg-surface-subtle min-h-[44px] transition-colors">
        <span className="font-medium text-text-base">Dettaglio cliente / fornitura</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-text-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-xl border border-border-ui bg-surface-subtle divide-y divide-border-ui overflow-hidden">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <span className="text-xs text-text-muted shrink-0">{label}</span>
              <span className="text-xs text-text-base text-right break-all">{value}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── DetailView ────────────────────────────────────────────────────────────────

function DetailView({
  sim,
  onBack,
  onElimina,
}: {
  sim: SimulazioneRow;
  onBack: () => void;
  onElimina: (id: string) => void;
}) {
  const { luce, gas } = splitSnapshot(sim.snapshot_offerte ?? []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg border border-border-ui text-text-muted hover:bg-surface-subtle min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-base truncate">{nomeCliente(sim.clienti)}</p>
          <p className="text-xs text-text-muted">{fmtData(sim.created_at)}</p>
        </div>
        {sim.stato && (
          <Badge variant={STATO_VARIANT[sim.stato] ?? "secondary"}>
            {STATO_LABEL[sim.stato] ?? sim.stato}
          </Badge>
        )}
      </div>

      {/* Cliente / fornitura */}
      {sim.clienti && <ClienteDettaglioSection c={sim.clienti} />}

      {/* Snapshot warning */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Snapshot storico — prezzi congelati al {fmtData(sim.created_at)}.
          Non riflette i prezzi attuali.
        </span>
      </div>

      {/* Luce offers */}
      {luce.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
            <Zap className="w-3.5 h-3.5 text-yellow-500" /> Elettricità
          </div>
          {luce.map((r) => (
            <OfferSnapshotCard
              key={r.cte_id}
              r={stripProvvigioni(r)}
              isSelected={r.cte_id === sim.offerta_scelta_id}
            />
          ))}
        </div>
      )}

      {/* Gas offers */}
      {gas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wide">
            <Flame className="w-3.5 h-3.5 text-orange-500" /> Gas naturale
          </div>
          {gas.map((r) => (
            <OfferSnapshotCard
              key={r.cte_id}
              r={stripProvvigioni(r)}
              isSelected={r.cte_id === sim.offerta_scelta_id}
            />
          ))}
        </div>
      )}

      {luce.length === 0 && gas.length === 0 && (
        <p className="text-sm text-text-muted text-center py-8">Snapshot vuoto.</p>
      )}

      {/* Delete */}
      <div className="pt-2 border-t border-border-ui">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive gap-1.5"
          onClick={() => onElimina(sim.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Elimina analisi
        </Button>
      </div>
    </div>
  );
}

// ── StoricoTab ────────────────────────────────────────────────────────────────

export function StoricoTab() {
  const [rows, setRows] = useState<SimulazioneRow[] | null>(null);
  const [selected, setSelected] = useState<SimulazioneRow | null>(null);

  const carica = useCallback(async () => {
    const { data } = await supabase
      .from("simulazioni")
      .select(
        "id, dati_input, snapshot_offerte, offerta_scelta_id, risparmio_annuo, risparmio_percentuale, stato, created_at, clienti(nome, cognome, ragione_sociale, telefono, email, segmento, indirizzo, comune, cap, provincia, pod, pdr, fornitore_attuale, offerta_attuale, scadenza_offerta)",
      )
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as SimulazioneRow[]);
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const handleElimina = async (id: string) => {
    if (!confirm("Eliminare questa analisi? L'azione non è reversibile.")) return;
    await supabase.from("simulazioni").delete().eq("id", id);
    setSelected(null);
    void carica();
  };

  // Loading
  if (rows === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  // Detail view
  if (selected) {
    return (
      <DetailView
        sim={selected}
        onBack={() => setSelected(null)}
        onElimina={handleElimina}
      />
    );
  }

  // Empty
  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-muted py-12 text-center">
        Nessuna analisi salvata.
      </p>
    );
  }

  // List
  return (
    <div className="space-y-3">
      {rows.map((sim) => {
        const risparmio = sim.risparmio_annuo ?? 0;
        return (
          <Card key={sim.id} className="p-4 space-y-2 border border-border-ui shadow-none">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-text-base truncate">
                  {nomeCliente(sim.clienti)}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{fmtData(sim.created_at)}</p>
              </div>
              {sim.stato && (
                <Badge variant={STATO_VARIANT[sim.stato] ?? "secondary"} className="shrink-0 text-[10px]">
                  {STATO_LABEL[sim.stato] ?? sim.stato}
                </Badge>
              )}
            </div>

            {sim.clienti?.telefono && (
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Phone className="w-3 h-3" />
                {sim.clienti.telefono}
              </div>
            )}

            {risparmio > 0 && (
              <p className="text-sm font-semibold text-savings">
                +{eur(risparmio)} / anno
              </p>
            )}

            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setSelected(sim)}
              >
                Apri
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
