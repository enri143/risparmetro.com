import { Compass } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ObiezioniPanel } from "./ObiezioniPanel";
import { ScalettaChiusuraPanel } from "./ScalettaChiusuraPanel";
import { FrasiClosePanel } from "./FrasiClosePanel";
import { CompliancePanel } from "./CompliancePanel";

const SEZIONI = [
  { id: "obiezioni",  label: "Gestione obiezioni",  Panel: ObiezioniPanel },
  { id: "scaletta",   label: "Scaletta di chiusura", Panel: ScalettaChiusuraPanel },
  { id: "frasi",      label: "Frasi di close",       Panel: FrasiClosePanel },
  { id: "compliance", label: "Compliance",            Panel: CompliancePanel },
];

export function CopilotTrattativa() {
  return (
    <div className="rounded-2xl border border-border-ui bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border-ui bg-surface-subtle">
        <Compass className="w-4 h-4 text-brand shrink-0" />
        <span className="text-sm font-semibold text-text-base">Co-pilot trattativa</span>
      </div>

      <Accordion type="single" collapsible className="divide-y divide-border-ui">
        {SEZIONI.map(({ id, label, Panel }) => (
          <AccordionItem key={id} value={id} className="border-none">
            <AccordionTrigger className="px-5 py-3.5 text-sm font-medium text-text-base hover:bg-surface-subtle hover:no-underline [&>svg]:text-text-muted min-h-[52px]">
              {label}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1">
              <Panel />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
