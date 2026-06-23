import { describe, it, expect } from "vitest";
import { matchFornitore } from "./matchFornitore";

const F = [
  { id: "1", nome: "Enel Energia" },
  { id: "2", nome: "Hera Comm" },
  { id: "3", nome: "A2A Energia" },
];

describe("matchFornitore", () => {
  it("esatto match", () => {
    expect(matchFornitore("Enel Energia", F)).toBe("1");
  });

  it("fuzzy: estratto contenuto nel nome esistente", () => {
    expect(matchFornitore("Enel", F)).toBe("1");
  });

  it("fuzzy: A2A matches A2A Energia", () => {
    expect(matchFornitore("A2A", F)).toBe("3");
  });

  it("nessun match → null", () => {
    expect(matchFornitore("Acea", F)).toBeNull();
  });

  it("stringa vuota → null", () => {
    expect(matchFornitore("", F)).toBeNull();
  });
});
