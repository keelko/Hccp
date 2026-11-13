/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Camera,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  Clock,
  ArrowRight,
  RefreshCw,
  Eye,
  BookOpen,
  HelpCircle,
  FileText,
  Printer,
  Info,
  X,
  Plus,
  Minus,
  ShoppingCart,
  Send,
  Share2,
  Trash2,
  Save,
  Check,
  CheckSquare,
  Square,
  Thermometer,
  Flame,
  Smartphone,
  Mail,
  Award,
  Sparkle,
  Download,
  Building
} from "lucide-react";
import { StockStatus } from "../types";
import ManualInteractiveSection from "./ManualInteractiveSection";

interface DashboardHomeProps {
  onCameraClick: () => void;
  onGalleryClick: () => void;
  onManualClick?: () => void;
  onDemoSelect: (demoId: number) => void;
  onNavigateToExplorer: (searchQuery?: string, filterType?: "lots" | "suppliers" | "ingredients") => void;
  onNavigateToRecipes: () => void;
  onNavigateToReports?: () => void;
}

export default function DashboardHome({
  onCameraClick,
  onGalleryClick,
  onManualClick,
  onDemoSelect,
  onNavigateToExplorer,
  onNavigateToRecipes,
  onNavigateToReports
}: DashboardHomeProps) {
  // General Data States
  const [ingredients, setIngredients] = useState<StockStatus[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Alert details and threshold
  const [expiryThresholdDays, setExpiryThresholdDays] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lotExpirationThresholdDays");
      return saved ? parseInt(saved) || 7 : 7;
    }
    return 7;
  });
  const [expiredLots, setExpiredLots] = useState<any[]>([]);
  const [expiringSoonLots, setExpiringSoonLots] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "expired" | "expiring">("expired");

  // Floating notifications toasts stack
  const [toasts, setToasts] = useState<any[]>([]);
  const [shownToasts, setShownToasts] = useState<boolean>(false);

  // Scan History States
  const [scannedDocuments, setScannedDocuments] = useState<any[]>([]);
  const [loadingScans, setLoadingScans] = useState<boolean>(false);
  const [selectedDocDetails, setSelectedDocDetails] = useState<any | null>(null);
  const [scanTypeFilter, setScanTypeFilter] = useState<string>("all");
  const [scanDateFilter, setScanDateFilter] = useState<string>("");
  const [scanSearchQuery, setScanSearchQuery] = useState<string>("");

  // Metro UI view selector ("ordine" | "inventario" | "caricoscarico" | "produzione" | "temperature" | "pulizie" | null)
  const [metroSubView, setMetroSubView] = useState<string | null>(null);

  // Guided Tour States
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // ==========================================
  // MODULE-SPECIFIC STATES
  // ==========================================
  
  // Module 1: Nuovo Ordine
  const [selectedOrderSupplier, setSelectedOrderSupplier] = useState<string | null>(null);
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [showOrderSummaryModal, setShowOrderSummaryModal] = useState(false);
  const [generatedOrderText, setGeneratedOrderText] = useState("");

  // Module 2: Inventario & Note
  const [invSupplierFilter, setInvSupplierFilter] = useState<string>("all");
  const [staffNotes, setStaffNotes] = useState<Record<string, string>>({});
  const [colliConversion, setColliConversion] = useState<Record<string, number>>({}); // items per package
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteValue, setTempNoteValue] = useState("");

  // Module 3: Carico/Scarico
  const [caricoScaricoTab, setCaricoScaricoTab] = useState<"carico" | "scarico" | "scans">("carico");
  const [scaricoIngredienteId, setScaricoIngredienteId] = useState<string>("");
  const [scaricoLotId, setScaricoLotId] = useState<string>("");
  const [scaricoQty, setScaricoQty] = useState<number>(1);
  const [scaricoSuccess, setScaricoSuccess] = useState<string | null>(null);
  const [scaricoError, setScaricoError] = useState<string | null>(null);

  // Module 4: Produzione
  const [recipesList, setRecipesList] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [productionQty, setProductionQty] = useState<number>(1);
  const [productionSuccess, setProductionSuccess] = useState<string | null>(null);
  const [productionError, setProductionError] = useState<string | null>(null);

  // Module 5: Registro Temperature
  const [tempOperator, setTempOperator] = useState("O.S.A. Rossi");
  const [selectedTempFridge, setSelectedTempFridge] = useState("Frigorifero 1 (Carni/Freschi)");
  const [selectedTempValue, setSelectedTempValue] = useState("+4°C");
  const [temperatureLogs, setTemperatureLogs] = useState<any[]>([]);
  const [tempLogSuccess, setTempLogSuccess] = useState(false);

  // Module 6: Registro Pulizie & Saponi
  const [pulizieTab, setPulizieTab] = useState<"giornaliera" | "settimanale" | "mensile">("giornaliera");
  const [completedPulizie, setCompletedPulizie] = useState<Record<string, boolean>>({});
  const [saponiList, setSaponiList] = useState<any[]>([]);
  const [newSoapName, setNewSoapName] = useState("");
  const [newSoapActive, setNewSoapActive] = useState("Sgrassante Clorato");
  const [newSoapPhoto, setNewSoapPhoto] = useState<string | null>(null);
  const [showPulizieReportModal, setShowPulizieReportModal] = useState(false);

  // Fetch initial stats & load local storage
  useEffect(() => {
    fetchStats();
    fetchSuppliers();
    fetchRecipes();
    loadLocalStorageData();
    fetchScannedDocuments();
  }, []);

  const triggerBrowserNotification = (productName: string, lotNumber: string, expiryDate: string) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(`Scadenza Lotto: ${productName}`, {
          body: `Lotto ${lotNumber} in scadenza il ${expiryDate}!`,
          icon: "/favicon.ico"
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(`Scadenza Lotto: ${productName}`, {
              body: `Lotto ${lotNumber} in scadenza il ${expiryDate}!`,
              icon: "/favicon.ico"
            });
          }
        });
      }
    }
  };

  const fetchScannedDocuments = async () => {
    try {
      setLoadingScans(true);
      const res = await fetch("/api/documents");
      const docs = await res.json();
      setScannedDocuments(docs);
    } catch (e) {
      console.error("Errore recupero cronologia scansioni:", e);
    } finally {
      setLoadingScans(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const [ingRes, lotsRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/lots")
      ]);
      const ingData = await ingRes.json();
      const lotsData = await lotsRes.json();

      setIngredients(ingData);
      setLots(lotsData);

      // Group lots for expiry alerts
      const now = new Date();
      const savedThreshold = typeof window !== "undefined" ? localStorage.getItem("lotExpirationThresholdDays") : null;
      const thresholdDays = savedThreshold ? parseInt(savedThreshold) || 7 : 7;
      const thresholdDate = new Date();
      thresholdDate.setDate(now.getDate() + thresholdDays);

      const expired: any[] = [];
      const expiringSoon: any[] = [];

      lotsData.forEach((lot: any) => {
        if (lot.quantita_rimanente <= 0) return; // ignore empty lots
        if (!lot.data_scadenza) return;

        const expiryDate = new Date(lot.data_scadenza);
        if (expiryDate < now) {
          expired.push(lot);
        } else if (expiryDate <= thresholdDate) {
          expiringSoon.push(lot);
        }
      });

      const sortByReceptionDesc = (a: any, b: any) => {
        const dateA = a.data_ricezione ? new Date(a.data_ricezione).getTime() : 0;
        const dateB = b.data_ricezione ? new Date(b.data_ricezione).getTime() : 0;
        if (dateA !== dateB) return dateB - dateA;
        return String(b.id).localeCompare(String(a.id));
      };
      expired.sort(sortByReceptionDesc);
      expiringSoon.sort(sortByReceptionDesc);

      setExpiredLots(expired);
      setExpiringSoonLots(expiringSoon);
      
      if (expired.length === 0 && expiringSoon.length > 0) {
        setActiveTab("expiring");
      }
    } catch (e) {
      console.error("Errore caricamento statistiche:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  // Recalculate expiry alerts when threshold changes
  useEffect(() => {
    if (lots.length === 0) return;
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + expiryThresholdDays);

    const expired: any[] = [];
    const expiringSoon: any[] = [];

    lots.forEach((lot: any) => {
      if (lot.quantita_rimanente <= 0) return;
      if (!lot.data_scadenza) return;

      const expiryDate = new Date(lot.data_scadenza);
      if (expiryDate < now) {
        expired.push(lot);
      } else if (expiryDate <= thresholdDate) {
        expiringSoon.push(lot);
      }
    });

    const sortByReceptionDesc = (a: any, b: any) => {
      const dateA = a.data_ricezione ? new Date(a.data_ricezione).getTime() : 0;
      const dateB = b.data_ricezione ? new Date(b.data_ricezione).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return String(b.id).localeCompare(String(a.id));
    };
    expired.sort(sortByReceptionDesc);
    expiringSoon.sort(sortByReceptionDesc);

    setExpiredLots(expired);
    setExpiringSoonLots(expiringSoon);
  }, [expiryThresholdDays, lots]);

  // Handle toasts triggering
  useEffect(() => {
    if (loadingStats || lots.length === 0 || shownToasts) return;

    if (expiringSoonLots.length > 0 || expiredLots.length > 0) {
      const newToasts = expiringSoonLots.slice(0, 3).map((lot, index) => {
        const diffTime = new Date(lot.data_scadenza).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        triggerBrowserNotification(lot.ingrediente?.nome_generico, lot.numero_lotto, formatDate(lot.data_scadenza));

        return {
          id: `toast-${index}-${Date.now()}`,
          prodotto: lot.ingrediente?.nome_generico,
          lotto: lot.numero_lotto,
          dataScadenza: formatDate(lot.data_scadenza),
          giorniRimasti: diffDays,
          tipo: "warning"
        };
      });

      const expiredToasts = expiredLots.slice(0, 2).map((lot, index) => {
        return {
          id: `toast-exp-${index}-${Date.now()}`,
          prodotto: lot.ingrediente?.nome_generico,
          lotto: lot.numero_lotto,
          dataScadenza: formatDate(lot.data_scadenza),
          giorniRimasti: 0,
          tipo: "error"
        };
      });

      setToasts([...expiredToasts, ...newToasts]);
      setShownToasts(true);
    }
  }, [loadingStats, expiringSoonLots, expiredLots, shownToasts]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      setSuppliers(data);
    } catch (e) {
      console.error("Errore caricamento fornitori:", e);
    }
  };

  const fetchRecipes = async () => {
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      setRecipesList(data);
    } catch (e) {
      console.error("Errore caricamento ricette:", e);
    }
  };

  const loadLocalStorageData = () => {
    try {
      // Notes staff
      const storedNotes = localStorage.getItem("haccp_staff_notes");
      if (storedNotes) setStaffNotes(JSON.parse(storedNotes));

      // Package conversions
      const storedColli = localStorage.getItem("haccp_colli_conversions");
      if (storedColli) setColliConversion(JSON.parse(storedColli));

      // Temp logs
      const storedTempLogs = localStorage.getItem("haccp_temperature_logs");
      if (storedTempLogs) {
        setTemperatureLogs(JSON.parse(storedTempLogs));
      } else {
        // Prepopulate with realistic historic entries so it looks nice on day 1
        const defaultLogs = [
          {
            id: "1",
            data: new Date(Date.now() - 3 * 3600 * 1000).toLocaleString("it-IT"),
            frigo: "Frigorifero 1 (Carni/Freschi)",
            temperatura: "+3°C",
            operatore: "O.S.A. Rossi",
            conforme: true
          },
          {
            id: "2",
            data: new Date(Date.now() - 6 * 3600 * 1000).toLocaleString("it-IT"),
            frigo: "Cella Surgelati (-20°C)",
            temperatura: "-21°C",
            operatore: "O.S.A. Bianchi",
            conforme: true
          },
          {
            id: "3",
            data: new Date(Date.now() - 24 * 3600 * 1000).toLocaleString("it-IT"),
            frigo: "Frigorifero 2 (Verdure/Bevande)",
            temperatura: "+4°C",
            operatore: "O.S.A. Rossi",
            conforme: true
          }
        ];
        localStorage.setItem("haccp_temperature_logs", JSON.stringify(defaultLogs));
        setTemperatureLogs(defaultLogs);
      }

      // Cleaning completed
      const storedPulizie = localStorage.getItem("haccp_pulizie_completed");
      if (storedPulizie) setCompletedPulizie(JSON.parse(storedPulizie));

      // Soaps list
      const storedSaponi = localStorage.getItem("haccp_saponi_list");
      if (storedSaponi) {
        setSaponiList(JSON.parse(storedSaponi));
      } else {
        const defaultSaponi = [
          { id: "1", nome: "Cloractive Professional", principio: "Ipoclorito di Sodio", foto: null },
          { id: "2", nome: "Sgrassatore Forte Vetri", principio: "Tensioattivi cationici", foto: null },
          { id: "3", nome: "Dermogel Mani Igienizzante", principio: "Alcol Etilico 75%", foto: null }
        ];
        localStorage.setItem("haccp_saponi_list", JSON.stringify(defaultSaponi));
        setSaponiList(defaultSaponi);
      }
    } catch (e) {
      console.error("Errore caricamento dati locali:", e);
    }
  };

  // Realtime search suggestions
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: any[] = [];

    lots.forEach((lot) => {
      const matchLot = lot.numero_lotto?.toLowerCase().includes(query);
      const matchIng = lot.ingrediente?.nome_generico?.toLowerCase().includes(query);
      const matchForn = lot.fornitore?.ragione_sociale?.toLowerCase().includes(query);

      if (matchLot || matchIng || matchForn) {
        results.push({
          type: "lot",
          id: lot.id,
          title: `Lotto: ${lot.numero_lotto}`,
          subtitle: `${lot.ingrediente?.nome_generico || "Ingrediente"} - ${lot.quantita_rimanente} ${lot.ingrediente?.unita_misura || ""}`,
          subBadge: lot.fornitore?.ragione_sociale,
          badgeColor: "bg-blue-100 text-blue-800",
          payload: lot
        });
      }
    });

    setSearchResults(results.slice(0, 5));
  }, [searchQuery, lots]);

  // Save notes to local storage helper
  const handleSaveNote = (ingredientId: string, noteText: string) => {
    const updatedNotes = { ...staffNotes, [ingredientId]: noteText };
    setStaffNotes(updatedNotes);
    localStorage.setItem("haccp_staff_notes", JSON.stringify(updatedNotes));
    setEditingNoteId(null);
  };

  // Save colli conversion helper
  const handleSaveColliConversion = (ingredientId: string, factor: number) => {
    const updatedColli = { ...colliConversion, [ingredientId]: factor };
    setColliConversion(updatedColli);
    localStorage.setItem("haccp_colli_conversions", JSON.stringify(updatedColli));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Senza scadenza";
    const d = new Date(dateStr);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  };

  const lowStockCount = ingredients.filter((i) => i.warnings === "low" || i.warnings === "empty").length;

  const tourSteps = [
    {
      title: "📱 1. Sistema Metro UI & Navigazione Rapida",
      description: "Abbiamo trasformato l'applicazione con una nuovissima interfaccia a quadranti colorati (ispirata a Windows Phone). È ottimizzata per smartphone e tablet a muro, adatta a tutte le età (anche per personale anziano). Ogni quadrante raggruppa le funzioni in blocchi ben definiti e ad alta visibilità.",
      elementId: "metro-grid-container",
      targetText: "Quadranti Operativi Metro UI"
    },
    {
      title: "🛒 2. Elaborazione e Nuovo Ordine d'Acquisto",
      description: "Seleziona un fornitore dal primo quadrante, regola le quantità con grandi tasti + e - (mentre vedi la giacenza attuale in parentesi) e genera un foglio d'ordine digitale. Invialo all'istante su WhatsApp o via email con un singolo tocco.",
      elementId: "tile-ordine",
      targetText: "Blocco Nuovo Ordine"
    },
    {
      title: "📋 3. Registro Temperature e Pulizie (HACCP)",
      description: "Due moduli specifici per eliminare la carta. Nel Registro Temperature digiti i gradi istantaneamente da un menu touch. Nel Registro Pulizie spunti le aree pulite su base giornaliera, settimanale o mensile, gestisci l'anagrafica dei saponi con foto ed esporti report pronti per i controlli sanitari.",
      elementId: "tile-temperature",
      targetText: "Pannelli HACCP"
    }
  ];

  // ==========================================
  // ACTIONS FOR INDIVIDUAL MODULES
  // ==========================================

  // Module 1: Order Generation Action
  const handleGenerateOrderText = (supplierName: string) => {
    const lines = [`📋 *ORDINE DI ACQUISTO - HACCP SMART-TRACK*`];
    lines.push(`🏢 *Fornitore:* ${supplierName}`);
    lines.push(`📅 *Data:* ${new Date().toLocaleDateString("it-IT")}`);
    lines.push(`---------------------------------`);
    
    let hasItems = false;
    Object.keys(orderQuantities).forEach((ingId) => {
      const qty = orderQuantities[ingId] || 0;
      if (qty <= 0) return;
      const ing = ingredients.find(i => i.ingrediente_id === ingId);
      if (ing) {
        hasItems = true;
        const currentStock = ing.scorta_totale;
        lines.push(`• *${ing.nome_generico}:* ${qty} ${ing.unita_misura} _(Giacenza attuale: ${currentStock} ${ing.unita_misura})_`);
      }
    });

    if (!hasItems) {
      alert("Seleziona almeno un ingrediente con quantità maggiore di zero.");
      return;
    }

    lines.push(`---------------------------------`);
    lines.push(`Si prega di confermare la consegna. Grazie!`);
    const text = lines.join("\n");
    setGeneratedOrderText(text);
    setShowOrderSummaryModal(true);
  };

  const handleShareWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(generatedOrderText)}`;
    window.open(url, "_blank");
  };

  const handleShareEmail = () => {
    const url = `mailto:?subject=Nuovo%20Ordine%20Acquisto&body=${encodeURIComponent(generatedOrderText)}`;
    window.open(url, "_blank");
  };

  // Module 3: Discharge Lot
  const handleConfirmDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    setScaricoSuccess(null);
    setScaricoError(null);

    if (!scaricoLotId) {
      setScaricoError("Seleziona un lotto valido da scaricare.");
      return;
    }
    if (scaricoQty <= 0) {
      setScaricoError("Inserisci una quantità di scarico superiore a zero.");
      return;
    }

    try {
      const res = await fetch(`/api/lots/${scaricoLotId}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantita: scaricoQty })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nello scarico merci");

      setScaricoSuccess(`Registrato con successo! Scaricati ${scaricoQty} dal lotto selezionato.`);
      setScaricoQty(1);
      fetchStats(); // reload stock counts
    } catch (err: any) {
      setScaricoError(err.message || "Impossibile completare lo scarico.");
    }
  };

  // Module 4: Record Production Run
  const handleConfirmProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductionSuccess(null);
    setProductionError(null);

    if (!selectedRecipeId) {
      setProductionError("Seleziona una preparazione/ricetta.");
      return;
    }
    if (productionQty <= 0) {
      setProductionError("Inserisci una quantità prodotta valida.");
      return;
    }

    const recipe = recipesList.find(r => r.id === selectedRecipeId);
    if (!recipe) {
      setProductionError("Ricetta non trovata.");
      return;
    }

    // Automatically map ingredients lots for production
    // For each ingredient in the recipe, we need to gather lots that cover the total needed amount
    const lottiSelezionati: any[] = [];
    let stockDeficit = false;
    let deficitMessage = "";

    for (const item of recipe.ingredienti) {
      const neededQty = item.quantita_richiesta * productionQty;
      // Get active lots of this ingredient
      const activeLots = lots.filter(l => l.ingrediente_id === item.ingrediente_id && l.quantita_rimanente > 0);
      
      let gatheredQty = 0;
      for (const lot of activeLots) {
        if (gatheredQty >= neededQty) break;
        const take = Math.min(lot.quantita_rimanente, neededQty - gatheredQty);
        lottiSelezionati.push({
          lotId: lot.id,
          quantita_usata: take
        });
        gatheredQty += take;
      }

      if (gatheredQty < neededQty) {
        stockDeficit = true;
        deficitMessage = `Scorte insufficienti per: ${item.nome_generico}. Richiesti ${neededQty} ${item.unita_misura}, disponibili solo ${gatheredQty} ${item.unita_misura}.`;
        break;
      }
    }

    if (stockDeficit) {
      setProductionError(deficitMessage);
      return;
    }

    try {
      const res = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ricetta_id: selectedRecipeId,
          quantita_prodotta: productionQty,
          lotti_selezionati: lottiSelezionati
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella registrazione di produzione");

      setProductionSuccess(`La preparazione di "${recipe.nome_prodotto_finito}" è stata registrata! Le materie prime necessarie sono state scaricate automaticamente dal magazzino.`);
      setProductionQty(1);
      fetchStats(); // Refresh stocks
    } catch (err: any) {
      setProductionError(err.message || "Errore imprevisto durante la produzione.");
    }
  };

  // Module 5: Add Temperature Log
  const handleAddTemperatureLog = (e: React.FormEvent) => {
    e.preventDefault();
    setTempLogSuccess(false);

    // Parse numeric temperature to check if compliant
    const numVal = parseFloat(selectedTempValue.replace("°C", ""));
    let conforme = true;
    if (selectedTempFridge.includes("Surgelati") || selectedTempFridge.includes("Cella")) {
      if (numVal > -15) conforme = false;
    } else {
      if (numVal > 6) conforme = false;
    }

    const newLog = {
      id: Date.now().toString(),
      data: new Date().toLocaleString("it-IT"),
      frigo: selectedTempFridge,
      temperatura: selectedTempValue,
      operatore: tempOperator,
      conforme: conforme
    };

    const updatedLogs = [newLog, ...temperatureLogs];
    setTemperatureLogs(updatedLogs);
    localStorage.setItem("haccp_temperature_logs", JSON.stringify(updatedLogs));
    setTempLogSuccess(true);
    setTimeout(() => setTempLogSuccess(false), 3000);
  };

  // Module 6: Add Soap and Toggle Tasks
  const handleToggleTask = (taskId: string) => {
    const updated = { ...completedPulizie, [taskId]: !completedPulizie[taskId] };
    setCompletedPulizie(updated);
    localStorage.setItem("haccp_pulizie_completed", JSON.stringify(updated));
  };

  const handleAddSoap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSoapName.trim()) return;

    const newSoap = {
      id: Date.now().toString(),
      nome: newSoapName.trim(),
      principio: newSoapActive,
      foto: newSoapPhoto
    };

    const updated = [...saponiList, newSoap];
    setSaponiList(updated);
    localStorage.setItem("haccp_saponi_list", JSON.stringify(updated));
    
    setNewSoapName("");
    setNewSoapPhoto(null);
  };

  const handleSoapPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewSoapPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteSoap = (soapId: string) => {
    const updated = saponiList.filter(s => s.id !== soapId);
    setSaponiList(updated);
    localStorage.setItem("haccp_saponi_list", JSON.stringify(updated));
  };

  // Pre-configured list of tasks grouped by frequency
  const cleaningTasks = {
    giornaliera: [
      { id: "g1", text: "Sanificazione ripiani e superfici di lavoro in acciaio" },
      { id: "g2", text: "Lavaggio e disinfezione dei pavimenti della cucina" },
      { id: "g3", text: "Pulizia e smontaggio dell'affettatrice meccanica" },
      { id: "g4", text: "Svuotamento dei cestini rifiuti e lavaggio bidoni" }
    ],
    settimanale: [
      { id: "s1", text: "Lavaggio e sgrassatura delle pareti piastrellate della zona calda" },
      { id: "s2", text: "Pulizia interna approfondita dei frigoriferi e delle celle" },
      { id: "s3", text: "Sgrassatura filtri e cappa d'aspirazione fumi" }
    ],
    mensile: [
      { id: "m1", text: "Pulizia profonda interna ed esterna della friggitrice professionale" },
      { id: "m2", text: "Lavaggio delle guarnizioni magnetiche delle porte dei frigo" },
      { id: "m3", text: "Sanificazione straordinaria e pulizia filtri dell'aria del laboratorio" }
    ]
  };

  return (
    <div className="space-y-8" id="dashboard-container">
      
      {/* ==========================================
          HEADER & GLOBAL SEARCH BAR (ALWAYS VISIBLE)
          ========================================== */}
      <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/60" id="search-header-container">
        {/* Global Search Input */}
        <div 
          className="relative w-full transition-all duration-300"
          id="global-search-bar-wrap"
        >
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-xs font-bold"
            placeholder="Cerca numero lotto"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="global-search-input"
          />
          
          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute z-30 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200/60 divide-y divide-slate-100 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
              {searchResults.map((res) => (
                <div
                  key={res.id}
                  onClick={() => {
                    onNavigateToExplorer(res.payload.numero_lotto, "lots");
                    setSearchQuery("");
                  }}
                  className="p-3.5 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">
                      {res.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {res.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600 max-w-[120px] sm:max-w-[200px] truncate block">
                      {res.subBadge}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==========================================
          METRO UI TILE DASHBOARD (MAIN SCREEN VIEW)
          ========================================== */}
      {metroSubView === null ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* 6 Grid Tiles Windows Phone Style in 2x3 Grid */}
          <div 
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto" 
            id="metro-grid-container"
          >
            
            {/* Tile 1: Nuovo Ordine */}
            <button
              onClick={() => setMetroSubView("ordine")}
              className="aspect-square bg-blue-600 hover:bg-blue-500 text-white rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-4 transition-all duration-150 shadow-[0_4px_0_rgba(0,0,0,0.2),_0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.1)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none relative group cursor-pointer border border-blue-700/50"
              id="tile-ordine"
            >
              <div className="p-3 sm:p-4 bg-white/15 rounded-2xl mb-3">
                <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight">
                Nuovo Ordine
              </h3>
            </button>

            {/* Tile 2: Inventario & Note */}
            <button
              onClick={() => setMetroSubView("inventario")}
              className="aspect-square bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-4 transition-all duration-150 shadow-[0_4px_0_rgba(0,0,0,0.2),_0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.1)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none relative group cursor-pointer border border-cyan-700/50"
              id="tile-inventario"
            >
              <div className="p-3 sm:p-4 bg-white/15 rounded-2xl mb-3">
                <Layers className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight">
                Magazzino & Giacenze
              </h3>
            </button>

            {/* Tile 3: Carico & Scarico Merci */}
            <button
              onClick={() => setMetroSubView("caricoscarico")}
              className="aspect-square bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-4 transition-all duration-150 shadow-[0_4px_0_rgba(0,0,0,0.2),_0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.1)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none relative group cursor-pointer border border-emerald-700/50"
              id="tile-caricoscarico"
            >
              <div className="p-3 sm:p-4 bg-white/15 rounded-2xl mb-3">
                <Camera className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight">
                Carico / Scarico / DDT
              </h3>
            </button>

            {/* Tile 4: Produzione */}
            <button
              onClick={() => setMetroSubView("produzione")}
              className="aspect-square bg-purple-600 hover:bg-purple-500 text-white rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-4 transition-all duration-150 shadow-[0_4px_0_rgba(0,0,0,0.2),_0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.1)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none relative group cursor-pointer border border-purple-700/50"
              id="tile-produzione"
            >
              <div className="p-3 sm:p-4 bg-white/15 rounded-2xl mb-3">
                <Flame className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight">
                Produzione
              </h3>
            </button>

            {/* Tile 5: Registro Temperature */}
            <button
              onClick={() => setMetroSubView("temperature")}
              className="aspect-square bg-amber-600 hover:bg-amber-500 text-white rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-4 transition-all duration-150 shadow-[0_4px_0_rgba(0,0,0,0.2),_0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.1)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none relative group cursor-pointer border border-amber-700/50"
              id="tile-temperature"
            >
              <div className="p-3 sm:p-4 bg-white/15 rounded-2xl mb-3">
                <Thermometer className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight">
                Temperature HACCP
              </h3>
            </button>

            {/* Tile 6: Registro Pulizie */}
            <button
              onClick={() => setMetroSubView("pulizie")}
              className="aspect-square bg-rose-600 hover:bg-rose-500 text-white rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-4 transition-all duration-150 shadow-[0_4px_0_rgba(0,0,0,0.2),_0_8px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_2px_0_rgba(0,0,0,0.2),_0_4px_8px_rgba(0,0,0,0.1)] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none relative group cursor-pointer border border-rose-700/50"
              id="tile-pulizie"
            >
              <div className="p-3 sm:p-4 bg-white/15 rounded-2xl mb-3">
                <Sparkles className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-black uppercase tracking-tight">
                Pulizie & Saponi
              </h3>
            </button>

          </div>

          {/* Expiry Alarms Panel (Rosso, Arancione, Verde) - VISIBLE ON HOME */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="expiry-alert-panels-container">
            <div 
              className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
              id="expiry-tab-box"
            >
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <AlertTriangle className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Allarmi Scadenze HACCP</h3>
                    <p className="text-xs text-slate-400">Controllo lotti attivi in laboratorio</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/80 border border-slate-200 px-3 py-1 rounded-xl">
                    <span className="font-medium text-slate-600">Soglia allerta:</span>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      className="w-12 text-center bg-white border border-slate-200 rounded-md font-extrabold text-slate-800 focus:outline-hidden text-xs py-0.5"
                      value={expiryThresholdDays}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setExpiryThresholdDays(val);
                        localStorage.setItem("lotExpirationThresholdDays", String(val));
                      }}
                    />
                    <span className="font-medium text-[11px] text-slate-500">giorni</span>
                  </div>

                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-center">
                    <button
                      onClick={() => setActiveTab("expired")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        activeTab === "expired"
                          ? "bg-red-500 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🔴 Scaduti ({expiredLots.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("expiring")}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        activeTab === "expiring"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🟠 Entro {expiryThresholdDays}gg ({expiringSoonLots.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                {loadingStats ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Caricamento lotti...</span>
                  </div>
                ) : (
                  <>
                    {activeTab === "expired" && (
                      <div className="space-y-2">
                        {expiredLots.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600 mb-2" />
                            <p className="font-bold text-sm text-slate-700">Ottimo lavoro!</p>
                            <p className="text-xs text-slate-400 mt-0.5">Non ci sono lotti scaduti in laboratorio.</p>
                          </div>
                        ) : (
                          expiredLots.map((lot) => (
                            <div
                              key={lot.id}
                              className="p-3.5 bg-red-50 border border-red-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-red-100/50 transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-sm">
                                    {lot.numero_lotto}
                                  </span>
                                  <span className="font-bold text-slate-800 text-sm">
                                    {lot.ingrediente?.nome_generico}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-red-500" /> Scaduto il: <strong>{formatDate(lot.data_scadenza)}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>Fornitore: {lot.fornitore?.ragione_sociale}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-red-200/50">
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Giacenza</p>
                                  <p className="text-sm font-black text-slate-800">
                                    {lot.quantita_rimanente} {lot.ingrediente?.unita_misura}
                                  </p>
                                </div>
                                <button
                                  onClick={() => onNavigateToExplorer(lot.numero_lotto, "lots")}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  Gestisci <Eye size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeTab === "expiring" && (
                      <div className="space-y-2">
                        {expiringSoonLots.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600 mb-2" />
                            <p className="font-bold text-sm text-slate-700">Tutto conforme!</p>
                            <p className="text-xs text-slate-400 mt-0.5">Nessun lotto scadrà nei prossimi {expiryThresholdDays} giorni.</p>
                          </div>
                        ) : (
                          expiringSoonLots.map((lot) => (
                            <div
                              key={lot.id}
                              className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-amber-100/30 transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-sm">
                                    {lot.numero_lotto}
                                  </span>
                                  <span className="font-bold text-slate-800 text-sm">
                                    {lot.ingrediente?.nome_generico}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 font-medium">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} className="text-amber-500" /> Scade il: <strong>{formatDate(lot.data_scadenza)}</strong>
                                  </span>
                                  <span>•</span>
                                  <span>Fornitore: {lot.fornitore?.ragione_sociale}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-amber-200/50">
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Giacenza</p>
                                  <p className="text-sm font-black text-slate-800">
                                    {lot.quantita_rimanente} {lot.ingrediente?.unita_misura}
                                  </p>
                                </div>
                                <button
                                  onClick={() => onNavigateToExplorer(lot.numero_lotto, "lots")}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  Usa Prima <Eye size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Sidebar quick counts */}
            <div 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-6"
              id="stock-bento-subcard"
            >
              <div>
                <h4 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Stato del Magazzino</h4>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">Controllo scorte materie prime</p>
              </div>

              {loadingStats ? (
                <div className="flex justify-center py-6">
                  <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${lowStockCount > 0 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                        <TrendingDown size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-bold">Scorte Sotto Soglia</p>
                        <p className="text-xs text-slate-600 font-bold">Alerts attivi</p>
                      </div>
                    </div>
                    <span className={`text-lg font-black px-2.5 py-0.5 rounded-xl ${lowStockCount > 0 ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                      {lowStockCount}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
                        <Layers size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-bold">Lotti Totali</p>
                        <p className="text-xs text-slate-600 font-bold">In giacenza attiva</p>
                      </div>
                    </div>
                    <span className="text-lg font-black text-slate-700">
                      {lots.filter((l) => l.quantita_rimanente > 0).length}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Shortcuts */}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={() => onNavigateToExplorer("", "ingredients")}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Vedi Catalogo Completo
                </button>
                <button
                  onClick={onNavigateToRecipes}
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Gestione Ricettario 🍲
                </button>
                {onNavigateToReports && (
                  <button
                    onClick={onNavigateToReports}
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Genera Registro HACCP Ufficiale 📋
                  </button>
                )}
              </div>
            </div>
          </div>

          <ManualInteractiveSection setIsTourActive={setIsTourActive} setTourStep={setTourStep} />
        </div>
      ) : (
        /* ==========================================
            METRO SUB-VIEWS IN-PLACE INTERACTIVE CANVASES
            ========================================== */
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl animate-in fade-in duration-200">
          
          {/* Sub-view Navigation header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
            <button
              onClick={() => setMetroSubView(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft size={16} /> Torna ai Quadranti (Menu Principale)
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Stato: Attivo
              </span>
            </div>
          </div>

          {/* 1. ELABORAZIONE E NUOVO ORDINE VIEW */}
          {metroSubView === "ordine" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-blue-600 uppercase tracking-tight flex items-center gap-2">
                  <ShoppingCart size={28} /> Elaborazione & Nuovo Ordine d'Acquisto
                </h2>
                <p className="text-slate-500 mt-1 text-xs">
                  Seleziona un fornitore per ordinare le materie prime. Tasti grandi ottimizzati per la massima rapidità d'uso.
                </p>
              </div>

              {/* Step 1: Supplier Selection */}
              {!selectedOrderSupplier ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Scegli il fornitore destinatario dell'ordine:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Mock & Real integrated list of suppliers */}
                    {(suppliers.length > 0 ? suppliers : [
                      { id: "giorgione", ragione_sociale: "Giorgione Bevande & Bibite" },
                      { id: "farinera", ragione_sociale: "F.lli Rossi Sementi e Farine" },
                      { id: "latteria", ragione_sociale: "Latteria Centrale d'Abruzzo" }
                    ]).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setSelectedOrderSupplier(f.ragione_sociale);
                          // Reset quantities
                          setOrderQuantities({});
                        }}
                        className="p-5 bg-blue-50 border border-blue-100 hover:border-blue-300 rounded-2xl text-left transition-all active:scale-98 shadow-xs cursor-pointer group"
                      >
                        <h4 className="font-extrabold text-blue-900 group-hover:text-blue-600 transition-colors">
                          {f.ragione_sociale}
                        </h4>
                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                          Inizia Ordine <ChevronRight size={12} />
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Active order builder header */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest">Ordinando da:</p>
                      <h3 className="text-lg font-black text-blue-900">{selectedOrderSupplier}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedOrderSupplier(null)}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-blue-800 rounded-lg text-xs font-bold border border-blue-200 transition-colors"
                    >
                      Cambia Fornitore
                    </button>
                  </div>

                  {/* Quantity adjustment list */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prodotti e quantità</h4>
                    
                    {ingredients.map((ing) => {
                      const qty = orderQuantities[ing.ingrediente_id] || 0;
                      return (
                        <div
                          key={ing.ingrediente_id}
                          className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-800 text-sm block truncate">
                              {ing.nome_generico}
                            </span>
                            {/* Stock warning in parentheses as requested */}
                            <span className="text-[11px] text-slate-500 font-bold">
                              (In Giacenza: <span className={ing.scorta_totale <= (ing.scorta_minima || 5) ? "text-red-600" : "text-slate-600"}>{ing.scorta_totale} {ing.unita_misura}</span>)
                            </span>
                          </div>

                          {/* Large touch plus minus buttons */}
                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (qty > 0) {
                                  setOrderQuantities({ ...orderQuantities, [ing.ingrediente_id]: qty - 1 });
                                }
                              }}
                              className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center font-black active:scale-95 transition-all text-lg cursor-pointer shadow-xs"
                            >
                              <Minus size={16} strokeWidth={3} />
                            </button>
                            <span className="w-8 text-center text-sm font-black text-slate-800 font-mono">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setOrderQuantities({ ...orderQuantities, [ing.ingrediente_id]: qty + 1 });
                              }}
                              className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center font-black active:scale-95 transition-all text-lg cursor-pointer shadow-xs"
                            >
                              <Plus size={16} strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-5 flex justify-end">
                    <button
                      onClick={() => handleGenerateOrderText(selectedOrderSupplier)}
                      className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                    >
                      Genera Ordine Digitale <Check size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. INVENTARIO DI MAGAZZINO (GIACENZE E NOTE) VIEW */}
          {metroSubView === "inventario" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-cyan-600 uppercase tracking-tight flex items-center gap-2">
                    <Layers size={28} /> Inventario Scorte & Note di Comunicazione
                  </h2>
                  <p className="text-slate-500 mt-1 text-xs">
                    Consulenza delle rimanenze suddivise, gestione a Colli/Cartoni e spazio Note per allineare lo staff.
                  </p>
                </div>

                {/* Quick filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Fornitore:</span>
                  <select
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    value={invSupplierFilter}
                    onChange={(e) => setInvSupplierFilter(e.target.value)}
                  >
                    <option value="all">Mostra Tutti</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.ragione_sociale}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table list of ingredients */}
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                {ingredients
                  .filter(ing => {
                    if (invSupplierFilter === "all") return true;
                    // Check if there are active lots from this supplier
                    const matchingLots = lots.filter(l => l.ingrediente_id === ing.ingrediente_id && l.fornitore_id === invSupplierFilter);
                    return matchingLots.length > 0;
                  })
                  .map((ing) => {
                    const factor = colliConversion[ing.ingrediente_id] || 6; // default 6 items per package
                    const totalSingles = ing.scorta_totale;
                    const colli = Math.floor(totalSingles / factor);
                    const piecesLeft = totalSingles % factor;
                    const hasNote = staffNotes[ing.ingrediente_id];

                    return (
                      <div
                        key={ing.ingrediente_id}
                        className="p-4 bg-slate-50 border border-slate-200/60 rounded-3xl flex flex-col md:flex-row md:items-stretch justify-between gap-4"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 text-sm">
                              {ing.nome_generico}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ing.warnings === "empty" ? "bg-red-100 text-red-800" :
                              ing.warnings === "low" ? "bg-amber-100 text-amber-800" :
                              "bg-emerald-100 text-emerald-800"
                            }`}>
                              {ing.warnings.toUpperCase()}
                            </span>
                          </div>

                          {/* Conversion in Colli display */}
                          <div className="text-xs text-slate-500 font-bold flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Giacenza Totale: <strong className="text-slate-800">{totalSingles} {ing.unita_misura}</strong></span>
                            <span>•</span>
                            <span className="text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md">
                              📦 Equivalente a: <strong>{colli} colli</strong> {piecesLeft > 0 ? `+ ${piecesLeft} unità` : ""}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              Fattore collo: 
                              <input
                                type="number"
                                className="w-10 px-1 bg-white border border-slate-200 rounded text-center text-slate-800 font-bold"
                                value={factor}
                                onChange={(e) => handleSaveColliConversion(ing.ingrediente_id, Math.max(1, parseInt(e.target.value) || 1))}
                              />
                            </span>
                          </div>

                          {/* Staff Notes Area */}
                          <div className="bg-white p-3 rounded-xl border border-slate-100 mt-2 text-xs">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                              💬 Nota per lo staff (es. "due casse a metà")
                            </p>
                            
                            {editingNoteId === ing.ingrediente_id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                  value={tempNoteValue}
                                  onChange={(e) => setTempNoteValue(e.target.value)}
                                  placeholder="Scrivi nota di servizio..."
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveNote(ing.ingrediente_id, tempNoteValue)}
                                  className="p-1 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 cursor-pointer"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="p-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 cursor-pointer"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center gap-4">
                                <p className={`italic font-medium ${hasNote ? "text-cyan-800" : "text-slate-400"}`}>
                                  {hasNote || "Nessuna comunicazione inserita."}
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(ing.ingrediente_id);
                                    setTempNoteValue(hasNote || "");
                                  }}
                                  className="text-cyan-600 hover:text-cyan-800 font-bold text-[11px] underline cursor-pointer"
                                >
                                  Modifica Nota
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 3. CARICO & SCARICO MERCI / DDT VIEW */}
          {metroSubView === "caricoscarico" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-emerald-600 uppercase tracking-tight flex items-center gap-2">
                  <Camera size={28} /> Carico e Scarico Merci (DDT & Bolle)
                </h2>
                <p className="text-slate-500 mt-1 text-xs">
                  Scegli se caricare nuove merci da DDT (tramite scanner intelligente o manuale) o scaricare i lotti usati.
                </p>
              </div>

              {/* Sub-tab switcher */}
              <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-md">
                <button
                  onClick={() => setCaricoScaricoTab("carico")}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    caricoScaricoTab === "carico"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📥 Carico Merci (Entrata)
                </button>
                <button
                  onClick={() => setCaricoScaricoTab("scarico")}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    caricoScaricoTab === "scarico"
                      ? "bg-red-600 text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📤 Scarico Rapido (Uscita)
                </button>
                <button
                  onClick={() => {
                    setCaricoScaricoTab("scans");
                    fetchScannedDocuments();
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    caricoScaricoTab === "scans"
                      ? "bg-cyan-600 text-white shadow-md"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🔍 Storico Scans
                </button>
              </div>

              {/* Tab 3A: Carico Merci */}
              {caricoScaricoTab === "carico" && (
                <div className="space-y-6 bg-slate-50 p-6 rounded-3xl border border-slate-200/60">
                  <div className="text-center max-w-xl mx-auto space-y-4">
                    <div className="inline-flex p-4 bg-emerald-100 rounded-3xl text-emerald-700">
                      <Camera size={44} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Acquisizione Documenti di Consegna</h3>
                      <p className="text-slate-500 text-xs mt-1">
                        Scatta o carica un DDT/Fattura per estrarre lotti e scadenze automaticamente tramite Intelligenza Artificiale.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4 font-bold uppercase tracking-wider text-center">
                    <button
                      onClick={onCameraClick}
                      className="p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      <Camera size={28} />
                      <span className="text-[11px]">Inquadra DDT</span>
                    </button>
                    
                    <button
                      onClick={onGalleryClick}
                      className="p-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      <FileText size={28} />
                      <span className="text-[11px]">Sfoglia Galleria</span>
                    </button>

                    <button
                      onClick={onManualClick}
                      className="p-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      <Plus size={28} />
                      <span className="text-[11px]">Inserisci Manuale</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3B: Scarico Merci */}
              {caricoScaricoTab === "scarico" && (
                <form onSubmit={handleConfirmDischarge} className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-200/60 max-w-xl mx-auto">
                  <h3 className="text-base font-black text-slate-800 border-b border-slate-200 pb-2">Scarico Manuale Scorte dal Magazzino</h3>
                  
                  {scaricoSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                      {scaricoSuccess}
                    </div>
                  )}

                  {scaricoError && (
                    <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                      {scaricoError}
                    </div>
                  )}

                  {/* Step 1: Ingredient */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Materia Prima / Prodotto *</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-red-500"
                      value={scaricoIngredienteId}
                      onChange={(e) => {
                        setScaricoIngredienteId(e.target.value);
                        setScaricoLotId(""); // Reset lot choice
                      }}
                      required
                    >
                      <option value="">-- Seleziona Prodotto --</option>
                      {ingredients.map(i => (
                        <option key={i.ingrediente_id} value={i.ingrediente_id}>{i.nome_generico} ({i.scorta_totale} {i.unita_misura} disp.)</option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Lot related */}
                  {scaricoIngredienteId && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Lotto d'Acquisto Specifico *</label>
                      <select
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-red-500"
                        value={scaricoLotId}
                        onChange={(e) => setScaricoLotId(e.target.value)}
                        required
                      >
                        <option value="">-- Seleziona Lotto --</option>
                        {lots
                          .filter(l => l.ingrediente_id === scaricoIngredienteId && l.quantita_rimanente > 0)
                          .map(l => (
                            <option key={l.id} value={l.id}>
                              Lotto: {l.numero_lotto} (Disponibili: {l.quantita_rimanente} - Scade il: {formatDate(l.data_scadenza)})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  {/* Step 3: Qty to discharge */}
                  {scaricoLotId && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Quantità da scaricare *</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setScaricoQty(q => Math.max(1, q - 1))}
                          className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center font-black active:scale-95 transition-all text-lg cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="w-20 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-center font-bold focus:outline-hidden focus:ring-1 focus:ring-red-500"
                          value={scaricoQty}
                          onChange={(e) => setScaricoQty(Math.max(1, parseFloat(e.target.value) || 1))}
                          required
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => setScaricoQty(q => q + 1)}
                          className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center font-black active:scale-95 transition-all text-lg cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={!scaricoLotId}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                    >
                      Conferma Registrazione Scarico 📤
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 3C: Cronologia Scansioni */}
              {caricoScaricoTab === "scans" && (
                <div className="space-y-6">
                  {/* Filters block */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Ricerca Testuale</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                          placeholder="Cerca N° doc. o fornitore..."
                          value={scanSearchQuery}
                          onChange={(e) => setScanSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Tipo Documento</label>
                      <select
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                        value={scanTypeFilter}
                        onChange={(e) => setScanTypeFilter(e.target.value)}
                      >
                        <option value="all">Tutti i tipi</option>
                        <option value="ddt">DDT (Documenti di trasporto)</option>
                        <option value="fattura">Fatture d'acquisto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Filtro Data</label>
                      <input
                        type="date"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                        value={scanDateFilter}
                        onChange={(e) => setScanDateFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Scanned Document List Table */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                    {loadingScans ? (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2.5">
                        <RefreshCw className="h-6 w-6 animate-spin text-cyan-600" />
                        <span className="text-xs font-bold uppercase tracking-wider">Caricamento storico scansioni...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-black text-[10px] tracking-wider">
                              <th className="p-4">Stato / Tipo</th>
                              <th className="p-4">Numero Documento</th>
                              <th className="p-4">Fornitore</th>
                              <th className="p-4">Data Documento</th>
                              <th className="p-4">Registrazione</th>
                              <th className="p-4 text-right">Azioni</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {scannedDocuments.filter((doc) => {
                              const matchesType = scanTypeFilter === "all" || doc.tipo === scanTypeFilter;
                              const matchesDate = !scanDateFilter || doc.data_documento === scanDateFilter || (doc.data_caricamento && doc.data_caricamento.startsWith(scanDateFilter));
                              const matchesSearch = !scanSearchQuery || 
                                doc.numero_documento?.toLowerCase().includes(scanSearchQuery.toLowerCase()) ||
                                doc.fornitore?.ragione_sociale?.toLowerCase().includes(scanSearchQuery.toLowerCase()) ||
                                doc.ragione_sociale_fornitore?.toLowerCase().includes(scanSearchQuery.toLowerCase());
                              return matchesType && matchesDate && matchesSearch;
                            }).length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                  Nessun documento di trasporto o fattura scansionata corrisponde ai filtri impostati.
                                </td>
                              </tr>
                            ) : (
                              scannedDocuments
                                .filter((doc) => {
                                  const matchesType = scanTypeFilter === "all" || doc.tipo === scanTypeFilter;
                                  const matchesDate = !scanDateFilter || doc.data_documento === scanDateFilter || (doc.data_caricamento && doc.data_caricamento.startsWith(scanDateFilter));
                                  const matchesSearch = !scanSearchQuery || 
                                    doc.numero_documento?.toLowerCase().includes(scanSearchQuery.toLowerCase()) ||
                                    doc.fornitore?.ragione_sociale?.toLowerCase().includes(scanSearchQuery.toLowerCase()) ||
                                    doc.ragione_sociale_fornitore?.toLowerCase().includes(scanSearchQuery.toLowerCase());
                                  return matchesType && matchesDate && matchesSearch;
                                })
                                .sort((a, b) => {
                                  const dateA = a.data_caricamento || a.data_documento || "";
                                  const dateB = b.data_caricamento || b.data_documento || "";
                                  return dateB.localeCompare(dateA);
                                })
                                .map((doc) => (
                                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">
                                      <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-wide inline-flex items-center gap-1 ${
                                        doc.tipo === "fattura"
                                          ? "bg-blue-50 text-blue-700 border border-blue-200/50"
                                          : "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                                      }`}>
                                        <FileText size={10} />
                                        {doc.tipo || "DDT"}
                                      </span>
                                    </td>
                                    <td className="p-4 font-bold text-slate-800 font-mono">
                                      {doc.numero_documento}
                                    </td>
                                    <td className="p-4 text-slate-800 font-bold max-w-[200px] truncate">
                                      {doc.fornitore?.ragione_sociale || doc.ragione_sociale_fornitore}
                                    </td>
                                    <td className="p-4 text-slate-600 font-medium">
                                      {formatDate(doc.data_documento)}
                                    </td>
                                    <td className="p-4 text-slate-500 font-mono text-[11px]">
                                      {doc.data_caricamento || "N/D"}
                                    </td>
                                    <td className="p-4 text-right">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedDocDetails(doc)}
                                        className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                      >
                                        Ispetta <Eye size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. PRODUZIONE VIEW */}
          {metroSubView === "produzione" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-purple-600 uppercase tracking-tight flex items-center gap-2">
                  <Flame size={28} /> Gestione Produzione e Preparazioni
                </h2>
                <p className="text-slate-500 mt-1 text-xs">
                  Avvia e registra preparazioni interne del locale. Il sistema scaricherà automaticamente le giuste quantità dai lotti di materie prime più vecchi (principio FIFO).
                </p>
              </div>

              <form onSubmit={handleConfirmProduction} className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-200/60 max-w-xl mx-auto">
                <h3 className="text-base font-black text-slate-800 border-b border-slate-200 pb-2">Registra Lotto di Produzione Interna</h3>

                {productionSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                    {productionSuccess}
                  </div>
                )}

                {productionError && (
                  <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold">
                    {productionError}
                  </div>
                )}

                {/* Recipe selection */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Prodotto da Preparare (Ricetta) *</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    value={selectedRecipeId}
                    onChange={(e) => setSelectedRecipeId(e.target.value)}
                    required
                  >
                    <option value="">-- Seleziona Preparazione --</option>
                    {recipesList.map(r => (
                      <option key={r.id} value={r.id}>{r.nome_prodotto_finito}</option>
                    ))}
                  </select>
                </div>

                {/* Recipe components preview */}
                {selectedRecipeId && (
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 text-xs space-y-2">
                    <p className="font-bold text-slate-700">Ingredienti richiesti per singola lavorazione:</p>
                    <div className="divide-y divide-slate-100">
                      {recipesList.find(r => r.id === selectedRecipeId)?.ingredienti.map((item: any) => (
                        <div key={item.ingrediente_id} className="py-2 flex justify-between items-center text-[11px]">
                          <span className="font-medium text-slate-600">{item.nome_generico}</span>
                          <span className="font-mono font-bold text-slate-800">{item.quantita_richiesta} {item.unita_misura}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Production quantity */}
                {selectedRecipeId && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Moltiplicatore lavorazioni (Batch) *</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setProductionQty(q => Math.max(1, q - 1))}
                        className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center font-black active:scale-95 transition-all text-lg cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="w-20 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-center font-bold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                        value={productionQty}
                        onChange={(e) => setProductionQty(Math.max(1, parseInt(e.target.value) || 1))}
                        required
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={() => setProductionQty(q => q + 1)}
                        className="w-10 h-10 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center font-black active:scale-95 transition-all text-lg cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={!selectedRecipeId}
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    Lancia Lotto di Lavorazione 🍲
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. REGISTRO TEMPERATURE (HACCP) VIEW */}
          {metroSubView === "temperature" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-amber-600 uppercase tracking-tight flex items-center gap-2">
                  <Thermometer size={28} /> Monitoraggio Temperature Frigoriferi
                </h2>
                <p className="text-slate-500 mt-1 text-xs">
                  Progettato per l'inserimento immediato sul tablet a muro. Tocca i gradi preimpostati e registra la lettura senza tastiera.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* Registra Form */}
                <form onSubmit={handleAddTemperatureLog} className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-200/60">
                  <h3 className="text-base font-black text-slate-800 border-b border-slate-200 pb-2">Nuova Misurazione Odierna</h3>

                  {tempLogSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                      Lettura registrata con successo nel sistema di autocontrollo! ✅
                    </div>
                  )}

                  {/* Operatore */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Operatore (Firma)</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      value={tempOperator}
                      onChange={(e) => setTempOperator(e.target.value)}
                      required
                    />
                  </div>

                  {/* Cella frigo scelta */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Banco / Frigorifero / Cella *</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        "Frigorifero 1 (Carni/Freschi)",
                        "Frigorifero 2 (Verdure/Bevande)",
                        "Frigorifero 3 (Latticini)",
                        "Cella Surgelati (-20°C)",
                        "Vetrina Pasticceria"
                      ].map((fridge) => (
                        <button
                          key={fridge}
                          type="button"
                          onClick={() => {
                            setSelectedTempFridge(fridge);
                            // Auto adjust temperature value preset
                            if (fridge.includes("Surgelati")) {
                              setSelectedTempValue("-18°C");
                            } else if (fridge.includes("Pasticceria")) {
                              setSelectedTempValue("+5°C");
                            } else {
                              setSelectedTempValue("+4°C");
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                            selectedTempFridge === fridge
                              ? "bg-amber-600 border-amber-700 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span>{fridge}</span>
                          <span className="text-[10px] font-black uppercase bg-slate-900/10 px-2 py-0.5 rounded-sm">
                            {fridge.includes("Surgelati") ? "Sotto-zero" : "Fresco"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gradi termometro touch rapido */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">Valore Rilevato Termometro *</label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {(selectedTempFridge.includes("Surgelati")
                        ? ["-24°C", "-22°C", "-20°C", "-18°C", "-15°C", "-12°C"]
                        : ["+1°C", "+2°C", "+3°C", "+4°C", "+5°C", "+6°C", "+8°C", "+10°C"]
                      ).map((temp) => (
                        <button
                          key={temp}
                          type="button"
                          onClick={() => setSelectedTempValue(temp)}
                          className={`py-3.5 px-1 rounded-xl text-xs font-black text-center transition-all ${
                            selectedTempValue === temp
                              ? "bg-amber-600 text-white shadow-md font-extrabold"
                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {temp}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                    >
                      Registra Temperatura HACCP 🌡️
                    </button>
                  </div>
                </form>

                {/* Storico Letture */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Ultime misurazioni registrate</h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 divide-y divide-slate-200/60 max-h-[480px] overflow-y-auto">
                    {temperatureLogs.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-12">Nessun log per oggi.</p>
                    ) : (
                      temperatureLogs.map((log) => (
                        <div key={log.id} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{log.frigo}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {log.data} • Operatore: {log.operatore}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-black px-3 py-1 rounded-xl ${
                              log.conforme
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {log.temperatura}
                            </span>
                            <span className="text-xs" title={log.conforme ? "Conforme" : "Soglia Allerta HACCP superata!"}>
                              {log.conforme ? "✅" : "⚠️"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 6. REGISTRO PULIZIE (HACCP) VIEW */}
          {metroSubView === "pulizie" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-rose-600 uppercase tracking-tight flex items-center gap-2">
                    <Sparkles size={28} /> Registro Pulizie, Saponi & Report Ispezione
                  </h2>
                  <p className="text-slate-500 mt-1 text-xs">
                    Gestione del piano di sanificazione periodico. Spunta i macchinari puliti, fotografa i saponi e genera i report HACCP per gli ispettori sanitari.
                  </p>
                </div>
                
                <button
                  onClick={() => setShowPulizieReportModal(true)}
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <Printer size={16} /> Genera Report Ispezione
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* Left Side: Calendario Pulizie con Spunte Verdi */}
                <div className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-200/60">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <h3 className="text-base font-black text-slate-800">Piano di Sanificazione</h3>
                    
                    {/* Frequency selector buttons */}
                    <div className="flex gap-1 bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                      {["giornaliera", "settimanale", "mensile"].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setPulizieTab(tab as any)}
                          className={`px-2 py-1 rounded transition-all uppercase ${
                            pulizieTab === tab
                              ? "bg-white text-slate-900 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {tab.slice(0, 4)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive green checklists */}
                  <div className="space-y-2">
                    {cleaningTasks[pulizieTab].map((task) => {
                      const done = completedPulizie[task.id];
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleToggleTask(task.id)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-4 cursor-pointer ${
                            done
                              ? "bg-emerald-500 border-emerald-600 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xs font-bold leading-relaxed">{task.text}</span>
                          <span className={`p-1.5 rounded-lg shrink-0 ${done ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>
                            {done ? <Check size={16} strokeWidth={3} /> : <div className="w-4 h-4"></div>}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-2xl text-[11px] text-emerald-800 font-bold border border-emerald-100 flex items-center gap-2">
                    <Info size={14} />
                    <span>Le spunte verdi rimangono salvate per il turno lavorativo odierno e sono consultabili nel report ufficiale.</span>
                  </div>
                </div>

                {/* Right Side: Anagrafica Saponi con caricamento foto */}
                <div className="space-y-5 bg-slate-50 p-6 rounded-3xl border border-slate-200/60">
                  <h3 className="text-base font-black text-slate-800 border-b border-slate-200 pb-2">Anagrafica Saponi & Detergenti Autorizzati</h3>

                  {/* Add soap Form */}
                  <form onSubmit={handleAddSoap} className="bg-white p-4 rounded-2xl border border-slate-200/60 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aggiungi nuovo detergente con foto</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden"
                        placeholder="Nome sapone (es. Clor-Clean)"
                        value={newSoapName}
                        onChange={(e) => setNewSoapName(e.target.value)}
                        required
                      />
                      <select
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden"
                        value={newSoapActive}
                        onChange={(e) => setNewSoapActive(e.target.value)}
                      >
                        <option value="Sgrassante Clorato">Sgrassante Clorato</option>
                        <option value="Ipoclorito di Sodio">Ipoclorito (Cloro)</option>
                        <option value="Sali Quaternari">Ammonio Quaternario</option>
                        <option value="Alcol Sgrassante">Alcol Sgrassante</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1.5">
                      {/* Photo trigger */}
                      <div className="flex items-center gap-2">
                        <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold cursor-pointer text-slate-600 transition-colors flex items-center gap-1">
                          <Camera size={14} /> {newSoapPhoto ? "Foto Caricata!" : "Scegli Foto"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSoapPhotoUpload}
                          />
                        </label>
                        {newSoapPhoto && (
                          <img src={newSoapPhoto} className="w-8 h-8 rounded-md object-cover border border-slate-200" alt="Anteprima sapone" />
                        )}
                      </div>

                      <button
                        type="submit"
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs"
                      >
                        Aggiungi Sapone
                      </button>
                    </div>
                  </form>

                  {/* Soap registry display */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2">
                    {saponiList.map((soap) => (
                      <div
                        key={soap.id}
                        className="p-3 bg-white rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          {soap.foto ? (
                            <img src={soap.foto} className="w-10 h-10 rounded-xl object-cover border border-slate-100" alt={soap.nome} />
                          ) : (
                            <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                              <Sparkles size={16} />
                            </div>
                          )}
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-xs">{soap.nome}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">P.A.: {soap.principio}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSoap(soap.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Elimina sapone"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* ==========================================
          MODALS & OVERLAYS (ORDER PREVIEW & PRINT)
          ========================================== */}
      
      {/* 1. Module 1: Order WhatsApp/Email Share Modal */}
      {showOrderSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <ShoppingCart className="text-blue-600" /> Anteprima Ordine Digitale
              </h3>
              <button
                onClick={() => setShowOrderSummaryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-5">
              <p className="text-xs text-slate-500 mb-3 font-semibold">
                Questo è il testo generato che verrà inviato direttamente al tuo fornitore tramite l'app selezionata:
              </p>
              <pre className="p-4 bg-slate-950 text-emerald-400 text-xs font-mono rounded-2xl whitespace-pre-wrap overflow-y-auto max-h-[250px] border border-slate-800">
                {generatedOrderText}
              </pre>
            </div>

            {/* Quick Share buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-bold uppercase tracking-wider text-center">
              <button
                onClick={handleShareWhatsApp}
                className="py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <Smartphone size={16} /> Condividi su WhatsApp
              </button>
              <button
                onClick={handleShareEmail}
                className="py-3.5 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <Mail size={16} /> Invia via Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Module 6: Pulizie & HACCP Inspection Report Modal */}
      {showPulizieReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl p-6 relative my-8 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Printer className="text-rose-600" /> Registro Sanificazione Ufficiale HACCP
              </h3>
              <button
                onClick={() => setShowPulizieReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formal inspection report preview */}
            <div className="my-5 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-6 text-slate-800 text-xs" id="inspection-report-printable">
              
              {/* Header block */}
              <div className="border-b border-slate-300 pb-4 flex justify-between items-start">
                <div>
                  <h4 className="font-extrabold text-sm uppercase text-slate-900">REGISTRO REGOLAMENTO (CE) 852/2004</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Piano di Autocontrollo Igienico Sanitario (HACCP)</p>
                  <p className="text-[10px] text-slate-600 mt-1">Sede d'esercizio: <strong>Stabilimento {localStorage.getItem("businessName") || "Lab_Rossi"}</strong></p>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono">
                  <p>Documento: REG-PUL-01</p>
                  <p>Stampa: {new Date().toLocaleDateString("it-IT")}</p>
                </div>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Data di verifica</p>
                  <p className="text-xs font-black text-slate-800 mt-0.5">{new Date().toLocaleDateString("it-IT")}</p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Stato conformità</p>
                  <p className="text-xs font-black text-emerald-800 mt-0.5">CONFORME ✅</p>
                </div>
              </div>

              {/* Checklist states */}
              <div className="space-y-2">
                <h5 className="font-black text-slate-900 border-b border-slate-200 pb-1.5 uppercase text-[10px] tracking-wide">Stato delle operazioni di pulizia</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {[...cleaningTasks.giornaliera, ...cleaningTasks.settimanale].map((task) => (
                    <div key={task.id} className="flex items-center justify-between py-1 border-b border-slate-100 text-[10px]">
                      <span className="text-slate-600 font-medium truncate max-w-[220px]">{task.text}</span>
                      <span className={`font-bold font-mono px-2 py-0.5 rounded ${
                        completedPulizie[task.id]
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {completedPulizie[task.id] ? "ESEGUITO" : "NON ESEGUITO"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Temperature logs summary */}
              <div className="space-y-2">
                <h5 className="font-black text-slate-900 border-b border-slate-200 pb-1.5 uppercase text-[10px] tracking-wide">Rilevamento Temperature Giornaliere</h5>
                <div className="space-y-1">
                  {temperatureLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex justify-between items-center text-[10px] py-1">
                      <span className="text-slate-600 font-medium">{log.frigo}</span>
                      <span className="font-mono font-bold text-slate-800">{log.temperatura} ({log.conforme ? "CONFORME" : "ALLERTA"})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disinfectants registry */}
              <div className="space-y-2">
                <h5 className="font-black text-slate-900 border-b border-slate-200 pb-1.5 uppercase text-[10px] tracking-wide">Detergenti & Disinfettanti Attivi in Sede</h5>
                <div className="flex flex-wrap gap-2">
                  {saponiList.map((soap) => (
                    <span key={soap.id} className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md font-bold text-[9px] uppercase">
                      🧼 {soap.nome} ({soap.principio})
                    </span>
                  ))}
                </div>
              </div>

              {/* Signature area */}
              <div className="pt-6 border-t border-slate-300 flex justify-between text-[10px]">
                <div>
                  <p>Firma del Responsabile (O.S.A.)</p>
                  <p className="mt-8 font-bold">____________________________</p>
                </div>
                <div className="text-right">
                  <p>Timbro d'esercizio</p>
                  <p className="mt-8 font-bold">____________________________</p>
                </div>
              </div>

            </div>

            {/* Quick print trigger */}
            <div className="flex justify-end gap-3 font-bold uppercase tracking-wider text-center">
              <button
                onClick={() => {
                  window.print();
                }}
                className="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-1.5 shadow-md text-xs cursor-pointer"
              >
                <Printer size={15} /> Avvia Stampa / Salva PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Tour Modal */}
      {isTourActive && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-6 md:right-6 md:max-w-md w-auto md:w-full z-50 bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 p-6 animate-in slide-in-from-bottom-8 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-blue-400 h-5 w-5 animate-spin" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Tour Guidato ({tourStep + 1} di {tourSteps.length})
              </span>
            </div>
            <button
              onClick={() => setIsTourActive(false)}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <h4 className="text-base font-black text-white leading-snug">
            {tourSteps[tourStep].title}
          </h4>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            {tourSteps[tourStep].description}
          </p>

          <div className="bg-slate-950 p-2.5 rounded-xl mt-4 border border-slate-800/80 flex items-center gap-2 text-[10px] text-slate-400">
            <Info size={12} className="text-blue-400 shrink-0" />
            <span>
              Elemento evidenziato sullo schermo: <strong>{tourSteps[tourStep].targetText}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                if (tourStep > 0) {
                  setTourStep(prev => prev - 1);
                } else {
                  setIsTourActive(false);
                }
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={14} />
              {tourStep === 0 ? "Esci" : "Precedente"}
            </button>

            <div className="flex gap-1">
              {tourSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === tourStep ? "bg-blue-500 w-3" : "bg-slate-700"
                  }`}
                ></div>
              ))}
            </div>

            <button
              onClick={() => {
                if (tourStep < tourSteps.length - 1) {
                  setTourStep(prev => prev + 1);
                } else {
                  setIsTourActive(false);
                }
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-1 cursor-pointer"
            >
              <span>{tourStep === tourSteps.length - 1 ? "Completa" : "Avanti"}</span>
              {tourStep < tourSteps.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* FLOATING NOTIFICATIONS TOAST STACK */}
      <div className="fixed top-20 right-4 z-50 space-y-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg flex items-start gap-3 bg-white/95 backdrop-blur-md animate-in slide-in-from-right duration-300 relative ${
              toast.tipo === "error"
                ? "border-red-200 bg-red-50/95 text-red-900"
                : "border-amber-200 bg-amber-50/95 text-amber-900"
            }`}
          >
            <div className={`p-1.5 rounded-lg shrink-0 ${toast.tipo === "error" ? "bg-red-500 text-white animate-bounce" : "bg-amber-500 text-white animate-pulse"}`}>
              <AlertTriangle size={16} />
            </div>
            <div className="flex-1 pr-6">
              <h4 className="text-[10px] font-black uppercase tracking-wider">
                {toast.tipo === "error" ? "LOTTO SCADUTO! 🚨" : "LOTTO IN SCADENZA! ⚠️"}
              </h4>
              <p className="text-xs font-bold mt-1 text-slate-800">
                {toast.prodotto}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                Lotto: <strong>{toast.lotto}</strong> • Scadenza: <strong>{toast.dataScadenza}</strong>
              </p>
              {toast.tipo !== "error" && (
                <p className="text-[10px] text-amber-700 font-extrabold mt-1">
                  Mancano solo {toast.giorniRimasti} giorni alla scadenza!
                </p>
              )}
            </div>
            <button
              onClick={() => setToasts(toasts.filter(t => t.id !== toast.id))}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* DETTAGLI DOCUMENTO SCANSIONATO MODAL */}
      {selectedDocDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {selectedDocDetails.tipo?.toUpperCase() || "DOCUMENTO"} N° {selectedDocDetails.numero_documento}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fornitore: <strong>{selectedDocDetails.fornitore?.ragione_sociale || selectedDocDetails.ragione_sociale_fornitore}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDocDetails(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content (Two columns grid on desktop, scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left pane: Details and items */}
              <div className="space-y-5">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Metadati Documento</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Tipo Documento</span>
                      <span className="font-bold text-slate-800 uppercase block">{selectedDocDetails.tipo || "Non specificato"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Data Documento</span>
                      <span className="font-bold text-slate-800 block">{formatDate(selectedDocDetails.data_documento)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Data Caricamento</span>
                      <span className="font-bold text-slate-800 block">{selectedDocDetails.data_caricamento || "N/D"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">P. IVA Fornitore</span>
                      <span className="font-bold text-slate-800 font-mono block">{selectedDocDetails.fornitore?.p_iva || selectedDocDetails.p_iva || "N/D"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Righe e Lotti Associati</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {lots.filter(lot => lot.documento_id === selectedDocDetails.id).length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">
                        Nessun lotto associato a questo documento.
                      </p>
                    ) : (
                      lots.filter(lot => lot.documento_id === selectedDocDetails.id).map((lot, idx) => (
                        <div key={lot.id || idx} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center gap-3">
                          <div>
                            <p className="font-bold text-xs text-slate-800">{lot.ingrediente?.nome_generico || "Ingrediente"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                Lotto: {lot.numero_lotto}
                              </span>
                              {lot.data_scadenza && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  new Date(lot.data_scadenza) < new Date()
                                    ? "bg-red-50 text-red-600"
                                    : "bg-emerald-50 text-emerald-600"
                                }`}>
                                  Scad.: {formatDate(lot.data_scadenza)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-700 block">
                              {lot.quantita_caricata} {lot.ingrediente?.unita_misura}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Rim.: {lot.quantita_rimanente} {lot.ingrediente?.unita_misura}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right pane: Photo and Scan image */}
              <div className="flex flex-col h-full min-h-[320px] md:min-h-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5">Foto Originale Scansione</h4>
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative flex items-center justify-center p-2 group shadow-inner min-h-[300px]">
                  {selectedDocDetails.immagine_url ? (
                    <img
                      src={selectedDocDetails.immagine_url}
                      alt="Scansione Documento"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-3 text-slate-500">
                      <div className="p-4 bg-slate-900 rounded-full w-fit mx-auto text-slate-400 border border-slate-800/50">
                        <Camera size={28} className="animate-pulse" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-wider">Immagine Non Disponibile</p>
                      <p className="text-[10px] text-slate-600">Questo documento è stato inserito manualmente o la foto è stata rimossa.</p>
                    </div>
                  )}
                  {selectedDocDetails.immagine_url && (
                    <a
                      href={selectedDocDetails.immagine_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 p-2 bg-slate-900/85 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs opacity-0 group-hover:opacity-100 border border-slate-800"
                    >
                      Apri in Nuova Scheda <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setSelectedDocDetails(null)}
                className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                Chiudi Ispettore
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
