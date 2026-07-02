mod db;

use db::{Database, get_app_dir};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct AppState {
    pub db: Database,
}

// ── Types ──

#[derive(Debug, Serialize, Deserialize)]
pub struct Proyecto {
    pub id: String,
    pub nombre: String,
    pub descripcion: String,
    pub fecha_creacion: String,
    pub fecha_modificacion: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Codigo {
    pub id: String,
    pub proyecto_id: String,
    pub nombre: String,
    pub color_hex: String,
    pub codigo_padre_id: Option<String>,
    pub descripcion: String,
    pub es_nodo_libre: bool,
    pub es_in_vivo: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CitaCodigo {
    pub id: String,
    pub cita_id: String,
    pub codigo_id: String,
    pub peso_codificacion: i32,
    pub fecha: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentoData {
    pub id: String,
    pub proyecto_id: String,
    pub nombre: String,
    pub tipo: String,
    pub fecha_importacion: String,
    pub tamanio_bytes: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RedGuardada {
    pub id: String,
    pub proyecto_id: String,
    pub nombre: String,
    pub datos_json: String,
    pub miniatura_svg: Option<String>,
    pub fecha: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub rows: Vec<serde_json::Value>,
    pub count: usize,
}

// ── Tauri commands ──

#[tauri::command]
fn create_proyecto(state: State<AppState>, nombre: String, descripcion: String, investigador: String) -> Result<Proyecto, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let id = format!("proj-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let now = chrono_now();
    conn.execute(
        "INSERT INTO proyectos (id, nombre, descripcion, fecha_creacion, fecha_modificacion) VALUES (?1,?2,?3,?4,?5)",
        params![id, nombre, descripcion, now, now],
    ).map_err(|e| e.to_string())?;
    // Also create researcher
    conn.execute(
        "INSERT OR IGNORE INTO investigadores (id, nombre, fecha_registro) VALUES (?1,?2,?3)",
        params![format!("inv-{}", id), investigador, now],
    ).map_err(|e| e.to_string())?;
    Ok(Proyecto { id, nombre, descripcion, fecha_creacion: now.clone(), fecha_modificacion: now })
}

#[tauri::command]
fn get_codigos(state: State<AppState>, proyecto_id: String) -> Result<Vec<Codigo>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, proyecto_id, nombre, color_hex, COALESCE(codigo_padre_id,''), COALESCE(descripcion,''), es_nodo_libre, es_in_vivo FROM codigos WHERE proyecto_id=?1"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(Codigo {
            id: row.get(0)?, proyecto_id: row.get(1)?, nombre: row.get(2)?,
            color_hex: row.get(3)?, codigo_padre_id: if row.get::<_,String>(4)? == "" { None } else { Some(row.get(4)?) },
            descripcion: row.get(5)?, es_nodo_libre: row.get(6)?, es_in_vivo: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_distribution(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT c.nombre as categoria, d.nombre as documento, COUNT(cc.id) as n
         FROM citas_codigos cc
         JOIN codigos c ON cc.codigo_id = c.id
         JOIN citas ci ON cc.cita_id = ci.id
         JOIN documentos d ON ci.documento_id = d.id
         WHERE c.proyecto_id = ?1
         GROUP BY c.id, d.id
         ORDER BY c.nombre, d.nombre"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "categoria": row.get::<_,String>(0)?,
            "documento": row.get::<_,String>(1)?,
            "n": row.get::<_,i64>(2)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn save_red(state: State<AppState>, proyecto_id: String, id: String, nombre: String, datos_json: String, miniatura_svg: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO redes_guardadas (id, proyecto_id, nombre, datos_json, miniatura_svg, fecha) VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, proyecto_id, nombre, datos_json, miniatura_svg, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_redes(state: State<AppState>, proyecto_id: String) -> Result<Vec<RedGuardada>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, proyecto_id, nombre, datos_json, miniatura_svg, fecha FROM redes_guardadas WHERE proyecto_id=?1 ORDER BY fecha DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(RedGuardada {
            id: row.get(0)?, proyecto_id: row.get(1)?, nombre: row.get(2)?,
            datos_json: row.get(3)?, miniatura_svg: row.get(4)?, fecha: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn exec_query(state: State<AppState>, sql: String, params_json: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let params: Vec<serde_json::Value> = serde_json::from_str(&params_json).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
    let param_refs: Vec<Box<dyn rusqlite::types::ToSql>> = params.iter().map(|v| {
        match v {
            serde_json::Value::String(s) => Box::new(s.clone()) as Box<dyn rusqlite::types::ToSql>,
            serde_json::Value::Number(n) => {
                Box::new(n.as_f64().unwrap_or(0.0)) as Box<dyn rusqlite::types::ToSql>
            }
            serde_json::Value::Bool(b) => Box::new(*b) as Box<dyn rusqlite::types::ToSql>,
            _ => Box::new(rusqlite::types::Null) as Box<dyn rusqlite::types::ToSql>,
        }
    }).collect();
    let param_slice: Vec<&dyn rusqlite::types::ToSql> = param_refs.iter().map(|b| b.as_ref()).collect();
    let rows: Vec<serde_json::Value> = stmt.query_map(
        rusqlite::params_from_iter(param_slice),
        |row| {
            let mut map = serde_json::Map::new();
            for (i, name) in column_names.iter().enumerate() {
                let val: String = row.get::<_,String>(i).unwrap_or_default();
                map.insert(name.clone(), serde_json::Value::String(val));
            }
            Ok(serde_json::Value::Object(map))
        }
    ).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn save_codigo(state: State<AppState>, id: String, proyecto_id: String, nombre: String, color_hex: String, descripcion: String, codigo_padre_id: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO codigos (id, proyecto_id, nombre, color_hex, descripcion, codigo_padre_id, fecha_creacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, proyecto_id, nombre, color_hex, descripcion, codigo_padre_id, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn save_documento(state: State<AppState>, id: String, proyecto_id: String, nombre: String, tipo: String, ruta: String, tamanio: i64) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO documentos (id, proyecto_id, nombre, tipo, ruta_archivo, fecha_importacion, tamanio_bytes) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, proyecto_id, nombre, tipo, ruta, now, tamanio],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn save_documento_web(state: State<AppState>, proyecto_id: String, nombre: String, tipo: String, url_origen: Option<String>, contenido_html: Option<String>, metadatos_json: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let id = format!("doc-web-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO documentos (id, proyecto_id, nombre, tipo, url_origen, contenido_html, metadatos_json, fecha_importacion, tamanio_bytes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![id, proyecto_id, nombre, tipo, url_origen, contenido_html, metadatos_json, now, 0_i64],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn save_cita(state: State<AppState>, id: String, documento_id: String, texto: String, inicio: i64, fin: i64, pagina: i64) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO citas (id, documento_id, texto_seleccionado, posicion_inicio, posicion_fin, pagina, fecha_creacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, documento_id, texto, inicio, fin, pagina, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_documentos(state: State<AppState>, proyecto_id: String) -> Result<Vec<DocumentoData>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, proyecto_id, nombre, tipo, fecha_importacion, tamanio_bytes FROM documentos WHERE proyecto_id=?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(DocumentoData { id: row.get(0)?, proyecto_id: row.get(1)?, nombre: row.get(2)?, tipo: row.get(3)?, fecha_importacion: row.get(4)?, tamanio_bytes: row.get(5)? })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_documento_content(state: State<AppState>, documento_id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let content: String = conn.query_row(
        "SELECT COALESCE(contenido_html,'') FROM documentos WHERE id=?1",
        rusqlite::params![documento_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
fn get_citas_por_codigo(state: State<AppState>, codigo_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT ci.id, ci.texto_seleccionado, ci.pagina, d.nombre as doc_nombre, cc.peso_codificacion
         FROM citas_codigos cc JOIN citas ci ON cc.cita_id=ci.id JOIN documentos d ON ci.documento_id=d.id
         WHERE cc.codigo_id=?1 ORDER BY cc.peso_codificacion DESC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![codigo_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "texto": row.get::<_,String>(1)?,
            "pagina": row.get::<_,i64>(2)?, "doc": row.get::<_,String>(3)?,
            "peso": row.get::<_,i64>(4)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn get_cooccurrences(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT c1.nombre as cat_a, c2.nombre as cat_b, COUNT(DISTINCT cc1.cita_id) as n
         FROM citas_codigos cc1
         JOIN citas_codigos cc2 ON cc1.cita_id=cc2.cita_id AND cc1.codigo_id<cc2.codigo_id
         JOIN codigos c1 ON cc1.codigo_id=c1.id
         JOIN codigos c2 ON cc2.codigo_id=c2.id
         WHERE c1.proyecto_id=?1
         GROUP BY c1.id, c2.id ORDER BY n DESC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "cat_a": row.get::<_,String>(0)?, "cat_b": row.get::<_,String>(1)?, "n": row.get::<_,i64>(2)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn save_memo(state: State<AppState>, id: String, proyecto_id: String, titulo: String, contenido: String, tipo: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO memos (id, proyecto_id, titulo, contenido_html, tipo_memo, fecha_creacion, fecha_modificacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, proyecto_id, titulo, contenido, tipo, now, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_memos(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, titulo, contenido_html, tipo_memo, fecha_creacion FROM memos WHERE proyecto_id=?1 ORDER BY fecha_modificacion DESC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "titulo": row.get::<_,String>(1)?,
            "contenido": row.get::<_,String>(2)?, "tipo": row.get::<_,String>(3)?,
            "fecha": row.get::<_,String>(4)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn get_stop_words(state: State<AppState>, idioma: String) -> Result<Vec<String>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT palabra FROM stop_words WHERE idioma=?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![idioma], |row| row.get::<_,String>(0)).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ── Delete commands ──

#[tauri::command]
fn delete_documento(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM documentos WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn delete_codigo(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM codigos WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn delete_cita(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM citas WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn delete_memo(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM memos WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn delete_red(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM redes_guardadas WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

// ── Citations ──

#[tauri::command]
fn get_citas(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT ci.id, ci.documento_id, ci.texto_seleccionado, ci.posicion_inicio, ci.posicion_fin, ci.pagina, d.nombre as doc_nombre
         FROM citas ci JOIN documentos d ON ci.documento_id=d.id WHERE d.proyecto_id=?1 ORDER BY ci.id"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "documento_id": row.get::<_,String>(1)?,
            "texto": row.get::<_,String>(2)?, "inicio": row.get::<_,i64>(3)?,
            "fin": row.get::<_,i64>(4)?, "pagina": row.get::<_,i64>(5)?,
            "doc": row.get::<_,String>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn update_cita_limites(state: State<AppState>, id: String, inicio: i64, fin: i64, pagina: i64) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE citas SET posicion_inicio=?2, posicion_fin=?3, pagina=?4 WHERE id=?1",
        params![id, inicio, fin, pagina],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

// ── Transcription ──

#[tauri::command]
fn save_transcripcion(state: State<AppState>, id: String, documento_id: String, proyecto_id: String, contenido_html: String, idioma: String, hablantes_json: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO transcripciones (id, documento_id, proyecto_id, contenido_html, idioma, hablantes_json, fecha_creacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, documento_id, proyecto_id, contenido_html, idioma, hablantes_json, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_transcripcion(state: State<AppState>, documento_id: String) -> Result<serde_json::Value, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, contenido_html, idioma, hablantes_json, fecha_creacion FROM transcripciones WHERE documento_id=?1",
        params![documento_id],
        |row| Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "contenido": row.get::<_,String>(1)?,
            "idioma": row.get::<_,String>(2)?, "hablantes": row.get::<_,String>(3)?,
            "fecha": row.get::<_,String>(4)?,
        }))
    ).map_err(|e| e.to_string())
}

// ── Audio markers ──

#[tauri::command]
fn save_marcador_audio(state: State<AppState>, id: String, documento_id: String, proyecto_id: String, tiempo_inicio: f64, tiempo_fin: Option<f64>, etiqueta: Option<String>, categoria_id: Option<String>, comentario: Option<String>, investigador_id: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO marcadores_audio (id, documento_id, proyecto_id, tiempo_inicio, tiempo_fin, etiqueta, categoria_id, comentario, investigador_id, fecha) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![id, documento_id, proyecto_id, tiempo_inicio, tiempo_fin, etiqueta, categoria_id, comentario, investigador_id, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_marcadores_audio(state: State<AppState>, documento_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, tiempo_inicio, tiempo_fin, etiqueta, categoria_id, comentario FROM marcadores_audio WHERE documento_id=?1 ORDER BY tiempo_inicio"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![documento_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "tiempo_inicio": row.get::<_,f64>(1)?,
            "tiempo_fin": row.get::<_,Option<f64>>(2)?, "etiqueta": row.get::<_,Option<String>>(3)?,
            "categoria_id": row.get::<_,Option<String>>(4)?, "comentario": row.get::<_,Option<String>>(5)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

// ── Position memory ──

#[tauri::command]
fn save_posicion_documento(state: State<AppState>, documento_id: String, proyecto_id: String, pagina: i64, scroll_y: f64, zoom: f64) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO posicion_documentos (documento_id, proyecto_id, pagina, scroll_y, zoom) VALUES (?1,?2,?3,?4,?5)",
        params![documento_id, proyecto_id, pagina, scroll_y, zoom],
    ).map_err(|e| e.to_string())?;
    Ok(documento_id)
}

#[tauri::command]
fn get_posicion_documento(state: State<AppState>, documento_id: String, proyecto_id: String) -> Result<serde_json::Value, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT pagina, scroll_y, zoom FROM posicion_documentos WHERE documento_id=?1 AND proyecto_id=?2",
        params![documento_id, proyecto_id],
        |row| Ok(serde_json::json!({"pagina": row.get::<_,i64>(0)?, "scroll_y": row.get::<_,f64>(1)?, "zoom": row.get::<_,f64>(2)?}))
    ).map_err(|e| e.to_string())
}

// ── Hyperlinks between segments ──

#[tauri::command]
fn save_vinculo(state: State<AppState>, id: String, proyecto_id: String, cita_origen_id: String, cita_destino_id: String, etiqueta: Option<String>, investigador_id: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO vinculos_hipermedia (id, proyecto_id, cita_origen_id, cita_destino_id, etiqueta, investigador_id, fecha) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, proyecto_id, cita_origen_id, cita_destino_id, etiqueta, investigador_id, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_vinculos(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT v.id, v.cita_origen_id, v.cita_destino_id, v.etiqueta, v.investigador_id, v.fecha,
                co.texto_seleccionado as texto_origen, cd.texto_seleccionado as texto_destino
         FROM vinculos_hipermedia v
         JOIN citas co ON v.cita_origen_id=co.id
         JOIN citas cd ON v.cita_destino_id=cd.id
         WHERE v.proyecto_id=?1 ORDER BY v.fecha DESC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "origen_id": row.get::<_,String>(1)?,
            "destino_id": row.get::<_,String>(2)?, "etiqueta": row.get::<_,Option<String>>(3)?,
            "investigador_id": row.get::<_,Option<String>>(4)?, "fecha": row.get::<_,String>(5)?,
            "texto_origen": row.get::<_,String>(6)?, "texto_destino": row.get::<_,String>(7)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn delete_vinculo(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM vinculos_hipermedia WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

// ── GIS markers ──

#[tauri::command]
fn save_marcador_gis(state: State<AppState>, id: Option<i64>, documento_geo_id: String, proyecto_id: String, tipo: String, nombre: Option<String>, descripcion: Option<String>, categoria_gis: Option<String>, coordenadas_json: String, color_hex: Option<String>, investigador_id: Option<String>) -> Result<i64, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    if let Some(existing_id) = id {
        conn.execute(
            "UPDATE marcadores_gis SET tipo=?2, nombre=?3, descripcion=?4, categoria_gis=?5, coordenadas_json=?6, color_hex=?7 WHERE id=?1",
            params![existing_id, tipo, nombre, descripcion, categoria_gis, coordenadas_json, color_hex],
        ).map_err(|e| e.to_string())?;
        Ok(existing_id)
    } else {
        conn.execute(
            "INSERT INTO marcadores_gis (documento_geo_id, proyecto_id, tipo, nombre, descripcion, categoria_gis, coordenadas_json, color_hex, investigador_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![documento_geo_id, proyecto_id, tipo, nombre, descripcion, categoria_gis, coordenadas_json, color_hex, investigador_id],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }
}

#[tauri::command]
fn get_marcadores_gis(state: State<AppState>, documento_geo_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, tipo, nombre, descripcion, categoria_gis, coordenadas_json, color_hex FROM marcadores_gis WHERE documento_geo_id=?1 ORDER BY id"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![documento_geo_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,i64>(0)?, "tipo": row.get::<_,String>(1)?,
            "nombre": row.get::<_,Option<String>>(2)?, "descripcion": row.get::<_,Option<String>>(3)?,
            "categoria": row.get::<_,Option<String>>(4)?, "coordenadas": row.get::<_,String>(5)?,
            "color": row.get::<_,Option<String>>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn delete_marcador_gis(state: State<AppState>, id: i64) -> Result<i64, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM marcadores_gis WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

// ── GIS categories ──

#[tauri::command]
fn save_categoria_gis(state: State<AppState>, id: String, proyecto_id: String, nombre: String, color_hex: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO categorias_gis (id, proyecto_id, nombre, color_hex) VALUES (?1,?2,?3,?4)",
        params![id, proyecto_id, nombre, color_hex],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_categorias_gis(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, nombre, color_hex FROM categorias_gis WHERE proyecto_id=?1 ORDER BY nombre"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "nombre": row.get::<_,String>(1)?,
            "color": row.get::<_,Option<String>>(2)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

// ── Network: get by id ──

#[tauri::command]
fn get_red_por_id(state: State<AppState>, id: String) -> Result<RedGuardada, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, proyecto_id, nombre, datos_json, miniatura_svg, fecha FROM redes_guardadas WHERE id=?1",
        params![id],
        |row| Ok(RedGuardada {
            id: row.get(0)?, proyecto_id: row.get(1)?, nombre: row.get(2)?,
            datos_json: row.get(3)?, miniatura_svg: row.get(4)?, fecha: row.get(5)?,
        })
    ).map_err(|e| e.to_string())
}

// ── Variables ──

#[tauri::command]
fn save_variable(state: State<AppState>, id: String, proyecto_id: String, nombre: String, tipo_dato: String, descripcion: Option<String>, unidad: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO variables_documento (id, proyecto_id, nombre, tipo_dato, descripcion, unidad) VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, proyecto_id, nombre, tipo_dato, descripcion, unidad],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_variables(state: State<AppState>, proyecto_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, nombre, tipo_dato, descripcion, unidad FROM variables_documento WHERE proyecto_id=?1 ORDER BY nombre"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "nombre": row.get::<_,String>(1)?,
            "tipo": row.get::<_,String>(2)?, "descripcion": row.get::<_,Option<String>>(3)?,
            "unidad": row.get::<_,Option<String>>(4)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

#[tauri::command]
fn save_valor_variable(state: State<AppState>, id: String, variable_id: String, documento_id: String, valor_texto: Option<String>, valor_numero: Option<f64>, valor_fecha: Option<String>, valor_booleano: Option<bool>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO valores_variables (id, variable_id, documento_id, valor_texto, valor_numero, valor_fecha, valor_booleano) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, variable_id, documento_id, valor_texto, valor_numero, valor_fecha, valor_booleano],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_valores_variables(state: State<AppState>, variable_id: String) -> Result<QueryResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT vv.id, vv.documento_id, vv.valor_texto, vv.valor_numero, vv.valor_fecha, vv.valor_booleano, d.nombre as doc_nombre
         FROM valores_variables vv JOIN documentos d ON vv.documento_id=d.id WHERE vv.variable_id=?1 ORDER BY d.nombre"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<serde_json::Value> = stmt.query_map(params![variable_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "documento_id": row.get::<_,String>(1)?,
            "valor_texto": row.get::<_,Option<String>>(2)?, "valor_numero": row.get::<_,Option<f64>>(3)?,
            "valor_fecha": row.get::<_,Option<String>>(4)?, "valor_booleano": row.get::<_,Option<bool>>(5)?,
            "doc": row.get::<_,String>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    let count = rows.len();
    Ok(QueryResult { rows, count })
}

// ── Save network with nodes and edges ──

#[tauri::command]
fn save_nodo_red(state: State<AppState>, id: String, red_id: String, tipo: String, entidad_id: Option<String>, etiqueta: String, x: f64, y: f64, color_hex: String, tamano: f64, forma: String, estilo_json: Option<String>, comentario: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO nodos_red (id, red_id, tipo, entidad_id, etiqueta, x, y, color_hex, tamano, forma, estilo_json, comentario) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![id, red_id, tipo, entidad_id, etiqueta, x, y, color_hex, tamano, forma, estilo_json, comentario],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn save_arista_red(state: State<AppState>, id: String, red_id: String, origen_id: String, destino_id: String, tipo_relacion_id: Option<String>, etiqueta: Option<String>, color_hex: String, grosor: f64, estilo: String, direccion: String, curvatura: f64, comentario: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO aristas_red (id, red_id, origen_id, destino_id, tipo_relacion_id, etiqueta, color_hex, grosor, estilo, direccion, curvatura, comentario) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![id, red_id, origen_id, destino_id, tipo_relacion_id, etiqueta, color_hex, grosor, estilo, direccion, curvatura, comentario],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MapaConceptual {
    pub id: String,
    pub proyecto_id: String,
    pub nombre: String,
    pub tipo_mapa: String,
    pub datos_json: String,
    pub capas_json: Option<String>,
    pub fecha: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Instantanea {
    pub id: String,
    pub proyecto_id: String,
    pub nombre: String,
    pub descripcion: Option<String>,
    pub datos_json: String,
    pub fecha: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SesionColaboracion {
    pub id: String,
    pub proyecto_id: String,
    pub host_investigador_id: String,
    pub codigo_sala: String,
    pub fecha_inicio: String,
    pub fecha_fin: Option<String>,
    pub activa: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContribucionInvestigador {
    pub investigador_id: String,
    pub nombre: String,
    pub color_presencia_hex: Option<String>,
    pub segmentos: i64,
    pub memos: i64,
    pub categorias: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MergeResult {
    pub nuevos: i64,
    pub actualizados: i64,
    pub eliminados: i64,
    pub conflictos: Vec<String>,
}

// ── Concept maps ──

#[tauri::command]
fn save_mapa_conceptual(state: State<AppState>, id: String, proyecto_id: String, nombre: String, tipo_mapa: String, datos_json: String, capas_json: Option<String>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO mapas_conceptuales (id, proyecto_id, nombre, tipo_mapa, datos_json, capas_json, fecha) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![id, proyecto_id, nombre, tipo_mapa, datos_json, capas_json, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_mapas_conceptuales(state: State<AppState>, proyecto_id: String) -> Result<Vec<MapaConceptual>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, proyecto_id, nombre, tipo_mapa, datos_json, capas_json, fecha FROM mapas_conceptuales WHERE proyecto_id=?1 ORDER BY fecha DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(MapaConceptual {
            id: row.get(0)?, proyecto_id: row.get(1)?, nombre: row.get(2)?,
            tipo_mapa: row.get(3)?, datos_json: row.get(4)?, capas_json: row.get(5)?, fecha: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn delete_mapa_conceptual(state: State<AppState>, id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM mapas_conceptuales WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(id)
}

// ── Transcription (stub for whisper.cpp integration) ──

#[tauri::command]
fn transcribe_audio(state: State<AppState>, _ruta_archivo: String, _idioma: String, _opciones_json: String) -> Result<String, String> {
    // Stub: returns empty string. Real implementation would use whisper.cpp.
    // To enable: place whisper-base.bin in resources/whisper/ and compile with whisper-rs.
    Ok(String::new())
}

// ── Section 10: Snapshots ──

#[tauri::command]
fn save_instantanea(state: State<AppState>, id: String, proyecto_id: String, nombre: String, descripcion: Option<String>, datos_json: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO instantaneas (id, proyecto_id, nombre, descripcion, datos_json, fecha) VALUES (?1,?2,?3,?4,?5,?6)",
        params![id, proyecto_id, nombre, descripcion, datos_json, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn get_instantaneas(state: State<AppState>, proyecto_id: String) -> Result<Vec<Instantanea>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, proyecto_id, nombre, descripcion, datos_json, fecha FROM instantaneas WHERE proyecto_id=?1 ORDER BY fecha DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(Instantanea {
            id: row.get(0)?, proyecto_id: row.get(1)?, nombre: row.get(2)?,
            descripcion: row.get(3)?, datos_json: row.get(4)?, fecha: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn restore_instantanea(state: State<AppState>, id: String, proyecto_id: String) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    // Get the snapshot data
    let datos: String = conn.query_row(
        "SELECT datos_json FROM instantaneas WHERE id=?1 AND proyecto_id=?2",
        params![id, proyecto_id],
        |row| row.get(0),
    ).map_err(|e| format!("Snapshot not found: {}", e))?;
    // Parse and restore
    let state_data: serde_json::Value = serde_json::from_str(&datos).map_err(|e| e.to_string())?;
    // For each table present in the snapshot, delete existing and insert
    if let Some(docs) = state_data.get("documentos").and_then(|v| v.as_array()) {
        conn.execute("DELETE FROM documentos WHERE proyecto_id=?1", params![proyecto_id]).map_err(|e| e.to_string())?;
        for doc in docs {
            conn.execute(
                "INSERT OR REPLACE INTO documentos (id, proyecto_id, nombre, tipo, ruta_archivo, fecha_importacion, tamanio_bytes) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    doc.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                    proyecto_id,
                    doc.get("nombre").and_then(|v| v.as_str()).unwrap_or(""),
                    doc.get("tipo").and_then(|v| v.as_str()).unwrap_or("txt"),
                    doc.get("ruta_archivo").and_then(|v| v.as_str()).unwrap_or(""),
                    doc.get("fecha_importacion").and_then(|v| v.as_str()).unwrap_or(&chrono_now()),
                    doc.get("tamanio_bytes").and_then(|v| v.as_i64()).unwrap_or(0),
                ],
            ).map_err(|e| e.to_string())?;
        }
    }
    if let Some(cods) = state_data.get("codigos").and_then(|v| v.as_array()) {
        conn.execute("DELETE FROM codigos WHERE proyecto_id=?1", params![proyecto_id]).map_err(|e| e.to_string())?;
        for c in cods {
            conn.execute(
                "INSERT OR REPLACE INTO codigos (id, proyecto_id, nombre, color_hex, descripcion, codigo_padre_id, fecha_creacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    c.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                    proyecto_id,
                    c.get("nombre").and_then(|v| v.as_str()).unwrap_or(""),
                    c.get("color_hex").and_then(|v| v.as_str()).unwrap_or("#F1D7FF"),
                    c.get("descripcion").and_then(|v| v.as_str()).unwrap_or(""),
                    c.get("codigo_padre_id").and_then(|v| v.as_str()),
                    &chrono_now(),
                ],
            ).map_err(|e| e.to_string())?;
        }
    }
    if let Some(citas) = state_data.get("citas").and_then(|v| v.as_array()) {
        conn.execute("DELETE FROM citas WHERE documento_id IN (SELECT id FROM documentos WHERE proyecto_id=?1)", params![proyecto_id]).map_err(|e| e.to_string())?;
        for ci in citas {
            conn.execute(
                "INSERT OR REPLACE INTO citas (id, documento_id, texto_seleccionado, posicion_inicio, posicion_fin, pagina, fecha_creacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    ci.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                    ci.get("documento_id").and_then(|v| v.as_str()).unwrap_or(""),
                    ci.get("texto_seleccionado").and_then(|v| v.as_str()).unwrap_or(""),
                    ci.get("posicion_inicio").and_then(|v| v.as_i64()).unwrap_or(0),
                    ci.get("posicion_fin").and_then(|v| v.as_i64()).unwrap_or(0),
                    ci.get("pagina").and_then(|v| v.as_i64()).unwrap_or(1),
                    &chrono_now(),
                ],
            ).map_err(|e| e.to_string())?;
        }
    }
    if let Some(ccs) = state_data.get("citas_codigos").and_then(|v| v.as_array()) {
        conn.execute("DELETE FROM citas_codigos WHERE cita_id IN (SELECT id FROM citas WHERE documento_id IN (SELECT id FROM documentos WHERE proyecto_id=?1))", params![proyecto_id]).map_err(|e| e.to_string())?;
        for cc in ccs {
            conn.execute(
                "INSERT OR REPLACE INTO citas_codigos (id, cita_id, codigo_id, peso_codificacion, fecha) VALUES (?1,?2,?3,?4,?5)",
                params![
                    cc.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                    cc.get("cita_id").and_then(|v| v.as_str()).unwrap_or(""),
                    cc.get("codigo_id").and_then(|v| v.as_str()).unwrap_or(""),
                    cc.get("peso_codificacion").and_then(|v| v.as_i64()).unwrap_or(50),
                    &chrono_now(),
                ],
            ).map_err(|e| e.to_string())?;
        }
    }
    if let Some(memos) = state_data.get("memos").and_then(|v| v.as_array()) {
        conn.execute("DELETE FROM memos WHERE proyecto_id=?1", params![proyecto_id]).map_err(|e| e.to_string())?;
        for m in memos {
            conn.execute(
                "INSERT OR REPLACE INTO memos (id, proyecto_id, titulo, contenido_html, tipo_memo, fecha_creacion, fecha_modificacion) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                    proyecto_id,
                    m.get("titulo").and_then(|v| v.as_str()).unwrap_or(""),
                    m.get("contenido_html").and_then(|v| v.as_str()).unwrap_or(""),
                    m.get("tipo_memo").and_then(|v| v.as_str()).unwrap_or("general"),
                    &chrono_now(),
                    &chrono_now(),
                ],
            ).map_err(|e| e.to_string())?;
        }
    }
    if let Some(redes) = state_data.get("redes_guardadas").and_then(|v| v.as_array()) {
        conn.execute("DELETE FROM redes_guardadas WHERE proyecto_id=?1", params![proyecto_id]).map_err(|e| e.to_string())?;
        for r in redes {
            conn.execute(
                "INSERT OR REPLACE INTO redes_guardadas (id, proyecto_id, nombre, datos_json, miniatura_svg, fecha) VALUES (?1,?2,?3,?4,?5,?6)",
                params![
                    r.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                    proyecto_id,
                    r.get("nombre").and_then(|v| v.as_str()).unwrap_or(""),
                    r.get("datos_json").and_then(|v| v.as_str()).unwrap_or("{}"),
                    r.get("miniatura_svg").and_then(|v| v.as_str()),
                    &chrono_now(),
                ],
            ).map_err(|e| e.to_string())?;
        }
    }
    Ok(true)
}

#[tauri::command]
fn delete_instantanea(state: State<AppState>, id: String) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM instantaneas WHERE id=?1", params![id]).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn export_project_state(state: State<AppState>, proyecto_id: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut export = serde_json::Map::new();

    // Documentos
    let mut stmt = conn.prepare("SELECT id, proyecto_id, nombre, tipo, ruta_archivo, fecha_importacion, tamanio_bytes FROM documentos WHERE proyecto_id=?1").map_err(|e| e.to_string())?;
    let docs: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "proyecto_id": row.get::<_,String>(1)?, "nombre": row.get::<_,String>(2)?,
            "tipo": row.get::<_,String>(3)?, "ruta_archivo": row.get::<_,Option<String>>(4)?,
            "fecha_importacion": row.get::<_,String>(5)?, "tamanio_bytes": row.get::<_,i64>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("documentos".to_string(), serde_json::Value::Array(docs));

    // Codigos
    let mut stmt = conn.prepare("SELECT id, proyecto_id, nombre, color_hex, descripcion, codigo_padre_id, fecha_creacion FROM codigos WHERE proyecto_id=?1").map_err(|e| e.to_string())?;
    let cods: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "proyecto_id": row.get::<_,String>(1)?, "nombre": row.get::<_,String>(2)?,
            "color_hex": row.get::<_,String>(3)?, "descripcion": row.get::<_,Option<String>>(4)?,
            "codigo_padre_id": row.get::<_,Option<String>>(5)?, "fecha_creacion": row.get::<_,String>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("codigos".to_string(), serde_json::Value::Array(cods));

    // Citas
    let mut stmt = conn.prepare("SELECT c.id, c.documento_id, c.texto_seleccionado, c.posicion_inicio, c.posicion_fin, c.pagina, c.fecha_creacion FROM citas c JOIN documentos d ON c.documento_id=d.id WHERE d.proyecto_id=?1").map_err(|e| e.to_string())?;
    let citas: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "documento_id": row.get::<_,String>(1)?,
            "texto_seleccionado": row.get::<_,String>(2)?, "posicion_inicio": row.get::<_,i64>(3)?,
            "posicion_fin": row.get::<_,i64>(4)?, "pagina": row.get::<_,i64>(5)?, "fecha_creacion": row.get::<_,String>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("citas".to_string(), serde_json::Value::Array(citas));

    // Citas_codigos
    let mut stmt = conn.prepare("SELECT cc.id, cc.cita_id, cc.codigo_id, cc.peso_codificacion, cc.fecha FROM citas_codigos cc JOIN citas c ON cc.cita_id=c.id JOIN documentos d ON c.documento_id=d.id WHERE d.proyecto_id=?1").map_err(|e| e.to_string())?;
    let ccs: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "cita_id": row.get::<_,String>(1)?, "codigo_id": row.get::<_,String>(2)?,
            "peso_codificacion": row.get::<_,i64>(3)?, "fecha": row.get::<_,String>(4)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("citas_codigos".to_string(), serde_json::Value::Array(ccs));

    // Memos
    let mut stmt = conn.prepare("SELECT id, proyecto_id, titulo, contenido_html, tipo_memo, fecha_creacion, fecha_modificacion FROM memos WHERE proyecto_id=?1").map_err(|e| e.to_string())?;
    let memos: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "proyecto_id": row.get::<_,String>(1)?, "titulo": row.get::<_,String>(2)?,
            "contenido_html": row.get::<_,String>(3)?, "tipo_memo": row.get::<_,String>(4)?,
            "fecha_creacion": row.get::<_,String>(5)?, "fecha_modificacion": row.get::<_,String>(6)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("memos".to_string(), serde_json::Value::Array(memos));

    // Redes
    let mut stmt = conn.prepare("SELECT id, proyecto_id, nombre, datos_json, miniatura_svg, fecha FROM redes_guardadas WHERE proyecto_id=?1").map_err(|e| e.to_string())?;
    let redes: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "nombre": row.get::<_,String>(2)?,
            "datos_json": row.get::<_,String>(3)?, "miniatura_svg": row.get::<_,Option<String>>(4)?, "fecha": row.get::<_,String>(5)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("redes_guardadas".to_string(), serde_json::Value::Array(redes));

    // Variables
    let mut stmt = conn.prepare("SELECT id, nombre, tipo_dato, descripcion, unidad FROM variables_documento WHERE proyecto_id=?1").map_err(|e| e.to_string())?;
    let vars: Vec<serde_json::Value> = stmt.query_map(params![proyecto_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_,String>(0)?, "nombre": row.get::<_,String>(1)?, "tipo_dato": row.get::<_,String>(2)?,
            "descripcion": row.get::<_,Option<String>>(3)?, "unidad": row.get::<_,Option<String>>(4)?,
        }))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    export.insert("variables".to_string(), serde_json::Value::Array(vars));

    Ok(serde_json::to_string(&export).map_err(|e| e.to_string())?)
}

// ── Section 10: Project protection ──

#[tauri::command]
fn protect_project(state: State<AppState>, proyecto_id: String, hash_clave: String) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE proyectos SET bloqueado_con_clave=1, hash_clave=?2 WHERE id=?1",
        params![proyecto_id, hash_clave],
    ).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn verify_project_password(state: State<AppState>, proyecto_id: String, hash: String) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let stored: String = conn.query_row(
        "SELECT COALESCE(hash_clave,'') FROM proyectos WHERE id=?1",
        params![proyecto_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(stored == hash)
}

#[tauri::command]
fn is_project_protected(state: State<AppState>, proyecto_id: String) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let locked: bool = conn.query_row(
        "SELECT COALESCE(bloqueado_con_clave,0) FROM proyectos WHERE id=?1",
        params![proyecto_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(locked)
}

// ── Section 11: Collaboration sessions ──

#[tauri::command]
fn save_sesion_colaboracion(state: State<AppState>, id: String, proyecto_id: String, host_id: String, codigo_sala: String) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "INSERT OR REPLACE INTO sesiones_colaboracion (id, proyecto_id, host_investigador_id, codigo_sala, fecha_inicio, activa) VALUES (?1,?2,?3,?4,?5,1)",
        params![id, proyecto_id, host_id, codigo_sala, now],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
fn close_sesion_colaboracion(state: State<AppState>, id: String) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono_now();
    conn.execute(
        "UPDATE sesiones_colaboracion SET fecha_fin=?2, activa=0 WHERE id=?1",
        params![id, now],
    ).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn get_historial_sesiones(state: State<AppState>, proyecto_id: String) -> Result<Vec<SesionColaboracion>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, proyecto_id, host_investigador_id, codigo_sala, fecha_inicio, fecha_fin, activa FROM sesiones_colaboracion WHERE proyecto_id=?1 ORDER BY fecha_inicio DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(SesionColaboracion {
            id: row.get(0)?, proyecto_id: row.get(1)?, host_investigador_id: row.get(2)?,
            codigo_sala: row.get(3)?, fecha_inicio: row.get(4)?, fecha_fin: row.get(5)?,
            activa: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_contribuciones_investigadores(state: State<AppState>, proyecto_id: String) -> Result<Vec<ContribucionInvestigador>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT i.id, i.nombre, i.color_presencia_hex,
                COUNT(DISTINCT cc.id) as segmentos,
                COUNT(DISTINCT m.id) as memos,
                COUNT(DISTINCT c.id) as categorias
         FROM investigadores i
         LEFT JOIN citas_codigos cc ON cc.investigador_id=i.id
         LEFT JOIN memos m ON m.investigador_id=i.id
         LEFT JOIN codigos c ON c.proyecto_id=?1
         WHERE i.activo=1
         GROUP BY i.id
         ORDER BY segmentos DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![proyecto_id], |row| {
        Ok(ContribucionInvestigador {
            investigador_id: row.get(0)?, nombre: row.get(1)?, color_presencia_hex: row.get(2)?,
            segmentos: row.get(3)?, memos: row.get(4)?, categorias: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn merge_external_project(state: State<AppState>, proyecto_id: String, datos_json_externo: String) -> Result<MergeResult, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let external: serde_json::Value = serde_json::from_str(&datos_json_externo).map_err(|e| e.to_string())?;
    let mut nuevos: i64 = 0;
    let mut actualizados: i64 = 0;
    let mut eliminados: i64 = 0;
    let mut conflictos: Vec<String> = vec![];

    if let Some(docs) = external.get("documentos").and_then(|v| v.as_array()) {
        for doc in docs {
            let doc_id = doc.get("id").and_then(|v| v.as_str()).unwrap_or("");
            let exists: bool = conn.query_row(
                "SELECT COUNT(*) > 0 FROM documentos WHERE id=?1", params![doc_id], |row| row.get(0)
            ).unwrap_or(false);
            if exists {
                conflictos.push(format!("Documento {} ya existe — actualizado", doc.get("nombre").and_then(|v| v.as_str()).unwrap_or("")));
                actualizados += 1;
            } else {
                nuevos += 1;
            }
            conn.execute(
                "INSERT OR REPLACE INTO documentos (id, proyecto_id, nombre, tipo, ruta_archivo, fecha_importacion, tamanio_bytes) VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![doc_id, proyecto_id, doc.get("nombre").and_then(|v| v.as_str()).unwrap_or(""), doc.get("tipo").and_then(|v| v.as_str()).unwrap_or("txt"), doc.get("ruta_archivo").and_then(|v| v.as_str()).unwrap_or(""), doc.get("fecha_importacion").and_then(|v| v.as_str()).unwrap_or(&chrono_now()), doc.get("tamanio_bytes").and_then(|v| v.as_i64()).unwrap_or(0)],
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(MergeResult { nuevos, actualizados, eliminados, conflictos })
}

// ── Section 10: Add hash_clave column if missing ──

#[tauri::command]
fn ensure_schema_columns(_state: State<AppState>) -> Result<bool, String> {
    let conn = _state.db.conn.lock().map_err(|e| e.to_string())?;
    // Add hash_clave if not exists
    conn.execute("ALTER TABLE proyectos ADD COLUMN hash_clave TEXT DEFAULT ''", []).ok();
    // Add contenido_html if not exists (needed for web importers)
    conn.execute("ALTER TABLE documentos ADD COLUMN contenido_html TEXT DEFAULT ''", []).ok();
    Ok(true)
}

// ── Language persistence ──

#[tauri::command]
fn update_investigador_lang(
    state: State<AppState>,
    investigador_id: String,
    lang: String,
) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE investigadores SET idioma_preferido=?1 WHERE id=?2",
        rusqlite::params![lang, investigador_id],
    ).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn get_investigador_lang(
    state: State<AppState>,
    investigador_id: String,
) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let lang: String = conn.query_row(
        "SELECT COALESCE(idioma_preferido,'es') FROM investigadores WHERE id=?1",
        rusqlite::params![investigador_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    Ok(lang)
}

fn chrono_now() -> String {
    // Simple ISO date without chrono dependency
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap();
    let secs = now.as_secs();
    let days_since_epoch = secs / 86400;
    let mut y = 1970i64;
    let mut d = days_since_epoch as i64;
    loop {
        let days_in_year = if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 { 366 } else { 365 };
        if d < days_in_year { break; }
        d -= days_in_year; y += 1;
    }
    let months = [31,28,31,30,31,30,31,31,30,31,30,31];
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let mut m = 0;
    for (i, days) in months.iter().enumerate() {
        let md = if i == 1 && leap { 29 } else { *days };
        if d < md { m = i + 1; break; }
        d -= md;
    }
    let day = d + 1;
    let remaining = secs % 86400;
    let h = remaining / 3600;
    let min = (remaining % 3600) / 60;
    let s = remaining % 60;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}", y, m, day, h, min, s)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_dir = get_app_dir();
    let database = Database::new(&app_dir).expect("Failed to open database");
    database.init_schema().expect("Failed to initialize schema");

    // Auto-migrate schema for existing databases
    {
        let conn = database.conn.lock().expect("Failed to lock db for migration");
        conn.execute("ALTER TABLE proyectos ADD COLUMN hash_clave TEXT DEFAULT ''", []).ok();
        conn.execute("ALTER TABLE documentos ADD COLUMN contenido_html TEXT DEFAULT ''", []).ok();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { db: database })
        .invoke_handler(tauri::generate_handler![
            create_proyecto,
            get_codigos,
            get_distribution,
            save_red,
            get_redes,
            exec_query,
            save_codigo,
            save_documento,
            save_documento_web,
            get_documento_content,
            save_cita,
            get_documentos,
            get_citas_por_codigo,
            get_cooccurrences,
            save_memo,
            get_memos,
            get_stop_words,
            delete_documento,
            delete_codigo,
            delete_cita,
            delete_memo,
            delete_red,
            get_citas,
            update_cita_limites,
            save_transcripcion,
            get_transcripcion,
            save_marcador_audio,
            get_marcadores_audio,
            save_posicion_documento,
            get_posicion_documento,
            save_vinculo,
            get_vinculos,
            delete_vinculo,
            save_marcador_gis,
            get_marcadores_gis,
            delete_marcador_gis,
            save_categoria_gis,
            get_categorias_gis,
            get_red_por_id,
            save_variable,
            get_variables,
            save_valor_variable,
            get_valores_variables,
            save_nodo_red,
            save_arista_red,
            save_mapa_conceptual,
            get_mapas_conceptuales,
            delete_mapa_conceptual,
            transcribe_audio,
            save_instantanea,
            get_instantaneas,
            restore_instantanea,
            delete_instantanea,
            export_project_state,
            protect_project,
            verify_project_password,
            is_project_protected,
            save_sesion_colaboracion,
            close_sesion_colaboracion,
            get_historial_sesiones,
            get_contribuciones_investigadores,
            merge_external_project,
            ensure_schema_columns,
            update_investigador_lang,
            get_investigador_lang,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
