from datetime import date, time
from typing import Optional, List

from pydantic import BaseModel, field_validator


# ------------------------------------------------------------
# LOGIN
# ------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


# ------------------------------------------------------------
# CIRURGIES
# ------------------------------------------------------------

class CirugiaBase(BaseModel):

    data_solicitud_operacio: date

    user_id: str = "demo"

    codigo: str

    tipo_cirugia: str = "Oberta"

    duracion_min: int = 300

    requiere_robot: bool = False

    maligno: bool = False

    estat_cas: str = "Pendent"

    area_neoplasia: str = "Fetge"

    tipus_neoplasia: str = "HCC"

    tipo_operacion_principal: Optional[str] = None

    detalle_operacion: Optional[str] = None

    fecha_fin_neo: Optional[date] = None

    bilirrubina: float = 0

    prioridad_puntos: int = 0

    fijada: bool = False

    fecha_fijada: Optional[date] = None

    hora_inicio_fija: Optional[str] = None

    comentarios: Optional[str] = None

    realizada_validada: bool = False

    dia_curs: bool = False

    fecha_dia_curs: Optional[date] = None

    slot_id: Optional[int] = None

    # --------------------------------------------------------
    # VALIDACIONS
    # --------------------------------------------------------

    @field_validator("fecha_fin_neo")
    @classmethod
    def validar_fecha_fin_neo(cls, value):

        if value and value > date.today():

            raise ValueError(
                "La fecha de finalización de neoadyuvancia no puede ser futura."
            )

        return value


class CirugiaCreate(CirugiaBase):
    pass


class CirugiaUpdate(CirugiaBase):
    pass


# ------------------------------------------------------------
# SLOTS QUIRÚRGICS
# ------------------------------------------------------------

class SlotBase(BaseModel):

    fecha: date

    quirofano: Optional[str] = None

    franja: Optional[str] = None

    hora_inicio: Optional[time] = None

    hora_fin: Optional[time] = None

    tipo_cirugia: List[str] = []

    cirujanos_disponibles: List[str] = []

    tipus_registre: str = "Slot quirúrgic"

    comentari: Optional[str] = None

    slot_de_curs: bool = False

    cirurgia_benigna: bool = False


class SlotCreate(SlotBase):
    pass


class SlotUpdate(SlotBase):
    pass

# ------------------------------------------------------------
# CIRURGIANS ASSIGNATS A PROGRAMACIÓ
# ------------------------------------------------------------

class CirujanosAsignadosUpdate(BaseModel):
    cirujanos_asignados: List[str] = []