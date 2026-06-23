import { describe, it, expect } from "vitest";
import { OBIEZIONI, SCALETTA_CHIUSURA, FRASI_CLOSE, COMPLIANCE } from "./copilotContent";

describe("copilotContent", () => {
  it("OBIEZIONI is non-empty", () => {
    expect(OBIEZIONI.length).toBeGreaterThan(0);
  });

  it("every OBIEZIONI item has non-empty obiezione and risposta", () => {
    for (const item of OBIEZIONI) {
      expect(item.obiezione.trim().length).toBeGreaterThan(0);
      expect(item.risposta.trim().length).toBeGreaterThan(0);
    }
  });

  it("SCALETTA_CHIUSURA is non-empty", () => {
    expect(SCALETTA_CHIUSURA.length).toBeGreaterThan(0);
  });

  it("FRASI_CLOSE is non-empty", () => {
    expect(FRASI_CLOSE.length).toBeGreaterThan(0);
  });

  it("COMPLIANCE is non-empty", () => {
    expect(COMPLIANCE.length).toBeGreaterThan(0);
  });
});
