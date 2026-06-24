import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { getStepperModel } from "./stepperModel";

interface Props {
  hasRisultati: boolean;
  hasTrattativa: boolean;
}

export function AnalisiStepper({ hasRisultati, hasTrattativa }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { accentColor } = useTenantBranding();
  const model = getStepperModel(pathname, hasRisultati, hasTrattativa);

  if (!model.visible) return null;

  return (
    <div
      data-testid="analisi-stepper"
      className="bg-surface-subtle border border-border-ui rounded-xl px-5 py-3 mb-5"
    >
      <div className="flex items-center">
        {model.steps.map((step, i) => (
          <div key={step.id} className={cn("flex items-center", i < model.steps.length - 1 && "flex-1 min-w-0")}>
            <button
              data-testid={`step-${step.id}`}
              type="button"
              onClick={() => {
                if (step.enabled && !step.active) navigate(`/board/analisi/${step.id}`, { viewTransition: true });
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 min-h-[44px] min-w-[44px] px-2 justify-center shrink-0 rounded-lg",
                "transition-opacity duration-150 motion-reduce:transition-none",
                step.active
                  ? "cursor-default"
                  : step.enabled
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-40",
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                  "transition-colors duration-150 motion-reduce:transition-none",
                  step.active
                    ? "bg-brand text-brand-foreground"
                    : step.completed
                    ? "bg-brand-subtle text-brand"
                    : step.enabled
                    ? "bg-white border border-border-ui text-text-base"
                    : "bg-white border border-border-ui text-text-placeholder",
                )}
              >
                {step.completed ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium leading-none whitespace-nowrap",
                  "transition-colors duration-150 motion-reduce:transition-none",
                  step.active
                    ? "text-brand font-semibold"
                    : step.completed
                    ? "text-brand-subtle-foreground"
                    : step.enabled
                    ? "text-text-muted"
                    : "text-text-placeholder",
                )}
              >
                {step.label}
              </span>
            </button>

            {i < model.steps.length - 1 && (
              <div
                className="flex-1 h-px mx-1 transition-colors duration-150 motion-reduce:transition-none"
                style={{
                  backgroundColor: step.completed ? accentColor : "var(--color-border-ui)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
