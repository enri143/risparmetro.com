import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("spazi e maiuscole", () => {
    expect(slugify("Energia Verde Srl")).toBe("energia-verde-srl");
  });

  it("accenti e simboli", () => {
    expect(slugify("  Acmé & Co  ")).toBe("acme-co");
  });

  it("stringa vuota", () => {
    expect(slugify("")).toBe("");
  });

  it("trattini multipli collassati", () => {
    expect(slugify("Luce -- Gas  Srl")).toBe("luce-gas-srl");
  });

  it("solo simboli → stringa vuota", () => {
    expect(slugify("---")).toBe("");
  });
});
