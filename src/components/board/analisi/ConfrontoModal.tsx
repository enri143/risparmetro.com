import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DatiCliente, Impostazioni, RisultatoOfferta } from "@/lib/board/types";
import { simulaBollettaLuce, simulaBollettaGas } from "@/lib/board/calcoli";
import { SimulazioneBollettaView } from "./SimulazioneBolletta";
import { eur } from "@/lib/board/formatters";

export function ConfrontoModal({ items, dati, imp, onClose }: {
  items: RisultatoOfferta[]; dati: DatiCliente; imp: Impostazioni; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Confronto offerte</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((r) => {
            const sim = r.cte.tipo === "luce" ? simulaBollettaLuce(r.cte, dati, imp) : simulaBollettaGas(r.cte, dati, imp);
            return (
              <div key={r.cte.id} className="border rounded-lg p-4">
                <h4 className="font-semibold">{r.cte.nome}</h4>
                <p className="text-xs text-muted-foreground">{r.cte.fornitore}</p>
                <div className="mt-2 text-sm">
                  <span className={r.risparmio >= 0 ? "text-green-700" : "text-red-700"}>
                    {r.risparmio >= 0 ? "Risparmio annuo" : "⛔ Costa di più"}
                  </span>:{" "}
                  <span className={`font-bold ${r.risparmio >= 0 ? "text-green-600" : "text-red-600"}`}>
                    +{eur(Math.abs(r.risparmio))}
                  </span>
                </div>
                <SimulazioneBollettaView sim={sim} cte={r.cte} dati={dati} />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
