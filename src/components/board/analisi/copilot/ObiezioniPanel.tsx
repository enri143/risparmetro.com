import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OBIEZIONI } from "@/lib/board/copilotContent";

export function ObiezioniPanel() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {OBIEZIONI.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-xl border border-border-ui bg-white overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left min-h-[52px] text-sm font-medium text-text-base hover:bg-surface-subtle transition-colors"
            >
              <span>"{item.obiezione}"</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 shrink-0 text-text-muted transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-0 text-sm text-text-base bg-surface-subtle border-t border-border-ui">
                <p className="leading-relaxed">{item.risposta}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
