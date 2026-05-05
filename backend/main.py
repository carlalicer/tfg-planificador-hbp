from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

from db import (
    init_db,
    init_slots_table,
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
)
from schemas import CirugiaCreate, CirugiaUpdate, SlotCreate, SlotUpdate

load_dotenv()

app = FastAPI(title="Planner Quirúrgico HBP")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 🔹 INICIALIZACIÓN
@app.on_event("startup")
def startup():
    init_db()
    init_slots_table()


# 🔹 ROOT
@app.get("/")
def root():
    return {"mensaje": "API funcionando 🚀"}


# 🔹 HEALTH CHECK
@app.get("/health")
def health():
    return {
        "db": "ok",
        "now": ping_db(),
        "total_cirugias": count_cirugias(),
    }


# 🔹 CIRUGÍAS

@app.get("/cirugias")
def get_cirugias():
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
        }
        for r in rows
    ]

@app.post("/cirugias")
def create_cirugia(data: CirugiaCreate):
    try:
        new_id = add_cirugia(data.model_dump())
        return {"mensaje": "Cirugía creada", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/cirugias/{cirugia_id}")
def edit_cirugia(cirugia_id: int, data: CirugiaUpdate):
    try:
        update_cirugia(cirugia_id, data.model_dump())
        return {"mensaje": "Cirugía actualizada", "id": cirugia_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/cirugias/{cirugia_id}")
def remove_cirugia(cirugia_id: int):
    try:
        delete_cirugia(cirugia_id)
        return {"mensaje": "Cirugía eliminada", "id": cirugia_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 🔹 SLOTS QUIRÚRGICOS

@app.get("/slots")
def get_slots():
    rows = list_slots_quirurgicos()

    return [
        {
            "id": r[0],
            "fecha": r[1],
            "quirofano": r[2],
            "franja": r[3],
            "hora_inicio": r[4],
            "hora_fin": r[5],
            "tipo_cirugia": r[6],
            "cirujanos_disponibles": r[7],
            "created_at": r[8],
            "tipus_registre": r[9],
            "comentari": r[10],
        }
        for r in rows
    ]


@app.post("/slots")
def create_slot(data: SlotCreate):
    try:
        new_id = add_slot_quirurgico(data.model_dump())
        return {"mensaje": "Slot creado", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/slots/{slot_id}")
def edit_slot(slot_id: int, data: SlotUpdate):
    try:
        update_slot_quirurgico(slot_id, data.model_dump())
        return {"mensaje": "Slot actualizado", "id": slot_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/slots/{slot_id}")
def remove_slot(slot_id: int):
    try:
        delete_slot_quirurgico(slot_id)
        return {"mensaje": "Slot eliminado", "id": slot_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))