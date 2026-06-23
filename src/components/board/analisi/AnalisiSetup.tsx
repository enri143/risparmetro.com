import {
  ChevronDown,
  Flame,
  Search,
  User,
  Zap,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { UploadBollettaButton } from "./UploadBollettaButton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  type TipoFornitura,
  type UsoGas,
} from "@/lib/board/calcoloOfferte";
import type { ClienteSeg, ResidenzaSeg } from "./cockpitShared";
import type { AnalisiCtx } from "../AnalisiCockpit";

const TIPO_FORNITURA_OPT: { v: TipoFornitura; l: string }[] = [
  { v: "luce", l: "Luce" },
  { v: "gas", l: "Gas" },
  { v: "dual", l: "Luce + Gas" },
];

const USI_GAS_OPT: { v: UsoGas; l: string }[] = [
  { v: "riscaldamento", l: "Riscaldamento" },
  { v: "cottura_acs", l: "Cottura + ACS" },
  { v: "entrambi", l: "Entrambi" },
];

function SegControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; l: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex h-12 border border-border-ui rounded-lg bg-surface-subtle p-1 gap-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "flex-1 rounded-md text-sm font-medium transition-colors min-h-[40px] whitespace-nowrap px-2",
            value === o.v
              ? "bg-brand text-brand-foreground shadow-sm"
              : "text-text-muted hover:text-text-base hover:bg-surface-overlay",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function AnalisiSetup() {
  const {
    dati,
    set,
    clienteSeg,
    setClienteSeg,
    residenzaSeg,
    setResidenzaSeg,
    isBusiness,
    potenze,
    potenzaCustom,
    setPotenzaCustom,
    prezzoMateriaLuce,
    setPrezzoMateriaLuce,
    quotaFissaLuceAtt,
    setQuotaFissaLuceAtt,
    prezzoMateriaGas,
    setPrezzoMateriaGas,
    quotaFissaGasAtt,
    setQuotaFissaGasAtt,
    showLuce,
    showGas,
    regione,
    setRegione,
    showAdvanced,
    setShowAdvanced,
    zones,
    zonaInfo,
    prezziMercato,
    goToOfferte,
    resetResults,
    canCalcola,
    loadingZona,
    nomeCliente,
    setNomeCliente,
    cognomeCliente,
    setCognomeCliente,
    ragioneSocialeCliente,
    setRagioneSocialeCliente,
    telefonoCliente,
    setTelefonoCliente,
    noteCliente,
    setNoteCliente,
    indirizzoCliente,
    setIndirizzoCliente,
    comuneCliente,
    setComuneCliente,
    capCliente,
    setCapCliente,
    provinciaCliente,
    setProvinciaCliente,
    podCliente,
    setPodCliente,
    pdrCliente,
    setPdrCliente,
    fornitoreAttualeCliente,
    setFornitoreAttualeCliente,
    offertaAttualeCliente,
    setOffertaAttualeCliente,
    scadenzaOffertaCliente,
    setScadenzaOffertaCliente,
    clienteDettaglioOpen,
    setClienteDettaglioOpen,
    handleOcrApply,
    handleOcrDone,
  } = useOutletContext<AnalisiCtx>();
  return (
    <div data-testid="analisi-setup" className="grid xl:grid-cols-12 gap-5 items-start">
      {/* Form */}
      <div className="xl:col-span-7 bg-white border border-border-ui rounded-xl p-6 shadow-sm space-y-6">

        {/* 1 — Tipo fornitura + Tipo cliente */}
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Tipo fornitura
            </label>
            <SegControl
              options={TIPO_FORNITURA_OPT}
              value={dati.tipo_fornitura}
              onChange={(v) => set({ tipo_fornitura: v })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Tipo cliente
            </label>
            <SegControl<ClienteSeg>
              options={[
                { v: "domestico", l: "Domestico" },
                { v: "business", l: "Business" },
              ]}
              value={clienteSeg}
              onChange={(v) => {
                setClienteSeg(v);
                set({ potenza_impegnata_kw: v === "business" ? 6 : 3 });
              }}
            />
          </div>
        </div>

        {/* 2 — Residenza (solo domestico) */}
        {!isBusiness && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Residenza
            </label>
            <SegControl<ResidenzaSeg>
              options={[
                { v: "residente", l: "Residente" },
                { v: "non_residente", l: "Non residente" },
              ]}
              value={residenzaSeg}
              onChange={setResidenzaSeg}
            />
          </div>
        )}

        {/* 3 — Potenza disponibile */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Potenza disponibile (kW)
          </label>
          <div className="relative">
            <select
              value={potenzaCustom ? "altro" : (dati.potenza_impegnata_kw?.toString() ?? "3")}
              onChange={(e) => {
                if (e.target.value === "altro") {
                  setPotenzaCustom(true);
                } else {
                  setPotenzaCustom(false);
                  set({ potenza_impegnata_kw: parseFloat(e.target.value) });
                }
              }}
              className="w-full h-12 rounded-lg border border-border-ui bg-surface-subtle px-4 text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand appearance-none"
            >
              {potenze.map((p) => (
                <option key={p} value={p.toString()}>
                  {p} kW
                </option>
              ))}
              <option value="altro">Altro...</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>
          {potenzaCustom && (
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={dati.potenza_impegnata_kw ?? ""}
              onChange={(e) =>
                set({ potenza_impegnata_kw: parseFloat(e.target.value) || 0 })
              }
              placeholder="kW personalizzato"
              className="h-12 w-full px-4 text-sm rounded-lg border border-brand/40 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
            />
          )}
        </div>

        {/* 4 — Blocco LUCE */}
        {showLuce && (
          <div className="bg-surface-subtle border border-border-ui rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-text-base">Energia Elettrica</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                  Consumo annuo (kWh)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={dati.consumo_annuo_kwh ?? ""}
                  onChange={(e) =>
                    set({ consumo_annuo_kwh: parseInt(e.target.value) || 0 })
                  }
                  className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                  placeholder="es. 2700"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                  Prezzo materia prima (€/kWh)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.0001}
                  value={prezzoMateriaLuce}
                  onChange={(e) => {
                    setPrezzoMateriaLuce(e.target.value);
                    resetResults();
                  }}
                  className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                  placeholder="es. 0.1250"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                  Quota fissa (€/mese)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={quotaFissaLuceAtt}
                  onChange={(e) => {
                    setQuotaFissaLuceAtt(e.target.value);
                    resetResults();
                  }}
                  className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                  placeholder="es. 14.50"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5 — Blocco GAS */}
        {showGas && (
          <div className="bg-surface-subtle border border-border-ui rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-text-base">Gas Naturale</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                  Consumo annuo (Smc)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={dati.consumo_annuo_smc ?? ""}
                  onChange={(e) =>
                    set({ consumo_annuo_smc: parseInt(e.target.value) || 0 })
                  }
                  className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                  placeholder="es. 1200"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                  Prezzo materia prima (€/Smc)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.001}
                  value={prezzoMateriaGas}
                  onChange={(e) => {
                    setPrezzoMateriaGas(e.target.value);
                    resetResults();
                  }}
                  className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                  placeholder="es. 0.420"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                  Quota fissa (€/mese)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={quotaFissaGasAtt}
                  onChange={(e) => {
                    setQuotaFissaGasAtt(e.target.value);
                    resetResults();
                  }}
                  className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                  placeholder="es. 12.00"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6 — Toggle dettagli avanzati */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors"
        >
          <ChevronDown
            className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")}
          />
          {showAdvanced ? "Nascondi dettagli" : "Dettagli per calcolo preciso"}
        </button>

        {/* 7 — Sezione avanzata */}
        {showAdvanced && (
          <div className="pt-4 border-t border-border-ui space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Zona ARERA — regione cliente
              </label>
              <div className="relative">
                <select
                  value={regione}
                  onChange={(e) => {
                    setRegione(e.target.value);
                    resetResults();
                  }}
                  className="w-full h-12 rounded-lg border border-border-ui bg-surface-subtle px-4 text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand appearance-none"
                >
                  <option value="">— Seleziona per calcolo preciso —</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.regione}>
                      {z.regione} · {z.zona_elettrica}
                      {z.ambito_gas ? ` / ${z.ambito_gas}` : " (no gas)"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              </div>
              {zonaInfo && (
                <p className="text-[11px] text-text-muted">
                  PUN: {(prezziMercato.pun_medio * 100).toFixed(2)} c€/kWh · PSV:{" "}
                  {prezziMercato.psv_medio.toFixed(3)} €/Smc (media 30 gg)
                </p>
              )}
            </div>

            {showGas && zonaInfo?.ambito_gas && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Uso gas
                </label>
                <SegControl
                  options={USI_GAS_OPT}
                  value={dati.uso_gas ?? "riscaldamento"}
                  onChange={(v) => set({ uso_gas: v })}
                />
              </div>
            )}
          </div>
        )}

        {/* 8 — Cliente (opzionale) */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-dashed border-muted-foreground/30">
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <User className="w-4 h-4" />
            <span>Cliente</span>
            <span className="text-xs opacity-70">opzionale, serve solo se vuoi salvare</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                Nome cliente
              </label>
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                placeholder="Mario Rossi"
              />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                Telefono
              </label>
              <input
                type="tel"
                value={telefonoCliente}
                onChange={(e) => setTelefonoCliente(e.target.value)}
                className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                placeholder="333 1234567"
              />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                Note
              </label>
              <input
                type="text"
                value={noteCliente}
                onChange={(e) => setNoteCliente(e.target.value)}
                className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                placeholder="es. vuole offerta verde"
              />
            </div>
          </div>

          {/* Anagrafica / fornitura — espandibile */}
          <Collapsible open={clienteDettaglioOpen} onOpenChange={setClienteDettaglioOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-1 py-1.5 text-sm text-text-muted hover:text-text-base transition-colors min-h-[44px]">
              <span className="font-medium">Dati anagrafica / fornitura</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  clienteDettaglioOpen && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Cognome
                  </label>
                  <input
                    type="text"
                    value={cognomeCliente}
                    onChange={(e) => setCognomeCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="Rossi"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Ragione sociale
                  </label>
                  <input
                    type="text"
                    value={ragioneSocialeCliente}
                    onChange={(e) => setRagioneSocialeCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="Acme Srl"
                  />
                </div>
                <div className="relative sm:col-span-2">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={indirizzoCliente}
                    onChange={(e) => setIndirizzoCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="Via Roma 1"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Comune
                  </label>
                  <input
                    type="text"
                    value={comuneCliente}
                    onChange={(e) => setComuneCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="Milano"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                      CAP
                    </label>
                    <input
                      type="text"
                      value={capCliente}
                      onChange={(e) => setCapCliente(e.target.value)}
                      className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                      placeholder="20100"
                    />
                  </div>
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                      Provincia
                    </label>
                    <input
                      type="text"
                      value={provinciaCliente}
                      onChange={(e) => setProvinciaCliente(e.target.value)}
                      maxLength={2}
                      className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                      placeholder="MI"
                    />
                  </div>
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    POD
                  </label>
                  <input
                    type="text"
                    value={podCliente}
                    onChange={(e) => setPodCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="IT001E12345678"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    PDR
                  </label>
                  <input
                    type="text"
                    value={pdrCliente}
                    onChange={(e) => setPdrCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="12345678901234"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Fornitore attuale
                  </label>
                  <input
                    type="text"
                    value={fornitoreAttualeCliente}
                    onChange={(e) => setFornitoreAttualeCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="Enel"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Offerta attuale
                  </label>
                  <input
                    type="text"
                    value={offertaAttualeCliente}
                    onChange={(e) => setOffertaAttualeCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand placeholder:text-text-placeholder"
                    placeholder="Luce Flex"
                  />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] font-medium text-text-muted">
                    Scadenza offerta
                  </label>
                  <input
                    type="date"
                    value={scadenzaOffertaCliente}
                    onChange={(e) => setScadenzaOffertaCliente(e.target.value)}
                    className="h-12 w-full px-4 text-sm rounded-lg border border-border-ui bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* 9 — CTA */}
        <button
          type="button"
          disabled={!canCalcola}
          onClick={() => {
            goToOfferte();
          }}
          className={cn(
            "w-full h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all",
            canCalcola
              ? "bg-brand text-brand-foreground hover:bg-brand-hover shadow-sm"
              : "bg-surface-subtle text-text-muted cursor-not-allowed",
          )}
        >
          <Search className="w-5 h-5" />
          {loadingZona ? "Caricamento parametri…" : "Confronta offerte"}
        </button>
      </div>

      {/* Dropzone bolletta */}
      <div className="xl:col-span-5 min-h-[240px] flex flex-col justify-center">
        <UploadBollettaButton
          dati={{
            segmento: isBusiness ? "business" : "family",
            potenzaKw: dati.potenza_impegnata_kw ?? 3,
            residente: residenzaSeg === "residente",
            canoneRai: false,
            consumoLuce: dati.consumo_annuo_kwh ?? 0,
            prezzoLuce: parseFloat(prezzoMateriaLuce) || 0,
            fissoLuceMese: parseFloat(quotaFissaLuceAtt) || 0,
            consumoGas: dati.consumo_annuo_smc ?? 0,
            prezzoGas: parseFloat(prezzoMateriaGas) || 0,
            fissoGasMese: parseFloat(quotaFissaGasAtt) || 0,
          }}
          onApply={handleOcrApply}
          onOcrDone={handleOcrDone}
        />
      </div>
    </div>
  );
}
