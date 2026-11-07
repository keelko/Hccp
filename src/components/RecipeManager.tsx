/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  CookingPot,
  Plus,
  RefreshCw,
  Layers,
  ChevronRight,
  TrendingDown,
  Clock,
  History,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Calendar,
  Sparkles,
  Trash2,
  Pencil,
  Printer
} from "lucide-react";
import { Ricetta, StockStatus } from "../types";

export default function RecipeManager() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [discharges, setDischarges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view: "recipes" | "production" | "history"
  const [activeTab, setActiveTab] = useState<"recipes" | "production" | "history">("recipes");

  // Production Wizard State
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [produceQty, setProduceQty] = useState("");
  const [step, setStep] = useState(1); // Step 1: Qty, Step 2: Lot allocation preview
  const [lotAllocation, setLotAllocation] = useState<any[]>([]); // { lotId, lotNumber, ingName, qtyUsed, maxAvail }
  const [submittingProduction, setSubmittingProduction] = useState(false);

  // New Recipe Modal State
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [newRecipeIngredients, setNewRecipeIngredients] = useState<{ ingredientId: string; qty: string }[]>([
    { ingredientId: "", qty: "" }
  ]);

  // Quick Add Raw Material al Volo
  const [showQuickAddIng, setShowQuickAddIng] = useState(false);
  const [quickIngName, setQuickIngName] = useState("");
  const [quickIngUom, setQuickIngUom] = useState("kg");

  // Edit Production Discharge State
  const [editingDischarge, setEditingDischarge] = useState<any | null>(null);
  const [editProduceQty, setEditProduceQty] = useState("");
  const [editProduceDate, setEditProduceDate] = useState("");

  // Label Printing States
  const [showPrintLabelModal, setShowPrintLabelModal] = useState(false);
  const [selectedDischargeForLabel, setSelectedDischargeForLabel] = useState<any | null>(null);
  const [labelWeight, setLabelWeight] = useState("500g");
  const [labelStorage, setLabelStorage] = useState("Conservare in luogo fresco e asciutto");
  const [labelExpiryDays, setLabelExpiryDays] = useState(30);
  const [customLotNumber, setCustomLotNumber] = useState("");
  const [labelTmcWording, setLabelTmcWording] = useState("Da consumarsi preferibilmente entro il:");
  const [labelOrigin, setLabelOrigin] = useState("Origine: Italia");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recRes, ingRes, lotsRes, discRes] = await Promise.all([
        fetch("/api/recipes"),
        fetch("/api/ingredients"),
        fetch("/api/lots"),
        fetch("/api/discharges")
      ]);

      const recData = await recRes.json();
      const ingData = await ingRes.json();
      const lotsData = await lotsRes.json();
      const discData = await discRes.json();

      setRecipes(recData);
      setIngredients(ingData);
      setLots(lotsData);
      setDischarges(discData);
    } catch (e) {
      console.error("Errore recupero ricette/lotti:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDischarge = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa registrazione di produzione? Le materie prime consumate verranno ripristinate nelle giacenze del magazzino!")) {
      return;
    }
    try {
      const res = await fetch(`/api/discharges/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Errore durante l'eliminazione");
      fetchData(); // ricarica tutto, comprese le giacenze ripristinate!
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  const handleUpdateDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDischarge) return;
    try {
      const res = await fetch(`/api/discharges/${editingDischarge.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantita_prodotta: Number(editProduceQty),
          data: editProduceDate
        })
      });
      if (!res.ok) throw new Error("Errore durante l'aggiornamento");
      setEditingDischarge(null);
      fetchData();
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  // Setup Lot allocation automatically based on FIFO (First In First Out / earliest expiry first)
  const calculateLotAllocation = () => {
    const qty = Number(produceQty);
    if (!selectedRecipe || isNaN(qty) || qty <= 0) {
      alert("Selezionare una quantità valida.");
      return;
    }

    const allocationList: any[] = [];
    let insufficientStockError = false;
    const errors: string[] = [];

    // For each ingredient in the recipe
    selectedRecipe.ingredienti.forEach((ri: any) => {
      const neededTotal = Number((ri.quantita_richiesta * qty).toFixed(3));
      let remainingNeeded = neededTotal;

      // Find active, non-empty, non-expired lots of this ingredient
      // Sort by expiration date (earliest first), fallback to reception date
      const activeLots = lots
        .filter((l) => l.ingrediente_id === ri.ingrediente_id && l.quantita_rimanente > 0)
        .sort((a, b) => {
          if (!a.data_scadenza) return 1;
          if (!b.data_scadenza) return -1;
          return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
        });

      const totalAvail = activeLots.reduce((sum, l) => sum + l.quantita_rimanente, 0);
      if (totalAvail < neededTotal) {
        insufficientStockError = true;
        errors.push(
          `Scorte insufficienti per "${ri.nome_generico}". Richiesti: ${neededTotal} ${ri.unita_misura}, disponibili in lotti attivi: ${totalAvail} ${ri.unita_misura}.`
        );
      }

      // Deduct from lots FIFO
      for (const lot of activeLots) {
        if (remainingNeeded <= 0) break;

        const take = Math.min(lot.quantita_rimanente, remainingNeeded);
        allocationList.push({
          lotId: lot.id,
          lotNumber: lot.numero_lotto,
          ingId: ri.ingrediente_id,
          ingName: ri.nome_generico,
          uom: ri.unita_misura,
          qtyUsed: Number(take.toFixed(3)),
          maxAvail: lot.quantita_rimanente
        });

        remainingNeeded = Number((remainingNeeded - take).toFixed(3));
      }
    });

    if (insufficientStockError) {
      alert(errors.join("\n"));
      return;
    }

    setLotAllocation(allocationList);
    setStep(2); // Go to review step
  };

  // Adjust allocated quantity manually in step 2
  const handleAllocationQtyChange = (index: number, newQty: number) => {
    const updated = [...lotAllocation];
    const item = updated[index];
    if (newQty > item.maxAvail) {
      alert("La quantità non può superare la giacenza disponibile nel lotto.");
      return;
    }
    updated[index] = {
      ...item,
      qtyUsed: Number(newQty)
    };
    setLotAllocation(updated);
  };

  // Run and save Production Discharge
  const handleProductionSubmit = async () => {
    try {
      setSubmittingProduction(true);
      
      const payload = {
        ricetta_id: selectedRecipe.id,
        quantita_prodotta: Number(produceQty),
        lotti_selezionati: lotAllocation.map((la) => ({
          lotId: la.lotId,
          quantita_usata: la.qtyUsed
        }))
      };

      const res = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Errore durante la registrazione del lotto di produzione.");
      }

      await fetchData();
      alert("Produzione completata! Scorte di magazzino aggiornate correttamente.");
      
      // Reset State
      setStep(1);
      setSelectedRecipe(null);
      setProduceQty("");
      setLotAllocation([]);
      setActiveTab("history"); // Go to logs history
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingProduction(false);
    }
  };

  // Create or Update Recipe Handler
  const handleAddRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName.trim()) {
      alert("Nome ricetta obbligatorio.");
      return;
    }

    const cleanIngs = newRecipeIngredients.filter((ri) => ri.ingredientId && Number(ri.qty) > 0);
    if (cleanIngs.length === 0) {
      alert("Inserire almeno un ingrediente valido con quantità positiva.");
      return;
    }

    try {
      const payload = {
        nome_prodotto_finito: newRecipeName,
        ingredienti: cleanIngs.map((i) => ({
          ingrediente_id: i.ingredientId,
          quantita_richiesta: Number(i.qty)
        }))
      };

      const url = editingRecipeId ? `/api/recipes/${editingRecipeId}` : "/api/recipes";
      const method = editingRecipeId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Impossibile salvare la ricetta.");
      }

      await fetchData();
      setShowAddRecipeModal(false);
      setEditingRecipeId(null);
      setNewRecipeName("");
      setNewRecipeIngredients([{ ingredientId: "", qty: "" }]);
      alert(editingRecipeId ? "Ricetta modificata con successo!" : "Ricetta salvata con successo!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa ricetta? Questa azione non influirà sui lotti già prodotti, ma rimuoverà la ricetta dall'elenco.")) {
      return;
    }
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore durante l'eliminazione");
      await fetchData();
      alert("Ricetta eliminata con successo!");
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  const handleAddModalRow = () => {
    setNewRecipeIngredients([...newRecipeIngredients, { ingredientId: "", qty: "" }]);
  };

  const handleModalIngChange = (index: number, field: "ingredientId" | "qty", val: string) => {
    const updated = [...newRecipeIngredients];
    updated[index] = {
      ...updated[index],
      [field]: val
    };
    setNewRecipeIngredients(updated);
  };

  const handleRemoveModalRow = (index: number) => {
    setNewRecipeIngredients(newRecipeIngredients.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-6" id="recipe-manager-container">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Distinte Basi e Produzione</h2>
          <p className="text-xs text-slate-400 mt-1">Definisci le ricette dei prodotti finiti e automatizza gli scarichi scorte per la produzione.</p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {activeTab === "recipes" && (
            <button
              onClick={() => setShowAddRecipeModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              id="btn-trigger-add-recipe"
            >
              <Plus size={14} /> Nuova Ricetta
            </button>
          )}
          
          <button
            onClick={fetchData}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
            title="Aggiorna Ricette"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold overflow-x-auto whitespace-nowrap scrollbar-none" id="recipe-view-switcher">
        <button
          onClick={() => setActiveTab("recipes")}
          className={`shrink-0 px-6 py-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "recipes"
              ? "border-blue-600 text-blue-700 bg-blue-50/30"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-view-recipes"
        >
          <CookingPot size={14} /> Ricette Attive ({recipes.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("production");
            setStep(1);
          }}
          className={`shrink-0 px-6 py-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "production"
              ? "border-blue-600 text-blue-700 bg-blue-50/30"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-run-production"
        >
          <Play size={14} className="text-blue-600 fill-blue-600/10" /> Scarico di Produzione Wizard
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`shrink-0 px-6 py-3.5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "history"
              ? "border-blue-600 text-blue-700 bg-blue-50/30"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-production-history"
        >
          <History size={14} /> Storico Scarichi ({discharges.length})
        </button>
      </div>

      {/* CONTENTS */}
      {loading ? (
        <div className="bg-white rounded-2xl p-16 border border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
          <span>Inizializzazione produzione...</span>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6" id="recipes-subpanels">
          
          {/* TAB 1: RECIPES DIRECTORY */}
          {activeTab === "recipes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="recipes-grid">
              {recipes.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs md:col-span-3">Nessuna ricetta inserita nel sistema.</div>
              ) : (
                recipes.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-5 border border-slate-200 rounded-2xl shadow-2xs hover:shadow-xs transition-all bg-white space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0">
                            <CookingPot size={18} />
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">{rec.nome_prodotto_finito}</h4>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingRecipeId(rec.id);
                              setNewRecipeName(rec.nome_prodotto_finito);
                              setNewRecipeIngredients(
                                rec.ingredienti.map((ri: any) => ({
                                  ingredientId: ri.ingrediente_id,
                                  qty: String(ri.quantita_richiesta)
                                }))
                              );
                              setShowAddRecipeModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="Modifica ricetta"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteRecipe(rec.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Elimina ricetta"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Ingredients lists */}
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distinta ingredienti (unitaria):</p>
                        <div className="space-y-1">
                          {rec.ingredienti?.map((ri: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-slate-600 p-1 rounded-sm bg-slate-50">
                              <span>{ri.nome_generico}</span>
                              <span className="font-bold text-slate-800">
                                {ri.quantita_richiesta} {ri.unita_misura}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedRecipe(rec);
                          setActiveTab("production");
                          setStep(1);
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Play size={12} className="fill-white" /> Avvia Produzione
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: AUTOMATIC PRODUCTION LOT ALLOCATION WIZARD */}
          {activeTab === "production" && (
            <div className="max-w-3xl mx-auto" id="production-wizard-panel">
              {step === 1 ? (
                // STEP 1: SELECT RECIPE & QUANTITY
                <div className="space-y-6">
                  <div className="text-center pb-4 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-800">Lancia un Lotto di Produzione</h3>
                    <p className="text-xs text-slate-500 mt-1">Il sistema calcolerà le scorte necessarie prelevando automaticamente dai lotti attivi più vecchi (FIFO).</p>
                  </div>

                  <div className="space-y-4">
                    {/* Select Recipe */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Seleziona Ricetta / Prodotto*</label>
                      <select
                        className="block w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                        value={selectedRecipe ? selectedRecipe.id : ""}
                        onChange={(e) => {
                          const found = recipes.find((r) => r.id === e.target.value);
                          setSelectedRecipe(found || null);
                        }}
                      >
                        <option value="">-- Seleziona una ricetta --</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nome_prodotto_finito}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity to produce */}
                    {selectedRecipe && (
                      <div className="animate-in fade-in slide-in-from-top-1.5 duration-150 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5">Quantità di Prodotto Finito da Produrre*</label>
                          <input
                            type="number"
                            required
                            min="1"
                            className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-extrabold"
                            placeholder="Es. 100 panetti, burger..."
                            value={produceQty}
                            onChange={(e) => setProduceQty(e.target.value)}
                          />
                        </div>

                        {/* Ingredients preview logic */}
                        <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
                          <h5 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider mb-2">Previsione Consumo Ingredienti Totale:</h5>
                          <div className="space-y-1.5">
                            {selectedRecipe.ingredienti?.map((ri: any, idx: number) => {
                              const totalNeed = Number(ri.quantita_richiesta) * (Number(produceQty) || 0);
                              return (
                                <div key={idx} className="flex justify-between text-xs text-slate-600">
                                  <span>{ri.nome_generico}</span>
                                  <span className="font-bold text-slate-800">
                                    {totalNeed.toFixed(3)} {ri.unita_misura}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex justify-end pt-4">
                          <button
                            onClick={calculateLotAllocation}
                            disabled={!produceQty || Number(produceQty) <= 0}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                          >
                            Calcola Lotti FIFO <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // STEP 2: REVIEW LOT ALLOCATIONS & EXECUTE DISCHARGE
                <div className="space-y-6">
                  <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Allocazione dei Lotti</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        La produzione richiede lo scarico dei seguenti lotti in magazzino. Puoi modificare i valori se necessario.
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    >
                      Indietro
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lotAllocation.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.ingName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs font-extrabold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-sm">
                              {item.lotNumber}
                            </span>
                            <span className="text-xs text-slate-500">
                              Giacenza disp: {item.maxAvail} {item.uom}
                            </span>
                          </div>
                        </div>

                        {/* Editable Qty adjustment */}
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-500">Quantità prelevata:</label>
                          <div className="relative w-36">
                            <input
                              type="number"
                              step="any"
                              max={item.maxAvail}
                              min="0"
                              className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                              value={item.qtyUsed}
                              onChange={(e) => handleAllocationQtyChange(idx, Number(e.target.value))}
                            />
                            <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-slate-400 font-bold">
                              {item.uom}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-700 border border-amber-200/50 flex items-start gap-1.5 max-w-md">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                      <p>Il salvataggio ridurrà la giacenza residua dei lotti elencati qui sopra in via definitiva.</p>
                    </div>

                    <button
                      onClick={handleProductionSubmit}
                      disabled={submittingProduction}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      {submittingProduction ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Registra Produzione
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRODUCTION LOGS HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4" id="production-logs-list">
              {discharges.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-xs">Nessuna registrazione di produzione in archivio.</div>
              ) : (
                [...discharges].reverse().map((disc) => (
                  <div
                    key={disc.id}
                    className="p-5 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50/20 transition-all flex flex-col space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">Batch Prodotto: {disc.nome_prodotto_finito}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">ID scarico: {disc.id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Resoconto Lotto</p>
                          <p className="text-sm font-black text-slate-800">+{disc.quantita_prodotta} pezzi</p>
                        </div>
                        <span className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-semibold flex items-center gap-1">
                          <Calendar size={12} /> {disc.data}
                        </span>
                        
                        {/* Actions: Edit / Delete */}
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                          <button
                            onClick={() => {
                              setSelectedDischargeForLabel(disc);
                              // Auto-generate a beautiful lot code based on date and batch id
                              const dateStr = disc.data.split(" ")[0].replace(/-/g, "");
                              const shortId = disc.id.slice(0, 4).toUpperCase();
                              setCustomLotNumber(`L-${dateStr}-${shortId}`);
                              setLabelWeight("500g");
                              setLabelStorage("Conservare in luogo fresco e asciutto");
                              setLabelExpiryDays(30);
                              setShowPrintLabelModal(true);
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all cursor-pointer font-bold text-xs flex items-center gap-1 shrink-0"
                            title="Stampa Etichetta Prodotto"
                          >
                            <Printer size={14} />
                            <span>Stampa Etichetta</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setEditingDischarge(disc);
                              setEditProduceQty(String(disc.quantita_prodotta));
                              setEditProduceDate(disc.data);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                            title="Modifica registrazione"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteDischarge(disc.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Elimina registrazione"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Consumed details */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tracciabilità Ingredienti Consumati (HACCP):</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" id="consumed-lots-haccp">
                        {disc.lotti_usati_dettaglio?.map((lu: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-700">{lu.nome_generico}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Lotto: {lu.numero_lotto}</p>
                            </div>
                            <span className="font-mono font-bold text-red-600">
                              -{lu.quantita_usata} {lu.unita_misura}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}

      {/* CREATE RECIPE POPUP MODAL */}
      {showAddRecipeModal && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800">
                {editingRecipeId ? "Modifica Ricetta" : "Definisci Nuova Ricetta"}
              </h3>
              <button
                onClick={() => {
                  setShowAddRecipeModal(false);
                  setEditingRecipeId(null);
                  setNewRecipeName("");
                  setNewRecipeIngredients([{ ingredientId: "", qty: "" }]);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRecipeSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome Prodotto Finito*</label>
                <input
                  type="text"
                  required
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Es. Burger Speciale al Cheddar"
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                />
              </div>

              {/* Dynamic rows of ingredients */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Composizione Ricetta*</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddIng(!showQuickAddIng)}
                      className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold border border-amber-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Materia Prima al volo
                    </button>
                    <button
                      type="button"
                      onClick={handleAddModalRow}
                      className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold border border-blue-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Aggiungi Riga
                    </button>
                  </div>
                </div>

                {showQuickAddIng && (
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 space-y-2.5 animate-in slide-in-from-top-1.5 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Aggiunta Rapida Materia Prima</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowQuickAddIng(false);
                          setQuickIngName("");
                        }}
                        className="text-amber-500 hover:text-amber-700"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="Nome materia prima (es. Lievito, Pomodoro)"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                          value={quickIngName}
                          onChange={(e) => setQuickIngName(e.target.value)}
                        />
                      </div>
                      <div>
                        <select
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                          value={quickIngUom}
                          onChange={(e) => setQuickIngUom(e.target.value)}
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="pz">pz</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!quickIngName.trim()) {
                            alert("Inserisci un nome valido.");
                            return;
                          }
                          try {
                            const res = await fetch("/api/ingredients", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                nome_generico: quickIngName.trim(),
                                unita_misura: quickIngUom,
                                categoria: "Senza categoria",
                                scorta_minima: 0
                              })
                            });
                            if (!res.ok) throw new Error("Errore salvataggio");
                            const saved = await res.json();
                            
                            // Aggiorna l'elenco locale delle materie prime
                            const ingRes = await fetch("/api/ingredients");
                            const ingData = await ingRes.json();
                            setIngredients(ingData);

                            // Inserisci automaticamente l'ingrediente creato nell'ultima riga
                            const updated = [...newRecipeIngredients];
                            const lastIdx = updated.length - 1;
                            if (lastIdx >= 0) {
                              updated[lastIdx] = {
                                ...updated[lastIdx],
                                ingredientId: saved.id || saved.ingrediente_id
                              };
                              setNewRecipeIngredients(updated);
                            }

                            setQuickIngName("");
                            setShowQuickAddIng(false);
                          } catch (err) {
                            alert("Impossibile salvare la materia prima.");
                          }
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                      >
                        Salva e Metti in Ricetta
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1" id="recipe-ingredients-modal-rows">
                  {newRecipeIngredients.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <select
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        value={item.ingredientId}
                        onChange={(e) => handleModalIngChange(idx, "ingredientId", e.target.value)}
                        required
                      >
                        <option value="">Seleziona Materia Prima</option>
                        {ingredients.map((ing) => (
                          <option key={ing.ingrediente_id} value={ing.ingrediente_id}>
                            {ing.nome_generico} ({ing.unita_misura})
                          </option>
                        ))}
                      </select>

                      <div className="relative w-32">
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.001"
                          placeholder="Quantità"
                          className="block w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          value={item.qty}
                          onChange={(e) => handleModalIngChange(idx, "qty", e.target.value)}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400 font-bold">
                          {ingredients.find((ing) => ing.ingrediente_id === item.ingredientId)?.unita_misura || ""}
                        </span>
                      </div>

                      {newRecipeIngredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveModalRow(idx)}
                          className="p-1.5 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors shrink-0"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRecipeModal(false);
                    setEditingRecipeId(null);
                    setNewRecipeName("");
                    setNewRecipeIngredients([{ ingredientId: "", qty: "" }]);
                  }}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                >
                  {editingRecipeId ? "Salva Modifiche" : "Salva Ricetta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DISCHARGE POPUP MODAL */}
      {editingDischarge && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800">Modifica Registrazione Produzione</h3>
              <button
                onClick={() => setEditingDischarge(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer animate-none"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateDischarge} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ricetta / Prodotto Finito</label>
                <input
                  type="text"
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-semibold focus:outline-hidden cursor-not-allowed"
                  value={editingDischarge.nome_prodotto_finito}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantità Prodotta (pezzi)*</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  value={editProduceQty}
                  onChange={(e) => setEditProduceQty(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Registrazione (YYYY-MM-DD HH:mm)*</label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  value={editProduceDate}
                  onChange={(e) => setEditProduceDate(e.target.value)}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingDischarge(null)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT COMPLIANT LABEL MODAL */}
      {showPrintLabelModal && selectedDischargeForLabel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Stampa Etichetta Alimentare Professionale (HACCP)</h3>
                  <p className="text-[10px] text-slate-400">Generatore di etichette a norma UE 1169/2011 per il prodotto finito</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPrintLabelModal(false);
                  setSelectedDischargeForLabel(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 overflow-y-auto flex-1">
              {/* Left Column: Configuration Controls */}
              <div className="space-y-4 pr-1">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                  Configura Parametri Etichetta
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nome Prodotto
                  </label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-semibold cursor-not-allowed"
                    value={selectedDischargeForLabel.nome_prodotto_finito}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Lotto Confezionamento
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      value={customLotNumber}
                      onChange={(e) => setCustomLotNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Peso Netto (es. 500g, 1Kg)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      value={labelWeight}
                      onChange={(e) => setLabelWeight(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Giorni di Validità (TMC)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      value={labelExpiryDays}
                      onChange={(e) => setLabelExpiryDays(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Data di Produzione
                    </label>
                    <input
                      type="text"
                      disabled
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold cursor-not-allowed text-slate-500"
                      value={selectedDischargeForLabel.data.split(" ")[0]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Scadenza / TMC Calcolata
                    </label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 font-mono">
                      {(() => {
                        try {
                          const prodDatePart = selectedDischargeForLabel.data.split(" ")[0];
                          const date = new Date(prodDatePart);
                          if (!isNaN(date.getTime())) {
                            date.setDate(date.getDate() + labelExpiryDays);
                            return date.toLocaleDateString("it-IT");
                          }
                        } catch (e) {}
                        return "N/D";
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Paese d'Origine / Provenienza
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      value={labelOrigin}
                      onChange={(e) => setLabelOrigin(e.target.value)}
                      placeholder="Origine: Italia"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Dicitura Data di Scadenza (Reg. UE 1169)
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      value={labelTmcWording}
                      onChange={(e) => setLabelTmcWording(e.target.value)}
                    >
                      <option value="Da consumarsi preferibilmente entro il:">TMC (Prodotti secchi, conserve...)</option>
                      <option value="Da consumarsi entro il:">Scadenza Tassativa (Prodotti deperibili/freschi...)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Istruzioni di Conservazione
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    value={labelStorage}
                    onChange={(e) => setLabelStorage(e.target.value)}
                  />
                </div>

                <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100 text-[11px] text-blue-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Sparkles size={12} className="text-blue-600" />
                    Generazione Automatica Allergeni:
                  </p>
                  <p className="text-slate-500 leading-normal">
                    L'applicazione analizza l'anagrafica degli ingredienti usati e evidenzia automaticamente gli allergeni in <strong>GRASSETTO E SOTTOLINEATO</strong>, garantendo la conformità con il Regolamento UE 1169/2011.
                  </p>
                </div>
              </div>

              {/* Right Column: Live Sticky Label Preview */}
              <div className="flex flex-col items-center justify-center bg-slate-100 rounded-3xl p-6 border border-slate-200/60 min-h-[300px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                  Anteprima Etichetta (80mm x 50mm)
                </p>

                {/* Simulated Adhesive Thermal Label */}
                <div 
                  className="bg-white text-black p-4 border-2 border-black rounded-sm shadow-md w-full max-w-[340px] aspect-[8/5] flex flex-col justify-between font-sans select-none"
                  id="thermal-label-preview"
                >
                  <div className="text-center border-b border-black pb-1">
                    <div className="text-[9px] font-extrabold tracking-wider uppercase truncate">
                      {typeof window !== "undefined" ? localStorage.getItem("businessName") || "Lab_Rossi" : "Lab_Rossi"}
                    </div>
                    <div className="text-[5.5px] uppercase tracking-wider text-slate-500 font-bold truncate">
                      {typeof window !== "undefined" ? localStorage.getItem("businessAddress") || "Via dei Laboratori 42, Milano (MI)" : "Via dei Laboratori 42, Milano (MI)"}
                    </div>
                  </div>

                  <div className="my-0.5 text-center">
                    <h5 className="text-[11px] font-black uppercase tracking-wide leading-tight truncate">
                      {selectedDischargeForLabel.nome_prodotto_finito}
                    </h5>
                  </div>

                  <div className="text-[6.5px] leading-tight text-slate-800 text-justify overflow-hidden max-h-[42px] mb-1.5">
                    <strong className="text-[5.5px] uppercase">Ingredienti: </strong>
                    {selectedDischargeForLabel.lotti_usati_dettaglio && selectedDischargeForLabel.lotti_usati_dettaglio.length > 0 ? (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: selectedDischargeForLabel.lotti_usati_dettaglio
                            .map((lu: any) => {
                              const text = lu.nome_generico || "";
                              const allergens = [
                                "glutine", "frumento", "grano", "latte", "uova", "uovo", "burro", "lievito", "arachidi", 
                                "nocciole", "mandorle", "pesce", "soia", "sedano", "senape", "sesamo", "solfiti", "lattosio"
                              ];
                              let formatted = text;
                              allergens.forEach(allergen => {
                                const regex = new RegExp(`(${allergen}\\w*)`, "gi");
                                formatted = formatted.replace(regex, "<strong><u>$1</u></strong>");
                              });
                              return formatted;
                            })
                            .join(", ") + "."
                        }}
                      />
                    ) : (
                      <span className="italic text-slate-400">Ingredienti ricetta non specificati.</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-black pt-1 text-[7px] font-bold">
                    <div className="flex justify-between border-r border-slate-200 pr-1">
                      <span className="text-slate-400 text-[5.5px] uppercase">PROD</span>
                      <span>{selectedDischargeForLabel.data.split(" ")[0]}</span>
                    </div>
                    <div className="flex justify-between pl-1">
                      <span className="text-slate-400 text-[5.5px] uppercase">{labelTmcWording.toLowerCase().includes("preferibilmente") ? "TMC" : "SCAD"}</span>
                      <span>
                        {(() => {
                          try {
                            const prodDatePart = selectedDischargeForLabel.data.split(" ")[0];
                            const date = new Date(prodDatePart);
                            if (!isNaN(date.getTime())) {
                              date.setDate(date.getDate() + labelExpiryDays);
                              return date.toLocaleDateString("it-IT");
                            }
                          } catch (e) {}
                          return "N/D";
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between border-r border-slate-200 pr-1">
                      <span className="text-slate-400 text-[5.5px] uppercase">LOTTO</span>
                      <span className="font-mono">{customLotNumber}</span>
                    </div>
                    <div className="flex justify-between pl-1">
                      <span className="text-slate-400 text-[5.5px] uppercase">PESO</span>
                      <span>{labelWeight}</span>
                    </div>
                    <div className="flex justify-between border-r border-slate-200 pr-1 col-span-2 pt-0.5 border-t border-slate-100">
                      <span className="text-slate-400 text-[5.5px] uppercase">PROVENIENZA</span>
                      <span>{labelOrigin}</span>
                    </div>
                  </div>

                  {/* Simulated barcode / storage advice bar */}
                  <div className="mt-1 pt-1 border-t border-dotted border-black flex items-center justify-between">
                    <span className="text-[5.5px] font-bold text-slate-600 italic max-w-[190px] truncate">
                      {labelStorage}
                    </span>
                    
                    {/* Tiny visual barcode mock */}
                    <div className="flex gap-0.5 h-2.5 items-end pr-1" title="Visual Lotto Barcode">
                      <div className="w-0.5 bg-black h-full"></div>
                      <div className="w-[1px] bg-black h-5/6"></div>
                      <div className="w-[3px] bg-black h-full"></div>
                      <div className="w-[1px] bg-black h-full"></div>
                      <div className="w-0.5 bg-black h-5/6"></div>
                      <div className="w-[1px] bg-black h-full"></div>
                      <div className="w-0.5 bg-black h-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPrintLabelModal(false);
                  setSelectedDischargeForLabel(null);
                }}
                className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                Annulla
              </button>
              
              <button
                type="button"
                onClick={() => {
                  if (!selectedDischargeForLabel) return;
                  const business = typeof window !== "undefined" ? localStorage.getItem("businessName") || "Lab_Rossi" : "Lab_Rossi";
                  const businessAddress = typeof window !== "undefined" ? localStorage.getItem("businessAddress") || "Via dei Laboratori 42, Milano (MI)" : "Via dei Laboratori 42, Milano (MI)";
                  const prodName = selectedDischargeForLabel.nome_prodotto_finito;
                  const prodDate = selectedDischargeForLabel.data.split(" ")[0];
                  
                  // Compute expiry date
                  let expDate = "N/D";
                  try {
                    const date = new Date(prodDate);
                    if (!isNaN(date.getTime())) {
                      date.setDate(date.getDate() + labelExpiryDays);
                      expDate = date.toLocaleDateString("it-IT");
                    }
                  } catch (e) {}

                  // Highlight allergens
                  const highlightAllergens = (text: string) => {
                    if (!text) return "";
                    const allergens = [
                      "glutine", "frumento", "grano", "latte", "uova", "uovo", "burro", "lievito", "arachidi", 
                      "nocciole", "mandorle", "pesce", "soia", "sedano", "senape", "sesamo", "solfiti", "lattosio"
                    ];
                    let formatted = text;
                    allergens.forEach(allergen => {
                      const regex = new RegExp(`(${allergen}\\w*)`, "gi");
                      formatted = formatted.replace(regex, "<strong><u>$1</u></strong>");
                    });
                    return formatted;
                  };

                  const ingredientsHtml = selectedDischargeForLabel.lotti_usati_dettaglio && selectedDischargeForLabel.lotti_usati_dettaglio.length > 0
                    ? selectedDischargeForLabel.lotti_usati_dettaglio
                        .map((lu: any) => highlightAllergens(lu.nome_generico || ""))
                        .join(", ")
                    : "Ingredienti secondo ricetta depositata.";

                  const printWindow = window.open("", "_blank");
                  if (!printWindow) {
                    alert("Per favore, consenti i pop-up nel tuo browser per poter stampare l'etichetta.");
                    return;
                  }

                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Etichetta - ${prodName}</title>
                        <style>
                          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                          body {
                            font-family: 'Inter', sans-serif;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            background-color: #ffffff;
                          }
                          .label-card {
                            border: 1px solid #000000;
                            width: 80mm;
                            height: 50mm;
                            padding: 2.5mm 3.5mm;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            background: #ffffff;
                            color: #000000;
                          }
                          .header {
                            text-align: center;
                            border-bottom: 1px solid #000000;
                            padding-bottom: 0.8mm;
                            margin-bottom: 1.2mm;
                          }
                          .business-name {
                            font-size: 3mm;
                            font-weight: 900;
                            text-transform: uppercase;
                            letter-spacing: 0.1mm;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                          .business-address {
                            font-size: 1.6mm;
                            font-weight: 700;
                            text-transform: uppercase;
                            color: #444444;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            margin-top: 0.3mm;
                          }
                          .product-title {
                            font-size: 3.8mm;
                            font-weight: 900;
                            text-transform: uppercase;
                            margin: 0.8mm 0;
                            text-align: center;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                          .ingredients-box {
                            font-size: 1.8mm;
                            line-height: 2.3mm;
                            margin-bottom: 1.5mm;
                            flex-grow: 1;
                            overflow: hidden;
                          }
                          .ingredients-title {
                            font-weight: 700;
                            text-transform: uppercase;
                            display: inline;
                          }
                          .meta-grid {
                            display: grid;
                            grid-template-cols: 1fr 1fr;
                            font-size: 2mm;
                            border-top: 1px solid #000000;
                            padding-top: 1.2mm;
                            gap: 0.6mm;
                          }
                          .meta-item {
                            display: flex;
                            justify-content: space-between;
                            font-weight: 700;
                          }
                          .meta-label {
                            font-weight: 400;
                            text-transform: uppercase;
                            font-size: 1.5mm;
                            color: #444444;
                          }
                          .footer-bar {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 1.7mm;
                            border-top: 1px dotted #000000;
                            padding-top: 0.8mm;
                            margin-top: 0.8mm;
                          }
                          .storage-info {
                            font-weight: 600;
                            font-style: italic;
                            max-w: 55mm;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                          @media print {
                            body {
                              padding: 0;
                              margin: 0;
                            }
                            .label-card {
                              border: none;
                            }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="label-card">
                          <div class="header">
                            <div class="business-name">${business}</div>
                            <div class="business-address">${businessAddress}</div>
                          </div>
                          <div class="product-title">${prodName}</div>
                          <div class="ingredients-box">
                            <div class="ingredients-title">Ingredienti: </div>
                            ${ingredientsHtml}.
                          </div>
                          <div class="meta-grid">
                            <div class="meta-item" style="border-right: 1px solid #000; padding-right: 1.2mm;">
                              <span class="meta-label">PRODOTTO IL</span>
                              <span>${prodDate}</span>
                            </div>
                            <div class="meta-item" style="padding-left: 1.2mm;">
                              <span class="meta-label">${labelTmcWording.toUpperCase().includes("PREFERIBILMENTE") ? "TMC" : "SCADENZA"}</span>
                              <span>${expDate}</span>
                            </div>
                            <div class="meta-item" style="border-right: 1px solid #000; padding-right: 1.2mm;">
                              <span class="meta-label">LOTTO</span>
                              <span style="font-family: monospace;">${customLotNumber}</span>
                            </div>
                            <div class="meta-item" style="padding-left: 1.2mm;">
                              <span class="meta-label">PESO NETTO</span>
                              <span>${labelWeight}</span>
                            </div>
                            <div class="meta-item" style="grid-column: span 2; border-top: 1px solid #ddd; padding-top: 0.5mm; margin-top: 0.3mm;">
                              <span class="meta-label">PROVENIENZA</span>
                              <span>${labelOrigin}</span>
                            </div>
                          </div>
                          <div class="footer-bar">
                            <span class="storage-info">${labelStorage}</span>
                            <span style="font-weight: 900; font-size: 1.5mm; letter-spacing: 0.1mm;">REG. UE 1169/2011</span>
                          </div>
                        </div>
                        <script>
                          window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                          }
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Stampa o Salva PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
