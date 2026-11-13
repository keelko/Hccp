/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { db } from "./src/server/db.js";
import { GoogleGenAI, Type } from "@google/genai";

// Standard Express app creation
const app = express();
const PORT = 3000;

// Increase request size limit to handle large images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup directory for uploaded/scanned documents (supports Vercel and serverless /tmp)
const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY;
const uploadDir = isServerless ? path.join(os.tmpdir(), "uploads") : path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn("Impossibile creare cartella uploads locale:", e);
}
app.use("/uploads", express.static(uploadDir));

// Lazy DB initialization for serverless environments (Vercel)
let isDbReady = false;
let dbInitPromise: Promise<void> | null = null;
app.use(async (req, res, next) => {
  if (!isDbReady) {
    try {
      if (!dbInitPromise) {
        dbInitPromise = db.initialize();
      }
      await dbInitPromise;
      isDbReady = true;
    } catch (e) {
      dbInitPromise = null;
      console.warn("Database initialization warning:", e);
    }
  }
  next();
});

// Android Digital Asset Links (Required by Google Play for TWA full-screen verification)
app.get("/.well-known/assetlinks.json", (req, res) => {
  const customAssetLinks = process.env.ASSET_LINKS_JSON;
  if (customAssetLinks) {
    res.setHeader("Content-Type", "application/json");
    return res.send(customAssetLinks);
  }
  const assetLinksPath = path.join(process.cwd(), "public", ".well-known", "assetlinks.json");
  if (fs.existsSync(assetLinksPath)) {
    res.setHeader("Content-Type", "application/json");
    return res.sendFile(assetLinksPath);
  }
  res.status(404).json({ error: "assetlinks.json non ancora configurato." });
});

// PWA Manifest endpoints with permissive CORS for PWABuilder & Google Play checkers
app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const manifestPath = path.join(process.cwd(), "public", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    return res.sendFile(manifestPath);
  }
  res.status(404).json({ error: "Manifest non trovato" });
});

// Service Worker endpoint with appropriate scope headers
app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Service-Worker-Allowed", "/");
  const swPath = path.join(process.cwd(), "public", "sw.js");
  if (fs.existsSync(swPath)) {
    return res.sendFile(swPath);
  }
  res.status(404).send("// Service worker non trovato");
});

// Privacy Policy endpoint for Google Play compliance
app.get(["/privacy", "/privacy.html"], (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const privacyPath = path.join(process.cwd(), "public", "privacy.html");
  if (fs.existsSync(privacyPath)) {
    return res.sendFile(privacyPath);
  }
  res.status(404).send("<h1>Privacy policy non trovata</h1>");
});

// --- API ENDPOINTS ---

// Health check endpoint for diagnostics (e.g. Vercel / Render)
app.get(["/api", "/api/health"], (req, res) => {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
  );
  res.json({
    ok: true,
    runtime: isServerless ? "serverless" : "node",
    hasGeminiKey,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    timestamp: new Date().toISOString(),
  });
});

// 1. Get all suppliers (Anagrafica Fornitori)
app.get("/api/suppliers", (req, res) => {
  try {
    const data = db.getFornitori();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get all ingredients with current total stock
app.get("/api/ingredients", (req, res) => {
  try {
    const data = db.getIngredientiWithStock();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get ingredients stock specifically for haccp stock reports
app.get("/api/stock", (req, res) => {
  try {
    const data = db.getIngredientiWithStock();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new raw material/ingredient
app.post("/api/ingredients", async (req, res) => {
  try {
    const { nome_generico, unita_misura, categoria, scorta_minima } = req.body;
    if (!nome_generico || !unita_misura) {
      return res.status(400).json({ error: "Nome generico e Unità di misura sono obbligatori." });
    }
    const newIng = db.addIngrediente({
      nome_generico,
      unita_misura,
      categoria: categoria || "In classificazione",
      scorta_minima: Number(scorta_minima || 0)
    });
    await db.flush();
    res.json(newIng);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get all registered documents (DDT & Fatture)
app.get("/api/documents", (req, res) => {
  try {
    const docs = db.getDocumenti();
    const suppliers = db.getFornitori();
    
    // Join supplier details to each document
    const joinedDocs = docs.map((doc) => {
      const supplier = suppliers.find((s) => s.id === doc.fornitore_id);
      return {
        ...doc,
        fornitore: supplier || null
      };
    });
    res.json(joinedDocs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get active batches (Lotti)
app.get("/api/lots", (req, res) => {
  try {
    const lots = db.getRigheDocumento();
    const ingredients = db.getIngredienti();
    const documents = db.getDocumenti();
    const suppliers = db.getFornitori();

    // Map and join for complete details
    const fullyJoinedLots = lots.map((lot) => {
      const ingredient = ingredients.find((i) => i.id === lot.ingrediente_id);
      const document = documents.find((d) => d.id === lot.documento_id);
      const supplier = document ? suppliers.find((s) => s.id === document.fornitore_id) : null;

      return {
        ...lot,
        ingrediente: ingredient || null,
        documento: document || null,
        fornitore: supplier || null
      };
    });

    res.json(fullyJoinedLots);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Save Approved Document
app.post("/api/documents/approve", async (req, res) => {
  try {
    const { ragione_sociale_fornitore, p_iva, numero_documento, data_documento, tipo, immagine_url, righe } = req.body;
    
    if (!ragione_sociale_fornitore || !righe || !Array.isArray(righe)) {
      return res.status(400).json({ error: "Fornitore e Righe sono obbligatori." });
    }

    const result = db.saveApprovedDocument({
      ragione_sociale_fornitore,
      p_iva,
      numero_documento,
      data_documento,
      tipo,
      immagine_url,
      righe
    });

    await db.flush();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Manual Discharge of a lot
app.post("/api/lots/:id/discharge", async (req, res) => {
  try {
    const lotId = req.params.id;
    const { quantita } = req.body;
    
    if (quantita === undefined || isNaN(Number(quantita)) || Number(quantita) <= 0) {
      return res.status(400).json({ error: "La quantità da scaricare deve essere valida e maggiore di zero." });
    }

    const updatedLot = db.dischargeLot(lotId, Number(quantita));
    await db.flush();
    res.json({ success: true, lot: updatedLot });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update an existing lot
app.put("/api/lots/:id", async (req, res) => {
  try {
    const lotId = req.params.id;
    const { numero_lotto, quantita_caricata, quantita_rimanente, prezzo_unitario, data_scadenza } = req.body;
    const updated = db.updateLot(lotId, {
      numero_lotto,
      quantita_caricata,
      quantita_rimanente,
      prezzo_unitario,
      data_scadenza
    });
    await db.flush();
    res.json({ success: true, lot: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an existing lot
app.delete("/api/lots/:id", async (req, res) => {
  try {
    const lotId = req.params.id;
    db.deleteLot(lotId);
    await db.flush();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a raw material / ingredient
app.put("/api/ingredients/:id", async (req, res) => {
  try {
    const ingId = req.params.id;
    const { nome_generico, unita_misura, categoria, scorta_minima } = req.body;
    const updated = db.updateIngrediente(ingId, {
      nome_generico,
      unita_misura,
      categoria,
      scorta_minima: scorta_minima !== undefined ? Number(scorta_minima) : undefined
    });
    await db.flush();
    res.json({ success: true, ingredient: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a raw material / ingredient
app.delete("/api/ingredients/:id", async (req, res) => {
  try {
    const ingId = req.params.id;
    db.deleteIngrediente(ingId);
    await db.flush();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a supplier
app.put("/api/suppliers/:id", async (req, res) => {
  try {
    const supplierId = req.params.id;
    const { ragione_sociale, p_iva, email, telefono, note } = req.body;
    const updated = db.updateFornitore(supplierId, {
      ragione_sociale,
      p_iva,
      email,
      telefono,
      note
    });
    await db.flush();
    res.json({ success: true, supplier: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a supplier
app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const supplierId = req.params.id;
    db.deleteFornitore(supplierId);
    await db.flush();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Recipes (Ricette)
app.get("/api/recipes", (req, res) => {
  try {
    const recipes = db.getRicette();
    const ingredients = db.getIngredienti();

    // Map ingredients in recipes to provide standard names in list
    const recipesWithNames = recipes.map((rec) => ({
      ...rec,
      ingredienti: rec.ingredienti.map((ri) => {
        const ing = ingredients.find((i) => i.id === ri.ingrediente_id);
        return {
          ...ri,
          nome_generico: ing ? ing.nome_generico : "Sconosciuto",
          unita_misura: ing ? ing.unita_misura : ""
        };
      })
    }));

    res.json(recipesWithNames);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/recipes", async (req, res) => {
  try {
    const { nome_prodotto_finito, ingredienti } = req.body;
    if (!nome_prodotto_finito || !ingredienti || !Array.isArray(ingredienti)) {
      return res.status(400).json({ error: "Nome prodotto finito e ingredienti richiesti." });
    }
    const newRecipe = db.addRicetta({
      nome_prodotto_finito,
      ingredienti: ingredienti.map((i: any) => ({
        ingrediente_id: i.ingrediente_id,
        quantita_richiesta: Number(i.quantita_richiesta)
      }))
    });
    await db.flush();
    res.json(newRecipe);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/recipes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_prodotto_finito, ingredienti } = req.body;
    if (!nome_prodotto_finito || !ingredienti || !Array.isArray(ingredienti)) {
      return res.status(400).json({ error: "Nome prodotto finito e ingredienti richiesti." });
    }
    const updated = db.updateRicetta(id, {
      nome_prodotto_finito,
      ingredienti: ingredienti.map((i: any) => ({
        ingrediente_id: i.ingrediente_id,
        quantita_richiesta: Number(i.quantita_richiesta)
      }))
    });
    await db.flush();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/recipes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    db.deleteRicetta(id);
    await db.flush();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Production discharges (Scarichi Produzione)
app.get("/api/discharges", (req, res) => {
  try {
    const discharges = db.getScarichiProduzione();
    const recipes = db.getRicette();
    const lots = db.getRigheDocumento();
    const ingredients = db.getIngredienti();

    const formattedDischarges = discharges.map((d) => {
      const recipe = recipes.find((r) => r.id === d.ricetta_id);
      
      const fullLottiUsati = d.lotti_usati.map((lu) => {
        const lot = lots.find((l) => l.id === lu.riga_documento_id);
        const ing = lot ? ingredients.find((i) => i.id === lot.ingrediente_id) : null;
        return {
          ...lu,
          numero_lotto: lot ? lot.numero_lotto : "Lotto Sconosciuto",
          nome_generico: ing ? ing.nome_generico : "Ingrediente Sconosciuto",
          unita_misura: ing ? ing.unita_misura : ""
        };
      });

      return {
        ...d,
        nome_prodotto_finito: recipe ? recipe.nome_prodotto_finito : "Ricetta Sconosciuta",
        lotti_usati_dettaglio: fullLottiUsati
      };
    });

    res.json(formattedDischarges);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record new production run
app.post("/api/production", async (req, res) => {
  try {
    const { ricetta_id, quantita_prodotta, lotti_selezionati } = req.body;
    if (!ricetta_id || !quantita_prodotta || !lotti_selezionati || !Array.isArray(lotti_selezionati)) {
      return res.status(400).json({ error: "Tutti i dati di produzione (ricetta, quantità prodotta, lotti usati) sono obbligatori." });
    }

    const result = db.recordProduction({
      ricetta_id,
      quantita_prodotta: Number(quantita_prodotta),
      lotti_selezionati: lotti_selezionati.map((ls: any) => ({
        lotId: ls.lotId,
        quantita_usata: Number(ls.quantita_usata)
      }))
    });

    await db.flush();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update an existing production discharge (only metadata like quantity and date)
app.put("/api/discharges/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { quantita_prodotta, data } = req.body;
    const updated = db.updateScarico(id, { quantita_prodotta, data });
    await db.flush();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a production discharge (and restore active ingredient lot stock)
app.delete("/api/discharges/:id", async (req, res) => {
  try {
    const { id } = req.params;
    db.deleteScarico(id);
    await db.flush();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- DYNAMIC AI OCR EXTRATOR USING GEMINI ---

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  let key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    throw new Error(
      "La chiave API Gemini non è configurata. Per favore inseriscila nel pannello 'Settings > Secrets' dell'interfaccia AI Studio con il nome GEMINI_API_KEY."
    );
  }
  
  // Sanitizza la chiave da spazi bianchi, apici singoli (') o doppi (")
  // che l'utente potrebbe aver incollato per errore (molto comune su Render)
  key = key.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1).trim();
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1).trim();
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Extract JSON using Gemini (with automatic demo mock fallback if API key is not configured)
app.post("/api/scan", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Nessuna immagine fornita per la scansione." });
    }

    // Save the image statically on persistent servers, or keep compressed Data URL on serverless (Vercel)
    const timestamp = Date.now();
    const filename = `${timestamp}_documento.png`;
    const cleanBase64 = image.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    
    let imageUrl = image.startsWith("data:") ? image : `data:${mimeType || "image/jpeg"};base64,${cleanBase64}`;
    if (!isServerless) {
      try {
        fs.writeFileSync(path.join(uploadDir, filename), cleanBase64, { encoding: "base64" });
        imageUrl = `/uploads/${filename}`;
      } catch (fsErr) {
        console.warn("Filesystem non scrivibile. Utilizzo immagine inline Data URL:", fsErr);
      }
    }

    let parsedData: any = null;
    let providerUsed = "gemini";

    try {
      const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";

      if (!hasGeminiKey) {
        throw new Error("Chiave API di Gemini non configurata. Inserisci la chiave GEMINI_API_KEY nei Secrets di AI Studio.");
      }
      
      console.log("Esecuzione scansione tramite Gemini...");
      const ai = getGeminiClient();

      // Formulate prompt with strict rule against literal 'null' and for smart lot extraction
      const prompt = `Sei un sistema esperto di OCR per documenti alimentari e tracciabilità HACCP.
Il tuo compito è estrarre con estrema precisione i dati per compilare le righe di un Documento di Trasporto (DDT) o Fattura.

REGOLA FONDAMENTALE PER I CAMPI MANCANTI E IL 'NUMERO LOTTO':
- NON restituire MAI la parola 'null', 'N/A', 'n/d', 'non trovato', 'none' o 'undefined' per il campo 'numero_lotto' o per la data di scadenza.
- Cerca con la massima attenzione il lotto: verifica tutta la riga, le colonne 'COD. ART.', note a margine, descrizioni tra parentesi o riferimenti.
- Se nella riga è presente un codice articolo (es. 'CAR-014', 'CAR-088', 'CAR-102', 'ORT-045', 'ORT-012', 'ORT-029') o codice identificativo, e non è specificato un lotto esplicito con la parola 'Lotto:', USA IL CODICE ARTICOLO (es. 'CAR-102') o abbinalo al numero del documento (es. 'CAR-102-4102') come numero di lotto tracciabile per garantire la conformità HACCP.
- Se non è presente alcun codice di lotto o articolo, genera una stringa identificativa tracciabile basata sul numero documento e progressivo riga (es. 'L-4102-01') oppure lascia una stringa vuota "". MA NON RESTITUIRE MAI LA PAROLA 'null'.

Campi da estrarre nel JSON:
- tipo: 'ddt' se Documento di Trasporto / bolla, oppure 'fattura'
- ragione_sociale_fornitore: Denominazione/ragione sociale completa del fornitore (es. 'IRPINIA CARNI E ORTOFRUTTA S.R.L.')
- p_iva: Partita IVA se visibile
- numero_documento: Numero identificativo del DDT/Fattura (es. '2026/4102')
- data_documento: Data del documento in formato YYYY-MM-DD (es. '2026-11-07')
- elenco_righe: Array di righe merci con:
  * nome_prodotto: Descrizione completa del prodotto/bene alimentare
  * quantita: Valore numerico della quantità (es. 12.2, 45, 15.5)
  * unita_misura: Unità (es. 'Kg', 'g', 'l', 'pz')
  * prezzo_unitario: Prezzo unitario in Euro se indicato (altrimenti 0)
  * numero_lotto: Numero di lotto / codice articolo rintracciabile (MAI 'null'!)
  * data_scadenza: Data di scadenza YYYY-MM-DD se indicata (altrimenti stringa vuota, MAI 'null')`;

      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/png",
          data: cleanBase64,
        },
      };

      // Configurazione dello schema di risposta JSON per garantire dati perfetti
      const configOptions = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tipo: {
              type: Type.STRING,
              description: "Il tipo di documento: 'ddt' se documento di trasporto/bolla, 'fattura' se fattura."
            },
            ragione_sociale_fornitore: { 
              type: Type.STRING, 
              description: "La ragione sociale o nome completo del fornitore che ha emesso il documento" 
            },
            p_iva: { 
              type: Type.STRING, 
              description: "Partita IVA del fornitore" 
            },
            numero_documento: { 
              type: Type.STRING, 
              description: "Il numero identificativo del DDT o della fattura" 
            },
            data_documento: { 
              type: Type.STRING, 
              description: "La data del documento in formato YYYY-MM-DD" 
            },
            elenco_righe: {
              type: Type.ARRAY,
              description: "L'elenco di tutte le righe di prodotti/merci caricate nel documento",
              items: {
                type: Type.OBJECT,
                properties: {
                  nome_prodotto: { 
                    type: Type.STRING, 
                    description: "Nome o descrizione dell'ingrediente/prodotto" 
                  },
                  quantita: { 
                    type: Type.NUMBER, 
                    description: "Quantità numerica caricata" 
                  },
                  unita_misura: { 
                    type: Type.STRING, 
                    description: "Unità di misura corretta, come kg, g, l, pz" 
                  },
                  prezzo_unitario: { 
                    type: Type.NUMBER, 
                    description: "Prezzo unitario del prodotto in Euro (0 se non presente)" 
                  },
                  numero_lotto: { 
                    type: Type.STRING, 
                    description: "Numero di lotto o codice rintracciabilità articolo (es. CAR-102, L-4102-01). REGOLA: Non restituire MAI la stringa 'null' o 'N/A'." 
                  },
                  data_scadenza: { 
                    type: Type.STRING, 
                    description: "Data di scadenza in formato YYYY-MM-DD se presente, altrimenti stringa vuota. Non restituire la stringa 'null'." 
                  },
                },
                required: ["nome_prodotto", "quantita", "unita_misura"],
              },
            },
          },
          required: ["tipo", "ragione_sociale_fornitore", "numero_documento", "data_documento", "elenco_righe"],
        },
      };

      let response;
      try {
        console.log("Tentativo scansione con gemini-3.8-flash...");
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [prompt, imagePart],
          config: configOptions,
        });
      } catch (firstError: any) {
        console.warn("gemini-3.8-flash in errore. Provo con gemini-3.1-flash-lite come fallback...", firstError.message);
        // Attendi 800ms per sicurezza prima del retry
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [prompt, imagePart],
          config: configOptions,
        });
      }

      const extractedText = response.text || "{}";
      parsedData = JSON.parse(extractedText.trim());

      // Post-Processing di sicurezza: garantisce l'assenza assoluta di parole 'null' o 'N/A'
      if (parsedData && Array.isArray(parsedData.elenco_righe)) {
        const rawDocNum = parsedData.numero_documento || "";
        const cleanDocNum = rawDocNum.replace(/[^a-zA-Z0-9]/g, "");

        parsedData.elenco_righe = parsedData.elenco_righe.map((riga: any, idx: number) => {
          let lot = riga.numero_lotto;
          
          const isInvalidLot = !lot ||
            typeof lot !== "string" ||
            ["null", "n/a", "nd", "n/d", "none", "non trovato", "non specificato", "undefined", "-", "--"].includes(lot.trim().toLowerCase());

          if (isInvalidLot) {
            // Cerca se nel nome del prodotto è presente un codice articolo (es. CAR-102, ORT-045)
            const matchCode = (riga.nome_prodotto || "").match(/\b([A-Z]{2,4}[-_]?[0-9]{2,6})\b/i);
            if (matchCode) {
              const codeClean = matchCode[1].toUpperCase();
              lot = cleanDocNum ? `${codeClean}-${cleanDocNum}` : codeClean;
            } else if (cleanDocNum) {
              lot = `L-${cleanDocNum}-${String(idx + 1).padStart(2, "0")}`;
            } else {
              lot = "";
            }
          }

          // Rimuovi 'null' se finito in data_scadenza
          let exp = riga.data_scadenza;
          if (exp && typeof exp === "string" && ["null", "n/a", "nd", "n/d", "none", "non trovato", "undefined"].includes(exp.trim().toLowerCase())) {
            exp = null;
          }

          return {
            ...riga,
            numero_lotto: lot ? lot.trim() : "",
            data_scadenza: exp || null
          };
        });
      }
    } catch (apiError: any) {
      console.error("Scanning Error:", apiError);
      
      const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";

      // Se l'utente ha configurato una chiave reale, non dobbiamo fallire silenziosamente
      // ma lanciare l'errore effettivo così l'utente sa cosa è andato storto.
      if (hasGeminiKey) {
        let cleanErrorMsg = apiError.message || String(apiError);
        
        // Estrai messaggio pulito se l'errore è un JSON di errore restituito dall'API
        try {
          const parsed = typeof cleanErrorMsg === "string" && cleanErrorMsg.startsWith("{") ? JSON.parse(cleanErrorMsg) : null;
          if (parsed?.error?.message) {
            cleanErrorMsg = parsed.error.message;
          }
        } catch {
          // Mantieni cleanErrorMsg intatto
        }

        const lowerMsg = cleanErrorMsg.toLowerCase();
        
        if (lowerMsg.includes("403") || lowerMsg.includes("forbidden") || lowerMsg.includes("permission") || lowerMsg.includes("<!doctype html>")) {
          cleanErrorMsg = "Errore 403 (Accesso Negato) dalle API di Google Gemini. " +
            "Questo indica che la chiave GEMINI_API_KEY impostata non è abilitata per la tua area geografica, oppure la richiesta proviene da un server in una regione non supportata. " +
            "Verifica la chiave GEMINI_API_KEY nei Secrets di AI Studio o configura l'ambiente di hosting in una regione supportata (es. US-East o US-West).";
        } else if (lowerMsg.includes("400") || lowerMsg.includes("api key not valid") || lowerMsg.includes("invalid") || lowerMsg.includes("invalid_argument")) {
          cleanErrorMsg = "Errore 400 (Chiave API Non Valida) dalle API di Google Gemini. " +
            "Questo indica che la chiave GEMINI_API_KEY inserita non è corretta, è incompleta o contiene caratteri spuri. " +
            "Verifica nei Secrets di AI Studio o nell'ambiente di hosting che la chiave sia stata incollata correttamente (senza virgolette o apici attorno al valore).";
        } else if (lowerMsg.includes("404") || lowerMsg.includes("not found")) {
          cleanErrorMsg = "Errore 404 (Modello non trovato). Il modello è stato aggiornato all'attuale 'gemini-3.8-flash'.";
        }
        throw new Error(cleanErrorMsg);
      }
      
      // Fallback ai dati demo solo se NON c'è una chiave API reale impostata (modalità demo iniziale)
      console.log("Utilizzo del mock automatico in assenza di API Key reale.");
      const mockResult = getMockOcrResult();
      parsedData = mockResult;
      providerUsed = "demo";
    }

    res.json({
      imageUrl,
      data: parsedData,
      providerUsed,
      error: null
    });

  } catch (error: any) {
    console.error("Global Scan Error:", error);
    res.status(500).json({ error: error.message });
  }
});

function getMockOcrResult() {
  const list = [
    {
      ragione_sociale_fornitore: "Gusto Veneto S.r.l.",
      p_iva: "01234560281",
      numero_documento: `DDT-${Date.now().toString().slice(-4)}`,
      data_documento: new Date().toISOString().split("T")[0],
      elenco_righe: [
        {
          nome_prodotto: "Carne Macinata Bovino",
          quantita: 25,
          unita_misura: "kg",
          prezzo_unitario: 8.50,
          numero_lotto: `LT-BOV-${Math.floor(1000 + Math.random() * 9000)}`,
          data_scadenza: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Expiring in 5 days (orange alert)
        },
        {
          nome_prodotto: "Salsa Burger Speciale",
          quantita: 8,
          unita_misura: "l",
          prezzo_unitario: 12.00,
          numero_lotto: null, // Test null lot error handling
          data_scadenza: null, // Test missing expiry
        }
      ]
    },
    {
      ragione_sociale_fornitore: "Latteria delle Alpi S.C.A.",
      p_iva: "03456789012",
      numero_documento: `FATT-REC-${Date.now().toString().slice(-4)}`,
      data_documento: new Date().toISOString().split("T")[0],
      elenco_righe: [
        {
          nome_prodotto: "Formaggio Cheddar a Fette",
          quantita: 15,
          unita_misura: "kg",
          prezzo_unitario: 9.20,
          numero_lotto: `LT-CHD-${Math.floor(100 + Math.random() * 900)}`,
          data_scadenza: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // green
        },
        {
          nome_prodotto: "Burro di Centrifuga",
          quantita: 10,
          unita_misura: "kg",
          prezzo_unitario: 6.80,
          numero_lotto: `LT-BUT-MOCK`,
          data_scadenza: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // expired (red alert!)
        }
      ]
    }
  ];
  return list[Math.floor(Math.random() * list.length)];
}

// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  // Inizializza il database (cloud Postgres se presente, altrimenti locale JSON)
  try {
    await db.initialize();
  } catch (err: any) {
    console.error("Errore irreversibile nell'inizializzazione del database:", err);
  }

  const isDev = process.env.NODE_ENV !== "production" || (process.argv[1] && !process.argv[1].endsWith("server.cjs"));

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server full-stack attivo all'indirizzo http://localhost:${PORT}`);
  });
}

// In standard environments (Node / Docker / Render), launch server.
// In Vercel serverless functions, export the Express app directly.
if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
