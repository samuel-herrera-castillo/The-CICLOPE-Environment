-- KDCM Schema v8.0
CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT DEFAULT '',
  fecha_creacion TEXT NOT NULL, fecha_modificacion TEXT NOT NULL,
  version_esquema INTEGER DEFAULT 1, bloqueado_con_clave BOOLEAN DEFAULT 0
);
CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  tipo TEXT NOT NULL, ruta_archivo TEXT, fecha_importacion TEXT NOT NULL,
  tamanio_bytes INTEGER DEFAULT 0, color_etiqueta TEXT, orden INTEGER DEFAULT 0,
  grupo_id TEXT, es_pagina_web BOOLEAN DEFAULT 0, url_origen TEXT,
  contenido_html TEXT DEFAULT '', metadatos_json TEXT, documento_padre_id TEXT, carpeta_id TEXT
);
CREATE TABLE IF NOT EXISTS codigos (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '', color_hex TEXT NOT NULL, codigo_padre_id TEXT,
  orden INTEGER DEFAULT 0, regla_codificacion TEXT, cita_ejemplo TEXT,
  es_nodo_libre BOOLEAN DEFAULT 0, es_inteligente BOOLEAN DEFAULT 0,
  es_in_vivo BOOLEAN DEFAULT 0, regla_inteligente_json TEXT,
  fecha_creacion TEXT NOT NULL, carpeta_id TEXT
);
CREATE TABLE IF NOT EXISTS citas (
  id TEXT PRIMARY KEY, documento_id TEXT NOT NULL, investigador_id TEXT,
  tipo_cita TEXT DEFAULT 'texto', texto_seleccionado TEXT NOT NULL,
  posicion_inicio INTEGER NOT NULL, posicion_fin INTEGER NOT NULL,
  pagina INTEGER DEFAULT 1, timestamp_inicio REAL, timestamp_fin REAL,
  coordenadas_imagen_json TEXT, coordenadas_geo_json TEXT, nombre_cita TEXT,
  peso_relevancia INTEGER DEFAULT 50, fecha_creacion TEXT NOT NULL, comentario TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS citas_codigos (
  id TEXT PRIMARY KEY, cita_id TEXT NOT NULL, codigo_id TEXT NOT NULL,
  investigador_id TEXT, peso_codificacion INTEGER DEFAULT 50, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, titulo TEXT NOT NULL,
  contenido_html TEXT DEFAULT '', tipo_memo TEXT DEFAULT 'general',
  entidad_tipo TEXT, entidad_id TEXT, investigador_id TEXT,
  fecha_creacion TEXT NOT NULL, fecha_modificacion TEXT NOT NULL,
  carpeta_id TEXT, etiquetas_json TEXT, es_favorito BOOLEAN DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tipos_relacion (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  nombre_corto TEXT, simbolo TEXT, dirigida BOOLEAN DEFAULT 1,
  color_hex TEXT, grosor INTEGER DEFAULT 2, estilo_linea TEXT DEFAULT 'solid',
  punta_flecha TEXT DEFAULT 'classic'
);
CREATE TABLE IF NOT EXISTS relaciones_codigos (
  id TEXT PRIMARY KEY, codigo_origen_id TEXT NOT NULL, codigo_destino_id TEXT NOT NULL,
  tipo_relacion_id TEXT, investigador_id TEXT, fecha TEXT NOT NULL,
  direccion TEXT DEFAULT 'unidirectional', etiqueta_custom TEXT,
  estilo_json TEXT, comentario TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS investigadores (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT,
  color_presencia_hex TEXT, rol TEXT DEFAULT 'investigador',
  activo BOOLEAN DEFAULT 1, fecha_registro TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS variables_documento (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  tipo_dato TEXT NOT NULL, descripcion TEXT, unidad TEXT
);
CREATE TABLE IF NOT EXISTS valores_variables (
  id TEXT PRIMARY KEY, variable_id TEXT NOT NULL, documento_id TEXT NOT NULL,
  valor_texto TEXT, valor_numero REAL, valor_fecha TEXT, valor_booleano INTEGER
);
CREATE TABLE IF NOT EXISTS stop_words (
  id TEXT PRIMARY KEY, palabra TEXT NOT NULL, idioma TEXT NOT NULL DEFAULT 'es'
);
CREATE TABLE IF NOT EXISTS redes_guardadas (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  datos_json TEXT NOT NULL, miniatura_svg TEXT, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mapas_conceptuales (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  tipo_mapa TEXT DEFAULT 'blank', datos_json TEXT NOT NULL, capas_json TEXT, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS colecciones (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  descripcion TEXT, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coleccion_items (
  id TEXT PRIMARY KEY, coleccion_id TEXT NOT NULL, entidad_tipo TEXT NOT NULL,
  entidad_id TEXT NOT NULL, fecha_agregado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS grupos_semanticos (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, dimension TEXT NOT NULL,
  valor TEXT NOT NULL, color_hex TEXT
);
CREATE TABLE IF NOT EXISTS grupos_semanticos_docs (
  grupo_id TEXT NOT NULL, documento_id TEXT NOT NULL,
  PRIMARY KEY (grupo_id, documento_id)
);
CREATE TABLE IF NOT EXISTS sesiones_colaboracion (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, host_investigador_id TEXT,
  codigo_sala TEXT NOT NULL, fecha_inicio TEXT NOT NULL, fecha_fin TEXT, activa BOOLEAN DEFAULT 1
);
CREATE TABLE IF NOT EXISTS historial_cambios (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, investigador_id TEXT,
  tipo_accion TEXT NOT NULL, entidad_tipo TEXT NOT NULL, entidad_id TEXT NOT NULL,
  datos_antes_json TEXT, datos_despues_json TEXT, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS instantaneas (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL,
  descripcion TEXT, datos_json TEXT NOT NULL, fecha TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_proj ON documentos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_cod_proj ON codigos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_citas_doc ON citas(documento_id);
CREATE INDEX IF NOT EXISTS idx_cc_cita ON citas_codigos(cita_id);
CREATE INDEX IF NOT EXISTS idx_cc_cod ON citas_codigos(codigo_id);
CREATE INDEX IF NOT EXISTS idx_memos_proj ON memos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_redes_proj ON redes_guardadas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_trel_proj ON tipos_relacion(proyecto_id);
CREATE TABLE IF NOT EXISTS posicion_documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, documento_id TEXT NOT NULL,
  proyecto_id TEXT NOT NULL, pagina INTEGER DEFAULT 1, scroll_y REAL DEFAULT 0,
  zoom REAL DEFAULT 1.0, timestamp_apertura TEXT,
  UNIQUE(documento_id, proyecto_id)
);
CREATE TABLE IF NOT EXISTS transcripciones (
  id TEXT PRIMARY KEY, documento_id TEXT NOT NULL, proyecto_id TEXT NOT NULL,
  contenido_html TEXT DEFAULT '', idioma TEXT DEFAULT 'es',
  hablantes_json TEXT, fecha_creacion TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS marcadores_audio (
  id TEXT PRIMARY KEY, documento_id TEXT NOT NULL, proyecto_id TEXT NOT NULL,
  tiempo_inicio REAL NOT NULL, tiempo_fin REAL, etiqueta TEXT,
  categoria_id TEXT, comentario TEXT, investigador_id TEXT, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vinculos_hipermedia (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, cita_origen_id TEXT NOT NULL,
  cita_destino_id TEXT NOT NULL, etiqueta TEXT, investigador_id TEXT, fecha TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS marcadores_gis (
  id INTEGER PRIMARY KEY AUTOINCREMENT, documento_geo_id TEXT NOT NULL,
  proyecto_id TEXT NOT NULL, tipo TEXT NOT NULL, nombre TEXT, descripcion TEXT,
  categoria_gis TEXT, coordenadas_json TEXT NOT NULL, color_hex TEXT DEFAULT '#F1D7FF',
  investigador_id TEXT, fecha TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categorias_gis (
  id TEXT PRIMARY KEY, proyecto_id TEXT NOT NULL, nombre TEXT NOT NULL, color_hex TEXT
);
CREATE TABLE IF NOT EXISTS nodos_red (
  id TEXT PRIMARY KEY, red_id TEXT NOT NULL, tipo TEXT DEFAULT 'text',
  entidad_id TEXT, etiqueta TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
  color_hex TEXT DEFAULT '#F1D7FF', tamano REAL DEFAULT 24, forma TEXT DEFAULT 'rounded',
  estilo_json TEXT, comentario TEXT
);
CREATE TABLE IF NOT EXISTS aristas_red (
  id TEXT PRIMARY KEY, red_id TEXT NOT NULL, origen_id TEXT NOT NULL,
  destino_id TEXT NOT NULL, tipo_relacion_id TEXT, etiqueta TEXT,
  color_hex TEXT DEFAULT '#F1D7FF', grosor REAL DEFAULT 1, estilo TEXT DEFAULT 'solid',
  direccion TEXT DEFAULT 'undirected', curvatura REAL DEFAULT 0, comentario TEXT
);
