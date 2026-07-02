/**
 * Tauri backend bridge — wraps invoke() calls to Rust commands.
 * Falls back to localStorage when running in browser (non-Tauri).
 *
 * Every command has a wrapper function with fallback for web version.
 */

import { isTauri } from "../utils/env";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // Web fallback: use localStorage
  const key = `kdcm_${cmd}`;
  if (cmd.startsWith("get_") || cmd === "exec_query") {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    return ([] as unknown as T);
  }
  if (cmd.startsWith("save_") || cmd.startsWith("create_") || cmd === "delete_documento" || cmd === "delete_codigo" || cmd === "delete_cita" || cmd === "delete_memo" || cmd === "delete_red" || cmd === "delete_vinculo" || cmd === "delete_marcador_gis") {
    const isDelete = cmd.startsWith("delete_");
    if (isDelete) {
      if (cmd === "delete_marcador_gis") {
        const list = JSON.parse(localStorage.getItem("kdcm_get_marcadores_gis") || "[]");
        localStorage.setItem("kdcm_get_marcadores_gis", JSON.stringify(list.filter((m: any) => m.id !== args?.id)));
      }
      return (args?.id || "ok") as unknown as T;
    }
    const data = { ...args, _cmd: cmd, _ts: Date.now() };
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(existing)) {
      existing.push(data);
      localStorage.setItem(key, JSON.stringify(existing));
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
    return (args?.id || "ok") as unknown as T;
  }
  return null as unknown as T;
}

// ── Projects ──

export async function createProject(name: string, desc: string, researcher: string) {
  return invoke<{ id: string; nombre: string }>("create_proyecto", { nombre: name, descripcion: desc, investigador: researcher });
}

// ── Categories ──

export async function getCategories(proyectoId: string) {
  return invoke<any[]>("get_codigos", { proyectoId });
}

export async function saveCategory(id: string, proyectoId: string, nombre: string, colorHex: string, descripcion: string, parentId: string | null) {
  return invoke<string>("save_codigo", { id, proyectoId, nombre, colorHex, descripcion, codigoPadreId: parentId });
}

export async function deleteCategory(id: string) {
  return invoke<string>("delete_codigo", { id });
}

// ── Documents ──

export async function getDocuments(proyectoId: string) {
  return invoke<any[]>("get_documentos", { proyectoId });
}

export async function saveDocument(id: string, proyectoId: string, nombre: string, tipo: string, ruta: string, tamanio: number) {
  return invoke<string>("save_documento", { id, proyectoId, nombre, tipo, ruta, tamanio });
}

export async function getDocumentContent(documentoId: string): Promise<string> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<string>("get_documento_content", { documentoId });
  }
  // Web fallback: try localStorage
  const docs = JSON.parse(localStorage.getItem("kdcm_get_documentos") || "[]");
  const doc = docs.find((d: any) => d.id === documentoId);
  return doc?.contenido_html || "";
}

export async function saveDocumentWeb(proyectoId: string, nombre: string, tipo: string, urlOrigen: string | null, contenidoHtml: string | null, metadatosJson: string | null) {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<string>("save_documento_web", { proyectoId, nombre, tipo, urlOrigen, contenidoHtml, metadatosJson });
  }
  // Web fallback: save via localStorage
  const id = `doc-web-${Date.now()}`;
  const docs = JSON.parse(localStorage.getItem("kdcm_get_documentos") || "[]");
  docs.push({ id, proyecto_id: proyectoId, nombre, tipo, url_origen: urlOrigen, contenido_html: contenidoHtml, metadatos_json: metadatosJson, fecha_importacion: new Date().toISOString(), tamanio_bytes: 0 });
  localStorage.setItem("kdcm_get_documentos", JSON.stringify(docs));
  return id;
}

export async function deleteDocument(id: string) {
  return invoke<string>("delete_documento", { id });
}

// ── Citations ──

export async function saveCitation(id: string, docId: string, texto: string, inicio: number, fin: number, pagina: number) {
  return invoke<string>("save_cita", { id, documentoId: docId, texto, inicio, fin, pagina });
}

export async function deleteCitation(id: string) {
  return invoke<string>("delete_cita", { id });
}

export async function getCitations(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_citas", { proyectoId });
}

export async function getCitationsByCode(codigoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_citas_por_codigo", { codigoId });
}

export async function updateCitationBounds(id: string, inicio: number, fin: number, pagina: number) {
  return invoke<string>("update_cita_limites", { id, inicio, fin, pagina });
}

// ── Distribution ──

export async function getDistribution(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_distribution", { proyectoId });
}

// ── Co-occurrences ──

export async function getCooccurrences(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_cooccurrences", { proyectoId });
}

// ── Networks ──

export async function saveNetwork(proyectoId: string, id: string, nombre: string, datosJson: string, miniaturaSvg: string | null) {
  return invoke<string>("save_red", { proyectoId, id, nombre, datosJson, miniaturaSvg });
}

export async function getNetworks(proyectoId: string) {
  return invoke<any[]>("get_redes", { proyectoId });
}

export async function getNetworkById(id: string) {
  return invoke<any>("get_red_por_id", { id });
}

export async function deleteNetwork(id: string) {
  return invoke<string>("delete_red", { id });
}

export async function saveNetworkNode(id: string, redId: string, tipo: string, entidadId: string | null, etiqueta: string, x: number, y: number, colorHex: string, tamano: number, forma: string, estiloJson: string | null, comentario: string | null) {
  return invoke<string>("save_nodo_red", { id, redId, tipo, entidadId, etiqueta, x, y, colorHex, tamano, forma, estiloJson, comentario });
}

export async function saveNetworkEdge(id: string, redId: string, origenId: string, destinoId: string, tipoRelacionId: string | null, etiqueta: string | null, colorHex: string, grosor: number, estilo: string, direccion: string, curvatura: number, comentario: string | null) {
  return invoke<string>("save_arista_red", { id, redId, origenId, destinoId, tipoRelacionId, etiqueta, colorHex, grosor, estilo, direccion, curvatura, comentario });
}

// ── Memos ──

export async function saveMemo(id: string, proyectoId: string, titulo: string, contenido: string, tipo: string) {
  return invoke<string>("save_memo", { id, proyectoId, titulo, contenido, tipo });
}

export async function getMemos(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_memos", { proyectoId });
}

export async function deleteMemo(id: string) {
  return invoke<string>("delete_memo", { id });
}

// ── Stop words ──

export async function getStopWords(idioma: string = "es") {
  return invoke<string[]>("get_stop_words", { idioma });
}

// ── Transcription ──

export async function saveTranscription(id: string, documentoId: string, proyectoId: string, contenidoHtml: string, idioma: string, hablantesJson: string) {
  return invoke<string>("save_transcripcion", { id, documentoId, proyectoId, contenidoHtml, idioma, hablantesJson });
}

export async function getTranscription(documentoId: string) {
  return invoke<any>("get_transcripcion", { documentoId });
}

// ── Audio markers ──

export async function saveAudioMarker(id: string, documentoId: string, proyectoId: string, tiempoInicio: number, tiempoFin: number | null, etiqueta: string | null, categoriaId: string | null, comentario: string | null, investigadorId: string | null) {
  return invoke<string>("save_marcador_audio", { id, documentoId, proyectoId, tiempoInicio, tiempoFin, etiqueta, categoriaId, comentario, investigadorId });
}

export async function getAudioMarkers(documentoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_marcadores_audio", { documentoId });
}

// ── Position memory ──

export async function savePosition(documentoId: string, proyectoId: string, pagina: number, scrollY: number, zoom: number) {
  return invoke<string>("save_posicion_documento", { documentoId, proyectoId, pagina, scrollY, zoom });
}

export async function getPosition(documentoId: string, proyectoId: string) {
  return invoke<{ pagina: number; scroll_y: number; zoom: number }>("get_posicion_documento", { documentoId, proyectoId });
}

// ── Hyperlinks between segments ──

export async function saveLink(id: string, proyectoId: string, citaOrigenId: string, citaDestinoId: string, etiqueta: string | null, investigadorId: string | null) {
  return invoke<string>("save_vinculo", { id, proyectoId, citaOrigenId, citaDestinoId, etiqueta, investigadorId });
}

export async function getLinks(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_vinculos", { proyectoId });
}

export async function deleteLink(id: string) {
  return invoke<string>("delete_vinculo", { id });
}

// ── GIS markers ──

export async function saveGISMarker(id: number | null, documentoGeoId: string, proyectoId: string, tipo: string, nombre: string | null, descripcion: string | null, categoriaGis: string | null, coordenadasJson: string, colorHex: string | null, investigadorId: string | null) {
  return invoke<number>("save_marcador_gis", { id, documentoGeoId, proyectoId, tipo, nombre, descripcion, categoriaGis, coordenadasJson, colorHex, investigadorId });
}

export async function getGISMarkers(documentoGeoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_marcadores_gis", { documentoGeoId });
}

export async function deleteGISMarker(id: number) {
  return invoke<number>("delete_marcador_gis", { id });
}

// ── GIS categories ──

export async function saveGISCategory(id: string, proyectoId: string, nombre: string, colorHex: string | null) {
  return invoke<string>("save_categoria_gis", { id, proyectoId, nombre, colorHex });
}

export async function getGISCategories(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_categorias_gis", { proyectoId });
}

// ── Variables ──

export async function saveVariable(id: string, proyectoId: string, nombre: string, tipoDato: string, descripcion: string | null, unidad: string | null) {
  return invoke<string>("save_variable", { id, proyectoId, nombre, tipoDato, descripcion, unidad });
}

export async function getVariables(proyectoId: string) {
  return invoke<{ rows: any[]; count: number }>("get_variables", { proyectoId });
}

export async function saveVariableValue(id: string, variableId: string, documentoId: string, valorTexto: string | null, valorNumero: number | null, valorFecha: string | null, valorBooleano: boolean | null) {
  return invoke<string>("save_valor_variable", { id, variableId, documentoId, valorTexto, valorNumero, valorFecha, valorBooleano });
}

export async function getVariableValues(variableId: string) {
  return invoke<{ rows: any[]; count: number }>("get_valores_variables", { variableId });
}

// ── Concept maps ──

export async function saveConceptMap(id: string, proyectoId: string, nombre: string, tipoMapa: string, datosJson: string, capasJson: string | null) {
  return invoke<string>("save_mapa_conceptual", { id, proyectoId, nombre, tipoMapa, datosJson, capasJson });
}

export async function getConceptMaps(proyectoId: string) {
  return invoke<any[]>("get_mapas_conceptuales", { proyectoId });
}

export async function deleteConceptMap(id: string) {
  return invoke<string>("delete_mapa_conceptual", { id });
}

// ── Transcription (whisper.cpp stub) ──

export async function transcribeAudio(rutaArchivo: string, idioma: string, opcionesJson: string) {
  return invoke<string>("transcribe_audio", { rutaArchivo, idioma, opcionesJson });
}

// ── Raw query (for flexible access) ──

export async function execQuery(sql: string, params: any[]) {
  return invoke<{ rows: any[]; count: number }>("exec_query", { sql, paramsJson: JSON.stringify(params) });
}

// ── Section 10: Snapshots ──

export async function saveSnapshot(id: string, proyectoId: string, nombre: string, descripcion: string | null, datosJson: string) {
  return invoke<string>("save_instantanea", { id, proyectoId, nombre, descripcion, datosJson });
}

export async function getSnapshots(proyectoId: string) {
  return invoke<any[]>("get_instantaneas", { proyectoId });
}

export async function restoreSnapshot(id: string, proyectoId: string) {
  return invoke<boolean>("restore_instantanea", { id, proyectoId });
}

export async function deleteSnapshot(id: string) {
  return invoke<boolean>("delete_instantanea", { id });
}

export async function exportProjectState(proyectoId: string) {
  return invoke<string>("export_project_state", { proyectoId });
}

// ── Section 10: Project protection ──

export async function protectProject(proyectoId: string, hashClave: string) {
  return invoke<boolean>("protect_project", { proyectoId, hashClave });
}

export async function verifyProjectPassword(proyectoId: string, hash: string) {
  return invoke<boolean>("verify_project_password", { proyectoId, hash });
}

export async function isProjectProtected(proyectoId: string) {
  return invoke<boolean>("is_project_protected", { proyectoId });
}

// ── Section 11: Collaboration sessions ──

export async function saveCollabSession(id: string, proyectoId: string, hostId: string, codigoSala: string) {
  return invoke<string>("save_sesion_colaboracion", { id, proyectoId, hostId, codigoSala });
}

export async function closeCollabSession(id: string) {
  return invoke<boolean>("close_sesion_colaboracion", { id });
}

export async function getSessionHistory(proyectoId: string) {
  return invoke<any[]>("get_historial_sesiones", { proyectoId });
}

export async function getResearcherContributions(proyectoId: string) {
  return invoke<any[]>("get_contribuciones_investigadores", { proyectoId });
}

export async function mergeExternalProject(proyectoId: string, datosJsonExterno: string) {
  return invoke<any>("merge_external_project", { proyectoId, datosJsonExterno });
}

// ── Schema migration ──

export async function ensureSchemaColumns() {
  return invoke<boolean>("ensure_schema_columns", {});
}

// ── Language persistence ──

export async function updateInvestigadorLang(
  investigadorId: string,
  lang: string
): Promise<boolean> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<boolean>("update_investigador_lang", { investigadorId, lang });
  }
  localStorage.setItem("kdcm-lang", lang);
  return true;
}

export async function getInvestigadorLang(
  investigadorId: string
): Promise<string> {
  if (isTauri()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<string>("get_investigador_lang", { investigadorId });
  }
  return localStorage.getItem("kdcm-lang") || "es";
}
