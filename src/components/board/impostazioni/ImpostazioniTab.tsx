import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useImpostazioni } from "../ImpostazioniContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, RotateCcw, BarChart3, RefreshCw, LogOut, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { Impostazioni } from "@/lib/board/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useShowIva, setShowIva } from "@/hooks/useShowIva";

const DEFAULTS: Partial<Impostazioni> = {
  pun_riferimento: 0.12, psv_riferimento: 0.41, ccr_gas: 0.02,
  perdite_rete: 1.10, sigma1_mese: 1.90, sigma2_kw_mese: 2.106, sigma3_uc3_kwh: 0.01057,
  oneri_luce_fisso_mese: 0.50, oneri_luce_var_kwh: 0.0350,
  accise_luce_dom: 0.0227, accise_luce_bus: 0.0125, soglia_esenzione_kwh_mese: 150,
  iva_dom: 0.10, iva_bus: 0.22, canone_rai_anno: 90, cdispd_anno: 1.23,
  gas_trasporto_fisso_mese: 4.75, gas_trasporto_var_smc: 0.042,
  gas_oneri_fisso_mese: 0.50, gas_oneri_var_smc: 0.040,
  gas_accise_1_smc: 0.044, gas_accise_2_smc: 0.175, gas_accise_soglia: 120,
  gas_add_regionale: 0.0155, gas_iva_soglia: 480,
};

interface FieldDef { key: keyof Impostazioni; label: string; step?: string; }

const LUCE_FIELDS: FieldDef[] = [
  { key: "perdite_rete", label: "Perdite rete (mult.)", step: "0.0001" },
  { key: "sigma1_mese", label: "σ1 fissa rete (€/mese)", step: "0.0001" },
  { key: "sigma2_kw_mese", label: "σ2 potenza (€/kW/mese)", step: "0.001" },
  { key: "sigma3_uc3_kwh", label: "σ3+UC3 (€/kWh)", step: "0.000001" },
  { key: "oneri_luce_fisso_mese", label: "Oneri fissi (€/mese)", step: "0.01" },
  { key: "oneri_luce_var_kwh", label: "Oneri variabili (€/kWh)", step: "0.000001" },
  { key: "accise_luce_dom", label: "Accise domestico (€/kWh)", step: "0.000001" },
  { key: "accise_luce_bus", label: "Accise business (€/kWh)", step: "0.000001" },
  { key: "soglia_esenzione_kwh_mese", label: "Soglia esenzione (kWh/mese)" },
  { key: "iva_dom", label: "IVA domestico (decimale)", step: "0.01" },
  { key: "iva_bus", label: "IVA business (decimale)", step: "0.01" },
  { key: "canone_rai_anno", label: "Canone RAI annuo (€)", step: "0.01" },
  { key: "cdispd_anno", label: "CDISPD annuo (€)", step: "0.0001" },
];

const GAS_FIELDS: FieldDef[] = [
  { key: "gas_trasporto_fisso_mese", label: "Trasporto fisso (€/mese)", step: "0.0001" },
  { key: "gas_trasporto_var_smc", label: "Trasporto variabile (€/Smc)", step: "0.000001" },
  { key: "gas_oneri_fisso_mese", label: "Oneri fissi (€/mese)", step: "0.01" },
  { key: "gas_oneri_var_smc", label: "Oneri variabili (€/Smc)", step: "0.000001" },
  { key: "gas_accise_1_smc", label: "Accise 1° scaglione (€/Smc)", step: "0.000001" },
  { key: "gas_accise_2_smc", label: "Accise oltre soglia (€/Smc)", step: "0.000001" },
  { key: "gas_accise_soglia", label: "Soglia accise (Smc/anno)" },
  { key: "gas_add_regionale", label: "Addizionale regionale (€/Smc)", step: "0.000001" },
  { key: "gas_iva_soglia", label: "Soglia IVA 10% (Smc/anno)" },
];

export function ImpostazioniTab() {
  const { impostazioni, save, reload, loading } = useImpostazioni();
  const [local, setLocal] = useState<Impostazioni | null>(null);
  const [fetchingMercato, setFetchingMercato] = useState(false);
  const navigate = useNavigate();
  const showIva = useShowIva();

  useEffect(() => { if (impostazioni) setLocal(impostazioni); }, [impostazioni]);

  if (loading || !local) return <div className="p-6">Caricamento...</div>;


  const set = (p: Partial<Impostazioni>) => setLocal({ ...local, ...p });

  const salvaMercato = async () => { await save({
    pun_riferimento: local.pun_riferimento,
    pun_f1: local.pun_f1, pun_f2: local.pun_f2, pun_f3: local.pun_f3,
    psv_riferimento: local.psv_riferimento, ccr_gas: local.ccr_gas,
  }); toast.success("Valori di mercato salvati"); };
  const salvaFutures = async () => {
    await save({
      pun_futures_1: local.pun_futures_1, pun_futures_2: local.pun_futures_2, pun_futures_3: local.pun_futures_3,
      psv_futures_1: local.psv_futures_1, psv_futures_2: local.psv_futures_2, psv_futures_3: local.psv_futures_3,
      futures_mese_1: local.futures_mese_1, futures_mese_2: local.futures_mese_2, futures_mese_3: local.futures_mese_3,
      futures_updated_at: new Date().toISOString(),
    });
    toast.success("Futures salvati");
  };
  const aggiornaMercatoAuto = async () => {
    setFetchingMercato(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-market-data", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Errore");
      await reload();
      toast.success("Mercato e futures aggiornati");
    } catch (e) {
      toast.error("Errore: " + (e as Error).message);
    } finally {
      setFetchingMercato(false);
    }
  };
  const salvaCoeff = async (fields: FieldDef[]) => {
    const patch: Partial<Impostazioni> = {};
    fields.forEach((f) => { (patch as Record<string, unknown>)[f.key] = local[f.key]; });
    await save(patch); toast.success("Coefficienti salvati");
  };
  const ripristina = async () => {
    if (!confirm("Ripristinare tutti i valori di default?")) return;
    await save(DEFAULTS); toast.success("Valori ripristinati");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/board/login", { replace: true });
  };

  const FieldGrid = ({ fields, onSave }: { fields: FieldDef[]; onSave: () => void }) => (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key as string}>
            <Label className="text-xs">{f.label}</Label>
            <Input type="number" step={f.step ?? "1"} value={(local[f.key] as number) ?? 0}
              onChange={(e) => set({ [f.key]: parseFloat(e.target.value) || 0 } as Partial<Impostazioni>)} />
          </div>
        ))}
      </div>
      <Button onClick={onSave} className="gap-2"><Save className="w-4 h-4" />Salva</Button>
    </div>
  );

  return (

    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-3xl">
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Visualizzazione risparmi</h3>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-medium">Mostra risparmi IVA inclusa</div>
          <Switch checked={showIva} onCheckedChange={setShowIva} />
        </div>
        <p className="text-xs text-muted-foreground">
          Quando attivo, i numeri di risparmio mostrati al cliente includono l'IVA
          (10% domestico residente, 22% business o non residente). L'ordinamento delle offerte non cambia.
        </p>
      </Card>

      <Card className="p-5 space-y-2">
        <p className="text-xs text-muted-foreground">
          🔐 Chiavi API e password Salesboard sono ora gestite come secret lato server.
          Per cambiare la password di accesso aggiorna il secret <code className="bg-muted px-1 rounded">BOARD_PASSWORD</code>;
          per l'analisi PDF il secret <code className="bg-muted px-1 rounded">CLAUDE_API_KEY</code>.
        </p>
      </Card>


      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /><h3 className="font-semibold">Valori di mercato</h3></div>
        <p className="text-xs text-muted-foreground">Aggiorna ogni mese per le offerte index. PUN da mercatoelettrico.org, PSV/CCR ARERA.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label className="text-xs">PUN (€/kWh)</Label><Input type="number" step="0.000001" value={local.pun_riferimento} onChange={(e) => set({ pun_riferimento: parseFloat(e.target.value) || 0 })} /></div>
          <div><Label className="text-xs">PSV (€/Smc)</Label><Input type="number" step="0.000001" value={local.psv_riferimento} onChange={(e) => set({ psv_riferimento: parseFloat(e.target.value) || 0 })} /></div>
          <div><Label className="text-xs">CCR gas (€/Smc)</Label><Input type="number" step="0.000001" value={local.ccr_gas} onChange={(e) => set({ ccr_gas: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-1">PUN per fasce orarie (opzionale)</div>
          <p className="text-[11px] text-muted-foreground mb-2">Usati solo quando il toggle Fasce è attivo nell'Analisi.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label className="text-xs">PUN F1 — ore piene</Label><Input type="number" step="0.000001" value={local.pun_f1 ?? 0} onChange={(e) => set({ pun_f1: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label className="text-xs">PUN F2 — intermedie</Label><Input type="number" step="0.000001" value={local.pun_f2 ?? 0} onChange={(e) => set({ pun_f2: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label className="text-xs">PUN F3 — ore vuote</Label><Input type="number" step="0.000001" value={local.pun_f3 ?? 0} onChange={(e) => set({ pun_f3: parseFloat(e.target.value) || 0 })} /></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={salvaMercato} className="gap-2"><Save className="w-4 h-4" />Salva</Button>
        </div>
      </Card>

      {/* FUTURES */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /><h3 className="font-semibold">Previsioni Futures</h3></div>
        <p className="text-xs text-muted-foreground">Prezzi previsti per i prossimi 3 mesi.</p>
        <div className="space-y-2">
          {([1, 2, 3] as const).map((m) => (
            <div key={m} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div>
                <Label className="text-xs">Mese {m}</Label>
                <Input placeholder="es. Luglio 2026" value={(local[`futures_mese_${m}` as const] as string) ?? ""}
                  onChange={(e) => set({ [`futures_mese_${m}`]: e.target.value } as Partial<Impostazioni>)} />
              </div>
              <div>
                <Label className="text-xs">PUN (€/kWh)</Label>
                <Input type="number" step="0.000001" value={(local[`pun_futures_${m}` as const] as number) ?? ""}
                  onChange={(e) => set({ [`pun_futures_${m}`]: e.target.value === "" ? null : parseFloat(e.target.value) } as Partial<Impostazioni>)} />
              </div>
              <div>
                <Label className="text-xs">PSV (€/Smc)</Label>
                <Input type="number" step="0.000001" value={(local[`psv_futures_${m}` as const] as number) ?? ""}
                  onChange={(e) => set({ [`psv_futures_${m}`]: e.target.value === "" ? null : parseFloat(e.target.value) } as Partial<Impostazioni>)} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">Ultimo aggiornamento: {local.futures_updated_at ? new Date(local.futures_updated_at).toLocaleString("it-IT") : "mai"}</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={salvaFutures} className="gap-2"><Save className="w-4 h-4" />Salva futures</Button>
          <Button onClick={aggiornaMercatoAuto} variant="outline" disabled={fetchingMercato} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", fetchingMercato && "animate-spin")} />
            {fetchingMercato ? "Aggiornamento..." : "🔄 Aggiorna automaticamente (mercato + futures)"}
          </Button>
        </div>
      </Card>

      <Accordion type="multiple" className="space-y-2">
        <Card className="px-4">
          <AccordionItem value="luce" className="border-0">
            <AccordionTrigger>Coefficienti ARERA Luce (avanzato)</AccordionTrigger>
            <AccordionContent><FieldGrid fields={LUCE_FIELDS} onSave={() => salvaCoeff(LUCE_FIELDS)} /></AccordionContent>
          </AccordionItem>
        </Card>
        <Card className="px-4">
          <AccordionItem value="gas" className="border-0">
            <AccordionTrigger>Coefficienti ARERA Gas (avanzato)</AccordionTrigger>
            <AccordionContent><FieldGrid fields={GAS_FIELDS} onSave={() => salvaCoeff(GAS_FIELDS)} /></AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>

      <Card className="p-5 space-y-3">
        <Button variant="destructive" onClick={logout} className="gap-2"><LogOut className="w-4 h-4" />🔒 Esci</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <Button variant="outline" onClick={ripristina} className="gap-2"><RotateCcw className="w-4 h-4" />Ripristina valori default</Button>
        <p className="text-xs text-muted-foreground">Valori ARERA indicativi. Aggiorna dopo ogni delibera trimestrale ARERA.</p>
      </Card>
    </div>
  );
}
