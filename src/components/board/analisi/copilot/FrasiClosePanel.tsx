import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FRASI_CLOSE } from "@/lib/board/copilotContent";

export function FrasiClosePanel() {
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard not available — silent fail
    }
    setCopied(i);
    setTimeout(() => setCopied((prev) => (prev === i ? null : prev)), 1800);
  };

  return (
    <div className="space-y-2">
      {FRASI_CLOSE.map((frase, i) => {
        const isCopied = copied === i;
        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-border-ui bg-white px-4 py-3"
          >
            <p className="flex-1 text-sm text-text-base leading-relaxed">
              "{frase}"
            </p>
            <button
              type="button"
              onClick={() => handleCopy(frase, i)}
              className={cn(
                "shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]",
                isCopied
                  ? "bg-savings-subtle text-savings"
                  : "bg-surface-subtle text-text-muted hover:bg-surface-overlay hover:text-text-base",
              )}
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {isCopied ? "Copiato" : "Copia"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
