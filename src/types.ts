/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Fornitore {
  id: string;
  ragione_sociale: string;
  p_iva: string;
  email?: string;
  telefono?: string;
  note?: string;
}

export interface Ingrediente {
  id: string;
  nome_generico: string;
  unita_misura: string; // kg, g, l, ml, pz, etc.
  categoria?: string; // Carni, Farine, Latticini, Spezie, Verdure, Imballaggi
  scorta_minima?: number; // threshold for low stock alert
}

export interface Documento {
  id: string;
  fornitore_id: string;
  numero_documento: string;
  data_documento: string; // YYYY-MM-DD
  tipo: "fattura" | "ddt";
  immagine_url: string; // upload path or data URL
  data_caricamento: string; // YYYY-MM-DD HH:mm
}

export interface RigaDocumento {
  id: string;
  documento_id: string;
  ingrediente_id: string;
  quantita_caricata: number;
  quantita_rimanente: number; // current stock remaining in this specific lot
  prezzo_unitario: number;
  numero_lotto: string;
  data_scadenza: string | null; // YYYY-MM-DD or null
  data_ricezione: string; // YYYY-MM-DD
}

export interface IngredienteRicetta {
  ingrediente_id: string;
  quantita_richiesta: number; // quantity in UoM of the ingredient
}

export interface Ricetta {
  id: string;
  nome_prodotto_finito: string;
  ingredienti: IngredienteRicetta[];
}

export interface LottoUsato {
  riga_documento_id: string; // the specific lot ID used
  quantita_usata: number;
}

export interface ScaricoProduzione {
  id: string;
  ricetta_id: string;
  quantita_prodotta: number;
  data: string; // YYYY-MM-DD HH:mm
  lotti_usati: LottoUsato[];
}

// Scanned data output from Gemini API
export interface ScannedLine {
  nome_prodotto: string;
  quantita: number;
  unita_misura: string;
  prezzo_unitario: number;
  numero_lotto: string | null;
  data_scadenza: string | null; // YYYY-MM-DD
}

export interface ScannedDocument {
  tipo?: "ddt" | "fattura";
  ragione_sociale_fornitore: string;
  p_iva: string;
  numero_documento: string;
  data_documento: string; // YYYY-MM-DD
  elenco_righe: ScannedLine[];
}

export interface StockStatus {
  ingrediente_id: string;
  nome_generico: string;
  unita_misura: string;
  categoria?: string;
  scorta_totale: number;
  scorta_minima?: number;
  warnings: "ok" | "low" | "empty";
}
