import { describe, it, expect } from "vitest";
import { getStepperModel } from "./stepperModel";

describe("getStepperModel", () => {
  it("/dati senza risultati: solo dati enabled, active=dati", () => {
    const model = getStepperModel("/board/analisi/dati", false, false);
    expect(model.visible).toBe(true);
    const byId = Object.fromEntries(model.steps.map((s) => [s.id, s]));
    expect(byId.dati.enabled).toBe(true);
    expect(byId.dati.active).toBe(true);
    expect(byId.dati.completed).toBe(false);
    expect(byId.offerte.enabled).toBe(false);
    expect(byId.offerte.active).toBe(false);
    expect(byId.presenta.enabled).toBe(false);
    expect(byId.chiudi.enabled).toBe(false);
  });

  it("/offerte con risultati: dati+offerte+presenta enabled, chiudi disabled, active=offerte", () => {
    const model = getStepperModel("/board/analisi/offerte", true, false);
    expect(model.visible).toBe(true);
    const byId = Object.fromEntries(model.steps.map((s) => [s.id, s]));
    expect(byId.dati.enabled).toBe(true);
    expect(byId.dati.completed).toBe(true);
    expect(byId.offerte.enabled).toBe(true);
    expect(byId.offerte.active).toBe(true);
    expect(byId.offerte.completed).toBe(false);
    expect(byId.presenta.enabled).toBe(true);
    expect(byId.chiudi.enabled).toBe(false);
  });

  it("/dettaglio: active=offerte, non active=dati", () => {
    const model = getStepperModel("/board/analisi/dettaglio", true, false);
    expect(model.visible).toBe(true);
    const active = model.steps.find((s) => s.active);
    expect(active?.id).toBe("offerte");
    expect(model.steps.find((s) => s.id === "dati")?.active).toBe(false);
  });

  it("/chiudi con trattativa: chiudi enabled e active, dati+offerte+presenta completed se hasRisultati", () => {
    const model = getStepperModel("/board/analisi/chiudi", true, true);
    expect(model.visible).toBe(true);
    const byId = Object.fromEntries(model.steps.map((s) => [s.id, s]));
    expect(byId.chiudi.enabled).toBe(true);
    expect(byId.chiudi.active).toBe(true);
    expect(byId.dati.completed).toBe(true);
    expect(byId.offerte.completed).toBe(true);
    expect(byId.presenta.completed).toBe(true);
  });

  it("/presenta: visible=false, steps vuoto", () => {
    const model = getStepperModel("/board/analisi/presenta", true, false);
    expect(model.visible).toBe(false);
    expect(model.steps).toHaveLength(0);
  });
});
