/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Camera,
  Search,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  FileText,
  Printer,
  Info,
  RefreshCw,
  Sparkles
} from "lucide-react";

interface ManualInteractiveSectionProps {
  setIsTourActive: (active: boolean) => void;
  setTourStep: (step: number) => void;
}

export default function ManualInteractiveSection({
  setIsTourActive,
  setTourStep
}: ManualInteractiveSectionProps) {
  // Manual & Guided Tour States
  const [manualTab, setManualTab] = useState<"ocr" | "trace" | "labels">("ocr");
  
  // OCR Simulator
  const [isOcrSimulating, setIsOcrSimulating] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrExtractedData, setOcrExtractedData] = useState<any | null>(null);

  // Trace Simulator
  const [traceInput, setTraceInput] = useState("L-BUFF-2026");
  const [traceResult, setTraceResult] = useState<any | null>({
    lotto: "L-BUFF-2026",
    ingrediente: "Mozzarella di Bufala Campana DOP",
    fornitore: "Caseificio Campano S.p.A. (P.IVA 01234567890)",
    scadenza: "12/08/2026",
    acquistoDdt: "DDT n. 450 del 01/07/2026",
    impiegoDownstream: [
      { ricetta: "Pizzette di Bufala", lottoFinito: "PZ-0407-A", data: "04/07/2026", operatore: "Mario Rossi" },
      { ricetta: "Caprese Express", lottoFinito: "CP-0307-B", data: "03/07/2026", operatore: "Mario Rossi" }
    ]
  });

  // Label Simulator Settings
  const [labelHighlightAllergens, setLabelHighlightAllergens] = useState(true);
  const [labelTmcType, setLabelTmcType] = useState<"tmc" | "scadenza">("tmc");
  const [labelShowOrigin, setLabelShowOrigin] = useState(true);

  const handleSimulateOcr = () => {
    setIsOcrSimulating(true);
    setOcrProgress(0);
    setOcrExtractedData(null);
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 20;
      setOcrProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsOcrSimulating(false);
        setOcrExtractedData({
          fornitore: "Molini d'Italia S.p.A.",
          piva: "09876543211",
          tipoDoc: "DDT (Documento di Trasporto)",
          numeroDoc: "DDT-9081/A",
          dataDoc: "03/07/2026",
          articoli: [
            { nome: "Farina di Grano Tenero Tipo 0", lotto: "LOT-FAR-990", scadenza: "03/07/2027", qta: "50 Kg" },
            { nome: "Lievito di Birra Secco", lotto: "L-LIEV-442", scadenza: "15/01/2027", qta: "5 Kg" }
          ]
        });
      }
    }, 250);
  };

  const handleTraceSelect = (lotto: string) => {
    setTraceInput(lotto);
    if (lotto === "L-BUFF-2026") {
      setTraceResult({
        lotto: "L-BUFF-2026",
        ingrediente: "Mozzarella di Bufala Campana DOP",
        fornitore: "Caseificio Campano S.p.A. (P.IVA 01234567890)",
        scadenza: "12/08/2026",
        acquistoDdt: "DDT n. 450 del 01/07/2026",
        impiegoDownstream: [
          { ricetta: "Pizzette di Bufala", lottoFinito: "PZ-0407-A", data: "04/07/2026", operatore: "Mario Rossi" },
          { ricetta: "Caprese Express", lottoFinito: "CP-0307-B", data: "03/07/2026", operatore: "Mario Rossi" }
        ]
      });
    } else {
      setTraceResult({
        lotto: "LOT-FAR-990",
        ingrediente: "Farina di Grano Tenero Tipo 0 (GLUTINE)",
        fornitore: "Molini d'Italia S.p.A. (P.IVA 09876543211)",
        scadenza: "03/07/2027",
        acquistoDdt: "DDT-9081/A del 03/07/2026",
        impiegoDownstream: [
          { ricetta: "Pane Rustico Integrale", lottoFinito: "PANE-77A", data: "04/07/2026", operatore: "Elena Bianchi" },
          { ricetta: "Focaccia Genovese", lottoFinito: "FOC-88B", data: "05/07/2026", operatore: "Elena Bianchi" }
        ]
      });
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs" id="interactive-manual-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-blue-600 h-6 w-6 animate-pulse" />
            📘 Manuale Utente HACCP Smart-Track
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Guida operativa passo-passo per il rispetto del Regolamento (UE) 1169/2011 e standard di rintracciabilità.
          </p>
        </div>
        <button
          onClick={() => {
            setIsTourActive(true);
            setTourStep(0);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer self-start md:self-auto hover:scale-102 active:scale-98"
        >
          <HelpCircle size={15} />
          Avvia Tour Guidato dell'App
        </button>
      </div>

      {/* Tab Buttons */}
      <div className="flex overflow-x-auto whitespace-nowrap gap-2 mb-6 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit scrollbar-none" id="manual-tab-selectors">
        <button
          onClick={() => setManualTab("ocr")}
          className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            manualTab === "ocr"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Camera size={14} />
          1. Scansione Documenti & OCR AI
        </button>
        <button
          onClick={() => setManualTab("trace")}
          className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            manualTab === "trace"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Search size={14} />
          2. Rintracciabilità dei Lotti (Fornitori → Prodotti)
        </button>
        <button
          onClick={() => setManualTab("labels")}
          className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
            manualTab === "labels"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Printer size={14} />
          3. Stampa Etichette Reg. UE 1169/2011
        </button>
      </div>

      {/* Dynamic Manual Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Manual text & regulations instructions */}
        <div className="space-y-4">
          {manualTab === "ocr" && (
            <>
              <div className="bg-blue-50/50 border border-blue-100/60 p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-100/60 px-2 py-0.5 rounded-md">Regolamento CE 178/2002</span>
                <h3 className="font-extrabold text-slate-800 text-sm mt-2">Come funziona la scansione OCR intelligente?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Il caricamento manuale dei lotti è soggetto a errori umani e richiede tempo. Con HACCP Smart-Track, ti basta scattare una foto al documento d'acquisto cartaceo (DDT o Fattura d'acquisto).
                </p>
              </div>

              <div className="space-y-3 pl-1">
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Estrazione intelligente</strong>: L'AI individua l'intestazione, la P.IVA, la ragione sociale del fornitore, le righe degli articoli, la quantità, il codice del lotto e la data di scadenza.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Tipologia Documento</strong>: Riconosce automaticamente se si tratta di un DDT (carico a magazzino) o di una Fattura.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Verifica e Conferma</strong>: Prima del salvataggio, l'applicazione ti permette di correggere e confermare i dati digitalizzati per eliminare qualsiasi imprecisione.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 flex gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p><strong>Suggerimento pratico:</strong> Inquadra bene il documento, evitando ombre forti e pieghe. Puoi testare l'OCR ora con il simulatore sulla destra!</p>
              </div>
            </>
          )}

          {manualTab === "trace" && (
            <>
              <div className="bg-blue-50/50 border border-blue-100/60 p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-100/60 px-2 py-0.5 rounded-md">Rintracciabilità Obbligatoria</span>
                <h3 className="font-extrabold text-slate-800 text-sm mt-2">Cos'è il sistema di rintracciabilità e come si usa?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Per legge (Regolamento CE 178/2002), ogni operatore deve poter rintracciare chi gli ha fornito le materie prime ("a monte") e a quali lotti finiti sono state destinate ("a valle").
                </p>
              </div>

              <div className="space-y-3 pl-1">
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Da Ingrediente a Lotto</strong>: Quando cerchi un ingrediente, l'app mostra i singoli lotti d'acquisto attivi, svelandone subito la provenienza e la data di scadenza (TMC).</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Unificazione Automatica</strong>: In fase di produzione (nella scheda "Ricette & Produzione"), scaricando i lotti usati l'app collega in automatico la filiera.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Dov'è stato utilizzato?</strong>: Se un fornitore segnala un'anomalia su un ingrediente, inserendo il lotto in barra di ricerca puoi richiamare all'istante l'elenco esatto di prodotti finiti realizzati con quel lotto.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 flex gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p><strong>Conformità HACCP:</strong> Durante un'ispezione ASL, potrai estrarre in meno di 10 secondi il report genealogico di qualsiasi ingrediente o lotto d'acquisto.</p>
              </div>
            </>
          )}

          {manualTab === "labels" && (
            <>
              <div className="bg-blue-50/50 border border-blue-100/60 p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-100/60 px-2 py-0.5 rounded-md">Regolamento (UE) n. 1169/2011</span>
                <h3 className="font-extrabold text-slate-800 text-sm mt-2">Standard di Etichettatura & Allergeni</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Il regolamento UE 1169/2011 stabilisce regole rigidissime sull'informazione al consumatore. L'app automatizza questo processo per evitare pesanti sanzioni.
                </p>
              </div>

              <div className="space-y-3 pl-1">
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Evidenziazione Visiva Allergeni</strong>: Gli allergeni (glutine, lattosio, uova, solfiti, etc.) devono essere chiaramente distinti dagli altri ingredienti. L'app li formatta in <strong>GRASSETTO SOTTOLINEATO</strong> in automatico.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Dicitura Scadenza vs TMC</strong>: Prodotti deperibili richiedono la scritta <em>"Da consumarsi entro il"</em> (scadenza tassativa). Prodotti a lunga conservazione richiedono <em>"Da consumarsi preferibilmente entro il"</em> (TMC).</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600"><strong>Ragione Sociale e Indirizzo</strong>: L'etichetta deve riportare obbligatoriamente il nome o la ragione sociale dell'operatore (O.S.A.) e il relativo indirizzo, che puoi configurare cliccando su "Profilo Operatore" in alto a destra.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 flex gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p><strong>Paese d'Origine:</strong> Puoi anche specificare il paese d'origine dell'ingrediente primario (es. "Origine: Italia"), parametro sempre più richiesto e normato.</p>
              </div>
            </>
          )}
        </div>

        {/* Right Column: High-fidelity Live Simulator */}
        <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between min-h-[380px]">
          {manualTab === "ocr" && (
            <div className="space-y-4 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                    📲 Simulatore Scanner AI
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold font-mono">
                    Fattura / DDT d'Acquisto
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mb-4">
                  Clicca sul pulsante qui sotto per simulare il caricamento di una foto e l'estrazione dati con l'AI di Gemini.
                </p>

                {/* Document Box Mock */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs relative overflow-hidden min-h-[160px] flex flex-col justify-between font-mono text-[10px] text-slate-700">
                  {/* Sweep Scanning Line */}
                  {isOcrSimulating && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-green-500 shadow-[0_0_10px_#22c55e] animate-bounce z-10"></div>
                  )}

                  {!isOcrSimulating && !ocrExtractedData && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-2 h-full text-center">
                      <Camera size={32} strokeWidth={1.5} />
                      <span className="text-xs font-bold font-sans">Nessun documento scansionato</span>
                      <span className="text-[9px] font-sans">Clicca su 'Simula Estrazione AI' per iniziare</span>
                    </div>
                  )}

                  {isOcrSimulating && (
                    <div className="flex flex-col items-center justify-center py-8 text-blue-600 gap-2 h-full">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                      <span className="font-sans font-bold text-[11px]">L'AI sta leggendo l'immagine...</span>
                      <div className="w-32 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {ocrExtractedData && (
                    <div className="space-y-2 animate-in fade-in duration-300 text-slate-600">
                      <div className="border-b border-slate-100 pb-1 flex justify-between">
                        <span className="font-bold text-slate-800">FORNITORE: {ocrExtractedData.fornitore}</span>
                        <span className="text-[9px] text-slate-400">P.IVA: {ocrExtractedData.piva}</span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        DOCUMENTO: <span className="text-slate-800 font-bold">{ocrExtractedData.tipoDoc} - N. {ocrExtractedData.numeroDoc} del {ocrExtractedData.dataDoc}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-1 space-y-1">
                        <span className="font-bold text-slate-500 text-[8px] uppercase">ARTICOLI E LOTTI RILEVATI:</span>
                        {ocrExtractedData.articoli.map((art: any, idx: number) => (
                          <div key={idx} className="bg-slate-50 p-1.5 rounded border border-slate-100 flex justify-between items-center text-[9px]">
                            <div>
                              <span className="font-bold text-slate-800 block">{art.nome}</span>
                              <span className="text-blue-700 font-bold">Lotto: {art.lotto}</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-slate-500">Scad: {art.scadenza}</span>
                              <span className="font-bold">{art.qta}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1 justify-center pt-1 border-t border-slate-100">
                        <CheckCircle2 size={10} /> Dati raggruppati correttamente per l'inserimento in magazzino.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSimulateOcr}
                disabled={isOcrSimulating}
                className="w-full py-2.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles size={14} className={isOcrSimulating ? "animate-spin" : ""} />
                {isOcrSimulating ? "Elaborazione in corso..." : "Simula Estrazione AI"}
              </button>
            </div>
          )}

          {manualTab === "trace" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  🌳 Diagramma di Tracciabilità
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                  Reg. CE 178/2002
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                Seleziona un lotto per testare come il motore di tracciabilità collega i flussi di acquisto e vendita.
              </p>

              {/* Micro selector buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleTraceSelect("L-BUFF-2026")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    traceInput === "L-BUFF-2026"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Lotto: L-BUFF-2026
                </button>
                <button
                  onClick={() => handleTraceSelect("LOT-FAR-990")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    traceInput === "LOT-FAR-990"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Lotto: LOT-FAR-990
                </button>
              </div>

              {/* Traceability Flow View */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3.5 shadow-xs text-xs animate-in fade-in duration-200">
                {/* Upstream */}
                <div className="relative pl-4 border-l-2 border-slate-200">
                  <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-amber-500 border border-white"></div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">A MONTE (Provenienza)</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{traceResult.fornitore}</p>
                  <p className="text-[10px] text-slate-500">Documento d'acquisto: <strong>{traceResult.acquistoDdt}</strong></p>
                </div>

                {/* Current */}
                <div className="relative pl-4 border-l-2 border-slate-200 bg-blue-50/20 p-2 rounded-r-lg">
                  <div className="absolute -left-1.5 top-2 w-3 h-3 rounded-full bg-blue-600 border border-white"></div>
                  <span className="text-[9px] uppercase font-bold text-blue-600 block tracking-wider">MATERIA PRIMA IN LABORATORIO</span>
                  <p className="font-extrabold text-slate-800 mt-0.5 font-mono text-[11px]">Lotto: {traceResult.lotto}</p>
                  <p className="text-[10px] text-slate-500">Ingrediente: {traceResult.ingrediente}</p>
                  <p className="text-[10px] text-slate-500">Scadenza: <strong>{traceResult.scadenza}</strong></p>
                </div>

                {/* Downstream */}
                <div className="relative pl-4">
                  <div className="absolute -left-[5px] top-0 w-3 h-3 rounded-full bg-emerald-500 border border-white"></div>
                  <span className="text-[9px] uppercase font-bold text-emerald-600 block tracking-wider">A VALLE (Impiego / Vendita)</span>
                  <div className="space-y-1.5 mt-1">
                    {traceResult.impiegoDownstream.map((u: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-1.5 rounded border border-slate-100 flex justify-between items-center text-[10px]">
                        <div>
                          <span className="font-bold text-slate-700 block">{u.ricetta}</span>
                          <span className="text-[9px] text-slate-400">Prodotto il {u.data} da {u.operatore}</span>
                        </div>
                        <span className="font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold text-[9px] border border-emerald-100">
                          Lotto Fin.: {u.lottoFinito}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {manualTab === "labels" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  🏷️ Configura & Verifica Etichetta Compliant
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Reg. UE 1169
                </span>
              </div>

              {/* Settings toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-bold text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={labelHighlightAllergens}
                    onChange={(e) => setLabelHighlightAllergens(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Allergeni <b>B/U</b></span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={labelShowOrigin}
                    onChange={(e) => setLabelShowOrigin(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Origine</span>
                </label>
                <select
                  value={labelTmcType}
                  onChange={(e: any) => setLabelTmcType(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[9px] focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-bold"
                >
                  <option value="tmc">Usa TMC</option>
                  <option value="scadenza">Usa Scadenza</option>
                </select>
              </div>

              {/* Label Mock */}
              <div className="bg-white text-black p-4 border-2 border-black rounded-sm shadow-md mx-auto max-w-[290px] aspect-[8/5] flex flex-col justify-between font-sans select-none animate-in zoom-in-95 duration-200">
                <div className="text-center border-b border-black pb-1">
                  <div className="text-[8px] font-extrabold tracking-wider uppercase truncate">
                    {typeof window !== "undefined" ? localStorage.getItem("businessName") || "Lab_Rossi" : "Lab_Rossi"}
                  </div>
                  <div className="text-[5px] uppercase tracking-wider text-slate-500 font-bold truncate">
                    {typeof window !== "undefined" ? localStorage.getItem("businessAddress") || "Via dei Laboratori 42, Milano (MI)" : "Via dei Laboratori 42, Milano (MI)"}
                  </div>
                </div>

                <div className="my-0.5 text-center">
                  <h5 className="text-[10px] font-black uppercase tracking-wide leading-tight truncate">
                    Torta di Mele Rustica
                  </h5>
                </div>

                <div className="text-[6px] leading-tight text-slate-800 text-justify overflow-hidden max-h-[35px] mb-1">
                  <strong className="text-[5px] uppercase">Ingredienti: </strong>
                  <span>
                    Mele fresche, Farina di frumento tipo 0 (contiene{" "}
                    {labelHighlightAllergens ? (
                      <strong><u>glutine</u></strong>
                    ) : (
                      "glutine"
                    )}
                    ), burro (contiene{" "}
                    {labelHighlightAllergens ? (
                      <strong><u>latte</u></strong>
                    ) : (
                      "latte"
                    )}
                    ), zucchero, uova fresche (contiene{" "}
                    {labelHighlightAllergens ? (
                      <strong><u>uova</u></strong>
                    ) : (
                      "uova"
                    )}
                    ).
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-black pt-1 text-[6.5px] font-bold">
                  <div className="flex justify-between border-r border-slate-200 pr-1">
                    <span className="text-slate-400 text-[5px] uppercase">PROD</span>
                    <span>04/07/2026</span>
                  </div>
                  <div className="flex justify-between pl-1">
                    <span className="text-slate-400 text-[5px] uppercase">
                      {labelTmcType === "tmc" ? "TMC" : "SCAD"}
                    </span>
                    <span>04/08/2026</span>
                  </div>
                  <div className="flex justify-between border-r border-slate-200 pr-1">
                    <span className="text-slate-400 text-[5px] uppercase">LOTTO</span>
                    <span className="font-mono">T-MELE-0407</span>
                  </div>
                  <div className="flex justify-between pl-1">
                    <span className="text-slate-400 text-[5px] uppercase">PESO</span>
                    <span>600g</span>
                  </div>
                  {labelShowOrigin && (
                    <div className="flex justify-between border-r border-slate-200 pr-1 col-span-2 pt-0.5 border-t border-slate-100">
                      <span className="text-slate-400 text-[5px] uppercase">PROVENIENZA</span>
                      <span>Origine: Italia</span>
                    </div>
                  )}
                </div>

                <div className="mt-1 pt-1 border-t border-dotted border-black flex items-center justify-between">
                  <span className="text-[5px] font-bold text-slate-600 italic max-w-[150px] truncate">
                    Conservare in frigo a +4°C
                  </span>
                  <span className="text-[5px] font-black text-slate-700 uppercase tracking-widest">
                    REG. UE 1169
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
