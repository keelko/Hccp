/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  Layers,
  Inbox,
  CookingPot,
  Sparkles,
  Cpu,
  RefreshCw,
  Clock,
  ArrowLeft,
  X,
  Plus,
  ArrowRight,
  User,
  Heart,
  AlertTriangle,
  FileText,
  Pencil
} from "lucide-react";
import DashboardHome from "./components/DashboardHome.js";
import OcrReview from "./components/OcrReview.js";
import TraceabilityExplorer from "./components/TraceabilityExplorer.js";
import RecipeManager from "./components/RecipeManager.js";
import ReportGenerator from "./components/ReportGenerator.js";
import { ScannedDocument } from "./types.js";

// Multi-step Italian status descriptors for loading state
const LOADING_STEPS = [
  "Lettura del documento in corso...",
  "Inizializzazione OCR...",
  "Identificazione della Partita IVA e intestazione...",
  "Analisi delle righe e quantità con l'AI...",
  "Controllo date di scadenza e numeri di lotto...",
  "Verifica del database e mappatura delle merci...",
  "Formattazione dei dati per la revisione..."
];

export default function App() {
  // Navigation: "dashboard" | "explorer" | "recipes" | "reports"
  const [currentView, setCurrentView] = useState<"dashboard" | "explorer" | "recipes" | "reports">("dashboard");
  const [businessName, setBusinessName] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("businessName") || "Lab_Rossi" : "Lab_Rossi";
  });
  const [businessAddress, setBusinessAddress] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("businessAddress") || "Via dei Laboratori 42, Milano (MI)" : "Via dei Laboratori 42, Milano (MI)";
  });
  const [showEditBusinessModal, setShowEditBusinessModal] = useState(false);
  const [tempBusinessName, setTempBusinessName] = useState("");
  const [tempBusinessAddress, setTempBusinessAddress] = useState("");
  const [explorerSearchQuery, setExplorerSearchQuery] = useState("");
  const [explorerTab, setExplorerTab] = useState<"lots" | "suppliers" | "ingredients">("lots");

  // Camera upload / scanning states
  const [scanning, setScanning] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [scannedDoc, setScannedDoc] = useState<ScannedDocument | null>(null);
  const [scannedImageUrl, setScannedImageUrl] = useState("");
  const [scannedProvider, setScannedProvider] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Controllo se l'applicazione sta girando in locale o nel cloud di AI Studio
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.includes("gitpod") || window.location.hostname.includes("github"));

  // AI Provider state: forced to "gemini" for cloud deployment
  const aiProvider = "gemini";

  // Hidden camera & gallery input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Animated loading step rotation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scanning) {
      setLoadingStepIndex(0);
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanning]);

  // Handle Photo capture / Upload trigger
  const triggerCameraInput = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const triggerGalleryInput = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  const handleManualDocumentEntry = () => {
    setScannedDoc({
      ragione_sociale_fornitore: "",
      p_iva: "",
      numero_documento: "",
      data_documento: new Date().toISOString().split("T")[0],
      elenco_righe: [
        {
          nome_prodotto: "",
          quantita: 1,
          unita_misura: "kg",
          prezzo_unitario: 0,
          numero_lotto: "",
          data_scadenza: ""
        }
      ]
    });
    setScannedImageUrl("manual_entry");
    setScannedProvider("manual");
  };

  // Metodo per ridimensionare e comprimere l'immagine direttamente nel browser.
  // Questo riduce drasticamente l'uso di banda, velocizza il caricamento a meno di 2 secondi
  // e minimizza il consumo di token per l'API di Gemini, rientrando perfettamente nel piano 100% GRATUITO.
  const compressImage = (base64Str: string, mimeType: string): Promise<{ compressedBase64: string, newMimeType: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ compressedBase64: base64Str, newMimeType: mimeType });
          return;
        }

        // Dimensioni massime ottimali per OCR ad alta leggibilità ma leggerissimo
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Esporta come JPEG compresso al 75% di qualità
        const outputMimeType = "image/jpeg";
        const compressedBase64 = canvas.toDataURL(outputMimeType, 0.75);
        resolve({ compressedBase64, newMimeType: outputMimeType });
      };
      img.onerror = () => {
        resolve({ compressedBase64: base64Str, newMimeType: mimeType });
      };
    });
  };

  // Convert uploaded image to base64 and invoke backend scan API
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Str = reader.result as string;
      const { compressedBase64, newMimeType } = await compressImage(base64Str, file.type);
      await processImageScan(compressedBase64, newMimeType);
    };
    reader.readAsDataURL(file);
  };

  // Process image with selected AI API (Gemini or Ollama)
  const processImageScan = async (base64Image: string, mimeType: string) => {
    try {
      setScanning(true);
      setScanError(null);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image, mimeType, provider: aiProvider })
      });

      if (!res.ok) {
        let errMsg = `Errore HTTP ${res.status} durante la scansione del documento.`;
        if (res.status === 404) {
          errMsg = "Endpoint /api/scan non trovato (404). Il backend server non risulta raggiungibile sul tuo hosting.";
        } else {
          try {
            const rawText = await res.text();
            if (rawText) {
              try {
                const errData = JSON.parse(rawText);
                if (errData && errData.error) {
                  errMsg = errData.error;
                } else {
                  errMsg = `${errMsg} (${rawText.slice(0, 200)})`;
                }
              } catch {
                errMsg = `${errMsg} — ${rawText.slice(0, 220)}`;
              }
            }
          } catch {}
        }
        throw new Error(errMsg);
      }

      const result = await res.json();
      if (result.warning) {
        console.warn(result.warning);
      }

      setScannedDoc(result.data);
      setScannedImageUrl(result.imageUrl);
      setScannedProvider(result.providerUsed || aiProvider);
    } catch (e: any) {
      setScanError(e.message || "Errore sconosciuto durante l'estrazione AI.");
    } finally {
      setScanning(false);
    }
  };

  // Trigger Precompiled Simulators instantly for zero-hardware tests
  const triggerDemoScan = async (demoId: number) => {
    try {
      setScanning(true);
      setScannedDoc(null);
      setScannedImageUrl("");

      // Simulate network lag for natural feel
      await new Promise((resolve) => setTimeout(resolve, 3000));

      let mockDoc: ScannedDocument;
      let mockUrl = "";

      if (demoId === 1) {
        mockDoc = {
          ragione_sociale_fornitore: "Euro Carni Emiliane S.r.l.",
          p_iva: "09123450998",
          numero_documento: "DDT-2026/812",
          data_documento: "2026-06-30",
          elenco_righe: [
            {
              nome_prodotto: "Carne Macinata Bovino",
              quantita: 45,
              unita_misura: "kg",
              prezzo_unitario: 7.80,
              numero_lotto: "LT-BOV-4422",
              data_scadenza: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // Expiring in 5 days
            },
            {
              nome_prodotto: "Farina Tipo 00", // Will merge with existing farina
              quantita: 25,
              unita_misura: "kg",
              prezzo_unitario: 1.10,
              numero_lotto: "LT-FAR-201A",
              data_scadenza: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
            }
          ]
        };
        mockUrl = "/uploads/demo_ddt_meat.png";
      } else if (demoId === 2) {
        mockDoc = {
          ragione_sociale_fornitore: "Latteria delle Alpi S.C.A.",
          p_iva: "03456789012",
          numero_documento: "FAT-2026-992",
          data_documento: "2026-06-29",
          elenco_righe: [
            {
              nome_prodotto: "Formaggio Cheddar a Fette",
              quantita: 25,
              unita_misura: "kg",
              prezzo_unitario: 8.90,
              numero_lotto: "LT-CHD-1122",
              data_scadenza: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
            },
            {
              nome_prodotto: "Burro di Centrifuga",
              quantita: 15,
              unita_misura: "kg",
              prezzo_unitario: 6.20,
              numero_lotto: "LT-BUT-410",
              data_scadenza: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // already expired (RED alert)
            }
          ]
        };
        mockUrl = "/uploads/demo_fatt_cheese.png";
      } else {
        mockDoc = {
          ragione_sociale_fornitore: "Mulini Reali S.p.A.",
          p_iva: "01122334455",
          numero_documento: "DDT-MUL-105",
          data_documento: "2026-06-27",
          elenco_righe: [
            {
              nome_prodotto: "Farina Tipo 00",
              quantita: 200,
              unita_misura: "kg",
              prezzo_unitario: 1.20,
              numero_lotto: "LT-FAR-202X",
              data_scadenza: new Date(Date.now() + 360 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // green
            },
            {
              nome_prodotto: "Salsa Burger Speciale",
              quantita: 5,
              unita_misura: "l",
              prezzo_unitario: 4.80,
              numero_lotto: null, // test missing lot
              data_scadenza: null // test missing expiry
            }
          ]
        };
        mockUrl = "/uploads/demo_ddt_flour.png";
      }

      setScannedDoc(mockDoc);
      setScannedImageUrl(mockUrl);
      setScannedProvider("demo");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setScanning(false);
    }
  };

  // Form Approval & Save
  const handleApproveDocument = async (finalDoc: ScannedDocument) => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/documents/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...finalDoc,
          tipo: finalDoc.tipo || ((finalDoc.numero_documento || "").toLowerCase().includes("fat") ? "fattura" : "ddt"),
          immagine_url: scannedImageUrl,
          righe: finalDoc.elenco_righe
        })
      });

      if (!res.ok) {
        throw new Error("Impossibile salvare il documento nel magazzino.");
      }

      alert("DDT/Fattura salvata! Lotti e scorte aggiornati con successo.");
      
      // Cleanup OCR mode and redirect
      setScannedDoc(null);
      setScannedImageUrl("");
      setExplorerTab("lots");
      setCurrentView("explorer");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardScan = () => {
    if (confirm("Vuoi davvero scartare questa scansione? I dati andranno persi.")) {
      setScannedDoc(null);
      setScannedImageUrl("");
    }
  };

  // Navigations with queries
  const handleQuickSearchNavigate = (query?: string, tabType?: "lots" | "suppliers" | "ingredients") => {
    if (query) {
      setExplorerSearchQuery(query);
    } else {
      setExplorerSearchQuery("");
    }
    if (tabType) {
      setExplorerTab(tabType);
    }
    setCurrentView("explorer");
  };

 return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-800" id="main-root">
      {/* Hidden Mobile Camera Trigger (forces native camera capture on mobile) */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
        id="camera-hidden-input"
      />

      {/* Hidden Gallery Trigger (standard browser file/gallery selection) */}
      <input
        type="file"
        ref={galleryInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        id="gallery-hidden-input"
      />

      {/* HEADER BAR (Visible unless reviewing split screen) */}
      {!scannedDoc && (
        <header className="bg-white text-slate-800 shrink-0 border-b border-slate-200 sticky top-0 z-20 shadow-xs" id="header-bar">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer min-w-0" onClick={() => setCurrentView("dashboard")}>
              <div className="p-2 bg-slate-950 rounded-xl text-white shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold tracking-tight text-xs sm:text-sm uppercase text-slate-900 block truncate">HACCP Smart-Track</span>
                <span className="hidden sm:block text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Laboratorio Alimenti</span>
              </div>
            </div>

            {/* Navigations links */}
            <nav className="hidden lg:flex items-center gap-1 text-xs font-bold uppercase">
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`px-4 py-2.5 rounded-lg transition-colors ${
                  currentView === "dashboard" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:text-slate-900"
                }`}
                id="nav-btn-dashboard"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  setExplorerSearchQuery("");
                  setCurrentView("explorer");
                }}
                className={`px-4 py-2.5 rounded-lg transition-colors ${
                  currentView === "explorer" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:text-slate-900"
                }`}
                id="nav-btn-explorer"
              >
                Anagrafica & Lotti
              </button>
              <button
                onClick={() => setCurrentView("recipes")}
                className={`px-4 py-2.5 rounded-lg transition-colors ${
                  currentView === "recipes" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:text-slate-900"
                }`}
                id="nav-btn-recipes"
              >
                Ricette & Produzione
              </button>
              <button
                onClick={() => setCurrentView("reports")}
                className={`px-4 py-2.5 rounded-lg transition-colors ${
                  currentView === "reports" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:text-slate-900"
                }`}
                id="nav-btn-reports"
              >
                Registri & Report
              </button>
            </nav>

            {/* Operator card */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="flex gap-0.5 shrink-0 font-bold uppercase tracking-wider">
                <button
                  onClick={triggerCameraInput}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-l-xl border-r border-blue-500/30 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                  title="Scatta Foto con la Fotocamera"
                  id="btn-quick-cam"
                >
                  <Camera size={14} /> <span className="hidden xl:inline">Fotocamera</span>
                </button>
                <button
                  onClick={triggerGalleryInput}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white border-r border-blue-500/30 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                  title="Carica da Galleria"
                  id="btn-quick-gallery"
                >
                  <FileText size={14} /> <span className="hidden xl:inline">Galleria</span>
                </button>
                <button
                  onClick={handleManualDocumentEntry}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-r-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                  title="Inserisci DDT/Fattura Manualmente"
                  id="btn-quick-manual"
                >
                  <Plus size={14} /> <span className="hidden xl:inline">Inserisci Manuale</span>
                </button>
              </div>
              
              <button
                onClick={() => {
                  setTempBusinessName(businessName);
                  setTempBusinessAddress(businessAddress);
                  setShowEditBusinessModal(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer group shrink-0"
                title="Modifica nome attività"
              >
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></div>
                <User size={13} className="text-slate-500 group-hover:text-blue-600 transition-colors shrink-0" />
                <span className="font-bold truncate max-w-[45px] sm:max-w-[100px] lg:max-w-[120px]">{businessName}</span>
                <Pencil size={11} className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 hidden sm:inline" />
              </button>
            </div>
          </div>

          {/* MOBILE SUB-NAVIGATION RAIL */}
          <div className="lg:hidden flex border-t border-slate-200 divide-x divide-slate-200 text-[10px] font-bold uppercase tracking-wider text-center bg-white" id="mobile-nav">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`flex-1 py-3 text-slate-600 ${currentView === "dashboard" ? "bg-blue-50 text-blue-700" : ""}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setExplorerSearchQuery("");
                setCurrentView("explorer");
              }}
              className={`flex-1 py-3 text-slate-600 ${currentView === "explorer" ? "bg-blue-50 text-blue-700" : ""}`}
            >
              Anagrafica
            </button>
            <button
              onClick={() => setCurrentView("recipes")}
              className={`flex-1 py-3 text-slate-600 ${currentView === "recipes" ? "bg-blue-50 text-blue-700" : ""}`}
            >
              Produzione
            </button>
            <button
              onClick={() => setCurrentView("reports")}
              className={`flex-1 py-3 text-slate-600 ${currentView === "reports" ? "bg-blue-50 text-blue-700" : ""}`}
            >
              Report
            </button>
          </div>
        </header>
      )}

      {/* VIEWPORT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="viewport-main-content">
        <AnimatePresence mode="wait">
          {scanError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-start gap-3 relative shadow-xs"
              id="scan-error-banner"
            >
              <AlertTriangle className="h-5.5 w-5.5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 pr-6">
                <h4 className="text-sm font-bold text-red-900">Errore durante la scansione AI</h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  {scanError}
                </p>
                <div className="mt-2 text-[11px] text-red-600 font-semibold space-y-0.5">
                  <p>💡 Consigli per risolvere:</p>
                  <p>• Riprova tra pochi istanti: i server dell'AI Cloud potrebbero essere momentaneamente sovraccarichi.</p>
                  <p>• Abbiamo aggiunto un sistema di auto-retry che usa un modello alternativo ultra-stabile in caso di sovraccarico.</p>
                  <p>• Se riscontri errori frequenti, verifica che la chiave <strong>GEMINI_API_KEY</strong> sia corretta ed inserita nei <strong>Secrets</strong> di AI Studio o nel tuo ambiente di hosting.</p>
                </div>
              </div>
              <button
                onClick={() => setScanError(null)}
                className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors"
                title="Chiudi"
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
          
          {/* STATE A: SCANNING/OCR LOADING SCREEN */}
          {scanning && (
            <motion.div
              key="scanning-spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-white"
            >
              <div className="max-w-md text-center space-y-6">
                {/* Advanced Radar scan animations */}
                <div className="relative w-28 h-28 mx-auto" id="scanning-animation-frame">
                   <div className="absolute inset-0 rounded-full border-4 border-dashed border-blue-500/20 animate-spin duration-3000"></div>
                   <div className="absolute inset-2 rounded-full border-2 border-blue-500/40 animate-ping"></div>
                   <div className="absolute inset-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shadow-2xl">
                    <Camera className="h-10 w-10" />
                  </div>
                  {/* Glowing radar sweep */}
                   <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 shadow-[0_0_15px_#3b82f6] animate-bounce"></div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight flex items-center justify-center gap-2">
                    Analisi con AI Cloud <Sparkles size={16} className="text-blue-400 animate-pulse" />
                  </h3>
                  <p className="text-xs text-slate-400">
                    OCR avanzato + Estrazione dei metadati in corso...
                  </p>
                </div>

                {/* Loading descriptors */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/50 min-h-[56px] flex items-center justify-center">
                  <motion.p
                    key={loadingStepIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-xs text-blue-400 font-semibold font-mono"
                  >
                    {LOADING_STEPS[loadingStepIndex]}
                  </motion.p>
                </div>

                <div className="text-[10px] text-slate-500 italic max-w-xs mx-auto leading-relaxed">
                  * L'intelligenza artificiale mappa automaticamente i prodotti con le materie prime in archivio.
                </div>
              </div>
            </motion.div>
          )}

          {/* STATE B: SPLIT REVIEW AND APPROVAL FRAME */}
          {scannedDoc ? (
            <motion.div
              key="ocr-review-stage-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
              {/* Review stage headers */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDiscardScan}
                  className="p-2 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <ArrowLeft size={14} /> Annulla
                </button>
                <div className="text-xs text-slate-500">
                  Revisione DDT / Fattura • <strong>{scannedDoc.ragione_sociale_fornitore}</strong>
                </div>
              </div>

              <OcrReview
                scannedDoc={scannedDoc}
                imageUrl={scannedImageUrl}
                providerUsed={scannedProvider}
                onApprove={handleApproveDocument}
                onDiscard={handleDiscardScan}
                isSaving={isSaving}
              />
            </motion.div>
          ) : (
            // STATE C: NAVIGATION VIEWS
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {currentView === "dashboard" && (
                <DashboardHome
                  onCameraClick={triggerCameraInput}
                  onGalleryClick={triggerGalleryInput}
                  onManualClick={handleManualDocumentEntry}
                  onDemoSelect={triggerDemoScan}
                  onNavigateToExplorer={handleQuickSearchNavigate}
                  onNavigateToRecipes={() => setCurrentView("recipes")}
                  onNavigateToReports={() => setCurrentView("reports")}
                />
              )}

              {currentView === "explorer" && (
                <TraceabilityExplorer
                  initialSearch={explorerSearchQuery}
                  initialTab={explorerTab}
                />
              )}

              {currentView === "recipes" && (
                <RecipeManager />
              )}

              {currentView === "reports" && (
                <ReportGenerator onBackToDashboard={() => setCurrentView("dashboard")} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="bg-white text-slate-500 py-6 border-t border-slate-200 shrink-0 mt-12 text-xs" id="footer-credit">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-blue-600" />
            <span className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">HACCP Smart-Track © 2026</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <a 
              href="/privacy.html" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-500 hover:text-blue-600 underline font-semibold transition-colors"
            >
              Informativa sulla Privacy
            </a>
            <span>•</span>
            <span className="flex items-center gap-1">
              Fatto per l'eccellenza alimentare <Heart size={11} className="text-red-500 fill-red-500" />
            </span>
          </div>
        </div>
      </footer>

      {/* EDIT BUSINESS NAME MODAL */}
      {showEditBusinessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-black text-slate-800">Profilo Operatore (O.S.A.)</h3>
              <button
                onClick={() => setShowEditBusinessModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer animate-none"
              >
                <X size={18} />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const cleanName = tempBusinessName.trim() || "Lab_Rossi";
                const cleanAddress = tempBusinessAddress.trim() || "Via dei Laboratori 42, Milano (MI)";
                setBusinessName(cleanName);
                setBusinessAddress(cleanAddress);
                localStorage.setItem("businessName", cleanName);
                localStorage.setItem("businessAddress", cleanAddress);
                setShowEditBusinessModal(false);
                // Also trigger page refresh or broadcast
                window.dispatchEvent(new Event("storage"));
              }} 
              className="space-y-4 pt-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Ragione Sociale / Nome Laboratorio *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-bold"
                  value={tempBusinessName}
                  onChange={(e) => setTempBusinessName(e.target.value)}
                  placeholder="Es. Pasticceria Rossi S.r.l."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Indirizzo Sede / Stabilimento (Reg. UE 1169/2011) *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-bold"
                  value={tempBusinessAddress}
                  onChange={(e) => setTempBusinessAddress(e.target.value)}
                  placeholder="Es. Via Roma 10, 20121 Milano (MI)"
                />
                <p className="text-[10px] text-slate-400 mt-1">L'indicazione dell'indirizzo dell'operatore è obbligatoria per legge su tutte le etichette alimentari.</p>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditBusinessModal(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Salva e Applica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
