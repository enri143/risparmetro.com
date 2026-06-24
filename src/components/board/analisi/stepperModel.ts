export type StepId = "dati" | "offerte" | "presenta" | "chiudi";

export interface StepInfo {
  id: StepId;
  label: string;
  enabled: boolean;
  active: boolean;
  completed: boolean;
}

export interface StepperModel {
  visible: boolean;
  steps: StepInfo[];
}

const STEP_ORDER: StepId[] = ["dati", "offerte", "presenta", "chiudi"];

const STEP_LABELS: Record<StepId, string> = {
  dati: "Dati",
  offerte: "Offerte",
  presenta: "Presenta",
  chiudi: "Chiudi",
};

function getActiveId(pathname: string): StepId {
  if (pathname.endsWith("/dati")) return "dati";
  if (pathname.endsWith("/offerte") || pathname.endsWith("/dettaglio")) return "offerte";
  if (pathname.endsWith("/chiudi")) return "chiudi";
  return "dati";
}

export function getStepperModel(
  pathname: string,
  hasRisultati: boolean,
  hasTrattativa: boolean,
): StepperModel {
  if (pathname.endsWith("/presenta")) {
    return { visible: false, steps: [] };
  }

  const activeId = getActiveId(pathname);
  const activeIndex = STEP_ORDER.indexOf(activeId);

  const steps: StepInfo[] = STEP_ORDER.map((id, i) => {
    const enabled =
      id === "dati"
        ? true
        : id === "offerte" || id === "presenta"
        ? hasRisultati
        : hasTrattativa;

    const active = id === activeId;
    const completed = i < activeIndex && enabled;

    return { id, label: STEP_LABELS[id], enabled, active, completed };
  });

  return { visible: true, steps };
}
