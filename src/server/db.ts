/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import pg from "pg";
import dns from "dns";

// Forza Node.js a preferire IPv4 rispetto a IPv6 per evitare errori di connessione ENETUNREACH con host come Supabase su reti che non supportano IPv6
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
import {
  Fornitore,
  Ingrediente,
  Documento,
  RigaDocumento,
  Ricetta,
  ScaricoProduzione,
  StockStatus,
  ScannedDocument
} from "../types.js";

import os from "os";

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY;
const DB_DIR = isServerless ? path.join(os.tmpdir(), "data") : path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

interface DatabaseSchema {
  fornitori: Fornitore[];
  ingredienti: Ingrediente[];
  documenti: Documento[];
  righe_documento: RigaDocumento[];
  ricette: Ricetta[];
  scarichi_produzione: ScaricoProduzione[];
}

const DEFAULT_DB: DatabaseSchema = {
  fornitori: [],
  ingredienti: [],
  documenti: [],
  righe_documento: [],
  ricette: [],
  scarichi_produzione: []
};

class FileDatabase {
  private cache: DatabaseSchema | null = null;
  private pool: any = null;
  private isCloudDb = false;

  constructor() {
    this.init();
  }

  async initialize(): Promise<void> {
    let dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (dbUrl) {
      // 1. Sanitizza spazi e virgolette
      dbUrl = dbUrl.trim();
      if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
        dbUrl = dbUrl.slice(1, -1).trim();
      }
      if (dbUrl.startsWith("'") && dbUrl.endsWith("'")) {
        dbUrl = dbUrl.slice(1, -1).trim();
      }

      // 2. Corregge automaticamente eventuali parentesi quadre intorno alla password
      // Ad esempio, da postgresql://user:[pass]@host:port/db a postgresql://user:pass@host:port/db
      const bracketMatch = dbUrl.match(/^(postgresql|postgres):\/\/[^:]+:\[([^\]]+)\]@/);
      if (bracketMatch) {
        const passwordWithBrackets = `[${bracketMatch[2]}]`;
        const passwordWithoutBrackets = bracketMatch[2];
        dbUrl = dbUrl.replace(`:${passwordWithBrackets}@`, `:${passwordWithoutBrackets}@`);
        console.log("⚠️ RILEVATO ERRORE: Hai inserito le parentesi quadre '[...]' intorno alla password nella tua URL di connessione. Le ho rimosse automaticamente!");
      }

      // 3. Genera una versione oscurata per i log di Render, così l'utente può fare il debug in sicurezza
      let obfuscatedUrl = dbUrl;
      const pwdMatch = dbUrl.match(/^(postgresql|postgres):\/\/[^:]+:([^@]+)@/);
      if (pwdMatch) {
        const urlParts = dbUrl.split("://");
        if (urlParts.length > 1) {
          const userAndRest = urlParts[1].split("@");
          if (userAndRest.length > 1) {
            const userParts = userAndRest[0].split(":");
            const username = userParts[0];
            const hostAndPort = userAndRest[1];
            obfuscatedUrl = `${urlParts[0]}://${username}:******@${hostAndPort}`;
          }
        }
      }

      console.log(`DATABASE_URL rilevata. Tento la connessione con: ${obfuscatedUrl}`);

      try {
        const { Pool } = pg;
        
        // Disabilita il controllo dei certificati TLS auto-firmati per evitare l'errore "self-signed certificate in certificate chain"
        if (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1")) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
        });
        
        // Crea la tabella se non esiste
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS app_state (
            key VARCHAR(255) PRIMARY KEY,
            value JSONB NOT NULL
          );
        `);
        
        // Leggi lo stato salvato
        const res = await this.pool.query("SELECT value FROM app_state WHERE key = 'haccp_db_state'");
        if (res.rows.length > 0) {
          console.log("Stato caricato con successo dal database cloud Postgres!");
          this.cache = res.rows[0].value;
        } else {
          console.log("Nessuno stato precedente trovato. Inizializzazione con lo stato di default...");
          await this.pool.query(
            "INSERT INTO app_state (key, value) VALUES ('haccp_db_state', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            [JSON.stringify(DEFAULT_DB)]
          );
          this.cache = JSON.parse(JSON.stringify(DEFAULT_DB));
        }
        this.isCloudDb = true;
      } catch (err: any) {
        console.error("\n❌ ERRORE DI CONNESSIONE A POSTGRES:", err.message);
        
        if (err.message.includes("ENETUNREACH") || err.message.includes("EADDRNOTAVAIL")) {
          console.error(`
💡 SUGGERIMENTO PER RISOLVERE ENETUNREACH (Errore IPv6 vs IPv4):
Questo errore indica che l'ambiente host (come Render gratuito o Replit) non supporta le connessioni in uscita tramite IPv6.
Di default, l'host diretto di Supabase (porta 5432) è IPv6-only.
👉 COME RISOLVERE:
1. Vai nel pannello di Supabase -> Impostazioni del Progetto -> Database.
2. Cerca la sezione "Connection Pooling" (o Connection Strings).
3. Seleziona la scheda "Pooler" (anziché "Direct").
4. Copia la nuova stringa di connessione che usa la porta 6543 (es. aws-0-eu-central-1.pooler.supabase.com:6543).
5. Usa questa nuova stringa come DATABASE_URL nel tuo ambiente Render/Replit! Essa supporta IPv4 e risolverà questo errore.
`);
        } else if (err.message.includes("password authentication failed")) {
          console.error(`
💡 SUGGERIMENTO PER RISOLVERE L'AUTENTICAZIONE FALLITA:
La password inserita nella stringa di connessione (DATABASE_URL) non è corretta, oppure contiene parentesi quadre o caratteri speciali non codificati.
👉 COME RISOLVERE:
1. Rimuovi le parentesi quadre '[' e ']' che circondano la password!
   Ad esempio, se Supabase ti mostra postgresql://...:[TUAPASSWORD]@... devi sostituire l'intera parte [TUAPASSWORD] (comprese le parentesi) con la tua password reale.
   Quindi NON deve essere postgresql://...:[password]@... MA deve essere postgresql://...:password@...
2. Se la tua password reale contiene caratteri speciali come @, #, :, /, ?, etc., questi devono essere codificati in formato URL (es. @ diventa %40, # diventa %23).
3. Per semplicità, puoi reimpostare la password del database in Supabase (Database -> Settings -> Reset password) 
   utilizzando una password composta solo da lettere e numeri (senza caratteri speciali), e aggiornare la tua DATABASE_URL.
`);
        } else if (err.message.includes("self-signed certificate")) {
          console.error(`
💡 SUGGERIMENTO PER RISOLVERE L'ERRORE SSL (self-signed certificate):
Questo errore si verifica quando Node.js rifiuta il certificato SSL auto-firmato del database.
👉 COME RISOLVERE:
Abbiamo aggiornato il codice dell'app per disabilitare automaticamente la verifica dei certificati TLS (impostando NODE_TLS_REJECT_UNAUTHORIZED="0") quando non sei su localhost.
Riesegui il deploy o riavvia il server su Render per applicare questa modifica, risolverà immediatamente l'errore SSL!
`);
        }

        console.log("Fallito l'uso del database cloud, si ricorre al database locale su file JSON.\n");
        this.isCloudDb = false;
        this.initLocal();
      }
    } else {
      console.log("Nessun DATABASE_URL configurato. Utilizzo del database locale su file JSON (data/db.json).");
      this.isCloudDb = false;
      this.initLocal();
    }
  }

  private init() {
    this.initLocal();
  }

  private initLocal() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
        this.cache = JSON.parse(JSON.stringify(DEFAULT_DB));
      } else {
        try {
          const data = fs.readFileSync(DB_FILE, "utf8");
          this.cache = JSON.parse(data);
        } catch (e) {
          console.error("Error reading database, resetting to default:", e);
          fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
          this.cache = JSON.parse(JSON.stringify(DEFAULT_DB));
        }
      }
    } catch (fsErr) {
      console.warn("Filesystem locale non scrivibile, uso memoria RAM temporanea:", fsErr);
      this.cache = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  }

  private read(): DatabaseSchema {
    if (!this.cache) {
      this.init();
    }
    return this.cache!;
  }

  private save(data: DatabaseSchema) {
    this.cache = data;
    if (this.isCloudDb && this.pool) {
      // Salvataggio asincrono in background sul Database Postgres
      this.pool.query(
        "INSERT INTO app_state (key, value) VALUES ('haccp_db_state', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(data)]
      ).catch((err: any) => {
        console.error("Errore nel salvataggio asincrono sul database Postgres:", err);
      });
    } else {
      // Salvataggio sincrono locale su file
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
      } catch (err) {
        console.error("Errore nel salvataggio locale:", err);
      }
    }
  }

  // Suppliers (Fornitori)
  getFornitori(): Fornitore[] {
    return this.read().fornitori;
  }

  addFornitore(fornitore: Omit<Fornitore, "id">): Fornitore {
    const db = this.read();
    const existing = db.fornitori.find(
      (f) => f.p_iva === fornitore.p_iva || f.ragione_sociale.toLowerCase() === fornitore.ragione_sociale.toLowerCase()
    );
    if (existing) {
      return existing;
    }
    const newForn: Fornitore = {
      ...fornitore,
      id: `forn_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };
    db.fornitori.push(newForn);
    this.save(db);
    return newForn;
  }

  // Ingredients (Ingredienti)
  getIngredienti(): Ingrediente[] {
    return this.read().ingredienti;
  }

  getIngredientiWithStock(): StockStatus[] {
    const db = this.read();
    return db.ingredienti.map((ing) => {
      // sum up quantita_rimanente across all batches of this ingredient
      const activeLots = db.righe_documento.filter((r) => r.ingrediente_id === ing.id);
      const scorta_totale = activeLots.reduce((sum, r) => sum + r.quantita_rimanente, 0);

      let warnings: "ok" | "low" | "empty" = "ok";
      const threshold = ing.scorta_minima || 0;
      if (scorta_totale <= 0) {
        warnings = "empty";
      } else if (scorta_totale < threshold) {
        warnings = "low";
      }

      return {
        ingrediente_id: ing.id,
        nome_generico: ing.nome_generico,
        unita_misura: ing.unita_misura,
        categoria: ing.categoria,
        scorta_totale,
        scorta_minima: ing.scorta_minima,
        warnings
      };
    });
  }

  addIngrediente(ingrediente: Omit<Ingrediente, "id">): Ingrediente {
    const db = this.read();
    const existing = db.ingredienti.find(
      (i) => i.nome_generico.toLowerCase().trim() === ingrediente.nome_generico.toLowerCase().trim()
    );
    if (existing) {
      return existing;
    }
    const newIng: Ingrediente = {
      ...ingrediente,
      id: `ing_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    };
    db.ingredienti.push(newIng);
    this.save(db);
    return newIng;
  }

  // Documents (Documenti)
  getDocumenti(): Documento[] {
    return this.read().documenti;
  }

  // Batches / Lots (Righe Documento)
  getRigheDocumento(): RigaDocumento[] {
    return this.read().righe_documento;
  }

  // Save Approved DDT / Invoice with lines
  saveApprovedDocument(payload: {
    ragione_sociale_fornitore: string;
    p_iva: string;
    numero_documento: string;
    data_documento: string;
    tipo: "fattura" | "ddt";
    immagine_url: string;
    righe: {
      nome_prodotto: string;
      quantita: number;
      unita_misura: string;
      prezzo_unitario: number;
      numero_lotto: string;
      data_scadenza: string | null;
    }[];
  }): { documento: Documento; righe: RigaDocumento[] } {
    const db = this.read();

    // 1. Get or create supplier
    let supplier = db.fornitori.find(
      (f) => (payload.p_iva && f.p_iva === payload.p_iva) || f.ragione_sociale.toLowerCase() === payload.ragione_sociale_fornitore.toLowerCase()
    );
    if (!supplier) {
      supplier = {
        id: `forn_${Date.now()}`,
        ragione_sociale: payload.ragione_sociale_fornitore,
        p_iva: payload.p_iva || `PIVA-${Date.now().toString().slice(-6)}`,
        note: "Auto-creato da scansione AI"
      };
      db.fornitori.push(supplier);
    }

    // 2. Create Document record
    const documentId = `doc_${Date.now()}`;
    const newDoc: Documento = {
      id: documentId,
      fornitore_id: supplier.id,
      numero_documento: payload.numero_documento || `DOC-${Date.now().toString().slice(-4)}`,
      data_documento: payload.data_documento || new Date().toISOString().split("T")[0],
      tipo: payload.tipo,
      immagine_url: payload.immagine_url || "",
      data_caricamento: new Date().toISOString().replace("T", " ").slice(0, 16)
    };
    db.documenti.push(newDoc);

    // 3. Process document lines (Lotti)
    const newLines: RigaDocumento[] = [];
    payload.righe.forEach((r, idx) => {
      // Find or create Ingredient
      let ingredient = db.ingredienti.find(
        (i) => i.nome_generico.toLowerCase().trim() === r.nome_prodotto.toLowerCase().trim()
      );
      if (!ingredient) {
        ingredient = {
          id: `ing_${Date.now()}_${idx}`,
          nome_generico: r.nome_prodotto,
          unita_misura: r.unita_misura || "kg",
          categoria: "In classificazione",
          scorta_minima: 10
        };
        db.ingredienti.push(ingredient);
      }

      // Create Stock Batch
      const newLine: RigaDocumento = {
        id: `riga_${Date.now()}_${idx}`,
        documento_id: documentId,
        ingrediente_id: ingredient.id,
        quantita_caricata: Number(r.quantita),
        quantita_rimanente: Number(r.quantita), // starts full
        prezzo_unitario: Number(r.prezzo_unitario || 0),
        numero_lotto: r.numero_lotto || `LOT-MOCK-${Date.now().toString().slice(-4)}-${idx}`,
        data_scadenza: r.data_scadenza || null,
        data_ricezione: new Date().toISOString().split("T")[0]
      };
      db.righe_documento.push(newLine);
      newLines.push(newLine);
    });

    this.save(db);
    return { documento: newDoc, righe: newLines };
  }

  // Recipes (Ricette)
  getRicette(): Ricetta[] {
    return this.read().ricette;
  }

  addRicetta(ricetta: Omit<Ricetta, "id">): Ricetta {
    const db = this.read();
    const newRic: Ricetta = {
      ...ricetta,
      id: `ric_${Date.now()}_${Math.floor(Math.random() * 100)}`
    };
    db.ricette.push(newRic);
    this.save(db);
    return newRic;
  }

  updateRicetta(id: string, updated: Omit<Ricetta, "id">): Ricetta {
    const db = this.read();
    const idx = db.ricette.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Ricetta non trovata");
    db.ricette[idx] = {
      ...updated,
      id
    };
    this.save(db);
    return db.ricette[idx];
  }

  deleteRicetta(id: string): void {
    const db = this.read();
    db.ricette = db.ricette.filter((r) => r.id !== id);
    this.save(db);
  }

  // Manual Lot Discharge
  dischargeLot(lotId: string, quantityToDischarge: number): RigaDocumento {
    const db = this.read();
    const idx = db.righe_documento.findIndex((r) => r.id === lotId);
    if (idx === -1) {
      throw new Error("Lotto non trovato");
    }
    const lot = db.righe_documento[idx];
    const updatedQty = Math.max(0, lot.quantita_rimanente - quantityToDischarge);
    db.righe_documento[idx] = {
      ...lot,
      quantita_rimanente: Number(updatedQty.toFixed(3))
    };
    this.save(db);
    return db.righe_documento[idx];
  }

  // Get production discharges history
  getScarichiProduzione(): ScaricoProduzione[] {
    return this.read().scarichi_produzione;
  }

  // Record a recipe production, which deducts active ingredients stocks using FIFO or manual selection
  recordProduction(payload: {
    ricetta_id: string;
    quantita_prodotta: number;
    data?: string;
    lotti_selezionati: { lotId: string; quantita_usata: number }[];
  }): ScaricoProduzione {
    const db = this.read();
    const newScarico: ScaricoProduzione = {
      id: `scar_${Date.now()}`,
      ricetta_id: payload.ricetta_id,
      quantita_prodotta: payload.quantita_prodotta,
      data: payload.data || new Date().toISOString().replace("T", " ").slice(0, 16),
      lotti_usati: payload.lotti_selezionati.map((ls) => ({
        riga_documento_id: ls.lotId,
        quantita_usata: ls.quantita_usata
      }))
    };

    // Deduct stock from the specified lots
    payload.lotti_selezionati.forEach((ls) => {
      const rigaIdx = db.righe_documento.findIndex((r) => r.id === ls.lotId);
      if (rigaIdx !== -1) {
        const riga = db.righe_documento[rigaIdx];
        const val = Math.max(0, riga.quantita_rimanente - ls.quantita_usata);
        db.righe_documento[rigaIdx] = {
          ...riga,
          quantita_rimanente: Number(val.toFixed(3))
        };
      }
    });

    db.scarichi_produzione.push(newScarico);
    this.save(db);
    return newScarico;
  }

  // Suppliers (Fornitori) updates
  updateFornitore(id: string, updated: Partial<Omit<Fornitore, "id">>): Fornitore {
    const db = this.read();
    const idx = db.fornitori.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("Fornitore non trovato");
    db.fornitori[idx] = { ...db.fornitori[idx], ...updated };
    this.save(db);
    return db.fornitori[idx];
  }

  deleteFornitore(id: string): void {
    const db = this.read();
    db.fornitori = db.fornitori.filter((f) => f.id !== id);
    this.save(db);
  }

  // Ingredients (Ingredienti) updates
  updateIngrediente(id: string, updated: Partial<Omit<Ingrediente, "id">>): Ingrediente {
    const db = this.read();
    const idx = db.ingredienti.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error("Materia prima non trovata");
    db.ingredienti[idx] = { ...db.ingredienti[idx], ...updated };
    this.save(db);
    return db.ingredienti[idx];
  }

  deleteIngrediente(id: string): void {
    const db = this.read();
    db.ingredienti = db.ingredienti.filter((i) => i.id !== id);
    this.save(db);
  }

  // Lots (Righe Documento) updates & deletion
  updateLot(id: string, updated: {
    numero_lotto?: string;
    quantita_caricata?: number;
    quantita_rimanente?: number;
    prezzo_unitario?: number;
    data_scadenza?: string | null;
  }): RigaDocumento {
    const db = this.read();
    const idx = db.righe_documento.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Lotto non trovato");
    const current = db.righe_documento[idx];
    
    db.righe_documento[idx] = {
      ...current,
      ...updated,
      quantita_caricata: updated.quantita_caricata !== undefined ? Number(updated.quantita_caricata) : current.quantita_caricata,
      quantita_rimanente: updated.quantita_rimanente !== undefined ? Number(updated.quantita_rimanente) : current.quantita_rimanente,
      prezzo_unitario: updated.prezzo_unitario !== undefined ? Number(updated.prezzo_unitario) : current.prezzo_unitario,
    };
    this.save(db);
    return db.righe_documento[idx];
  }

  deleteLot(id: string): void {
    const db = this.read();
    db.righe_documento = db.righe_documento.filter((r) => r.id !== id);
    this.save(db);
  }

  // Production discharges (Scarichi Produzione) updates & deletion
  updateScarico(id: string, updated: {
    quantita_prodotta?: number;
    data?: string;
  }): ScaricoProduzione {
    const db = this.read();
    const idx = db.scarichi_produzione.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Scarico di produzione non trovato");
    const current = db.scarichi_produzione[idx];
    db.scarichi_produzione[idx] = {
      ...current,
      quantita_prodotta: updated.quantita_prodotta !== undefined ? Number(updated.quantita_prodotta) : current.quantita_prodotta,
      data: updated.data !== undefined ? updated.data : current.data
    };
    this.save(db);
    return db.scarichi_produzione[idx];
  }

  deleteScarico(id: string): void {
    const db = this.read();
    const scarico = db.scarichi_produzione.find((s) => s.id === id);
    if (scarico) {
      // Ripristina la quantità rimanente dei lotti utilizzati
      scarico.lotti_usati.forEach((lu) => {
        const rigaIdx = db.righe_documento.findIndex((r) => r.id === lu.riga_documento_id);
        if (rigaIdx !== -1) {
          const riga = db.righe_documento[rigaIdx];
          db.righe_documento[rigaIdx] = {
            ...riga,
            quantita_rimanente: Number((riga.quantita_rimanente + lu.quantita_usata).toFixed(3))
          };
        }
      });
      db.scarichi_produzione = db.scarichi_produzione.filter((s) => s.id !== id);
      this.save(db);
    }
  }
}

export const db = new FileDatabase();
