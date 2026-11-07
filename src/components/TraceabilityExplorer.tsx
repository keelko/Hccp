/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Layers,
  Inbox,
  Building,
  Search,
  ArrowDownToLine,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Trash,
  Plus,
  RefreshCw,
  Eye,
  ArrowRight,
  Pencil
} from "lucide-react";
import { Fornitore, Ingrediente, RigaDocumento, StockStatus } from "../types";

interface TraceabilityExplorerProps {
  initialSearch?: string;
  initialTab?: "lots" | "suppliers" | "ingredients";
}

export default function TraceabilityExplorer({
  initialSearch = "",
  initialTab = "lots"
}: TraceabilityExplorerProps) {
  const [activeTab, setActiveTab] = useState<"lots" | "suppliers" | "ingredients">(initialTab);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  const [lots, setLots] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<StockStatus[]>([]);
  const [suppliers, setSuppliers] = useState<Fornitore[]>([]);
  const [discharges, setDischarges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordion expanded rows state
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);

  // Manual discharge Modal State
  const [dischargeLot, setDischargeLot] = useState<any | null>(null);
  const [dischargeQty, setDischargeQty] = useState("");
  const [discharging, setDischarging] = useState(false);

  // New Ingredient Modal State
  const [showAddIngModal, setShowAddIngModal] = useState(false);
  const [newIngName, setNewIngName] = useState("");
  const [newIngUom, setNewIngUom] = useState("kg");
  const [newIngCategory, setNewIngCategory] = useState("Farine");
  const [newIngMinStock, setNewIngMinStock] = useState("10");

  // Edit Lot Modal State
  const [editLot, setEditLot] = useState<any | null>(null);
  const [editLotNum, setEditLotNum] = useState("");
  const [editLotQtyCaricata, setEditLotQtyCaricata] = useState("");
  const [editLotQtyRimanente, setEditLotQtyRimanente] = useState("");
  const [editLotExpiry, setEditLotExpiry] = useState("");
  const [editLotPrice, setEditLotPrice] = useState("");
  const [updatingLot, setUpdatingLot] = useState(false);

  // Edit Ingredient Modal State
  const [editIng, setEditIng] = useState<any | null>(null);
  const [editIngName, setEditIngName] = useState("");
  const [editIngUom, setEditIngUom] = useState("kg");
  const [editIngCategory, setEditIngCategory] = useState("Farine");
  const [editIngMinStock, setEditIngMinStock] = useState("");
  const [updatingIng, setUpdatingIng] = useState(false);

  // Edit Supplier Modal State
  const [editSup, setEditSup] = useState<any | null>(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupPiva, setEditSupPiva] = useState("");
  const [editSupEmail, setEditSupEmail] = useState("");
  const [editSupPhone, setEditSupPhone] = useState("");
  const [editSupNote, setEditSupNote] = useState("");
  const [updatingSup, setUpdatingSup] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Start Lot Editing
  const handleStartEditLot = (lot: any) => {
    setEditLot(lot);
    setEditLotNum(lot.numero_lotto || "");
    setEditLotQtyCaricata(String(lot.quantita_caricata || 0));
    setEditLotQtyRimanente(String(lot.quantita_rimanente || 0));
    setEditLotExpiry(lot.data_scadenza || "");
    setEditLotPrice(String(lot.prezzo_unitario || 0));
  };

  const handleEditLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLot) return;
    try {
      setUpdatingLot(true);
      const res = await fetch(`/api/lots/${editLot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_lotto: editLotNum,
          quantita_caricata: Number(editLotQtyCaricata),
          quantita_rimanente: Number(editLotQtyRimanente),
          prezzo_unitario: Number(editLotPrice),
          data_scadenza: editLotExpiry || null
        })
      });
      if (!res.ok) throw new Error("Errore durante il salvataggio del lotto.");
      await fetchData();
      setEditLot(null);
      alert("Lotto aggiornato con successo!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingLot(false);
    }
  };

  const handleDeleteLot = async (lotId: string, lotNum: string) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il lotto "${lotNum}"? Questa operazione non può essere annullata.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/lots/${lotId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione del lotto.");
      await fetchData();
      alert("Lotto eliminato con successo.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Start Ingredient Editing
  const handleStartEditIngredient = (ing: any) => {
    setEditIng(ing);
    setEditIngName(ing.nome_generico || "");
    setEditIngUom(ing.unita_misura || "kg");
    setEditIngCategory(ing.categoria || "Farine");
    setEditIngMinStock(String(ing.scorta_minima || 0));
  };

  const handleEditIngredientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editIng) return;
    try {
      setUpdatingIng(true);
      const res = await fetch(`/api/ingredients/${editIng.ingrediente_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_generico: editIngName,
          unita_misura: editIngUom,
          categoria: editIngCategory,
          scorta_minima: Number(editIngMinStock)
        })
      });
      if (!res.ok) throw new Error("Errore durante il salvataggio della materia prima.");
      await fetchData();
      setEditIng(null);
      alert("Materia prima aggiornata con successo!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingIng(false);
    }
  };

  const handleDeleteIngredient = async (ingId: string, ingName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente la materia prima "${ingName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/ingredients/${ingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione.");
      await fetchData();
      alert("Materia prima eliminata con successo.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Start Supplier Editing
  const handleStartEditSupplier = (sup: any) => {
    setEditSup(sup);
    setEditSupName(sup.ragione_sociale || "");
    setEditSupPiva(sup.p_iva || "");
    setEditSupEmail(sup.email || "");
    setEditSupPhone(sup.telefono || "");
    setEditSupNote(sup.note || "");
  };

  const handleEditSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSup) return;
    try {
      setUpdatingSup(true);
      const res = await fetch(`/api/suppliers/${editSup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ragione_sociale: editSupName,
          p_iva: editSupPiva,
          email: editSupEmail,
          telefono: editSupPhone,
          note: editSupNote
        })
      });
      if (!res.ok) throw new Error("Errore durante il salvataggio del fornitore.");
      await fetchData();
      setEditSup(null);
      alert("Fornitore aggiornato con successo!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingSup(false);
    }
  };

  const handleDeleteSupplier = async (supId: string, supName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare definitivamente il fornitore "${supName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/suppliers/${supId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione.");
      await fetchData();
      alert("Fornitore eliminato con successo.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lotsRes, ingRes, supRes, discRes] = await Promise.all([
        fetch("/api/lots"),
        fetch("/api/ingredients"),
        fetch("/api/suppliers"),
        fetch("/api/discharges")
      ]);

      const lotsData = await lotsRes.json();
      const ingData = await ingRes.json();
      const supData = await supRes.json();
      const discData = await discRes.json();

      setLots(lotsData);
      setIngredients(ingData);
      setSuppliers(supData);
      setDischarges(discData);
    } catch (e) {
      console.error("Errore recupero dati anagrafica:", e);
    } finally {
      setLoading(false);
    }
  };

  // Manual Lot Discharge Execution
  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeLot || !dischargeQty || isNaN(Number(dischargeQty)) || Number(dischargeQty) <= 0) {
      alert("Inserire una quantità valida.");
      return;
    }
    if (Number(dischargeQty) > dischargeLot.quantita_rimanente) {
      alert("Impossibile scaricare una quantità superiore alla giacenza residua.");
      return;
    }

    try {
      setDischarging(true);
      const res = await fetch(`/api/lots/${dischargeLot.id}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantita: Number(dischargeQty) })
      });
      if (!res.ok) {
        throw new Error("Errore durante lo scarico del lotto.");
      }
      // Refresh
      await fetchData();
      setDischargeLot(null);
      setDischargeQty("");
      alert("Scarico registrato con successo!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDischarging(false);
    }
  };

  // Add Ingredient Submit
  const handleAddIngSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) {
      alert("Il nome ingrediente è richiesto.");
      return;
    }

    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_generico: newIngName,
          unita_misura: newIngUom,
          categoria: newIngCategory,
          scorta_minima: Number(newIngMinStock || 0)
        })
      });
      if (!res.ok) {
        throw new Error("Impossibile creare la materia prima.");
      }
      await fetchData();
      setShowAddIngModal(false);
      setNewIngName("");
      alert("Materia prima creata con successo.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter lists based on global search query
  const query = searchQuery.toLowerCase();

  const filteredLots = lots
    .filter((l) => {
      const num = l.numero_lotto?.toLowerCase() || "";
      const ing = l.ingrediente?.nome_generico?.toLowerCase() || "";
      const sup = l.fornitore?.ragione_sociale?.toLowerCase() || "";
      return num.includes(query) || ing.includes(query) || sup.includes(query);
    })
    .sort((a, b) => {
      const dateA = a.data_ricezione ? new Date(a.data_ricezione).getTime() : 0;
      const dateB = b.data_ricezione ? new Date(b.data_ricezione).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      // Convert IDs to strings safely before localeCompare
      return String(b.id).localeCompare(String(a.id));
    });

  const filteredIngredients = ingredients.filter((i) => {
    const name = i.nome_generico?.toLowerCase() || "";
    const cat = i.categoria?.toLowerCase() || "";
    return name.includes(query) || cat.includes(query);
  });

  const filteredSuppliers = suppliers.filter((s) => {
    const name = s.ragione_sociale?.toLowerCase() || "";
    const piva = s.p_iva?.toLowerCase() || "";
    return name.includes(query) || piva.includes(query);
  });

  // Calculate lot status badge
  const getLotStatus = (lot: any) => {
    if (lot.quantita_rimanente <= 0) {
      return { label: "Esaurito", color: "bg-slate-100 text-slate-600 border-slate-200" };
    }
    if (!lot.data_scadenza) {
      return { label: "Conforme", color: "bg-blue-50 text-blue-700 border-blue-100" };
    }

    const now = new Date();
    const expiry = new Date(lot.data_scadenza);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    if (expiry < now) {
      return { label: "SCADUTO 🚨", color: "bg-red-50 text-red-700 border-red-200 font-bold" };
    } else if (expiry <= sevenDaysFromNow) {
      return { label: "Scade a breve", color: "bg-amber-50 text-amber-700 border-amber-200 font-bold" };
    }
    return { label: "Ok (Conforme)", color: "bg-blue-50 text-blue-700 border-blue-100" };
  };

  // Get usage logs for expanded lot
  const getLotUsageHistory = (lotId: string) => {
    const logs: any[] = [];
    discharges.forEach((d) => {
      d.lotti_usati_dettaglio?.forEach((lu: any) => {
        if (lu.riga_documento_id === lotId && lu.quantita_usata > 0) {
          logs.push({
            date: d.data,
            recipeName: d.nome_prodotto_finito,
            qtyUsed: lu.quantita_usata
          });
        }
      });
    });
    return logs;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6" id="traceability-explorer-wrap">
      {/* Header and Query bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Anagrafica & Tracciabilità</h2>
          <p className="text-xs text-slate-400 mt-1">Registro storico dei lotti e delle scorte alimentari conformi HACCP.</p>
        </div>
        
        {/* Real-time filters and buttons */}
        <div className="flex items-center gap-2">
          {activeTab === "ingredients" && (
            <button
              onClick={() => setShowAddIngModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              id="btn-trigger-add-ing"
            >
              <Plus size={14} /> Nuova Materia Prima
            </button>
          )}
          
          <button
            onClick={fetchData}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
            title="Aggiorna Dati"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Directory tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none" id="explorer-tab-switcher">
        <button
          onClick={() => {
            setActiveTab("lots");
            setExpandedLotId(null);
          }}
          className={`shrink-0 px-6 py-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "lots"
              ? "border-blue-600 text-blue-700 bg-blue-50/30"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-view-lots"
        >
          <Layers size={14} /> Lotti e Giacenze ({filteredLots.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("ingredients");
            setExpandedLotId(null);
          }}
          className={`shrink-0 px-6 py-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "ingredients"
              ? "border-blue-600 text-blue-700 bg-blue-50/30"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-view-ingredients"
        >
          <Inbox size={14} /> Inventario Materie Prime ({filteredIngredients.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("suppliers");
            setExpandedLotId(null);
          }}
          className={`shrink-0 px-6 py-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "suppliers"
              ? "border-blue-600 text-blue-700 bg-blue-50/30"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-view-suppliers"
        >
          <Building size={14} /> Anagrafica Fornitori ({filteredSuppliers.length})
        </button>
      </div>

      {/* Global Explorer Search Bar */}
      <div className="relative max-w-xl" id="explorer-search-wrap">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          placeholder={`Filtra ${activeTab === "lots" ? "lotti, fornitori..." : activeTab === "ingredients" ? "materie prime..." : "fornitori, P.IVA..."}`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="explorer-search-input"
        />
      </div>

      {/* RENDER TAB CONTROLLER */}
      {loading ? (
        <div className="bg-white rounded-2xl p-16 border border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
          <span>Inizializzazione tabella...</span>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden" id="explorer-table-container">
          
          {/* TAB 1: LOTS REGISTER */}
          {activeTab === "lots" && (
            <div className="divide-y divide-slate-100">
              {filteredLots.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">Nessun lotto corrispondente ai criteri di ricerca.</div>
              ) : (
                filteredLots.map((lot) => {
                  const lotStatus = getLotStatus(lot);
                  const isExpanded = expandedLotId === lot.id;
                  const usageHistory = getLotUsageHistory(lot.id);

                  return (
                    <div key={lot.id} className="transition-colors hover:bg-slate-50/40">
                      {/* Row visible header */}
                      <div
                        onClick={() => setExpandedLotId(isExpanded ? null : lot.id)}
                        className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-[11px] px-2.5 py-0.5 bg-slate-900 text-white rounded-sm">
                              {lot.numero_lotto}
                            </span>
                            <span className="font-bold text-slate-800 text-sm">
                              {lot.ingrediente?.nome_generico}
                            </span>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${lotStatus.color}`}>
                              {lotStatus.label}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-0.5"><Building size={11} /> {lot.fornitore?.ragione_sociale}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5"><Clock size={11} /> Scad: <strong>{formatDate(lot.data_scadenza)}</strong></span>
                          </div>
                        </div>

                        {/* Stock metrics */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Giacenza Residua</p>
                            <p className="text-sm font-black text-slate-800">
                              {lot.quantita_rimanente} / {lot.quantita_caricata} <span className="text-[11px] text-slate-500 font-normal">{lot.ingrediente?.unita_misura}</span>
                            </p>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {lot.quantita_rimanente > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDischargeLot(lot);
                                }}
                                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl transition-all"
                                title="Scarica Manuale"
                              >
                                <ArrowDownToLine size={15} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditLot(lot);
                              }}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all"
                              title="Modifica"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLot(lot.id, lot.numero_lotto);
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-xl transition-all"
                              title="Elimina"
                            >
                              <Trash size={15} />
                            </button>
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </div>
                      </div>

                      {/* Pedigree Expander Details */}
                      {isExpanded && (
                        <div className="p-5 bg-slate-50/50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 animate-in fade-in duration-200">
                          
                          {/* Lot specifications */}
                          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <h5 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider text-blue-700">Tracciabilità Origine</h5>
                            <div className="space-y-2">
                              <p className="flex justify-between border-b border-slate-50 pb-1">
                                <span className="text-slate-400">Tipo Doc:</span>
                                <span className="font-semibold uppercase">{lot.documento?.tipo}</span>
                              </p>
                              <p className="flex justify-between border-b border-slate-50 pb-1">
                                <span className="text-slate-400">Numero Doc:</span>
                                <span className="font-mono font-bold">{lot.documento?.numero_documento}</span>
                              </p>
                              <p className="flex justify-between border-b border-slate-50 pb-1">
                                <span className="text-slate-400">Data Documento:</span>
                                <span className="font-semibold">{formatDate(lot.documento?.data_documento)}</span>
                              </p>
                              <p className="flex justify-between border-b border-slate-50 pb-1">
                                <span className="text-slate-400">Data Ricezione:</span>
                                <span className="font-semibold">{formatDate(lot.data_ricezione)}</span>
                              </p>
                              <p className="flex justify-between">
                                <span className="text-slate-400">Prezzo di Carico:</span>
                                <span className="font-semibold">{lot.prezzo_unitario ? `${lot.prezzo_unitario.toFixed(2)} €/${lot.ingrediente?.unita_misura}` : "N/A"}</span>
                              </p>
                            </div>
                          </div>

                          {/* Traceability History Logs (HACCP) */}
                          <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                            <h5 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider text-blue-700">Registro Utilizzo (HACCP)</h5>
                            
                            {usageHistory.length === 0 ? (
                              <div className="text-slate-400 text-center py-6">Nessun utilizzo registrato per questo lotto.</div>
                            ) : (
                              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                {usageHistory.map((log, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <div>
                                      <p className="font-bold text-slate-700 text-[11px]">{log.recipeName}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">{log.date}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-mono font-extrabold text-red-600">-{log.qtyUsed} {lot.ingrediente?.unita_misura}</p>
                                      <p className="text-[9px] text-slate-400 uppercase">Utilizzato</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: INGREDIENTS STATUS */}
          {activeTab === "ingredients" && (
            <div className="divide-y divide-slate-100">
              {filteredIngredients.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">Nessuna materia prima corrispondente.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-4">Ingrediente</th>
                        <th className="p-4">Categoria</th>
                        <th className="p-4 text-center">Scorta Minima</th>
                        <th className="p-4 text-right">Giacenza Totale</th>
                        <th className="p-4 text-center">Stato</th>
                        <th className="p-4 text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredIngredients.map((ing) => (
                        <tr key={ing.ingrediente_id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-800 text-sm">
                            {ing.nome_generico}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-sm font-semibold text-slate-600">
                              {ing.categoria || "N/A"}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-slate-500">
                            {ing.scorta_minima} {ing.unita_misura}
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-sm text-slate-800">
                              {ing.scorta_totale.toFixed(2)} {ing.unita_misura}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {ing.warnings === "empty" && (
                              <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full font-bold text-[10px] uppercase border border-red-100">
                                Sottoscorta Esaurito 🚨
                              </span>
                            )}
                            {ing.warnings === "low" && (
                              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-bold text-[10px] uppercase border border-amber-100">
                                Sottoscorta Scarso ⚠️
                              </span>
                            )}
                            {ing.warnings === "ok" && (
                              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-[10px] uppercase border border-blue-100">
                                Scorta Conforme
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSearchQuery(ing.nome_generico);
                                  setActiveTab("lots");
                                }}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                title="Traccia Lotti e Scadenze di questo ingrediente"
                              >
                                <Eye size={12} />
                                <span>Vedi Lotti</span>
                              </button>
                              <button
                                onClick={() => handleStartEditIngredient(ing)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all"
                                title="Modifica"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(ing.ingrediente_id, ing.nome_generico)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-all"
                                title="Elimina"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUPPLIERS LIST */}
          {activeTab === "suppliers" && (
            <div className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">Nessun fornitore registrato.</div>
              ) : (
                filteredSuppliers.map((sup) => (
                  <div key={sup.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/40">
                    <div className="space-y-1.5 md:max-w-xl">
                      <h4 className="font-black text-slate-800 text-base">{sup.ragione_sociale}</h4>
                      <p className="text-[11px] font-mono text-slate-400 font-bold uppercase">P.IVA: {sup.p_iva}</p>
                      {sup.note && <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{sup.note}</p>}
                    </div>

                    {/* Contacts and actions detail */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6 text-xs text-slate-500 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div>
                        <p className="font-bold text-slate-400 uppercase text-[9px]">Email ordini</p>
                        <p className="text-slate-700 font-medium">{sup.email || "Non inserita"}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-400 uppercase text-[9px]">Recapito</p>
                        <p className="text-slate-700 font-medium">{sup.telefono || "Non inserito"}</p>
                      </div>

                      {/* CRUD Actions */}
                      <div className="flex items-center gap-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <button
                          onClick={() => handleStartEditSupplier(sup)}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all animate-none"
                          title="Modifica"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(sup.id, sup.ragione_sociale)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-xl transition-all animate-none"
                          title="Elimina"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}

      {/* DISCHARGE POPUP MODAL (Manual Lot reduction) */}
      {dischargeLot && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-800">Registra Scarico Lotto Manuale</h3>
            <p className="text-xs text-slate-500 mt-1">
              Inserisci la quantità da detrarre dal lotto <strong className="font-mono text-slate-900 bg-slate-100 px-1 py-0.5 rounded-sm">{dischargeLot.numero_lotto}</strong> ({dischargeLot.ingrediente?.nome_generico}).
            </p>

            <form onSubmit={handleDischargeSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Quantità da scaricare ({dischargeLot.ingrediente?.unita_misura})*</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    max={dischargeLot.quantita_rimanente}
                    min="0.001"
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    placeholder={`Giacenza disp.: ${dischargeLot.quantita_rimanente}`}
                    value={dischargeQty}
                    onChange={(e) => setDischargeQty(e.target.value)}
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-400 font-bold">
                    {dischargeLot.ingrediente?.unita_misura}
                  </span>
                </div>
              </div>

              {/* Warnings */}
              <div className="p-3.5 bg-amber-50 rounded-xl text-[11px] text-amber-700 border border-amber-200/50 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <p>Lo scarico manuale aggiorna la scorta istantaneamente e viene registrato per la conformità HACCP.</p>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDischargeLot(null);
                    setDischargeQty("");
                  }}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                  disabled={discharging}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-md"
                  disabled={discharging}
                >
                  {discharging ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Conferma Scarico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW INGREDIENT POPUP MODAL */}
      {showAddIngModal && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-800">Crea Nuova Materia Prima</h3>
            <p className="text-xs text-slate-500 mt-1">Registra l'anagrafica di un nuovo ingrediente per il tracciamento.</p>

            <form onSubmit={handleAddIngSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome Generico*</label>
                <input
                  type="text"
                  required
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Es. Carne Macinata Bovino"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Unità di Misura*</label>
                  <select
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    value={newIngUom}
                    onChange={(e) => setNewIngUom(e.target.value)}
                  >
                    <option value="kg">kg (Chili)</option>
                    <option value="g">g (Grammi)</option>
                    <option value="l">l (Litri)</option>
                    <option value="ml">ml (Millilitri)</option>
                    <option value="pz">pz (Pezzi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Categoria</label>
                  <select
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    value={newIngCategory}
                    onChange={(e) => setNewIngCategory(e.target.value)}
                  >
                    <option value="Farine">Farine</option>
                    <option value="Carni">Carni</option>
                    <option value="Latticini">Latticini</option>
                    <option value="Spezie">Spezie / Salse</option>
                    <option value="Verdure">Verdure</option>
                    <option value="Imballaggi">Imballaggi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Scorta Minima Alert Threshold</label>
                <input
                  type="number"
                  min="0"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                  placeholder="10"
                  value={newIngMinStock}
                  onChange={(e) => setNewIngMinStock(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">Ricevi una notifica di warning se la giacenza totale scende sotto questo limite.</p>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddIngModal(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                >
                  Crea Materia Prima
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LOT POPUP MODAL */}
      {editLot && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-800">Modifica Dati Lotto</h3>
            <p className="text-xs text-slate-500 mt-1">
              Stai modificando il lotto <strong className="font-mono text-slate-900 bg-slate-100 px-1 py-0.5 rounded-sm">{editLot.numero_lotto}</strong> ({editLot.ingrediente?.nome_generico}).
            </p>

            <form onSubmit={handleEditLotSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Codice/Numero Lotto*</label>
                <input
                  type="text"
                  required
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  value={editLotNum}
                  onChange={(e) => setEditLotNum(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Quantità Caricata ({editLot.ingrediente?.unita_misura})*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    value={editLotQtyCaricata}
                    onChange={(e) => setEditLotQtyCaricata(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Quantità Rimanente ({editLot.ingrediente?.unita_misura})*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    value={editLotQtyRimanente}
                    onChange={(e) => setEditLotQtyRimanente(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Data Scadenza (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    value={editLotExpiry || ""}
                    onChange={(e) => setEditLotExpiry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Prezzo Unitario (€)*</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    value={editLotPrice}
                    onChange={(e) => setEditLotPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditLot(null)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                  disabled={updatingLot}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                  disabled={updatingLot}
                >
                  {updatingLot ? "Salvataggio..." : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INGREDIENT POPUP MODAL */}
      {editIng && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-800">Modifica Materia Prima</h3>
            <p className="text-xs text-slate-500 mt-1">Aggiorna le informazioni di anagrafica per {editIng.nome_generico}.</p>

            <form onSubmit={handleEditIngredientSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome Generico*</label>
                <input
                  type="text"
                  required
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  value={editIngName}
                  onChange={(e) => setEditIngName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Unità di Misura*</label>
                  <select
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                    value={editIngUom}
                    onChange={(e) => setEditIngUom(e.target.value)}
                  >
                    <option value="kg">kg (Chili)</option>
                    <option value="g">g (Grammi)</option>
                    <option value="l">l (Litri)</option>
                    <option value="ml">ml (Millilitri)</option>
                    <option value="pz">pz (Pezzi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Categoria</label>
                  <select
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    value={editIngCategory}
                    onChange={(e) => setEditIngCategory(e.target.value)}
                  >
                    <option value="Farine">Farine</option>
                    <option value="Carni">Carni</option>
                    <option value="Latticini">Latticini</option>
                    <option value="Spezie">Spezie / Salse</option>
                    <option value="Verdure">Verdure</option>
                    <option value="Imballaggi">Imballaggi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Scorta Minima Alert Threshold</label>
                <input
                  type="number"
                  min="0"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                  value={editIngMinStock}
                  onChange={(e) => setEditIngMinStock(e.target.value)}
                />
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditIng(null)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                  disabled={updatingIng}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                  disabled={updatingIng}
                >
                  {updatingIng ? "Salvataggio..." : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER POPUP MODAL */}
      {editSup && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-800">Modifica Fornitore</h3>
            <p className="text-xs text-slate-500 mt-1">Aggiorna l'anagrafica del fornitore {editSup.ragione_sociale}.</p>

            <form onSubmit={handleEditSupplierSubmit} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ragione Sociale*</label>
                <input
                  type="text"
                  required
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  value={editSupName}
                  onChange={(e) => setEditSupName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Partita IVA*</label>
                <input
                  type="text"
                  required
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  value={editSupPiva}
                  onChange={(e) => setEditSupPiva(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Email Ordini</label>
                  <input
                    type="email"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="ordini@email.it"
                    value={editSupEmail}
                    onChange={(e) => setEditSupEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Telefono</label>
                  <input
                    type="text"
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                    placeholder="+39 ..."
                    value={editSupPhone}
                    onChange={(e) => setEditSupPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Note / Dettagli</label>
                <textarea
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[70px]"
                  placeholder="Note aggiuntive..."
                  value={editSupNote}
                  onChange={(e) => setEditSupNote(e.target.value)}
                />
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditSup(null)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                  disabled={updatingSup}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                  disabled={updatingSup}
                >
                  {updatingSup ? "Salvataggio..." : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
