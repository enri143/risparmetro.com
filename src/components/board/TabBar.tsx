import { Zap, ListChecks, Settings, History } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardTab = "analisi" | "listino" | "storico" | "impostazioni";

const TABS: { id: BoardTab; label: string; icon: typeof Zap }[] = [
  { id: "analisi", label: "Analisi", icon: Zap },
  { id: "listino", label: "Listino CTE", icon: ListChecks },
  { id: "storico", label: "Storico", icon: History },
  { id: "impostazioni", label: "Impostazioni", icon: Settings },
];

export function TabBar({ active, onChange }: { active: BoardTab; onChange: (t: BoardTab) => void }) {
  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
