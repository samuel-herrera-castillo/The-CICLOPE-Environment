use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: &PathBuf) -> SqliteResult<Self> {
        std::fs::create_dir_all(app_dir).ok();
        let db_path = app_dir.join("kdcm.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Database { conn: Mutex::new(conn) })
    }

    pub fn init_schema(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        // Insert default relation types if they don't exist
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM tipos_relacion", [], |r| r.get(0))?;
        if count == 0 {
            conn.execute_batch("
                INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha)
                VALUES ('rt1','default','is cause of','causes','→',1,'#E53935',2,'solid','classic');
                INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha)
                VALUES ('rt2','default','is associated with','associated','↔',0,'#1E88E5',2,'solid','classic');
                INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha)
                VALUES ('rt3','default','contradicts','contr.','≠',1,'#F4511E',2,'dashed','classic');
                INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha)
                VALUES ('rt4','default','is part of','part of','⊂',1,'#43A047',2,'solid','classic');
                INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha)
                VALUES ('rt5','default','is a type of','type of','⊆',1,'#8E24AA',2,'solid','classic');
                INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha)
                VALUES ('rt6','default','relates to','related','~',0,'#6D4C41',1,'dotted','classic');
            ")?;
        }
        Ok(())
    }
}

// Helper to get app data dir
pub fn get_app_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("KDCM")
}
