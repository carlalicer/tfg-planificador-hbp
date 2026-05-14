import json
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)

from db import (
    init_db,
    init_slots_table,
    init_users_table,
    init_programacions_table,
    ping_db,
    count_cirugias,
    list_all_cirugias,
    add_cirugia,
    update_cirugia,
    delete_cirugia,
    list_slots_quirurgicos,
    add_slot_quirurgico,
    update_slot_quirurgico,
    delete_slot_quirurgico,
    get_user_by_username,
    create_user,
    guardar_programacion_definitiva,
    get_programacion_definitiva,
    update_cirujanos_programacion,
    marcar_cirugias_finalizadas_pendientes_validacion,
    validar_cirurgia_com_realitzada,
    retornar_cirurgia_a_pendents,
    netejar_programacions_no_actives,
    list_users,
    delete_user,
    update_user_password,
)

from planner import (
    generar_proposta_reprogramacio,
    detectar_canvis,
    detectar_conflictes_fixades,
)

from schemas import (
    CirugiaCreate,
    CirugiaUpdate,
    LoginRequest,
    SlotCreate,
    SlotUpdate,
    UserCreateRequest,
    UserPasswordUpdateRequest,
)

load_dotenv()

app = FastAPI(title="Planner Quirúrgic HBP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------

def normalizar_jsonb(valor):
    if valor is None:
        return []

    if isinstance(valor, list):
        return valor

    if isinstance(valor, str):
        try:
            parsed = json.loads(valor)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    return []


def ensure_default_admin():
    username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
    password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin1234")

    existing_user = get_user_by_username(username)

    if existing_user:
        return

    create_user(
        username=username,
        hashed_password=hash_password(password),
        role="admin",
    )


# ------------------------------------------------------------
# STARTUP
# ------------------------------------------------------------

@app.on_event("startup")
def startup():

    init_db()
    init_slots_table()
    init_users_table()
    init_programacions_table()

    ensure_default_admin()


# ------------------------------------------------------------
# ROOT
# ------------------------------------------------------------

@app.get("/")
def root():
    return {"mensaje": "API funcionant 🚀"}


@app.get("/health")
def health():
    return {
        "db": "ok",
        "now": ping_db(),
        "total_cirugias": count_cirugias(),
    }


# ------------------------------------------------------------
# AUTH
# ------------------------------------------------------------

@app.post("/auth/login")
def login(data: LoginRequest):

    user = get_user_by_username(data.username)

    if not user or not verify_password(
        data.password,
        user["hashed_password"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Usuari o contrasenya incorrectes",
        )

    token = create_access_token(
        {
            "sub": user["username"],
            "role": user["role"],
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    }


@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "role": current_user["role"],
    }

# ------------------------------------------------------------
# ADMIN USERS
# ------------------------------------------------------------

@app.get("/users")
def get_users_admin(
    current_user: dict = Depends(require_admin),
):
    return list_users()


@app.post("/users")
def create_user_admin(
    data: UserCreateRequest,
    current_user: dict = Depends(require_admin),
):
    username = data.username.strip()
    password = data.password.strip()
    role = data.role.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="El nom d'usuari és obligatori.",
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="La contrasenya ha de tenir almenys 6 caràcters.",
        )

    if role not in ["admin", "user"]:
        raise HTTPException(
            status_code=400,
            detail="El rol ha de ser admin o user.",
        )

    existing_user = get_user_by_username(username)

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Ja existeix un usuari amb aquest nom.",
        )

    new_id = create_user(
        username=username,
        hashed_password=hash_password(password),
        role=role,
    )

    return {
        "missatge": "Usuari creat correctament",
        "id": new_id,
        "username": username,
        "role": role,
    }


@app.delete("/users/{user_id}")
def delete_user_admin(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=400,
            detail="No pots eliminar el teu propi usuari.",
        )

    ok = delete_user(user_id)

    if not ok:
        raise HTTPException(
            status_code=404,
            detail="No s'ha trobat cap usuari amb aquest id.",
        )

    return {
        "missatge": "Usuari eliminat correctament",
        "id": user_id,
    }


@app.put("/users/{user_id}/password")
def update_password_admin(
    user_id: int,
    data: UserPasswordUpdateRequest,
    current_user: dict = Depends(require_admin),
):
    password = data.password.strip()

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="La nova contrasenya ha de tenir almenys 6 caràcters.",
        )

    ok = update_user_password(
        user_id=user_id,
        hashed_password=hash_password(password),
    )

    if not ok:
        raise HTTPException(
            status_code=404,
            detail="No s'ha trobat cap usuari amb aquest id.",
        )

    return {
        "missatge": "Contrasenya actualitzada correctament",
        "id": user_id,
    }
# ------------------------------------------------------------
# CIRUGIES
# ------------------------------------------------------------

@app.get("/cirugias")
def get_cirugias(current_user: dict = Depends(get_current_user)):
    
    marcar_cirugias_finalizadas_pendientes_validacion()
    
    rows = list_all_cirugias()

    return [
        {
            "id": r[0],
            "created_at": r[1],
            "data_solicitud_operacio": r[2],
            "user_id": r[3],
            "codigo": r[4],
            "tipo_cirugia": r[5],
            "duracion_min": r[6],
            "requiere_robot": r[7],
            "maligno": r[8],
            "estat_cas": r[9],
            "area_neoplasia": r[10],
            "tipus_neoplasia": r[11],
            "tipo_operacion_principal": r[12],
            "detalle_operacion": r[13],
            "fecha_fin_neo": r[14],
            "bilirrubina": r[15],
            "prioridad_puntos": r[16],
            "fijada": r[17],
            "fecha_fijada": r[18],
            "hora_inicio_fija": r[19],
            "comentarios": r[20],
            "realizada_validada": r[21],
            "dia_curs": r[22],
            "fecha_dia_curs": r[23],
            "slot_id": r[24],
        }
        for r in rows
    ]


@app.post("/cirugias")
def create_cirugia(
    data: CirugiaCreate,
    current_user: dict = Depends(get_current_user),

):
    try:

        payload = data.model_dump()

        payload["user_id"] = current_user["username"]

        new_id = add_cirugia(payload)

        return {
            "mensaje": "Cirurgia creada",
            "id": new_id,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/cirugias/{cirurgia_id}")
def edit_cirugia(
    cirurgia_id: int,
    data: CirugiaUpdate,
    current_user: dict = Depends(require_admin),
):
    try:

        actualitzada = update_cirugia(cirurgia_id, data.model_dump())

        if not actualitzada:
            raise HTTPException(
                status_code=404,
                detail="No s'ha trobat cap cirurgia amb aquest id.",
            )

        return {
            "mensaje": "Cirurgia actualitzada correctament",
            "id": cirurgia_id,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/cirugias/{cirurgia_id}")
def remove_cirugia(
    cirurgia_id: int,
    current_user: dict = Depends(require_admin),
):
    try:

        delete_cirugia(cirurgia_id)

        return {
            "mensaje": "Cirurgia eliminada",
            "id": cirurgia_id,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cirugias/{cirurgia_id}/validar-realitzada")
def validar_realitzada(
    cirurgia_id: int,
    current_user: dict = Depends(get_current_user),
):
    ok = validar_cirurgia_com_realitzada(cirurgia_id)

    if not ok:
        raise HTTPException(
            status_code=404,
            detail="No s'ha trobat cap cirurgia amb aquest id.",
        )

    return {
        "missatge": "Cirurgia validada com a realitzada",
        "id": cirurgia_id,
    }


@app.post("/cirugias/{cirurgia_id}/retornar-pendents")
def retornar_a_pendents(
    cirurgia_id: int,
    current_user: dict = Depends(get_current_user),
):
    ok = retornar_cirurgia_a_pendents(cirurgia_id)

    if not ok:
        raise HTTPException(
            status_code=404,
            detail="No s'ha trobat cap cirurgia amb aquest id.",
        )

    return {
        "missatge": "Cirurgia retornada a pendents",
        "id": cirurgia_id,
    }

# ------------------------------------------------------------
# SLOTS
# ------------------------------------------------------------

@app.get("/slots")
def get_slots(current_user: dict = Depends(get_current_user)):

    rows = list_slots_quirurgicos()

    return [
        {
            "id": r[0],
            "fecha": r[1],
            "quirofano": r[2],
            "franja": r[3],
            "hora_inicio": r[4],
            "hora_fin": r[5],
            "tipo_cirugia": normalizar_jsonb(r[6]),
            "cirujanos_disponibles": normalizar_jsonb(r[7]),
            "created_at": r[8],
            "tipus_registre": r[9],
            "comentari": r[10],
            "slot_de_curs": r[11],
            "cirurgia_benigna": r[12],
        }
        for r in rows
    ]


@app.post("/slots")
def create_slot(
    data: SlotCreate,
    current_user: dict = Depends(require_admin),
):
    try:

        new_id = add_slot_quirurgico(data.model_dump())

        return {
            "mensaje": "Slot creat",
            "id": new_id,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/slots/{slot_id}")
def edit_slot(
    slot_id: int,
    data: SlotUpdate,
    current_user: dict = Depends(require_admin),
):
    try:

        update_slot_quirurgico(slot_id, data.model_dump())

        return {
            "mensaje": "Slot actualitzat",
            "id": slot_id,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/slots/{slot_id}")
def remove_slot(
    slot_id: int,
    current_user: dict = Depends(require_admin),
):
    try:

        delete_slot_quirurgico(slot_id)

        return {
            "mensaje": "Slot eliminat",
            "id": slot_id,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------------
# PLANNER ACTUAL DEFINITIU
# ------------------------------------------------------------

@app.get("/planner/actual")
def planner_actual(
    current_user: dict = Depends(get_current_user),
):
    netejar_programacions_no_actives()
    marcar_cirugias_finalizadas_pendientes_validacion()
    programacio = get_programacion_definitiva()

    cirugias = get_cirugias(current_user)
    slots = get_slots(current_user)

    resultat = []

    for cirurgia_id, slot_id, fecha, cirujanos_asignados in programacio:

        cirurgia = next(
            (c for c in cirugias if c["id"] == cirurgia_id),
            None,
        )

        slot = next(
            (s for s in slots if s["id"] == slot_id),
            None,
        )

        if cirurgia and slot:

            resultat.append({
                "cirurgia": cirurgia,
                "slot": slot,
                "fixada": bool(cirurgia.get("fijada")),
                "cirujanos_asignados": normalizar_jsonb(cirujanos_asignados),
            })

    return resultat


# ------------------------------------------------------------
# ACTUALITZAR CIRURGIANS ASSIGNATS
# ------------------------------------------------------------

@app.put("/planner/cirujanos/{cirurgia_id}")
def actualizar_cirujanos_programacion(
    cirurgia_id: int,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    try:

        cirujanos = payload.get("cirujanos_asignados", [])

        if not isinstance(cirujanos, list):
            raise HTTPException(
                status_code=400,
                detail="cirujanos_asignados ha de ser una llista.",
            )

        update_cirujanos_programacion(
            cirurgia_id=cirurgia_id,
            cirujanos=cirujanos,
        )

        return {
            "mensaje": "Cirurgians assignats actualitzats",
            "cirurgia_id": cirurgia_id,
            "cirujanos_asignados": cirujanos,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------------
# PROPOSTA REPROGRAMACIÓ
# ------------------------------------------------------------

@app.get("/planner/proposta")
def planner_proposta(
    current_user: dict = Depends(require_admin),
):
    netejar_programacions_no_actives()
    cirugias = get_cirugias(current_user)
    slots = get_slots(current_user)

    actual = planner_actual(current_user)

    cirujanos_actuales_por_cirurgia = {
        assignacio["cirurgia"]["id"]: assignacio.get("cirujanos_asignados", [])
        for assignacio in actual
    }

    conflictes_fixades = detectar_conflictes_fixades(cirugias, slots)

    proposta = generar_proposta_reprogramacio(
        cirugias,
        slots,
    )

    for assignacio in proposta:
        cirurgia_id = assignacio["cirurgia"]["id"]
        assignacio["cirujanos_asignados"] = cirujanos_actuales_por_cirurgia.get(
            cirurgia_id,
            assignacio.get("cirujanos_asignados", []),
        )

    canvis = detectar_canvis(
        actual,
        proposta,
    )

    return {
    "assignacions": proposta,
    "canvis": canvis,
    "conflictes_fixades": conflictes_fixades,
    "requereix_validacio": len(canvis) > 0 or len(conflictes_fixades) > 0,
}


# ------------------------------------------------------------
# VALIDAR PLANNER
# ------------------------------------------------------------
@app.post("/planner/validar")
def validar_planner(
    current_user: dict = Depends(require_admin),
):
    netejar_programacions_no_actives()
    actual = planner_actual(current_user)

    cirujanos_actuales_por_cirurgia = {
        assignacio["cirurgia"]["id"]: assignacio.get("cirujanos_asignados", [])
        for assignacio in actual
    }

    cirugias = get_cirugias(current_user)
    slots = get_slots(current_user)

    conflictes_fixades = detectar_conflictes_fixades(cirugias, slots)

    if len(conflictes_fixades) > 0:
      raise HTTPException(
        status_code=400,
        detail={
            "missatge": "No es pot validar la planificació perquè hi ha conflictes amb cirurgies fixades manualment.",
            "conflictes_fixades": conflictes_fixades,
        },
    )

    proposta = generar_proposta_reprogramacio(
        cirugias,
        slots,
    )

    for assignacio in proposta:
        cirurgia_id = assignacio["cirurgia"]["id"]
        assignacio["cirujanos_asignados"] = cirujanos_actuales_por_cirurgia.get(
            cirurgia_id,
            assignacio.get("cirujanos_asignados", []),
        )

    if len(proposta) == 0:

        raise HTTPException(
            status_code=400,
            detail="No hi ha assignacions compatibles.",
        )

    guardar_programacion_definitiva(proposta)

    return {
        "missatge": "Planificació validada correctament",
        "total_programades": len(proposta),
    }