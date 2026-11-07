import React, { useState, useEffect } from "react";
import {
  Printer,
  FileText,
  Filter,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Download,
  Search,
  AlertCircle,
  ArrowRightLeft,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Fornitore, Ingrediente, RigaDocumento, StockStatus } from "../types";

interface ReportGeneratorProps {
  onBackToDashboard?: () => void;
}

export default function ReportGenerator({ onBackToDashboard }: ReportGeneratorProps) {
  // Report Selection: "inventory" | "traceability" | "production" | "scans"
  const [reportType, setReportType] = useState<"inventory" | "traceability" | "production" | "scans">("inventory");
  
  // Data States
  const [lots, setLots] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Fornitore[]>([]);
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [stock, setStock] = useState<StockStatus[]>([]);
  const [discharges, setDischarges] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "expired" | "expiring_soon">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Report Verification/Approval state
  const [isApproved, setIsApproved] = useState(false);
  const [approverName, setApproverName] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("businessName") || "Lab_Rossi" : "Lab_Rossi";
  });
  const [approvalDate, setApprovalDate] = useState(() => new Date().toLocaleDateString("it-IT"));
  const [protocolNumber, setProtocolNumber] = useState("");

  // Generate a random-looking protocol number once on load or when report changes
  useEffect(() => {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const typeCode = reportType === "inventory" ? "MAG" : reportType === "traceability" ? "TRAC" : reportType === "production" ? "PROD" : "SCAN";
    setProtocolNumber(`HACCP-${typeCode}-${year}-${rand}`);
    setIsApproved(false);
  }, [reportType, selectedLotId]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [lotsRes, supRes, ingRes, stockRes, discRes, docsRes] = await Promise.all([
        fetch("/api/lots"),
        fetch("/api/suppliers"),
        fetch("/api/ingredients"),
        fetch("/api/stock"),
        fetch("/api/discharges"),
        fetch("/api/documents")
      ]);

      if (!lotsRes.ok || !supRes.ok || !ingRes.ok || !stockRes.ok || !discRes.ok || !docsRes.ok) {
        throw new Error("Errore nel recupero dei dati per la reportistica.");
      }

      const [lotsData, supData, ingData, stockData, discData, docsData] = await Promise.all([
        lotsRes.json(),
        supRes.json(),
        ingRes.json(),
        stockRes.json(),
        discRes.json(),
        docsRes.json()
      ]);

      setLots(lotsData);
      setSuppliers(supData);
      setIngredients(ingData);
      setStock(stockData);
      setDischarges(discData);
      setDocuments(docsData);

      // Default select the first lot if available for traceability report
      if (lotsData && lotsData.length > 0) {
        setSelectedLotId(lotsData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Impossibile caricare i registri.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger browser print flow
  const handlePrint = () => {
    window.print();
  };

  // Filtered Stock / Expirations
  const getFilteredStockLots = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    return lots.filter(lot => {
      const isSearchMatch = lot.numero_lotto.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (lot.ingrediente?.nome_generico || "").toLowerCase().includes(searchTerm.toLowerCase());

      if (!isSearchMatch) return false;

      const expiryDate = lot.data_scadenza ? new Date(lot.data_scadenza) : null;
      
      if (stockFilter === "low") {
        return lot.quantita_rimanente <= (lot.ingrediente?.scorta_minima || 0);
      }
      if (stockFilter === "expired") {
        return expiryDate !== null && expiryDate < now;
      }
      if (stockFilter === "expiring_soon") {
        return expiryDate !== null && expiryDate >= now && expiryDate <= thirtyDaysFromNow;
      }
      
      return true;
    });
  };

  // Lot specific Traceability Details
  const getTraceabilityData = () => {
    if (!selectedLotId) return null;
    const targetLot = lots.find(l => l.id === selectedLotId);
    if (!targetLot) return null;

    // Supplier info
    const supplier = suppliers.find(s => s.id === targetLot.documento?.fornitore_id) || {
      ragione_sociale: targetLot.documento?.ragione_sociale_fornitore || "Non specificato",
      p_iva: targetLot.documento?.p_iva || "N/A",
      email: "N/A",
      telefono: "N/A"
    };

    // Find all usages of this lot in production discharges
    const usages = discharges.filter(d => 
      d.lotti_usati_dettaglio?.some((lu: any) => lu.riga_documento_id === targetLot.id)
    ).map(d => {
      const usageDetail = d.lotti_usati_dettaglio.find((lu: any) => lu.riga_documento_id === targetLot.id);
      return {
        id: d.id,
        ricetta_id: d.ricetta_id,
        nome_prodotto_finito: d.nome_prodotto_finito,
        data: d.data,
        quantita_prodotta: d.quantita_prodotta,
        quantita_usata: usageDetail ? usageDetail.quantita_usata : 0,
        unita_misura: usageDetail ? usageDetail.unita_misura : ""
      };
    });

    return {
      lot: targetLot,
      supplier,
      usages
    };
  };

  // Filtered Chronological production sessions
  const getFilteredProductions = () => {
    return discharges.filter(d => {
      const pDateStr = d.data ? d.data.split(" ")[0] : "";
      const isWithinDate = (!startDate || pDateStr >= startDate) && (!endDate || pDateStr <= endDate);
      const isSearchMatch = d.nome_prodotto_finito.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.lotti_usati_dettaglio?.some((lu: any) => lu.numero_lotto.toLowerCase().includes(searchTerm.toLowerCase()) || lu.nome_generico.toLowerCase().includes(searchTerm.toLowerCase()));
      return isWithinDate && isSearchMatch;
    });
  };

  const activeTraceability = getTraceabilityData();
  const activeStockLots = getFilteredStockLots();
  const activeProductions = getFilteredProductions();

  return (
    <div className="space-y-6" id="report-generator-root">
      {/* CSS per stampa e forzatura A4 */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          #header-bar, #footer-credit, #sidebar-menu, #mobile-nav, #report-controls-panel, #btn-quick-cam, #scan-error-banner {
            display: none !important;
          }
          #viewport-main-content {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          #printable-report-card {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          /* Forzatura stili di stampa puliti */
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      {/* HEADER SECTION (NO-PRINT) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Modulo Conformità & Registri
          </span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1.5 flex items-center gap-2">
            <ClipboardList className="text-blue-600 h-6.5 w-6.5" /> Centro Reportistica HACCP
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Genera, firma e stampa documenti ufficiali di tracciabilità per ispezioni sanitarie ed audit di sicurezza.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Sincronizza Dati"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handlePrint}
            className="px-4.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Printer size={15} /> Genera PDF / Stampa
          </button>
        </div>
      </div>

      {/* MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: REPORT OPTIONS & FILTERS (NO-PRINT) */}
        <div className="lg:col-span-4 space-y-5 no-print" id="report-controls-panel">
          
          {/* 1. REPORT TYPE SELECTOR */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">1. Seleziona Tipo Registro</h3>
            <div className="space-y-2">
              <button
                onClick={() => setReportType("inventory")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  reportType === "inventory"
                    ? "bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs"
                    : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/80 text-slate-600"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${reportType === "inventory" ? "bg-blue-500 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <FileText size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">Registro di Magazzino</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Giacenze attive, date di scadenza e lotti ingrediente.</p>
                </div>
              </button>

              <button
                onClick={() => setReportType("traceability")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  reportType === "traceability"
                    ? "bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs"
                    : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/80 text-slate-600"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${reportType === "traceability" ? "bg-blue-500 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">Fascicolo di Tracciabilità</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Tracciabilità completa di un singolo lotto (Indietro/Avanti).</p>
                </div>
              </button>

              <button
                onClick={() => setReportType("production")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  reportType === "production"
                    ? "bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs"
                    : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/80 text-slate-600"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${reportType === "production" ? "bg-blue-500 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <ClipboardList size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">Registro Produzione</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Storico cronologico delle lavorazioni e scarico lotti.</p>
                </div>
              </button>

              <button
                onClick={() => setReportType("scans")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  reportType === "scans"
                    ? "bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs"
                    : "bg-slate-50/50 hover:bg-slate-50 border-slate-200/80 text-slate-600"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${reportType === "scans" ? "bg-blue-500 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <FileText size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold">Registro Scansioni OCR</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Elenco dei documenti scansionati (DDT e Fatture) tramite AI.</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. SPECIFIC REPORT FILTERS */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Filter size={12} /> 2. Opzioni di Filtro
            </h3>

            {/* Filter fields depend on selected report */}
            {reportType === "inventory" && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stato Scadenze / Giacenze</label>
                  <select
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    value={stockFilter}
                    onChange={(e: any) => setStockFilter(e.target.value)}
                  >
                    <option value="all">Mostra tutti i lotti attivi</option>
                    <option value="low">Sotto scorta minima</option>
                    <option value="expired">Lotti SCADUTI</option>
                    <option value="expiring_soon">In scadenza nei prossimi 30gg</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cerca Ingrediente o Lotto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtra per nome, codice lotto..."
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {reportType === "traceability" && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Seleziona Lotto da Tracciare*</label>
                  {lots.length === 0 ? (
                    <p className="text-xs text-slate-400">Nessun lotto registrato nel sistema.</p>
                  ) : (
                    <select
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                      value={selectedLotId}
                      onChange={(e) => setSelectedLotId(e.target.value)}
                    >
                      {lots.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.numero_lotto} — {l.ingrediente?.nome_generico}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Seleziona un codice lotto per mapparne la provenienza (Fattura/Fornitore) e lo scarico nei lotti finiti di produzione.
                  </p>
                </div>
              </div>
            )}

            {reportType === "production" && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Inizio</label>
                    <input
                      type="date"
                      className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Fine</label>
                    <input
                      type="date"
                      className="block w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cerca Prodotto o Lotto Usato</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cerca ricetta, lotto ingrediente..."
                      className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. SIGNATURE & VALIDATION (NO-PRINT) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" /> 3. Approvazione ed Accettazione
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome dell'Operatore Responsabile</label>
                <input
                  type="text"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-bold text-slate-700"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                />
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 text-[11px] leading-relaxed text-slate-500">
                L'approvazione digitale appone una firma elettronica sul documento stampato, attestando l'avvenuta verifica manuale dei registri da parte dell'operatore designato per l'HACCP.
              </div>

              {!isApproved ? (
                <button
                  onClick={() => setIsApproved(true)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  Applica Firma Elettronica
                </button>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Firma elettronica applicata con successo!</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: INTERACTIVE A4 SHEET SIMULATOR (PRINT AREA) */}
        <div className="lg:col-span-8">
          
          <div
            id="printable-report-card"
            className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-12 font-sans text-slate-900 mx-auto min-h-[842px] max-w-[800px] flex flex-col justify-between"
          >
            <div>
              {/* SHEET HEADER */}
              <div className="border-b-2 border-slate-900 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-md font-black tracking-tight uppercase">Autocontrollo Alimentare S.r.l.</h2>
                    <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-0.5">Laboratorio Qualità & Tracciabilità • Protocollo HACCP</p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <p className="text-slate-400 font-bold text-[9px] uppercase">Codice Documento</p>
                  <p className="font-extrabold text-slate-800">{protocolNumber}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Data: {approvalDate}</p>
                </div>
              </div>

              {/* REPORT TITLE */}
              <div className="my-8">
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {reportType === "inventory" && "Registro di Magazzino, Giacenze e Stato Scadenze Materie Prime"}
                  {reportType === "traceability" && "Fascicolo di Tracciabilità Lotto e Flusso d'Impiego Alimentare"}
                  {reportType === "production" && "Registro delle Lavorazioni e Bilanciamento di Scarico Produzione"}
                  {reportType === "scans" && "Registro di Acquisizione Documenti Digitali ed Estrazione OCR"}
                </h1>
                <p className="text-[11px] text-slate-500 italic mt-1 leading-relaxed">
                  Redatto in conformità con i Regolamenti CE n. 852/2004 e n. 178/2002 riguardanti la rintracciabilità dei prodotti alimentari e la sicurezza igienico-sanitaria.
                </p>
              </div>

              {/* REPORT DATA CONTENT */}
              {loading ? (
                <div className="py-20 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="animate-spin text-blue-500 h-6 w-6" />
                  <span>Caricamento dati del report in corso...</span>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-2 text-xs">
                  <AlertCircle size={16} className="text-red-600" />
                  <span>{error}</span>
                </div>
              ) : (
                <div className="space-y-6">

                  {/* CONTENT TYPE A: INVENTORY REGISTER */}
                  {reportType === "inventory" && (
                    <div className="space-y-4">
                      {activeStockLots.length === 0 ? (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                          Nessun lotto corrisponde ai criteri o ai filtri di ricerca selezionati.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-300">
                            <thead>
                              <tr className="text-[10px] uppercase font-black tracking-wider text-slate-500 bg-slate-100 border-t border-slate-300">
                                <th className="p-2.5">Materia Prima</th>
                                <th className="p-2.5">N° Lotto</th>
                                <th className="p-2.5">Scadenza</th>
                                <th className="p-2.5 text-right">Giacenza</th>
                                <th className="p-2.5 text-right">Scorta Min.</th>
                                <th className="p-2.5 text-center">Stato HACCP</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {activeStockLots.map((lot, idx) => {
                                const expiryDate = lot.data_scadenza ? new Date(lot.data_scadenza) : null;
                                const isExpired = expiryDate !== null && expiryDate < new Date();
                                const isExpiringSoon = expiryDate !== null && !isExpired && 
                                  (expiryDate.getTime() - new Date().getTime()) < 30 * 24 * 60 * 60 * 1000;
                                const isLowStock = lot.quantita_rimanente <= (lot.ingrediente?.scorta_minima || 0);

                                return (
                                  <tr key={lot.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                    <td className="p-2.5 font-bold text-slate-900">{lot.ingrediente?.nome_generico}</td>
                                    <td className="p-2.5 font-mono font-bold">{lot.numero_lotto}</td>
                                    <td className={`p-2.5 ${isExpired ? "text-red-600 font-bold" : isExpiringSoon ? "text-amber-600 font-bold" : ""}`}>
                                      {lot.data_scadenza ? new Date(lot.data_scadenza).toLocaleDateString("it-IT") : "Nessuna"}
                                    </td>
                                    <td className="p-2.5 text-right font-extrabold text-slate-900">
                                      {lot.quantita_rimanente} <span className="text-[10px] text-slate-400 font-medium">{lot.ingrediente?.unita_misura}</span>
                                    </td>
                                    <td className="p-2.5 text-right text-slate-500">
                                      {lot.ingrediente?.scorta_minima || 0} <span className="text-[9px]">{lot.ingrediente?.unita_misura}</span>
                                    </td>
                                    <td className="p-2.5 text-center">
                                      {isExpired ? (
                                        <span className="text-[9px] font-black uppercase text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-sm">SCADUTO</span>
                                      ) : isLowStock ? (
                                        <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">SCORTA BASSA</span>
                                      ) : isExpiringSoon ? (
                                        <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">EXP PREV</span>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">IDONEO</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTENT TYPE B: SINGLE LOT TRACEABILITY DOSSIER */}
                  {reportType === "traceability" && (
                    <div className="space-y-6">
                      {!activeTraceability ? (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                          Seleziona un lotto per visualizzare l'intero percorso di tracciabilità.
                        </div>
                      ) : (
                        <>
                          {/* Block: Source document Info (One Step Back) */}
                          <div className="border border-slate-300 rounded-2xl overflow-hidden">
                            <div className="bg-slate-100 p-3 border-b border-slate-300">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span> Provenienza ed Ingresso (Fase di Carico - Indietro)
                              </h3>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Materia Prima</p>
                                <p className="text-slate-900 font-extrabold text-sm mt-0.5">{activeTraceability.lot.ingrediente?.nome_generico}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Codice ID Interno: {activeTraceability.lot.id}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Codice Lotto del Fornitore</p>
                                <p className="text-slate-900 font-mono font-black text-sm mt-0.5 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                                  {activeTraceability.lot.numero_lotto}
                                </p>
                              </div>
                              <div className="border-t border-slate-100 pt-3">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Documento Associato</p>
                                <p className="text-slate-800 font-bold mt-0.5">
                                  {activeTraceability.lot.documento?.tipo === "fattura" ? "Fattura" : "DDT"} N° {activeTraceability.lot.documento?.numero_documento}
                                </p>
                                <p className="text-slate-500">Del {activeTraceability.lot.documento ? new Date(activeTraceability.lot.documento.data_documento).toLocaleDateString("it-IT") : "Non registrato"}</p>
                              </div>
                              <div className="border-t border-slate-100 pt-3">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Fornitore Emittente</p>
                                <p className="text-slate-900 font-bold mt-0.5">{activeTraceability.supplier.ragione_sociale}</p>
                                <p className="text-slate-500">P.IVA: {activeTraceability.supplier.p_iva}</p>
                              </div>
                              <div className="border-t border-slate-100 pt-3 col-span-1 md:col-span-2 grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Quantità Ricevuta</p>
                                  <p className="text-slate-800 font-extrabold mt-0.5">
                                    {activeTraceability.lot.quantita_caricata} <span className="text-[10px] font-normal text-slate-500">{activeTraceability.lot.ingrediente?.unita_misura}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Giacenza Residua</p>
                                  <p className="text-blue-700 font-extrabold mt-0.5">
                                    {activeTraceability.lot.quantita_rimanente} <span className="text-[10px] font-normal text-slate-500">{activeTraceability.lot.ingrediente?.unita_misura}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Data Ricezione</p>
                                  <p className="text-slate-800 font-bold mt-0.5">
                                    {new Date(activeTraceability.lot.data_ricezione).toLocaleDateString("it-IT")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Block: Usage detail (One Step Forward) */}
                          <div className="border border-slate-300 rounded-2xl overflow-hidden">
                            <div className="bg-slate-100 p-3 border-b border-slate-300">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Utilizzo ed Impiego in Produzione (Fase di Scarico - Avanti)
                              </h3>
                            </div>
                            <div className="p-4">
                              {activeTraceability.usages.length === 0 ? (
                                <p className="text-xs text-slate-500 italic p-4 text-center">
                                  Nessun utilizzo in ricetta o scarico registrato per questo lotto. La merce è ancora integra in magazzino.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
                                    <thead>
                                      <tr className="text-[10px] uppercase font-black text-slate-400">
                                        <th className="pb-2">Data Lavorazione</th>
                                        <th className="pb-2">ID Scarico</th>
                                        <th className="pb-2">Prodotto Finito (Ricetta)</th>
                                        <th className="pb-2 text-right">Q.tà Prodotta</th>
                                        <th className="pb-2 text-right">Materia Prima Usata</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {activeTraceability.usages.map((usage: any) => (
                                        <tr key={usage.id} className="text-slate-800">
                                          <td className="py-2.5 font-medium">{new Date(usage.data.replace(/-/g, "/")).toLocaleString("it-IT")}</td>
                                          <td className="py-2.5 font-mono text-slate-500">{usage.id.slice(0, 8)}...</td>
                                          <td className="py-2.5 font-extrabold text-slate-900">{usage.nome_prodotto_finito}</td>
                                          <td className="py-2.5 text-right font-medium">{usage.quantita_prodotta} pz</td>
                                          <td className="py-2.5 text-right font-extrabold text-blue-700">
                                            -{usage.quantita_usata} <span className="text-[9px] text-slate-400 font-medium">{usage.unita_misura}</span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* CONTENT TYPE C: PRODUCTION CHRONOLOGICAL REGISTER */}
                  {reportType === "production" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-200 pb-2 bg-slate-50 p-3 rounded-xl">
                        <span>Filtro Temporale: <strong>{new Date(startDate).toLocaleDateString("it-IT")}</strong> a <strong>{new Date(endDate).toLocaleDateString("it-IT")}</strong></span>
                        <span>Lotti elaborati in totale: <strong>{activeProductions.length}</strong></span>
                      </div>

                      {activeProductions.length === 0 ? (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                          Nessun ciclo di produzione registrato nel periodo selezionato.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {activeProductions.map((prod, idx) => (
                            <div key={prod.id} className="p-4 border border-slate-200 rounded-2xl space-y-3.5 bg-slate-50/50">
                              <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Sessione di Produzione</span>
                                  <h4 className="text-sm font-black text-slate-900">{prod.nome_prodotto_finito}</h4>
                                  <p className="text-[10px] text-slate-500">{new Date(prod.data).toLocaleString("it-IT")}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Resa Totale</span>
                                  <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 inline-block mt-0.5">
                                    {prod.quantita_prodotta} pz
                                  </span>
                                </div>
                              </div>

                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mappatura e Rintracciabilità Lotti Utilizzati</span>
                                <table className="w-full text-left text-xs text-slate-600">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-[9px] uppercase font-bold text-slate-400">
                                      <th className="pb-1">Ingrediente</th>
                                      <th className="pb-1">N° Lotto Usato</th>
                                      <th className="pb-1 text-right">Q.tà Impiegata</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {prod.lotti_usati_dettaglio?.map((lu: any) => (
                                      <tr key={lu.riga_documento_id}>
                                        <td className="py-1">{lu.nome_generico}</td>
                                        <td className="py-1 font-mono font-bold text-slate-800">{lu.numero_lotto}</td>
                                        <td className="py-1 text-right font-bold text-red-600">-{lu.quantita_usata} {lu.unita_misura}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTENT TYPE D: OCR SCAN REGISTRY */}
                  {reportType === "scans" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-200 pb-2 bg-slate-50 p-3 rounded-xl">
                        <span>Registro Documenti Estratti tramite OCR</span>
                        <span>Documenti totali: <strong>{documents.length}</strong></span>
                      </div>

                      {documents.length === 0 ? (
                        <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                          Nessun documento scansionato registrato nel sistema.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-300">
                            <thead>
                              <tr className="text-[10px] uppercase font-black tracking-wider text-slate-500 bg-slate-100 border-t border-slate-300">
                                <th className="p-2.5">Tipo Doc.</th>
                                <th className="p-2.5">Numero</th>
                                <th className="p-2.5">Fornitore / P. IVA</th>
                                <th className="p-2.5 text-center">Data Documento</th>
                                <th className="p-2.5 text-center">Data Caricamento</th>
                                <th className="p-2.5 text-right">Lotti Caricati</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {documents.map((doc, idx) => {
                                const docLots = lots.filter(l => l.documento_id === doc.id);
                                return (
                                  <tr key={doc.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                    <td className="p-2.5 font-bold text-slate-900">
                                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                                        doc.tipo === "fattura" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                                      }`}>
                                        {doc.tipo || "DDT"}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-mono font-bold">{doc.numero_documento}</td>
                                    <td className="p-2.5">
                                      <p className="font-extrabold text-slate-800">{doc.fornitore?.ragione_sociale || doc.ragione_sociale_fornitore}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">P.IVA: {doc.fornitore?.p_iva || doc.p_iva || "N/D"}</p>
                                    </td>
                                    <td className="p-2.5 text-center">{doc.data_documento ? new Date(doc.data_documento).toLocaleDateString("it-IT") : "N/D"}</td>
                                    <td className="p-2.5 text-center text-slate-500 font-mono text-[10px]">{doc.data_caricamento || "N/D"}</td>
                                    <td className="p-2.5 text-right font-black text-slate-800">
                                      {docLots.length}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* SHEET SIGNATURE BLOCK */}
            <div className="border-t border-slate-300 pt-8 mt-12 grid grid-cols-2 gap-8 text-xs text-slate-700 bg-white">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Note e Prescrizioni</p>
                <p className="text-[10px] text-slate-500 leading-normal mt-1">
                  Questo documento costituisce autocertificazione ai sensi del D.Lgs 193/2007. È obbligo dell'operatore registrare tempestivamente ogni variazione di stock o scarico per mantenere inalterato il vincolo di rintracciabilità legale.
                </p>
              </div>

              <div className="text-right flex flex-col justify-end items-end relative min-h-[90px]">
                {isApproved && (
                  <div className="absolute right-10 top-2 -rotate-6 scale-95 opacity-80 border-4 border-emerald-600 text-emerald-600 font-black tracking-widest text-sm uppercase px-4 py-1.5 rounded-xl bg-emerald-50 select-none flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Approva HACCP
                  </div>
                )}
                
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-8">Firma e Timbro Responsabile Qualità</p>
                <div className="w-48 border-b border-dashed border-slate-400 text-center pb-1">
                  <span className="font-mono text-slate-800 text-xs font-bold italic">
                    {isApproved ? `${approverName} — Approva` : ""}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-mono">Verificato via Firma Digitale HACCP Smart-Track</p>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
