import html2canvas from "html2canvas";
import type { DatiCliente, Impostazioni, NoteCliente, RisultatoOfferta } from "./types";
import { aliquotaIvaCliente, applicaIva } from "./iva";

export function buildShareCardHtml(luce: RisultatoOfferta[], gas: RisultatoOfferta[], dati: DatiCliente): HTMLDivElement {
  const data = new Date().toLocaleDateString("it-IT");
  const fmt = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 0 });
  const medals = ["🥇", "🥈", "🥉"];

  const block = (title: string, icon: string, items: RisultatoOfferta[], consumo: number, unit: string, prezzo: number) => {
    if (items.length === 0) return "";
    const top = items.slice(0, 3).filter((r) => r.risparmio > 0);
    if (top.length === 0) return `
      <div style="margin-top:18px">
        <div style="font-size:18px;font-weight:600;color:#0f172a">${icon} ${title} — Consumi: ${fmt(consumo)} ${unit}/anno</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:8px">Attualmente paghi: ${prezzo.toFixed(3).replace(".", ",")} €/${unit}</div>
        <div style="font-size:14px;color:#dc2626">Nessuna offerta migliorativa disponibile</div>
      </div>`;
    return `
      <div style="margin-top:18px">
        <div style="font-size:18px;font-weight:600;color:#0f172a">${icon} ${title} — Consumi: ${fmt(consumo)} ${unit}/anno</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:10px">Attualmente paghi: ${prezzo.toFixed(3).replace(".", ",")} €/${unit}</div>
        ${top.map((r, i) => `
          <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:10px 12px;margin-bottom:6px;border-radius:6px">
            <div style="font-weight:600;font-size:14px;color:#0f172a">${medals[i]} ${r.cte.nome} — ${r.cte.fornitore}</div>
            <div style="color:#15803d;font-weight:600;font-size:13px;margin-top:2px">Risparmio: +€${fmt(r.risparmio)}/anno (${r.risparmioPct.toFixed(0)}%)</div>
          </div>
        `).join("")}
      </div>`;
  };

  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:560px;background:#ffffff;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0f172a";
  wrap.innerHTML = `
    <div style="border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:8px">
      <div style="font-size:22px;font-weight:700">📊 Confronto Offerte Energia</div>
      <div style="font-size:13px;color:#64748b">Analisi del ${data}</div>
    </div>
    ${block("LUCE", "⚡", luce, dati.consumoLuce, "kWh", dati.prezzoLuce)}
    ${block("GAS", "🔥", gas, dati.consumoGas, "Smc", dati.prezzoGas)}
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
      Stima indicativa — i valori reali possono variare · Valori ARERA Q2 2026
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

export async function generaImmagineRisultati(luce: RisultatoOfferta[], gas: RisultatoOfferta[], dati: DatiCliente): Promise<Blob> {
  const wrap = buildShareCardHtml(luce, gas, dati);
  try {
    const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: "#ffffff", logging: false });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas vuoto"))), "image/png");
    });
  } finally {
    wrap.remove();
  }
}

export async function condividiOScarica(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string }) => Promise<void> };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Confronto Offerte Energia" });
      return "shared";
    } catch {
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────

function buildPdfHtml(
  luce: RisultatoOfferta[],
  gas: RisultatoOfferta[],
  dati: DatiCliente,
  noteCliente: NoteCliente,
  logoUrl: string,
  imp: Impostazioni,
): HTMLDivElement {
  const data = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const fmt2 = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 0 });
  const aliq = aliquotaIvaCliente(dati, imp);
  const ivaPct = Math.round(aliq * 100);

  const bestLuce = luce[0];
  const bestGas = gas[0];

  const barRow = (label: string, costoCliente: number, costoOfferta: number) => {
    const max = Math.max(costoCliente, costoOfferta, 1);
    const pctA = Math.round((costoCliente / max) * 100);
    const pctO = Math.round((costoOfferta / max) * 100);
    return `
      <div style="margin-bottom:8px">
        <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px">${label}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <div style="width:110px;flex-shrink:0;font-size:11px;color:#64748b;text-align:right">Spesa attuale</div>
          <div style="flex:1;background:#fee2e2;border-radius:4px;height:18px;overflow:hidden">
            <div style="background:#f87171;height:18px;width:${pctA}%;border-radius:4px"></div>
          </div>
          <div style="width:72px;flex-shrink:0;font-size:12px;font-weight:600;text-align:right">${fmt2(costoCliente)} €</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:110px;flex-shrink:0;font-size:11px;color:#64748b;text-align:right">Miglior offerta</div>
          <div style="flex:1;background:#dcfce7;border-radius:4px;height:18px;overflow:hidden">
            <div style="background:#4ade80;height:18px;width:${pctO}%;border-radius:4px"></div>
          </div>
          <div style="width:72px;flex-shrink:0;font-size:12px;font-weight:600;text-align:right">${fmt2(costoOfferta)} €</div>
        </div>
      </div>`;
  };

  const offerBlock = (label: string, r: RisultatoOfferta, unit: string) => {
    const pos = r.risparmio > 0;
    const color = pos ? "#15803d" : "#dc2626";
    const bg = pos ? "#f0fdf4" : "#fef2f2";
    const border = pos ? "#16a34a" : "#dc2626";
    return `
      <div style="margin-bottom:10px;padding:14px 16px;background:${bg};border-left:4px solid ${border};border-radius:6px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.07em;text-transform:uppercase;margin-bottom:5px">${label}</div>
        <div style="font-size:16px;font-weight:700;color:#0f172a">${r.cte.nome}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px">${r.cte.fornitore}</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;color:#94a3b8">Prezzo stimato</div>
            <div style="font-size:13px;font-weight:600;color:#0f172a">${fmt2(r.prezzoEffettivo)} €/${unit}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#94a3b8">${pos ? "Risparmio annuo" : "Maggior costo"}</div>
            <div style="font-size:14px;font-weight:700;color:${color}">+${fmt2(Math.abs(r.risparmio))} €/anno <span style="font-size:10px;font-weight:500;color:#64748b">(netto)</span></div>
            <div style="font-size:11px;font-weight:600;color:${color};margin-top:1px">+${fmt2(applicaIva(Math.abs(r.risparmio), aliq))} € IVA inclusa (${ivaPct}%)</div>
          </div>
          <div>
            <div style="font-size:10px;color:#94a3b8">Al mese</div>
            <div style="font-size:13px;font-weight:600;color:${color}">+${fmt2(Math.abs(r.risparmio) / 12)} €/mese <span style="font-size:9px;font-weight:500;color:#64748b">(netto)</span></div>
            <div style="font-size:10px;font-weight:600;color:${color};margin-top:1px">+${fmt2(applicaIva(Math.abs(r.risparmio), aliq) / 12)} €/mese IVA incl.</div>
          </div>
        </div>
      </div>`;
  };

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;left:-9999px;top:0;width:700px;background:#ffffff;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;box-sizing:border-box";

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:2px solid #e2e8f0;margin-bottom:20px">
      <img src="${logoUrl}" style="height:42px;width:auto;object-fit:contain" crossorigin="anonymous" />
      <div style="text-align:right">
        <div style="font-size:12px;color:#64748b;font-weight:500">www.lucegasvicenza.it</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px">Analisi gratuita · nessun obbligo</div>
      </div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:21px;font-weight:700;color:#0f172a;margin-bottom:6px">Analisi Comparativa Offerte Energia</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div style="font-size:13px;color:#64748b"><span style="font-weight:500">Data: </span>${data}</div>
        ${noteCliente.nomeCliente ? `<div style="font-size:13px;color:#64748b"><span style="font-weight:500">Cliente: </span>${noteCliente.nomeCliente}</div>` : ""}
        ${noteCliente.telefono ? `<div style="font-size:13px;color:#64748b"><span style="font-weight:500">Tel: </span>${noteCliente.telefono}</div>` : ""}
      </div>
    </div>

    ${(bestLuce || bestGas) ? `
    <div style="background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:18px">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Spesa annua stimata — prima e dopo</div>
      ${bestLuce ? barRow("⚡ Energia elettrica", bestLuce.costoCliente, bestLuce.costoOfferta) : ""}
      ${bestGas ? barRow("🔥 Gas naturale", bestGas.costoCliente, bestGas.costoOfferta) : ""}
    </div>` : ""}

    <div style="margin-bottom:18px">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">Migliori offerte selezionate</div>
      ${bestLuce ? offerBlock("Energia elettrica", bestLuce, "kWh") : ""}
      ${bestGas ? offerBlock("Gas naturale", bestGas, "Smc") : ""}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:18px">
      <div>
        <div style="font-size:15px;font-weight:700;color:#15803d">Costo del servizio di consulenza</div>
        <div style="font-size:11px;color:#16a34a;margin-top:2px">Analisi, comparazione e supporto alla firma inclusi</div>
      </div>
      <div style="font-size:26px;font-weight:800;color:#15803d">0 €</div>
    </div>

    <div style="background:#f8fafc;border-radius:6px;padding:8px 14px;margin-bottom:16px;display:flex;gap:20px;flex-wrap:wrap">
      ${dati.consumoLuce > 0 ? `<div style="font-size:12px;color:#64748b"><span style="font-weight:500">Consumo luce: </span>${fmt0(dati.consumoLuce)} kWh/anno</div>` : ""}
      ${dati.consumoGas > 0 ? `<div style="font-size:12px;color:#64748b"><span style="font-weight:500">Consumo gas: </span>${fmt0(dati.consumoGas)} Smc/anno</div>` : ""}
    </div>

    <div style="padding-top:10px;border-top:1px solid #e2e8f0;font-size:9.5px;color:#94a3b8;line-height:1.5">
      Stima indicativa basata sui dati forniti e sui prezzi di mercato ARERA vigenti. I valori reali possono variare in base ai consumi effettivi, alle condizioni contrattuali e alle eventuali variazioni tariffarie. La presente analisi è fornita a titolo puramente informativo e non costituisce offerta contrattuale.
    </div>`;

  document.body.appendChild(wrap);
  return wrap;
}

export async function generaPDF(
  luce: RisultatoOfferta[],
  gas: RisultatoOfferta[],
  dati: DatiCliente,
  noteCliente: NoteCliente,
  logoUrl: string,
  imp: Impostazioni,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const wrap = buildPdfHtml(luce, gas, dati, noteCliente, logoUrl, imp);
  try {
    const canvas = await html2canvas(wrap, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const margin = 10;
    const usableW = 210 - margin * 2; // 190mm
    const imgAspect = canvas.height / canvas.width;
    const imgH = usableW * imgAspect;
    // Se il contenuto supera la pagina, lo riduco proporzionalmente
    const maxH = 297 - margin * 2;
    const finalH = Math.min(imgH, maxH);
    const finalW = finalH < imgH ? usableW * (finalH / imgH) : usableW;
    const offsetX = margin + (usableW - finalW) / 2;

    pdf.addImage(imgData, "PNG", offsetX, margin, finalW, finalH);

    const slug = noteCliente.nomeCliente
      ? `_${noteCliente.nomeCliente.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}`
      : "";
    pdf.save(`analisi-energia${slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    wrap.remove();
  }
}
