import os
import psycopg2
import json
from datetime import date


def get_conn():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL no está definida.")

    return psycopg2.connect(database_url)


# ------------------------------------------------------------
# INIT DB
# ------------------------------------------------------------

def init_db():
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
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
                    fecha_dia_curs DATE,
                    slot_id INTEGER
                );
            """)

            cur.execute("""
                ALTER TABLE cirugias
                ADD COLUMN IF NOT EXISTS slot_id INTEGER;
            """)

        conn.commit()

    finally:
        conn.close()


# ------------------------------------------------------------
# PROGRAMACIONS DEFINITIVES
# ------------------------------------------------------------

def init_programacions_table():
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                CREATE TABLE IF NOT EXISTS programacions_quirurgiques (
                    id SERIAL PRIMARY KEY,
                    cirurgia_id INTEGER NOT NULL,
                    slot_id INTEGER NOT NULL,
                    fecha_programada DATE NOT NULL,
                    cirujanos_asignados JSONB NOT NULL DEFAULT '[]'::jsonb,
                    validada BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)

            cur.execute("""
                ALTER TABLE programacions_quirurgiques
                ADD COLUMN IF NOT EXISTS cirujanos_asignados JSONB NOT NULL DEFAULT '[]'::jsonb;
            """)

        conn.commit()

    finally:
        conn.close()


# ------------------------------------------------------------
# CIRURGIES
# ------------------------------------------------------------

def calcular_prioridad(data: dict):
    puntos = 0

    # Tumor
    if data.get("maligno"):
        puntos += 20
    else:
        puntos += 0

    # Origen
    area = data.get("area_neoplasia")
    tipus = data.get("tipus_neoplasia")

    if area == "Fetge":
        puntos += 0
        if tipus in ["HCC", "pCCA", "iCCA"]:
            puntos += 20

    elif area == "Pàncrees":
        puntos += 10
        if tipus in ["dCCA", "ADK"]:
            puntos += 10
        elif tipus in ["M1", "TPMi", "PTNE"]:
            puntos -= 10

    elif area == "Vesícula biliar":
        puntos += 30

    # Bilirrubina
    bilirrubina = float(data.get("bilirrubina") or 0)

    if 5 <= bilirrubina < 10:
        puntos += 10
    elif 10 <= bilirrubina < 15:
        puntos += 20
    elif bilirrubina >= 15:
        puntos += 30

    # Espera de benignes
    if not data.get("maligno"):
        data_solicitud = data.get("data_solicitud_operacio")
        if data_solicitud:
            if isinstance(data_solicitud, str):
                data_solicitud = date.fromisoformat(data_solicitud)

            dies_espera = (date.today() - data_solicitud).days
            blocs_6_setmanes = dies_espera // 42
            puntos += blocs_6_setmanes * 15

    # Neoadjuvància
    fecha_fin_neo = data.get("fecha_fin_neo")
    if fecha_fin_neo:
        if isinstance(fecha_fin_neo, str):
            fecha_fin_neo = date.fromisoformat(fecha_fin_neo)

        dies_des_neo = (date.today() - fecha_fin_neo).days

        # A partir de la setmana 5
        if dies_des_neo >= 35:
            puntos *= 2

    return max(puntos, 0)

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
                    fecha_dia_curs,
                    slot_id
                )
                VALUES (
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    %s,%s,%s
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
                    calcular_prioridad(data),
                    data.get("fijada", False),
                    data.get("fecha_fijada"),
                    data.get("hora_inicio_fija"),
                    data.get("comentarios"),
                    data.get("realizada_validada", False),
                    data.get("dia_curs", False),
                    data.get("fecha_dia_curs"),
                    data.get("slot_id"),
                ),
            )

            new_id = cur.fetchone()[0]

        conn.commit()

        return new_id

    finally:
        conn.close()


def update_cirugia(cirurgia_id: int, data: dict):
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
                RETURNING id;
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
                    calcular_prioridad(data),
                    data.get("fijada", False),
                    data.get("fecha_fijada"),
                    data.get("hora_inicio_fija"),
                    data.get("comentarios"),
                    data.get("realizada_validada", False),
                    data.get("dia_curs", False),
                    data.get("fecha_dia_curs"),
                    cirurgia_id,
                ),
            )

            updated = cur.fetchone()

        conn.commit()

        return updated is not None

    finally:
        conn.close()


def delete_cirugia(cirurgia_id: int):
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute(
                """
                DELETE FROM cirugias
                WHERE id = %s;
                """,
                (cirurgia_id,),
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
                    fecha_dia_curs,
                    slot_id
                FROM cirugias
                ORDER BY prioridad_puntos DESC, data_solicitud_operacio ASC;
                """
            )

            return cur.fetchall()

    finally:
        conn.close()


def validar_cirugia_realizada(cirurgia_id: int):
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
                (cirurgia_id,),
            )

        conn.commit()

    finally:
        conn.close()


# ------------------------------------------------------------
# SLOTS
# ------------------------------------------------------------

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
                    comentari TEXT,
                    slot_de_curs BOOLEAN NOT NULL DEFAULT FALSE,
                    cirurgia_benigna BOOLEAN NOT NULL DEFAULT FALSE
                );
            """)

            cur.execute("""
                ALTER TABLE slots_quirurgicos
                ADD COLUMN IF NOT EXISTS slot_de_curs BOOLEAN NOT NULL DEFAULT FALSE;
            """)

            cur.execute("""
                ALTER TABLE slots_quirurgicos
                ADD COLUMN IF NOT EXISTS cirurgia_benigna BOOLEAN NOT NULL DEFAULT FALSE;
            """)

        conn.commit()


def add_slot_quirurgico(data: dict):
    with get_conn() as conn:

        with conn.cursor() as cur:

            cur.execute("""
                SELECT id
                FROM slots_quirurgicos
                WHERE
                    fecha = %s
                    AND quirofano = %s
                    AND franja = %s
                    AND tipus_registre = 'Slot quirúrgic'
            """, (
                data["fecha"],
                data.get("quirofano"),
                data.get("franja"),
            ))

            existent = cur.fetchone()

            if existent:
                raise Exception("Ja existeix un slot en aquest quiròfan i franja.")

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
                    comentari,
                    slot_de_curs,
                    cirurgia_benigna
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
                data.get("slot_de_curs", False),
                data.get("cirurgia_benigna", False),
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
                    comentari,
                    slot_de_curs,
                    cirurgia_benigna
                FROM slots_quirurgicos
                ORDER BY fecha ASC, hora_inicio ASC NULLS FIRST
            """)

            rows = cur.fetchall()

    return rows


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
                    comentari = %s,
                    slot_de_curs = %s,
                    cirurgia_benigna = %s
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
                data.get("slot_de_curs", False),
                data.get("cirurgia_benigna", False),
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


# ------------------------------------------------------------
# USERS
# ------------------------------------------------------------

def init_users_table():
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'admin',
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)

        conn.commit()

    finally:
        conn.close()


def get_user_by_username(username: str):
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT
                    id,
                    username,
                    hashed_password,
                    role,
                    created_at
                FROM users
                WHERE username = %s;
            """, (username,))

            row = cur.fetchone()

        if not row:
            return None

        return {
            "id": row[0],
            "username": row[1],
            "hashed_password": row[2],
            "role": row[3],
            "created_at": row[4],
        }

    finally:
        conn.close()


def create_user(username: str, hashed_password: str, role: str = "admin"):
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                INSERT INTO users (
                    username,
                    hashed_password,
                    role
                )
                VALUES (%s,%s,%s)
                ON CONFLICT (username) DO NOTHING
                RETURNING id;
            """, (
                username,
                hashed_password,
                role,
            ))

            row = cur.fetchone()

        conn.commit()

        return row[0] if row else None

    finally:
        conn.close()

def list_users():
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, role, created_at
                FROM users
                ORDER BY created_at ASC;
            """)

            rows = cur.fetchall()

        return [
            {
                "id": row[0],
                "username": row[1],
                "role": row[2],
                "created_at": row[3],
            }
            for row in rows
        ]

    finally:
        conn.close()


def delete_user(user_id: int):
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM users
                WHERE id = %s
                RETURNING id;
            """, (user_id,))

            row = cur.fetchone()

        conn.commit()

        return row is not None

    finally:
        conn.close()


def update_user_password(user_id: int, hashed_password: str):
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users
                SET hashed_password = %s
                WHERE id = %s
                RETURNING id;
            """, (hashed_password, user_id))

            row = cur.fetchone()

        conn.commit()

        return row is not None

    finally:
        conn.close()
# ------------------------------------------------------------
# PLANNER DEFINITIU
# ------------------------------------------------------------

def guardar_programacion_definitiva(assignacions: list):
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                DELETE FROM programacions_quirurgiques;
            """)

            ids_programades = []

            for assignacio in assignacions:

                cirurgia = assignacio["cirurgia"]
                slot = assignacio["slot"]

                ids_programades.append(cirurgia["id"])

                cirujanos_asignados = assignacio.get(
                    "cirujanos_asignados",
                    []
                )

                cur.execute("""
                    INSERT INTO programacions_quirurgiques (
                        cirurgia_id,
                        slot_id,
                        fecha_programada,
                        cirujanos_asignados,
                        validada
                    )
                    VALUES (%s,%s,%s,%s,TRUE)
                """, (
                    cirurgia["id"],
                    slot["id"],
                    slot["fecha"],
                    json.dumps(cirujanos_asignados, ensure_ascii=False),
                ))

                cur.execute("""
                    UPDATE cirugias
                    SET
                        estat_cas = 'Programat',
                        fecha_fijada = %s,
                        slot_id = %s
                    WHERE id = %s;
                """, (
                    slot["fecha"],
                    slot["id"],
                    cirurgia["id"],
                ))

            if ids_programades:

                cur.execute("""
                    UPDATE cirugias
                    SET
                        estat_cas = 'Pendent',
                        slot_id = NULL
                    WHERE estat_cas = 'Programat'
                    AND id NOT IN %s;
                """, (tuple(ids_programades),))

        conn.commit()

    finally:
        conn.close()

def netejar_programacions_no_actives():
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM programacions_quirurgiques p
                USING cirugias c
                WHERE p.cirurgia_id = c.id
                AND c.estat_cas IN (
                    'Operat',
                    'Cancel·lat',
                    'Pendent validació'
                );
            """)

        conn.commit()

    finally:
        conn.close()

def get_programacion_definitiva():
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT
                    cirurgia_id,
                    slot_id,
                    fecha_programada,
                    cirujanos_asignados
                FROM programacions_quirurgiques
                WHERE validada = TRUE;
            """)

            return cur.fetchall()

    finally:
        conn.close()


def update_cirujanos_programacion(
    cirurgia_id: int,
    cirujanos: list,
):
    conn = get_conn()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                UPDATE programacions_quirurgiques
                SET cirujanos_asignados = %s
                WHERE cirurgia_id = %s;
            """, (
                json.dumps(cirujanos, ensure_ascii=False),
                cirurgia_id,
            ))

        conn.commit()

    finally:
        conn.close()

def marcar_cirugias_finalizadas_pendientes_validacion():
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE cirugias c
                SET estat_cas = 'Pendent validació'
                FROM programacions_quirurgiques p
                JOIN slots_quirurgicos s ON s.id = p.slot_id
                WHERE
                    c.id = p.cirurgia_id
                    AND c.estat_cas = 'Programat'
                    AND c.realizada_validada = FALSE
                    AND (
                        s.fecha::timestamp + COALESCE(s.hora_fin, '23:59'::time)
                    ) < (NOW() AT TIME ZONE 'Europe/Madrid');
            """)

        conn.commit()

    finally:
        conn.close()


def validar_cirurgia_com_realitzada(cirurgia_id: int):
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE cirugias
                SET
                    estat_cas = 'Operat',
                    realizada_validada = TRUE
                WHERE id = %s
                RETURNING id;
            """, (cirurgia_id,))

            row = cur.fetchone()

        conn.commit()

        return row is not None

    finally:
        conn.close()


def retornar_cirurgia_a_pendents(cirurgia_id: int):
    conn = get_conn()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM programacions_quirurgiques
                WHERE cirurgia_id = %s;
            """, (cirurgia_id,))

            cur.execute("""
                UPDATE cirugias
                SET
                    estat_cas = 'Pendent',
                    realizada_validada = FALSE,
                    slot_id = NULL,
                    fecha_fijada = NULL
                WHERE id = %s
                RETURNING id;
            """, (cirurgia_id,))

            row = cur.fetchone()

        conn.commit()

        return row is not None

    finally:
        conn.close()
        
# ------------------------------------------------------------
# UTILS
# ------------------------------------------------------------

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