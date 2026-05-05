import os
from urllib.parse import urlparse

import psycopg2
import json


def get_conn():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL no está definida.")

    return psycopg2.connect(database_url)

def init_db():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cirugias (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMP DEFAULT NOW(),
                    data_solicitud_operacio DATE NOT NULL DEFAULT CURRENT_DATE,
                    user_id TEXT NOT NULL,
                    codigo TEXT NOT NULL,
                    tipo_cirugia TEXT NOT NULL,
                    duracion_min INTEGER NOT NULL DEFAULT 300,
                    requiere_robot BOOLEAN NOT NULL DEFAULT FALSE,
                    maligno BOOLEAN NOT NULL DEFAULT FALSE,
                    estat_cas TEXT NOT NULL DEFAULT 'Pendent',
                    area_neoplasia TEXT NOT NULL DEFAULT 'Fetge',
                    tipus_neoplasia TEXT NOT NULL DEFAULT 'HCC',
                    tipo_operacion_principal TEXT,
                    detalle_operacion TEXT,
                    fecha_fin_neo DATE,
                    bilirrubina DOUBLE PRECISION NOT NULL DEFAULT 0,
                    prioridad_puntos INTEGER NOT NULL DEFAULT 0,
                    fijada BOOLEAN NOT NULL DEFAULT FALSE,
                    fecha_fijada DATE,
                    hora_inicio_fija TEXT,
                    comentarios TEXT,
                    realizada_validada BOOLEAN NOT NULL DEFAULT FALSE,
                    dia_curs BOOLEAN NOT NULL DEFAULT FALSE,
                    fecha_dia_curs DATE
                );
                """
            )

            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS data_solicitud_operacio DATE NOT NULL DEFAULT CURRENT_DATE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS duracion_min INTEGER NOT NULL DEFAULT 300;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS requiere_robot BOOLEAN NOT NULL DEFAULT FALSE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS maligno BOOLEAN NOT NULL DEFAULT FALSE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS estat_cas TEXT NOT NULL DEFAULT 'Pendent';""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS area_neoplasia TEXT NOT NULL DEFAULT 'Fetge';""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS tipus_neoplasia TEXT NOT NULL DEFAULT 'HCC';""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS tipo_operacion_principal TEXT;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS detalle_operacion TEXT;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS fecha_fin_neo DATE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS bilirrubina DOUBLE PRECISION NOT NULL DEFAULT 0;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS prioridad_puntos INTEGER NOT NULL DEFAULT 0;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS fijada BOOLEAN NOT NULL DEFAULT FALSE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS fecha_fijada DATE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS hora_inicio_fija TEXT;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS comentarios TEXT;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS realizada_validada BOOLEAN NOT NULL DEFAULT FALSE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS dia_curs BOOLEAN NOT NULL DEFAULT FALSE;""")
            cur.execute("""ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS fecha_dia_curs DATE;""")

            cur.execute("""UPDATE cirugias SET data_solicitud_operacio = CURRENT_DATE WHERE data_solicitud_operacio IS NULL;""")
            cur.execute("""UPDATE cirugias SET duracion_min = 300 WHERE duracion_min IS NULL;""")
            cur.execute("""UPDATE cirugias SET requiere_robot = FALSE WHERE requiere_robot IS NULL;""")
            cur.execute("""UPDATE cirugias SET maligno = FALSE WHERE maligno IS NULL;""")
            cur.execute("""UPDATE cirugias SET estat_cas = 'Pendent' WHERE estat_cas IS NULL OR TRIM(estat_cas) = '';""")
            cur.execute("""UPDATE cirugias SET area_neoplasia = 'Fetge' WHERE area_neoplasia IS NULL OR TRIM(area_neoplasia) = '';""")
            cur.execute(
                """
                UPDATE cirugias
                SET tipus_neoplasia = CASE
                    WHEN area_neoplasia = 'Fetge' THEN 'HCC'
                    WHEN area_neoplasia = 'Pàncrees' THEN 'ADK'
                    WHEN area_neoplasia = 'Vesícula biliar' THEN 'Vesícula biliar'
                    ELSE 'altres'
                END
                WHERE tipus_neoplasia IS NULL OR TRIM(tipus_neoplasia) = '';
                """
            )
            cur.execute("""UPDATE cirugias SET bilirrubina = 0 WHERE bilirrubina IS NULL;""")
            cur.execute("""UPDATE cirugias SET prioridad_puntos = 0 WHERE prioridad_puntos IS NULL;""")
            cur.execute("""UPDATE cirugias SET fijada = FALSE WHERE fijada IS NULL;""")
            cur.execute("""UPDATE cirugias SET realizada_validada = FALSE WHERE realizada_validada IS NULL;""")
            cur.execute("""UPDATE cirugias SET dia_curs = FALSE WHERE dia_curs IS NULL;""")

            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS drenaje_biliar;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS origen;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS anemia;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS hay_tumor;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS neoadyuvancia;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS dias_fin_neo;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS tipo_operacion_area;""")
            cur.execute("""ALTER TABLE cirugias DROP COLUMN IF EXISTS quirofano_fijo;""")

        conn.commit()
    finally:
        conn.close()


def add_cirugia(data: dict):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cirugias (
                    data_solicitud_operacio,
                    user_id,
                    codigo,
                    tipo_cirugia,
                    duracion_min,
                    requiere_robot,
                    maligno,
                    estat_cas,
                    area_neoplasia,
                    tipus_neoplasia,
                    tipo_operacion_principal,
                    detalle_operacion,
                    fecha_fin_neo,
                    bilirrubina,
                    prioridad_puntos,
                    fijada,
                    fecha_fijada,
                    hora_inicio_fija,
                    comentarios,
                    realizada_validada,
                    dia_curs,
                    fecha_dia_curs
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id;
                """,
                (
                    data.get("data_solicitud_operacio"),
                    data.get("user_id", "demo"),
                    data.get("codigo", "").strip(),
                    data.get("tipo_cirugia", "Oberta"),
                    data.get("duracion_min", 300),
                    data.get("requiere_robot", False),
                    data.get("maligno", False),
                    data.get("estat_cas", "Pendent"),
                    data.get("area_neoplasia", "Fetge"),
                    data.get("tipus_neoplasia", "HCC"),
                    data.get("tipo_operacion_principal"),
                    data.get("detalle_operacion"),
                    data.get("fecha_fin_neo"),
                    data.get("bilirrubina", 0.0),
                    data.get("prioridad_puntos", 0),
                    data.get("fijada", False),
                    data.get("fecha_fijada"),
                    data.get("hora_inicio_fija"),
                    data.get("comentarios"),
                    data.get("realizada_validada", False),
                    data.get("dia_curs", False),
                    data.get("fecha_dia_curs"),
                ),
            )
            new_id = cur.fetchone()[0]

        conn.commit()
        return new_id
    finally:
        conn.close()


def update_cirugia(cirugia_id: int, data: dict):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE cirugias
                SET
                    codigo = %s,
                    tipo_cirugia = %s,
                    duracion_min = %s,
                    requiere_robot = %s,
                    maligno = %s,
                    estat_cas = %s,
                    area_neoplasia = %s,
                    tipus_neoplasia = %s,
                    tipo_operacion_principal = %s,
                    detalle_operacion = %s,
                    fecha_fin_neo = %s,
                    bilirrubina = %s,
                    prioridad_puntos = %s,
                    fijada = %s,
                    fecha_fijada = %s,
                    hora_inicio_fija = %s,
                    comentarios = %s,
                    realizada_validada = %s,
                    dia_curs = %s,
                    fecha_dia_curs = %s
                WHERE id = %s
                """,
                (
                    data.get("codigo", "").strip(),
                    data.get("tipo_cirugia", "Oberta"),
                    data.get("duracion_min", 300),
                    data.get("requiere_robot", False),
                    data.get("maligno", False),
                    data.get("estat_cas", "Pendent"),
                    data.get("area_neoplasia", "Fetge"),
                    data.get("tipus_neoplasia", "HCC"),
                    data.get("tipo_operacion_principal"),
                    data.get("detalle_operacion"),
                    data.get("fecha_fin_neo"),
                    data.get("bilirrubina", 0.0),
                    data.get("prioridad_puntos", 0),
                    data.get("fijada", False),
                    data.get("fecha_fijada"),
                    data.get("hora_inicio_fija"),
                    data.get("comentarios"),
                    data.get("realizada_validada", False),
                    data.get("dia_curs", False),
                    data.get("fecha_dia_curs"),
                    cirugia_id,
                ),
            )
        conn.commit()
    finally:
        conn.close()


def delete_cirugia(cirugia_id: int):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM cirugias
                WHERE id = %s;
                """,
                (cirugia_id,),
            )
        conn.commit()
    finally:
        conn.close()


def list_all_cirugias():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    created_at,
                    data_solicitud_operacio,
                    user_id,
                    codigo,
                    tipo_cirugia,
                    duracion_min,
                    requiere_robot,
                    maligno,
                    estat_cas,
                    area_neoplasia,
                    tipus_neoplasia,
                    tipo_operacion_principal,
                    detalle_operacion,
                    fecha_fin_neo,
                    bilirrubina,
                    prioridad_puntos,
                    fijada,
                    fecha_fijada,
                    hora_inicio_fija,
                    comentarios,
                    realizada_validada,
                    dia_curs,
                    fecha_dia_curs
                FROM cirugias
                ORDER BY prioridad_puntos DESC, created_at ASC;
                """
            )
            return cur.fetchall()
    finally:
        conn.close()


def validar_cirugia_realizada(cirugia_id: int):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE cirugias
                SET
                    realizada_validada = TRUE,
                    estat_cas = 'Operat'
                WHERE id = %s;
                """,
                (cirugia_id,),
            )
        conn.commit()
    finally:
        conn.close()


def ping_db():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT NOW();")
            return str(cur.fetchone()[0])
    finally:
        conn.close()


def count_cirugias():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM cirugias;")
            return int(cur.fetchone()[0])
    finally:
        conn.close()


def init_slots_table():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS slots_quirurgicos (
                    id SERIAL PRIMARY KEY,
                    fecha DATE NOT NULL,
                    quirofano VARCHAR(50),
                    franja VARCHAR(20),
                    hora_inicio TIME,
                    hora_fin TIME,
                    tipo_cirugia JSONB NOT NULL DEFAULT '[]'::jsonb,
                    cirujanos_disponibles JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW(),
                    tipus_registre VARCHAR(30) NOT NULL DEFAULT 'Slot quirúrgic',
                    comentari TEXT
                );
            """)

            cur.execute("""ALTER TABLE slots_quirurgicos ADD COLUMN IF NOT EXISTS franja VARCHAR(20);""")
            cur.execute("""ALTER TABLE slots_quirurgicos ADD COLUMN IF NOT EXISTS tipo_cirugia JSONB NOT NULL DEFAULT '[]'::jsonb;""")
            cur.execute("""ALTER TABLE slots_quirurgicos ADD COLUMN IF NOT EXISTS tipus_registre VARCHAR(30) NOT NULL DEFAULT 'Slot quirúrgic';""")
            cur.execute("""ALTER TABLE slots_quirurgicos ADD COLUMN IF NOT EXISTS comentari TEXT;""")

            cur.execute("""ALTER TABLE slots_quirurgicos ALTER COLUMN quirofano DROP NOT NULL;""")
            cur.execute("""ALTER TABLE slots_quirurgicos ALTER COLUMN franja DROP NOT NULL;""")
            cur.execute("""ALTER TABLE slots_quirurgicos ALTER COLUMN hora_inicio DROP NOT NULL;""")
            cur.execute("""ALTER TABLE slots_quirurgicos ALTER COLUMN hora_fin DROP NOT NULL;""")

            cur.execute("""UPDATE slots_quirurgicos SET tipus_registre = 'Slot quirúrgic' WHERE tipus_registre IS NULL OR TRIM(tipus_registre) = '';""")
            cur.execute("""UPDATE slots_quirurgicos SET tipo_cirugia = '[]'::jsonb WHERE tipo_cirugia IS NULL;""")
            cur.execute("""UPDATE slots_quirurgicos SET cirujanos_disponibles = '[]'::jsonb WHERE cirujanos_disponibles IS NULL;""")

        conn.commit()


def add_slot_quirurgico(data: dict):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO slots_quirurgicos (
                    fecha,
                    quirofano,
                    franja,
                    hora_inicio,
                    hora_fin,
                    tipo_cirugia,
                    cirujanos_disponibles,
                    tipus_registre,
                    comentari
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                data["fecha"],
                data.get("quirofano"),
                data.get("franja"),
                data.get("hora_inicio"),
                data.get("hora_fin"),
                json.dumps(data.get("tipo_cirugia", []), ensure_ascii=False),
                json.dumps(data.get("cirujanos_disponibles", []), ensure_ascii=False),
                data.get("tipus_registre", "Slot quirúrgic"),
                data.get("comentari"),
            ))
            new_id = cur.fetchone()[0]
        conn.commit()
    return new_id


def list_slots_quirurgicos():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    fecha,
                    quirofano,
                    franja,
                    hora_inicio,
                    hora_fin,
                    tipo_cirugia,
                    cirujanos_disponibles,
                    created_at,
                    tipus_registre,
                    comentari
                FROM slots_quirurgicos
                ORDER BY fecha ASC, hora_inicio ASC NULLS FIRST, quirofano ASC NULLS FIRST
            """)
            rows = cur.fetchall()
    return rows


def get_slot_quirurgico_by_id(slot_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    fecha,
                    quirofano,
                    franja,
                    hora_inicio,
                    hora_fin,
                    tipo_cirugia,
                    cirujanos_disponibles,
                    created_at,
                    tipus_registre,
                    comentari
                FROM slots_quirurgicos
                WHERE id = %s
            """, (slot_id,))
            return cur.fetchone()


def update_slot_quirurgico(slot_id: int, data: dict):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE slots_quirurgicos
                SET
                    fecha = %s,
                    quirofano = %s,
                    franja = %s,
                    hora_inicio = %s,
                    hora_fin = %s,
                    tipo_cirugia = %s,
                    cirujanos_disponibles = %s,
                    tipus_registre = %s,
                    comentari = %s
                WHERE id = %s
            """, (
                data["fecha"],
                data.get("quirofano"),
                data.get("franja"),
                data.get("hora_inicio"),
                data.get("hora_fin"),
                json.dumps(data.get("tipo_cirugia", []), ensure_ascii=False),
                json.dumps(data.get("cirujanos_disponibles", []), ensure_ascii=False),
                data.get("tipus_registre", "Slot quirúrgic"),
                data.get("comentari"),
                slot_id,
            ))
        conn.commit()


def delete_slot_quirurgico(slot_id: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM slots_quirurgicos
                WHERE id = %s
            """, (slot_id,))
        conn.commit()