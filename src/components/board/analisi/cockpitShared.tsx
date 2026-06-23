export type ZonaRow = {
  id: string;
  regione: string;
  zona_elettrica: string;
  ambito_gas: string | null;
};

export type ClienteSeg = "domestico" | "business";
export type ResidenzaSeg = "residente" | "non_residente";
