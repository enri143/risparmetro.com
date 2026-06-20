import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNegotiationDiscount } from "@/hooks/useNegotiationDiscount";

export const AGENT_SHEET_EVENT = "board:open-agent-sheet";

export function ModalitaAgenteSheet() {
  const [open, setOpen] = useState(false);
  const { discount, debug, setDiscount, setDebug, reset } = useNegotiationDiscount();
  const [local, setLocal] = useState<number>(discount);

  useEffect(() => setLocal(discount), [discount]);

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(AGENT_SHEET_EVENT, h);
    return () => window.removeEventListener(AGENT_SHEET_EVENT, h);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Zap className="w-5 h-5 text-primary" /> Modalità agente
          </SheetTitle>
          <SheetDescription>Strumenti riservati per trattativa e verifica dei numeri.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Sconto trattativa applicato</Label>
              <span className="font-mono text-lg font-semibold tabular-nums">{local}%</span>
            </div>
            <Slider
              value={[local]}
              min={0}
              max={15}
              step={1}
              onValueChange={([v]) => setLocal(v)}
              onValueCommit={([v]) => setDiscount(v)}
              className="[&_[role=slider]]:h-7 [&_[role=slider]]:w-7"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-mono px-1">
              <span>0%</span><span>5%</span><span>10%</span><span>15%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Vedi anteprima risparmio cliente con sconto extra ceduto in trattativa.
              <strong className="block mt-1">NON modifica le CTE salvate.</strong>
            </p>
            {discount > 0 && (
              <Button variant="outline" size="sm" onClick={reset} className="gap-2 min-h-[44px]">
                <RotateCcw className="w-4 h-4" /> Reset sconto
              </Button>
            )}
          </div>

          <div className="border-t pt-6 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-base">Modalità debug calcoli</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Mostra la formula sotto ogni CTE in classifica.
                </p>
              </div>
              <Switch checked={debug} onCheckedChange={setDebug} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
