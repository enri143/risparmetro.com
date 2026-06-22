import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── Tipi ─────────────────────────────────────────────────────────────────────

interface CrlRow {
  id: string;
  validita_da: string;
  validita_a: string;
  sigma1_mese: number;
  sigma2_kw_mese: number;
  sigma3_uc3_kwh: number;
  oneri_luce_fisso_mese: number;
  oneri_luce_var_kwh: number;
  oneri_asos_fisso_nonres: number | null;
  accise_luce_dom: number;
  accise_luce_bus: number;
  soglia_esenzione_kwh_mese: number;
  iva_dom: number;
  iva_bus: number;
  perdite_rete: number;
  cdispd_anno: number;
  canone_rai_anno: number;
  note: string | null;
}

type FormState = {
  validita_da: string;
  validita_a: string;
  sigma1_mese: string;
  sigma2_kw_mese: string;
  sigma3_uc3_kwh: string;
  oneri_luce_fisso_mese: string;
  oneri_luce_var_kwh: string;
  oneri_asos_fisso_nonres: string;
  accise_luce_dom: string;
  accise_luce_bus: string;
  soglia_esenzione_kwh_mese: string;
  iva_dom: string;
  iva_bus: string;
  perdite_rete: string;
  cdispd_anno: string;
  canone_rai_anno: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  validita_da: "",
  validita_a: "",
  sigma1_mese: "",
  sigma2_kw_mese: "",
  sigma3_uc3_kwh: "",
  oneri_luce_fisso_mese: "",
  oneri_luce_var_kwh: "",
  oneri_asos_fisso_nonres: "",
  accise_luce_dom: "",
  accise_luce_bus: "",
  soglia_esenzione_kwh_mese: "",
  iva_dom: "",
  iva_bus: "",
  perdite_rete: "",
  cdispd_anno: "",
  canone_rai_anno: "",
  note: "",
};

function rowToForm(row: CrlRow): FormState {
  return {
    validita_da: row.validita_da,
    validita_a: row.validita_a,
    sigma1_mese: String(row.sigma1_mese),
    sigma2_kw_mese: String(row.sigma2_kw_mese),
    sigma3_uc3_kwh: String(row.sigma3_uc3_kwh),
    oneri_luce_fisso_mese: String(row.oneri_luce_fisso_mese),
    oneri_luce_var_kwh: String(row.oneri_luce_var_kwh),
    oneri_asos_fisso_nonres: row.oneri_asos_fisso_nonres != null ? String(row.oneri_asos_fisso_nonres) : "",
    accise_luce_dom: String(row.accise_luce_dom),
    accise_luce_bus: String(row.accise_luce_bus),
    soglia_esenzione_kwh_mese: String(row.soglia_esenzione_kwh_mese),
    iva_dom: String(row.iva_dom),
    iva_bus: String(row.iva_bus),
    perdite_rete: String(row.perdite_rete),
    cdispd_anno: String(row.cdispd_anno),
    canone_rai_anno: String(row.canone_rai_anno),
    note: row.note ?? "",
  };
}

// ── Componente ────────────────────────────────────────────────────────────────

export function AreraTab() {
  const [rows, setRows] = useState<CrlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("componenti_regolate_luce")
      .select("*")
      .order("validita_da", { ascending: false });
    if (error) {
      toast.error("Errore caricamento: " + error.message);
    } else {
      setRows((data ?? []) as CrlRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function openEdit(row: CrlRow) {
    setForm(rowToForm(row));
    setEditingId(row.id);
  }

  function cancel() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function n(v: string) { return parseFloat(v); }
  function i(v: string) { return parseInt(v, 10); }

  function validate(): string | null {
    if (!form.validita_da) return "Data inizio obbligatoria";
    if (!form.validita_a) return "Data fine obbligatoria";
    if (form.validita_a < form.validita_da) return "Data fine deve essere ≥ data inizio";
    const req: (keyof FormState)[] = [
      "sigma1_mese", "sigma2_kw_mese", "sigma3_uc3_kwh",
      "oneri_luce_fisso_mese", "oneri_luce_var_kwh",
      "accise_luce_dom", "accise_luce_bus", "soglia_esenzione_kwh_mese",
      "iva_dom", "iva_bus", "perdite_rete", "cdispd_anno", "canone_rai_anno",
    ];
    for (const k of req) {
      if (form[k] === "" || isNaN(n(form[k]))) return `Campo ${k} obbligatorio e numerico`;
    }
    const ivaDom = n(form.iva_dom);
    const ivaBus = n(form.iva_bus);
    if (ivaDom < 0 || ivaDom > 1) return "iva_dom deve essere tra 0 e 1 (es. 0.10)";
    if (ivaBus < 0 || ivaBus > 1) return "iva_bus deve essere tra 0 e 1 (es. 0.22)";
    if (form.note.length > 500) return "Note max 500 caratteri";
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);

    const payload = {
      validita_da: form.validita_da,
      validita_a: form.validita_a,
      sigma1_mese: n(form.sigma1_mese),
      sigma2_kw_mese: n(form.sigma2_kw_mese),
      sigma3_uc3_kwh: n(form.sigma3_uc3_kwh),
      oneri_luce_fisso_mese: n(form.oneri_luce_fisso_mese),
      oneri_luce_var_kwh: n(form.oneri_luce_var_kwh),
      oneri_asos_fisso_nonres: form.oneri_asos_fisso_nonres !== "" ? n(form.oneri_asos_fisso_nonres) : null,
      accise_luce_dom: n(form.accise_luce_dom),
      accise_luce_bus: n(form.accise_luce_bus),
      soglia_esenzione_kwh_mese: i(form.soglia_esenzione_kwh_mese),
      iva_dom: n(form.iva_dom),
      iva_bus: n(form.iva_bus),
      perdite_rete: n(form.perdite_rete),
      cdispd_anno: n(form.cdispd_anno),
      canone_rai_anno: n(form.canone_rai_anno),
      note: form.note || null,
    };

    let error;
    if (editingId === "new") {
      ({ error } = await supabase.from("componenti_regolate_luce").insert(payload));
    } else {
      ({ error } = await supabase.from("componenti_regolate_luce").update(payload).eq("id", editingId!));
    }

    setSaving(false);
    if (error) {
      const msg = error.code === "42501" ? "Non autorizzato" : error.message;
      toast.error("Errore: " + msg);
    } else {
      toast.success(editingId === "new" ? "Trimestre creato" : "Trimestre aggiornato");
      cancel();
      load();
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Sicuro? L'operazione è irreversibile.")) return;
    const { error } = await supabase.from("componenti_regolate_luce").delete().eq("id", id);
    if (error) {
      const msg = error.code === "42501" ? "Non autorizzato" : error.message;
      toast.error("Errore: " + msg);
    } else {
      toast.success("Trimestre eliminato");
      load();
    }
  }

  function field(
    label: string,
    key: keyof FormState,
    opts?: { type?: string; step?: string; placeholder?: string; required?: boolean },
  ) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-gray-500">{label}</Label>
        <Input
          type={opts?.type ?? "number"}
          step={opts?.step ?? "0.000001"}
          placeholder={opts?.placeholder}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="h-8 text-sm"
        />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="text-sm text-gray-400 py-8 text-center">Caricamento...</p>;
  }

  // Form
  if (editingId !== null) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">
            {editingId === "new" ? "Nuovo trimestre ARERA" : "Modifica trimestre ARERA"}
          </h3>
        </div>

        {/* Validità */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Validità</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Data inizio</Label>
              <Input
                type="date"
                value={form.validita_da}
                onChange={(e) => setForm((f) => ({ ...f, validita_da: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Data fine</Label>
              <Input
                type="date"
                value={form.validita_a}
                onChange={(e) => setForm((f) => ({ ...f, validita_a: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Rete (sigma) */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rete (sigma ARERA)</p>
          <div className="grid grid-cols-3 gap-3">
            {field("σ1 quota fissa (€/mese)", "sigma1_mese")}
            {field("σ2 quota potenza (€/kW/mese)", "sigma2_kw_mese")}
            {field("σ3 / UC3 (€/kWh)", "sigma3_uc3_kwh")}
          </div>
        </section>

        {/* Oneri di sistema */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Oneri di sistema</p>
          <div className="grid grid-cols-3 gap-3">
            {field("Fisso (€/mese)", "oneri_luce_fisso_mese")}
            {field("Variabile (€/kWh)", "oneri_luce_var_kwh")}
            {field("ASOS non-res (€/anno, opt.)", "oneri_asos_fisso_nonres", { placeholder: "opzionale" })}
          </div>
        </section>

        {/* Imposte e accise */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Imposte e accise</p>
          <div className="grid grid-cols-3 gap-3">
            {field("Accise domestico (€/kWh)", "accise_luce_dom")}
            {field("Accise business (€/kWh)", "accise_luce_bus")}
            {field("Soglia esenzione (kWh/mese)", "soglia_esenzione_kwh_mese", { step: "1", placeholder: "150" })}
            {field("IVA domestico (0-1)", "iva_dom", { step: "0.01", placeholder: "0.10" })}
            {field("IVA business (0-1)", "iva_bus", { step: "0.01", placeholder: "0.22" })}
          </div>
        </section>

        {/* Altri costi fissi */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Altri costi fissi</p>
          <div className="grid grid-cols-3 gap-3">
            {field("Perdite rete (moltiplicatore)", "perdite_rete", { step: "0.0001", placeholder: "1.10" })}
            {field("Cdispd (€/anno)", "cdispd_anno", { step: "0.01" })}
            {field("Canone RAI (€/anno)", "canone_rai_anno", { step: "0.01" })}
          </div>
        </section>

        {/* Note */}
        <section className="space-y-1">
          <Label className="text-xs text-gray-500">Note (opzionale, max 500 caratteri)</Label>
          <Textarea
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            maxLength={500}
            rows={2}
            className="text-sm resize-none"
            placeholder="Fonte dati, delibera ARERA, ecc."
          />
        </section>

        {/* Azioni */}
        <div className="flex gap-3 pt-2">
          <Button onClick={save} disabled={saving} className="h-9 px-6">
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
          <Button variant="outline" onClick={cancel} disabled={saving} className="h-9 px-6">
            Annulla
          </Button>
        </div>
      </div>
    );
  }

  // Lista
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Componenti ARERA luce</h3>
        <Button onClick={openNew} className="h-9 px-4 text-sm">
          + Nuovo trimestre ARERA
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Nessun trimestre presente.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Periodo</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Perdite</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">σ1 (€/mese)</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">IVA dom</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Note</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.validita_da} → {row.validita_a}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{row.perdite_rete}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{row.sigma1_mese}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{row.iva_dom}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400 truncate max-w-[120px]">
                    {row.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={() => openEdit(row)}
                      >
                        Modifica
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => deleteRow(row.id)}
                      >
                        Elimina
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
