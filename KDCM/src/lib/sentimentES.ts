/**
 * Spanish sentiment lexicon for OpinionMining.
 * Positive and negative word lists with intensity weights (0-1).
 * Used to calculate polarity, intensity, and certainty from citation text
 * WITHOUT external AI APIs.
 */

export interface SentimentWord {
  word: string;
  weight: number; // 0.0 to 1.0
}

export const POSITIVE_WORDS: SentimentWord[] = [
  { word: "bueno", weight: 0.5 }, { word: "excelente", weight: 0.9 }, { word: "positivo", weight: 0.7 },
  { word: "mejor", weight: 0.6 }, { word: "óptimo", weight: 0.9 }, { word: "favorable", weight: 0.7 },
  { word: "beneficio", weight: 0.7 }, { word: "beneficioso", weight: 0.8 }, { word: "éxito", weight: 0.8 },
  { word: "exitoso", weight: 0.8 }, { word: "eficaz", weight: 0.7 }, { word: "eficiente", weight: 0.7 },
  { word: "adecuado", weight: 0.5 }, { word: "apropiado", weight: 0.6 }, { word: "correcto", weight: 0.5 },
  { word: "satisfactorio", weight: 0.7 }, { word: "agradable", weight: 0.6 }, { word: "feliz", weight: 0.8 },
  { word: "alegre", weight: 0.7 }, { word: "esperanzador", weight: 0.7 }, { word: "motivador", weight: 0.7 },
  { word: "inspirador", weight: 0.8 }, { word: "valioso", weight: 0.7 }, { word: "importante", weight: 0.6 },
  { word: "significativo", weight: 0.7 }, { word: "notable", weight: 0.7 }, { word: "destacado", weight: 0.7 },
  { word: "sobresaliente", weight: 0.9 }, { word: "maravilloso", weight: 0.9 }, { word: "fantástico", weight: 0.9 },
  { word: "genial", weight: 0.8 }, { word: "estupendo", weight: 0.8 }, { word: "magnífico", weight: 0.9 },
  { word: "espléndido", weight: 0.9 }, { word: "grandioso", weight: 0.9 }, { word: "increíble", weight: 0.8 },
  { word: "admirable", weight: 0.8 }, { word: "elogiable", weight: 0.8 }, { word: "recomendable", weight: 0.7 },
  { word: "útil", weight: 0.6 }, { word: "práctico", weight: 0.5 }, { word: "efectivo", weight: 0.7 },
  { word: "productivo", weight: 0.7 }, { word: "próspero", weight: 0.8 }, { word: "floreciente", weight: 0.7 },
  { word: "sólido", weight: 0.6 }, { word: "robusto", weight: 0.7 }, { word: "resistente", weight: 0.6 },
  { word: "confiable", weight: 0.7 }, { word: "seguro", weight: 0.6 }, { word: "protegido", weight: 0.6 },
  { word: "saludable", weight: 0.7 }, { word: "sano", weight: 0.6 }, { word: "limpio", weight: 0.5 },
  { word: "puro", weight: 0.6 }, { word: "claro", weight: 0.5 }, { word: "transparente", weight: 0.6 },
  { word: "justo", weight: 0.7 }, { word: "equitativo", weight: 0.7 }, { word: "inclusivo", weight: 0.8 },
  { word: "diverso", weight: 0.6 }, { word: "sostenible", weight: 0.7 }, { word: "renovable", weight: 0.6 },
  { word: "innovador", weight: 0.8 }, { word: "creativo", weight: 0.7 }, { word: "original", weight: 0.7 },
  { word: "inteligente", weight: 0.7 }, { word: "brillante", weight: 0.8 }, { word: "talentoso", weight: 0.7 },
  { word: "hábil", weight: 0.6 }, { word: "competente", weight: 0.6 }, { word: "capaz", weight: 0.6 },
  { word: "fuerte", weight: 0.6 }, { word: "poderoso", weight: 0.7 }, { word: "enérgico", weight: 0.6 },
  { word: "dinámico", weight: 0.6 }, { word: "ágil", weight: 0.6 }, { word: "rápido", weight: 0.5 },
  { word: "oportuno", weight: 0.6 }, { word: "conveniente", weight: 0.5 }, { word: "ventajoso", weight: 0.7 },
  { word: "superior", weight: 0.7 }, { word: "extraordinario", weight: 0.9 }, { word: "excepcional", weight: 0.9 },
  { word: "perfecto", weight: 0.9 }, { word: "ideal", weight: 0.8 }, { word: "inmejorable", weight: 0.9 },
  { word: "amable", weight: 0.7 }, { word: "cordial", weight: 0.6 }, { word: "generoso", weight: 0.7 },
  { word: "solidario", weight: 0.8 }, { word: "cooperativo", weight: 0.6 }, { word: "colaborativo", weight: 0.7 },
  { word: "pacífico", weight: 0.7 }, { word: "armonioso", weight: 0.7 }, { word: "tranquilo", weight: 0.6 },
  { word: "sereno", weight: 0.6 }, { word: "estable", weight: 0.5 }, { word: "consistente", weight: 0.6 },
];

export const NEGATIVE_WORDS: SentimentWord[] = [
  { word: "malo", weight: 0.5 }, { word: "pésimo", weight: 0.9 }, { word: "negativo", weight: 0.7 },
  { word: "peor", weight: 0.6 }, { word: "deficiente", weight: 0.7 }, { word: "insuficiente", weight: 0.7 },
  { word: "inadecuado", weight: 0.6 }, { word: "inapropiado", weight: 0.7 }, { word: "incorrecto", weight: 0.5 },
  { word: "perjudicial", weight: 0.8 }, { word: "dañino", weight: 0.8 }, { word: "nocivo", weight: 0.8 },
  { word: "tóxico", weight: 0.9 }, { word: "peligroso", weight: 0.8 }, { word: "riesgoso", weight: 0.7 },
  { word: "fracaso", weight: 0.8 }, { word: "fallido", weight: 0.8 }, { word: "frustrado", weight: 0.7 },
  { word: "decepcionante", weight: 0.7 }, { word: "desalentador", weight: 0.7 }, { word: "desesperanzador", weight: 0.8 },
  { word: "triste", weight: 0.7 }, { word: "deprimente", weight: 0.8 }, { word: "lamentable", weight: 0.7 },
  { word: "penoso", weight: 0.7 }, { word: "doloroso", weight: 0.8 }, { word: "terrible", weight: 0.9 },
  { word: "horrible", weight: 0.9 }, { word: "espantoso", weight: 0.9 }, { word: "catastrófico", weight: 0.9 },
  { word: "desastroso", weight: 0.9 }, { word: "fatal", weight: 0.9 }, { word: "grave", weight: 0.7 },
  { word: "severo", weight: 0.7 }, { word: "crítico", weight: 0.7 }, { word: "preocupante", weight: 0.7 },
  { word: "alarmante", weight: 0.8 }, { word: "inquietante", weight: 0.7 }, { word: "perturbador", weight: 0.8 },
  { word: "inútil", weight: 0.6 }, { word: "improductivo", weight: 0.7 }, { word: "ineficaz", weight: 0.7 },
  { word: "ineficiente", weight: 0.7 }, { word: "incompetente", weight: 0.7 }, { word: "incapaz", weight: 0.6 },
  { word: "débil", weight: 0.5 }, { word: "frágil", weight: 0.6 }, { word: "vulnerable", weight: 0.6 },
  { word: "inestable", weight: 0.6 }, { word: "inconsistente", weight: 0.6 }, { word: "variable", weight: 0.4 },
  { word: "confuso", weight: 0.6 }, { word: "ambiguo", weight: 0.5 }, { word: "oscuro", weight: 0.6 },
  { word: "turbio", weight: 0.7 }, { word: "sucio", weight: 0.6 }, { word: "contaminado", weight: 0.8 },
  { word: "corrupto", weight: 0.9 }, { word: "deshonesto", weight: 0.8 }, { word: "fraudulento", weight: 0.9 },
  { word: "injusto", weight: 0.8 }, { word: "desigual", weight: 0.7 }, { word: "discriminatorio", weight: 0.9 },
  { word: "excluyente", weight: 0.8 }, { word: "marginador", weight: 0.9 }, { word: "opresivo", weight: 0.9 },
  { word: "autoritario", weight: 0.8 }, { word: "abusivo", weight: 0.9 }, { word: "violento", weight: 0.9 },
  { word: "agresivo", weight: 0.7 }, { word: "hostil", weight: 0.8 }, { word: "conflictivo", weight: 0.7 },
  { word: "problemático", weight: 0.6 }, { word: "complicado", weight: 0.5 }, { word: "difícil", weight: 0.5 },
  { word: "tedioso", weight: 0.6 }, { word: "aburrido", weight: 0.5 }, { word: "monótono", weight: 0.5 },
  { word: "lento", weight: 0.4 }, { word: "tardío", weight: 0.5 }, { word: "demorado", weight: 0.5 },
  { word: "costoso", weight: 0.5 }, { word: "caro", weight: 0.4 }, { word: "excesivo", weight: 0.6 },
  { word: "escaso", weight: 0.5 }, { word: "limitado", weight: 0.5 }, { word: "restringido", weight: 0.6 },
  { word: "pobre", weight: 0.6 }, { word: "precario", weight: 0.7 }, { word: "miserable", weight: 0.8 },
  { word: "desagradable", weight: 0.6 }, { word: "molesto", weight: 0.5 }, { word: "irritante", weight: 0.7 },
  { word: "odioso", weight: 0.8 }, { word: "repugnante", weight: 0.9 }, { word: "asqueroso", weight: 0.8 },
  { word: "egoísta", weight: 0.7 }, { word: "arrogante", weight: 0.7 }, { word: "soberbio", weight: 0.7 },
  { word: "ignorante", weight: 0.6 }, { word: "irresponsable", weight: 0.7 }, { word: "negligente", weight: 0.7 },
];

// Certainty/uncertainty markers
export const CERTAINTY_MARKERS: SentimentWord[] = [
  { word: "definitivamente", weight: 0.9 }, { word: "ciertamente", weight: 0.9 }, { word: "indudablemente", weight: 0.9 },
  { word: "evidentemente", weight: 0.9 }, { word: "claramente", weight: 0.8 }, { word: "obviamente", weight: 0.8 },
  { word: "seguramente", weight: 0.7 }, { word: "probablemente", weight: 0.5 }, { word: "posiblemente", weight: 0.3 },
  { word: "quizás", weight: 0.2 }, { word: "tal vez", weight: 0.2 }, { word: "acaso", weight: 0.2 },
  { word: "siempre", weight: 0.9 }, { word: "nunca", weight: 0.9 }, { word: "absolutamente", weight: 0.9 },
  { word: "totalmente", weight: 0.8 }, { word: "completamente", weight: 0.8 }, { word: "plenamente", weight: 0.8 },
  { word: "sin duda", weight: 0.9 }, { word: "sin lugar a dudas", weight: 0.9 }, { word: "es evidente", weight: 0.9 },
  { word: "es claro", weight: 0.8 }, { word: "es obvio", weight: 0.8 }, { word: "es seguro", weight: 0.8 },
  { word: "podría", weight: 0.3 }, { word: "pudiera", weight: 0.3 }, { word: "quizá", weight: 0.2 },
  { word: "aparentemente", weight: 0.4 }, { word: "supuestamente", weight: 0.3 }, { word: "presuntamente", weight: 0.3 },
  { word: "aproximadamente", weight: 0.5 }, { word: "casi", weight: 0.4 }, { word: "prácticamente", weight: 0.7 },
];

export interface SentimentCitationResult {
  id: string;
  text: string;
  docName: string;
  polarity: "positive" | "negative" | "neutral";
  intensity: number;
  certainty: number;
}

/** Analyze a citation and return structured result for OpinionMining UI */
export function analyzeCitationSentiment(id: string, text: string, docName: string): SentimentCitationResult {
  const result = analyzeSentiment(text);
  let polarity: "positive" | "negative" | "neutral" = "neutral";
  if (result.polarity > 0.1) polarity = "positive";
  else if (result.polarity < -0.1) polarity = "negative";
  return { id, text, docName, polarity, intensity: Math.round(result.intensity * 100) / 100, certainty: Math.round(result.certainty * 100) / 100 };
}

/**
 * Calculate sentence-level sentiment metrics.
 * Returns polarity (-1 to 1), intensity (0-1), and certainty (0-1).
 */
export function analyzeSentiment(text: string): {
  polarity: number;
  intensity: number;
  certainty: number;
  positiveMatches: string[];
  negativeMatches: string[];
} {
  const lower = text.toLowerCase();
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];
  let posScore = 0;
  let negScore = 0;
  let certaintyScore = 0;
  let certaintyCount = 0;

  // Detect positive words
  for (const pw of POSITIVE_WORDS) {
    if (lower.includes(pw.word)) {
      positiveMatches.push(pw.word);
      posScore += pw.weight;
    }
  }

  // Detect negative words
  for (const nw of NEGATIVE_WORDS) {
    if (lower.includes(nw.word)) {
      negativeMatches.push(nw.word);
      negScore += nw.weight;
    }
  }

  // Detect certainty markers
  for (const cm of CERTAINTY_MARKERS) {
    if (lower.includes(cm.word)) {
      certaintyScore += cm.weight;
      certaintyCount++;
    }
  }

  // Calculate metrics
  const totalSentiment = posScore + negScore;
  const polarity = totalSentiment > 0 ? Math.min(1, posScore / Math.max(1, totalSentiment)) * (posScore / Math.max(1, posScore + negScore))
    : totalSentiment === 0 ? 0
    : -Math.min(1, negScore / Math.max(1, totalSentiment)) * (negScore / Math.max(1, posScore + negScore));

  const intensity = Math.min(1, totalSentiment / 5); // Normalize by expected max
  const certainty = certaintyCount > 0 ? Math.min(1, certaintyScore / certaintyCount) : 0.5; // Default neutral certainty

  return { polarity, intensity, certainty, positiveMatches, negativeMatches };
}
