import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DraftPayload } from "@/hooks/useDraftAutosave";

interface Props {
  draft: DraftPayload;
  onResume: () => void;
  onDiscard: () => void;
}

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ora";
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} or${h === 1 ? "a" : "e"} fa`;
  return `${Math.floor(h / 24)} g fa`;
}

export function DraftBanner({ draft, onResume, onDiscard }: Props) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setHidden(true), 10_000);
    return () => window.clearTimeout(t);
  }, []);

  if (hidden) return null;

  const seg = draft.dati.segmento === "family" ? "Domestico" : "Business";
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-3">
      <Save className="w-5 h-5 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-[200px] text-sm">
        <div className="font-semibold text-amber-900">
          Hai una bozza di {ago(draft.savedAt)}
        </div>
        <div className="text-amber-800 text-xs">
          {draft.dati.consumoLuce} kWh · {draft.dati.consumoGas} Smc · {seg}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onResume} className="min-h-[40px]">Riprendi</Button>
        <Button size="sm" variant="outline" onClick={onDiscard} className="min-h-[40px]">Scarta</Button>
        <Button size="icon" variant="ghost" onClick={() => setHidden(true)} aria-label="Nascondi" className="min-h-[40px] min-w-[40px]">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
