/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building,
  Calendar,
  Layers,
  HelpCircle,
  Hash,
  Coins,
  RefreshCw,
  Cpu,
  Sparkles
} from "lucide-react";
import { ScannedDocument, ScannedLine } from "../types";

interface OcrReviewProps {
  scannedDoc: ScannedDocument | null;
  imageUrl: string;
  providerUsed?: string;
  onApprove: (finalDoc: ScannedDocument) => Promise<void>;
  onDiscard: () => void;
  isSaving: boolean;
}

export default function OcrReview({
  scannedDoc,
  imageUrl,
  providerUsed,
  onApprove,
  onDiscard,
  isSaving
}: OcrReviewProps) {
  // Form State
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [pIva, setPIva] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [tipo, setTipo] = useState<"ddt" | "fattura">("ddt");
  const [righe, setRighe] = useState<ScannedLine[]>([]);

  // Interactive Image Viewport State
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Helper to detect invalid lot strings like "null", "N/A", "non trovato"
  const isInvalidLotString = (val: any) => {
    if (!val || typeof val !== "string") return true;
    const lower = val.trim().toLowerCase();
    return ["null", "n/a", "nd", "n/d", "none", "non trovato", "non specificato", "undefined", "-", "--"].includes(lower);
  };

  // Helper to infer or generate a lot from row data and doc number
  const generateLotForRow = (row: ScannedLine, index: number, docNum: string) => {
    const cleanDoc = (docNum || "").replace(/[^a-zA-Z0-9]/g, "");
    const matchCode = (row.nome_prodotto || "").match(/\b([A-Z]{2,4}[-_]?[0-9]{2,6})\b/i);
    if (matchCode) {
      const codeClean = matchCode[1].toUpperCase();
      return cleanDoc ? `${codeClean}-${cleanDoc}` : codeClean;
    }
    if (cleanDoc) {
      return `L-${cleanDoc}-${String(index + 1).padStart(2, "0")}`;
    }
    return `LT-${Date.now().toString().slice(-4)}-${index + 1}`;
  };

  // Automatically assign traceable lots to all rows missing one
  const autoAssignMissingLots = () => {
    const updated = righe.map((r, idx) => {
      if (!r.numero_lotto || isInvalidLotString(r.numero_lotto)) {
        return {
          ...r,
          numero_lotto: generateLotForRow(r, idx, numeroDocumento)
        };
      }
      return r;
    });
    setRighe(updated);
  };

  // Initialize form with scanned values
  useEffect(() => {
    if (scannedDoc) {
      const docNum = scannedDoc.numero_documento || "";
      setRagioneSociale(scannedDoc.ragione_sociale_fornitore || "");
      setPIva(scannedDoc.p_iva || "");
      setNumeroDocumento(docNum);
      setDataDocumento(scannedDoc.data_documento || "");
      
      // Infer tipo (DDT/Invoice)
      if (scannedDoc.tipo === "fattura" || scannedDoc.tipo === "ddt") {
        setTipo(scannedDoc.tipo);
      } else {
        const docNumLower = docNum.toLowerCase();
        if (docNumLower.includes("fatt") || docNumLower.includes("inv") || docNumLower.includes("f.")) {
          setTipo("fattura");
        } else {
          setTipo("ddt");
        }
      }

      // Sanitize lines: eliminate any literal "null" or "N/A" and infer smart batch if missing
      const rawLines = scannedDoc.elenco_righe || [];
      const sanitizedLines = rawLines.map((r, idx) => {
        let lot = r.numero_lotto;
        if (isInvalidLotString(lot)) {
          lot = generateLotForRow(r, idx, docNum);
        }
        let exp = r.data_scadenza;
        if (exp && isInvalidLotString(exp)) {
          exp = "";
        }
        return {
          ...r,
          numero_lotto: lot ? lot.trim() : "",
          data_scadenza: exp ? exp.trim() : ""
        };
      });

      setRighe(sanitizedLines);
    }
  }, [scannedDoc]);

  // Handle cell modifications
  const handleLineChange = (index: number, key: keyof ScannedLine, value: any) => {
    const updated = [...righe];
    let sanitizedValue = value;
    if (key === "numero_lotto" && typeof value === "string") {
      if (value.trim().toLowerCase() === "null") {
        sanitizedValue = "";
      }
    }
    updated[index] = {
      ...updated[index],
      [key]: sanitizedValue
    };
    setRighe(updated);
  };

  // Add empty row
  const addRow = () => {
    setRighe([
      ...righe,
      {
        nome_prodotto: "",
        quantita: 0,
        unita_misura: "kg",
        prezzo_unitario: 0,
        numero_lotto: "",
        data_scadenza: ""
      }
    ]);
  };

  // Delete specific row
  const deleteRow = (index: number) => {
    setRighe(righe.filter((_, idx) => idx !== index));
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetImage = () => {
    setZoom(1);
    setRotation(0);
  };

  // Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragioneSociale.trim()) {
      alert("Il nome del fornitore è obbligatorio.");
      return;
    }
    if (righe.length === 0) {
      alert("Il documento deve avere almeno una riga prodotto.");
      return;
    }

    onApprove({
      tipo: tipo,
      ragione_sociale_fornitore: ragioneSociale,
      p_iva: pIva,
      numero_documento: numeroDocumento,
      data_documento: dataDocumento,
      elenco_righe: righe.map(r => ({
        ...r,
        // sanitize types
        quantita: Number(r.quantita || 0),
        prezzo_unitario: Number(r.prezzo_unitario || 0),
        numero_lotto: r.numero_lotto ? r.numero_lotto.trim() : null,
        data_scadenza: r.data_scadenza ? r.data_scadenza.trim() : null
      }))
    });
  };

  // Highlights and warns if any lot or expiry is missing
  const hasValidationWarnings = righe.some((r) => !r.numero_lotto || !r.data_scadenza);

  return (
    <div className="flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-160px)]" id="ocr-review-stage">
      {/* LEFT PANEL: Interactive Image Frame & Simulated Document Receipt */}
      <div className="xl:w-1/2 flex flex-col bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-md relative" id="image-panel">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between z-10 text-white">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-bold font-mono tracking-widest text-slate-300 uppercase">Visualizzatore Documento</span>
          </div>
          
          {/* Controls toolbar */}
          <div className="flex items-center gap-1.5" id="image-toolbar">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              title="Zoom Avanti"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              title="Zoom Indietro"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              title="Ruota 90°"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={handleResetImage}
              className="text-xs px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-semibold transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Viewport Box */}
        <div className="flex-1 min-h-[350px] sm:min-h-[450px] flex items-center justify-center p-6 overflow-hidden relative bg-radial from-slate-950 to-slate-900" id="viewport-box">
          
          {/* Actual image or visual carbon-copy simulator if image represents demo or manual */}
          {(imageUrl && !imageUrl.startsWith("manual")) ? (
            <div
              className="transition-transform duration-200 ease-out max-w-full max-h-full"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              {imageUrl.includes("demo_") ? (
                // Super cool simulated delivery receipt
                <div className="bg-amber-50/95 border-2 border-dashed border-amber-800/20 p-8 rounded-lg shadow-xl text-amber-950 max-w-[400px] font-mono text-xs space-y-6 relative select-none">
                  <div className="absolute top-2 right-2 text-[10px] text-amber-900 border border-amber-900/30 px-1.5 py-0.5 rounded-sm font-sans uppercase">
                    Copia Laboratorio
                  </div>
                  
                  {/* Receipt Header */}
                  <div className="text-center pb-4 border-b border-dashed border-amber-950/20">
                    <h4 className="font-extrabold text-sm uppercase tracking-wide">{ragioneSociale || "FORNITORE CERTIFICATO"}</h4>
                    <p className="text-[10px] text-amber-800 mt-1">Sito Industriale Autorizzato HACCP</p>
                    <p className="text-[10px]">P.IVA: {pIva || "N/D"}</p>
                  </div>

                  {/* Document specifications */}
                  <div className="grid grid-cols-2 gap-2 py-2 text-[11px] border-b border-dashed border-amber-950/20">
                    <div>
                      <p className="text-amber-800 font-sans">Documento:</p>
                      <p className="font-bold uppercase">{tipo} N. {numeroDocumento || "ND"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-800 font-sans">Data consegna:</p>
                      <p className="font-bold">{dataDocumento || "ND"}</p>
                    </div>
                  </div>

                  {/* Document line details */}
                  <div className="space-y-3 pt-2">
                    <p className="font-sans font-bold text-[10px] uppercase text-amber-800 tracking-wider">Merci Consegnate:</p>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-amber-950/20 text-[9px] text-amber-800 font-sans">
                          <th className="py-1">Descrizione</th>
                          <th className="py-1 text-right">Qta</th>
                          <th className="py-1 text-right">Lotto / Scad.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-950/10">
                        {righe.map((row, idx) => (
                          <tr key={idx} className="text-[10px]">
                            <td className="py-1.5 pr-2 font-bold">{row.nome_prodotto || "Prodotto"}</td>
                            <td className="py-1.5 text-right font-bold">{row.quantita} {row.unita_misura}</td>
                            <td className="py-1.5 text-right font-mono text-[9px]">
                              <div>L: {row.numero_lotto || "N/D"}</div>
                              <div className="text-amber-800 font-sans">Scad: {row.data_scadenza || "N/D"}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footnote */}
                  <div className="text-center pt-4 border-t border-dashed border-amber-950/20 text-[9px] text-amber-800">
                    Merci controllate alla ricezione. Conforme agli standard igienici HACCP.
                  </div>
                </div>
              ) : (
                // Real uploaded picture
                <img
                  src={imageUrl}
                  alt="Scansione DDT/Fattura"
                  className="max-h-[500px] object-contain rounded-lg shadow-2xl referrer-policy-no-referrer"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          ) : (
            // Manual Entry Simulation Note
            <div
              className="transition-transform duration-200 ease-out max-w-full max-h-full"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <div className="bg-amber-50/95 border-2 border-dashed border-amber-800/20 p-8 rounded-lg shadow-xl text-amber-950 max-w-[400px] w-80 font-mono text-xs space-y-6 relative select-none">
                <div className="absolute top-2 right-2 text-[10px] text-amber-900 border border-amber-900/30 px-1.5 py-0.5 rounded-sm font-sans uppercase">
                  Inserimento Manuale
                </div>
                
                {/* Receipt Header */}
                <div className="text-center pb-4 border-b border-dashed border-amber-950/20">
                  <h4 className="font-extrabold text-sm uppercase tracking-wide truncate">{ragioneSociale || "FORNITORE CERTIFICATO"}</h4>
                  <p className="text-[10px] text-amber-800 mt-1">Caricamento Manuale Documento</p>
                  <p className="text-[10px]">P.IVA: {pIva || "N/D"}</p>
                </div>

                {/* Document specifications */}
                <div className="grid grid-cols-2 gap-2 py-2 text-[11px] border-b border-dashed border-amber-950/20">
                  <div>
                    <p className="text-amber-800 font-sans">Documento:</p>
                    <p className="font-bold uppercase truncate">{tipo} N. {numeroDocumento || "ND"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-800 font-sans">Data d'acquisto:</p>
                    <p className="font-bold">{dataDocumento || "ND"}</p>
                  </div>
                </div>

                {/* Document line details */}
                <div className="space-y-3 pt-2">
                  <p className="font-sans font-bold text-[10px] uppercase text-amber-800 tracking-wider">Merci Inserite:</p>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-amber-950/20 text-[9px] text-amber-800 font-sans">
                        <th className="py-1">Descrizione</th>
                        <th className="py-1 text-right">Qta</th>
                        <th className="py-1 text-right">Lotto / Scad.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-950/10">
                      {righe.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-[10px] text-amber-700 font-sans italic">
                            Nessun articolo inserito. Clicca su "Aggiungi Riga" a destra.
                          </td>
                        </tr>
                      ) : (
                        righe.map((row, idx) => (
                          <tr key={idx} className="text-[10px]">
                            <td className="py-1.5 pr-2 font-bold truncate max-w-[120px]">{row.nome_prodotto || "Prodotto"}</td>
                            <td className="py-1.5 text-right font-bold shrink-0">{row.quantita} {row.unita_misura}</td>
                            <td className="py-1.5 text-right font-mono text-[9px] shrink-0">
                              <div>L: {row.numero_lotto || "N/D"}</div>
                              <div className="text-amber-800 font-sans">Scad: {row.data_scadenza || "N/D"}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footnote */}
                <div className="text-center pt-4 border-t border-dashed border-amber-950/20 text-[9px] text-amber-800">
                  Compilato manualmente. Conforme agli standard igienici HACCP.
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Helper guide inside Left Panel */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/50 text-slate-400 text-xs flex items-start gap-2">
          <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
          <p>
            Verifica ogni riga a destra confrontandola con il documento stampato a sinistra. Se l'AI non è riuscita ad estrarre correttamente la scadenza o il lotto dal testo, compilali manualmente.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL: Editable Verification Form (Review & Edit fields) */}
      <div className="xl:w-1/2 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-md p-6 overflow-hidden" id="form-panel">
        <form onSubmit={handleSubmit} className="space-y-6 flex flex-col h-full">
          
          {/* Header titles */}
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                Revisione Dati Estratti
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                I dati estratti sono editabili. Correggi eventuali imprecisioni prima di salvare nel database.
              </p>
            </div>
            <div className="self-start sm:self-center shrink-0">
              {providerUsed === "ollama" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200" id="badge-ollama-ocr">
                  <Cpu size={12} className="text-blue-500 animate-pulse" /> Scansione Locale (Ollama)
                </span>
              ) : providerUsed === "gemini" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" id="badge-gemini-ocr">
                  <Sparkles size={12} className="text-amber-500" /> Scansione Cloud (AI)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200" id="badge-demo-ocr">
                  <CheckCircle2 size={12} className="text-purple-500" /> Simulatore Demo
                </span>
              )}
            </div>
          </div>

          {/* Form scroll wrapper */}
          <div className="space-y-6 flex-1 overflow-y-auto pr-1" id="form-scroll-container">
            
            {providerUsed === "demo" && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-purple-800">Modalità Demo Attiva (Dati di Esempio)</p>
                  <p className="text-[11px] text-purple-700 mt-0.5">
                    Stai vedendo dati di esempio perché la chiave di connessione al Cloud AI non è ancora configurata. Per estrarre i dati reali dal tuo documento:
                  </p>
                  <ol className="list-decimal list-inside text-[10.5px] text-purple-700 mt-1.5 space-y-1">
                    <li>Vai nel pannello <strong>Settings</strong> (in alto a destra in questa interfaccia).</li>
                    <li>Clicca su <strong>Secrets</strong>.</li>
                    <li>Aggiungi un secret con il nome <strong>GEMINI_API_KEY</strong> e inserisci la tua chiave API del servizio Cloud AI.</li>
                  </ol>
                  <p className="text-[10px] text-purple-500 mt-2 font-semibold">
                    * L'uso del Cloud AI con questo piano è gratuito ed è stato ottimizzato per non superare mai i limiti di costo zero!
                  </p>
                </div>
              </div>
            )}

            {/* Warning Box for missing lot/expirations */}
            {hasValidationWarnings && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Dati di tracciabilità mancanti</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Alcune righe non contengono il <strong>Lotto</strong> o la <strong>Data Scadenza</strong>. Compilali per assicurare la conformità HACCP prima del salvataggio.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 1: Supplier details */}
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building size={14} /> Anagrafica Fornitore
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ragione Sociale Fornitore*</label>
                  <input
                    type="text"
                    required
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome o ragione sociale del fornitore"
                    value={ragioneSociale}
                    onChange={(e) => setRagioneSociale(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Partita IVA</label>
                  <input
                    type="text"
                    maxLength={16}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Partita IVA (11 cifre)"
                    value={pIva}
                    onChange={(e) => setPIva(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Document Header details */}
            <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} /> Estremi del Documento
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Numero Documento*</label>
                  <input
                    type="text"
                    required
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    placeholder="Es. DDT-410"
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Data Doc.*</label>
                  <input
                    type="date"
                    required
                    className="block w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    value={dataDocumento}
                    onChange={(e) => setDataDocumento(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo Doc.</label>
                  <select
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    value={tipo}
                    onChange={(e: any) => setTipo(e.target.value)}
                  >
                    <option value="ddt">DDT</option>
                    <option value="fattura">Fattura</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: Tabular rows list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} /> Righe Merci ed Ingredienti ({righe.length})
                </h4>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={autoAssignMissingLots}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-amber-200"
                    title="Assegna automaticamente lotti di tracciabilità basati sul DDT a tutte le righe vuote"
                  >
                    <Sparkles size={12} className="text-amber-600" /> Assegna Lotti da DDT
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-blue-100"
                  >
                    <Plus size={12} /> Aggiungi Riga
                  </button>
                </div>
              </div>

              {/* Rows details */}
              <div className="space-y-4" id="document-lines-editor">
                {righe.map((row, idx) => {
                  const lotAlert = !row.numero_lotto;
                  const expiryAlert = !row.data_scadenza;

                  return (
                    <div
                      key={idx}
                      className="p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3 bg-white relative group"
                    >
                      {/* Trash action button */}
                      <button
                        type="button"
                        onClick={() => deleteRow(idx)}
                        className="absolute top-3 right-3 p-1.5 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors"
                        title="Elimina riga"
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Header label */}
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-extrabold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Riga Prodotto</span>
                      </div>

                      {/* Line inputs layout */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Ingrediente / Prodotto*</label>
                          <input
                            type="text"
                            required
                            className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                            placeholder="Es. Carne Macinata Bovino"
                            value={row.nome_prodotto}
                            onChange={(e) => handleLineChange(idx, "nome_prodotto", e.target.value)}
                          />
                        </div>
                        <div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Qta*</label>
                              <input
                                type="number"
                                required
                                min="0"
                                step="any"
                                className="block w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                                placeholder="0"
                                value={row.quantita || ""}
                                onChange={(e) => handleLineChange(idx, "quantita", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">U.M.*</label>
                              <input
                                type="text"
                                required
                                className="block w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                placeholder="kg, l..."
                                value={row.unita_misura}
                                onChange={(e) => handleLineChange(idx, "unita_misura", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Coins size={10} /> Prezzo Unit.
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="0.00"
                            value={row.prezzo_unitario || ""}
                            onChange={(e) => handleLineChange(idx, "prezzo_unitario", e.target.value)}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              <Hash size={10} /> Numero Lotto*
                            </label>
                            {!row.numero_lotto && (
                              <button
                                type="button"
                                onClick={() => handleLineChange(idx, "numero_lotto", generateLotForRow(row, idx, numeroDocumento))}
                                className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 hover:underline cursor-pointer"
                                title="Genera codice lotto basato su DDT o articolo"
                              >
                                <Sparkles size={9} /> Genera da DDT
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            className={`block w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono ${
                              lotAlert ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-50 border-slate-100"
                            }`}
                            placeholder="Es. CAR-102 o L-4102-01"
                            value={row.numero_lotto || ""}
                            onChange={(e) => handleLineChange(idx, "numero_lotto", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Calendar size={10} /> Scadenza
                          </label>
                          <input
                            type="date"
                            className={`block w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                              expiryAlert ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-50 border-slate-100"
                            }`}
                            value={row.data_scadenza || ""}
                            onChange={(e) => handleLineChange(idx, "data_scadenza", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Action Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onDiscard}
              className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-red-100"
              disabled={isSaving}
              id="btn-ocr-discard"
            >
              Scarta Scansione
            </button>
            
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm hover:scale-[1.01] transition-all flex items-center gap-2"
              disabled={isSaving}
              id="btn-ocr-save"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Salvataggio e aggiornamento scorte...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Correggi e Salva in Magazzino
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
