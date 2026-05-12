from datetime import date, timedelta

# ------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------

def cirurgia_neo_encara_no_programable(cirurgia):
    fecha_fin_neo = cirurgia.get("fecha_fin_neo")

    if not fecha_fin_neo:
        return False

    if isinstance(fecha_fin_neo, str):
        fecha_fin_neo = date.fromisoformat(fecha_fin_neo)

    data_minima = fecha_fin_neo + timedelta(weeks=4)

    return date.today() < data_minima

def slot_respecta_neoadjuvancia(slot, cirurgia):
    fecha_fin_neo = cirurgia.get("fecha_fin_neo")

    if not fecha_fin_neo:
        return True

    if isinstance(fecha_fin_neo, str):
        fecha_fin_neo = date.fromisoformat(fecha_fin_neo)

    fecha_slot = slot.get("fecha")

    if isinstance(fecha_slot, str):
        fecha_slot = date.fromisoformat(fecha_slot)

    data_minima = fecha_fin_neo + timedelta(weeks=4)

    return fecha_slot >= data_minima

def normalitza(text):

    return (
        str(text or "")
        .lower()
        .replace("ò", "o")
        .replace("à", "a")
        .replace("è", "e")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ï", "i")
    )


def es_dia_curs(slot):

    return slot.get("tipus_registre") == "Dia de curs"


def get_data_fixada(cirurgia):

    return (
        cirurgia.get("fecha_dia_curs")
        or cirurgia.get("fecha_fijada")
    )


# ------------------------------------------------------------
# COMPATIBILITAT
# ------------------------------------------------------------

def es_slot_compatible(slot, cirurgia):

    if slot.get("cirurgia_benigna"):
        return False

    if es_dia_curs(slot):
        return False

    cirurgia_es_de_curs = bool(cirurgia.get("dia_curs"))
    slot_es_de_curs = bool(slot.get("slot_de_curs"))
    cirurgia_fixada_manual = bool(cirurgia.get("fijada")) and not cirurgia_es_de_curs

    if cirurgia_es_de_curs and not slot_es_de_curs:
        return False

    if slot_es_de_curs and not cirurgia_es_de_curs:
        data_fixada = get_data_fixada(cirurgia)

        if not cirurgia_fixada_manual:
            return False

        if str(slot.get("fecha")) != str(data_fixada):
            return False

    tipus_slot = [
        normalitza(t)
        for t in slot.get("tipo_cirugia", [])
    ]

    quirofano = str(slot.get("quirofano") or "")
    tipus_cirurgia = normalitza(
        cirurgia.get("tipo_cirugia")
    )

    if tipus_cirurgia == "robotica":
        return (
            quirofano in ["2.1", "2.2"]
            or "robotica" in tipus_slot
        )

    if tipus_cirurgia == "oberta":
        return "oberta" in tipus_slot

    if tipus_cirurgia == "laparoscopica":
        return "laparoscopica" in tipus_slot

    return True
 
    


# ------------------------------------------------------------
# ORDENACIÓ
# ------------------------------------------------------------

def ordenar_cirugias(cirugias):
    def dies_espera(c):
        data = c.get("data_solicitud_operacio") or c.get("created_at") or ""
        return str(data)

    return sorted(
        cirugias,
        key=lambda c: (
            -(int(c.get("prioridad_puntos") or 0)),
            dies_espera(c),
            int(c.get("id") or 0),
        ),
    )

def ordenar_slots(slots):

    avui = date.today().isoformat()

    return sorted(
        [
            s
            for s in slots
            if not es_dia_curs(s)
            and str(s.get("fecha") or "") >= avui
        ],
        key=lambda s: (
            str(s.get("fecha") or ""),
            str(s.get("hora_inicio") or ""),
        ),
    )


# ------------------------------------------------------------
# REPROGRAMACIÓ
# ------------------------------------------------------------
def detectar_conflictes_fixades(cirugias, slots):
    conflictes = []

    slots_disponibles = ordenar_slots(slots)

    cirurgies_planificables = [
        c for c in cirugias
        if c.get("estat_cas") not in ["Operat", "Cancel·lat", "Pendent validació"]
    ]

    cirurgies_fixades = [
        c for c in cirurgies_planificables
        if (c.get("fijada") or c.get("dia_curs")) and get_data_fixada(c)
    ]

    dates_fixades = {}

    for cirurgia in ordenar_cirugias(cirurgies_fixades):
        data_fixada = str(get_data_fixada(cirurgia))
        dates_fixades.setdefault(data_fixada, []).append(cirurgia)

    for data_fixada, cirurgies_dia in dates_fixades.items():
        slots_dia = [
            slot for slot in slots_disponibles
            if str(slot.get("fecha")) == data_fixada
        ]

        slots_usats = set()
        cirurgies_no_assignades = []

        for cirurgia in ordenar_cirugias(cirurgies_dia):
            slot_assignable = next(
                (
                    slot
                    for slot in slots_dia
                    if slot["id"] not in slots_usats
                    and es_slot_compatible(slot, cirurgia)
                ),
                None,
            )

            if slot_assignable:
                slots_usats.add(slot_assignable["id"])
            else:
                cirurgies_no_assignades.append(cirurgia)

        if cirurgies_no_assignades:
            conflictes.append({
                "tipus": "competencia_slot_fixat",
                "data": data_fixada,
                "cirurgies": cirurgies_dia,
                "cirurgies_no_assignades": cirurgies_no_assignades,
                "missatge": "Hi ha més cirurgies fixades que slots compatibles disponibles.",
            })

    return conflictes

def generar_proposta_reprogramacio(
    cirugias,
    slots,
):

    slots_disponibles = ordenar_slots(slots)

    slots_usats = set()
    cirurgies_usades = set()

    assignacions = []

    cirurgies_planificables = ordenar_cirugias([
    c for c in cirugias
    if c.get("estat_cas") in ["Pendent", "Programat"]
])


    # --------------------------------------------------------
    # PRIORITAT 1:
    # FIXADES MANUALMENT / DIA CURS
    # --------------------------------------------------------

    cirurgies_fixades = [

        c for c in cirurgies_planificables

        if (
            (
                c.get("fijada")
                or c.get("dia_curs")
            )
            and get_data_fixada(c)
        )
    ]

    for cirurgia in cirurgies_fixades:

        data_fixada = get_data_fixada(cirurgia)

        slot_compatible = next(

            (
                slot

                for slot in slots_disponibles

                if (
                    slot["id"] not in slots_usats
                    and str(slot.get("fecha")) == str(data_fixada)
                    and es_slot_compatible(slot, cirurgia)
and slot_respecta_neoadjuvancia(slot, cirurgia)
                )
            ),

            None,
        )

        if slot_compatible:

            assignacions.append({

                "cirurgia": cirurgia,
                "slot": slot_compatible,
                "fixada": True,
                "cirujanos_asignados": [],

            })

            slots_usats.add(slot_compatible["id"])
            cirurgies_usades.add(cirurgia["id"])

    # --------------------------------------------------------
    # PRIORITAT 2:
    # RESTA DE CIRURGIES
    # --------------------------------------------------------

    for cirurgia in cirurgies_planificables:

        if cirurgia["id"] in cirurgies_usades:
            continue

        if (
            cirurgia.get("fijada")
            or cirurgia.get("dia_curs")
        ):
            continue

        slot_compatible = next(

            (
                slot

                for slot in slots_disponibles

                if (
                    slot["id"] not in slots_usats
                    and es_slot_compatible(slot, cirurgia)
and slot_respecta_neoadjuvancia(slot, cirurgia)
                )
            ),

            None,
        )

        if slot_compatible:

            assignacions.append({

                "cirurgia": cirurgia,
                "slot": slot_compatible,
                "fixada": False,
                "cirujanos_asignados": [],

            })

            slots_usats.add(slot_compatible["id"])
            cirurgies_usades.add(cirurgia["id"])

    return assignacions


# ------------------------------------------------------------
# DETECTAR CANVIS
# ------------------------------------------------------------

def detectar_canvis(
    actual,
    proposta,
):

    canvis = []

    actual_per_cirurgia = {
        a["cirurgia"]["id"]: a
        for a in actual
    }

    proposta_per_cirurgia = {
        a["cirurgia"]["id"]: a
        for a in proposta
    }

    ids_actuals = set(actual_per_cirurgia.keys())
    ids_proposta = set(proposta_per_cirurgia.keys())

    # --------------------------------------------------------
    # CIRURGIES QUE ES MANTENEN O ES MOUEN
    # --------------------------------------------------------

    for cirurgia_id in ids_actuals.intersection(ids_proposta):

        assignacio_actual = actual_per_cirurgia[cirurgia_id]
        assignacio_proposta = proposta_per_cirurgia[cirurgia_id]

        slot_actual_id = assignacio_actual["slot"]["id"]
        slot_proposta_id = assignacio_proposta["slot"]["id"]

        if slot_actual_id == slot_proposta_id:

            canvis.append({
                "tipus": "igual",
                "cirurgia": assignacio_proposta["cirurgia"],
                "slot_actual": assignacio_actual["slot"],
                "slot_nou": assignacio_proposta["slot"],
            })

        else:

            canvis.append({
                "tipus": "moguda",
                "cirurgia": assignacio_proposta["cirurgia"],
                "slot_actual": assignacio_actual["slot"],
                "slot_nou": assignacio_proposta["slot"],
            })

    # --------------------------------------------------------
    # CIRURGIES NOVES PROGRAMADES
    # --------------------------------------------------------

    for cirurgia_id in ids_proposta - ids_actuals:

        assignacio_proposta = proposta_per_cirurgia[cirurgia_id]

        canvis.append({
            "tipus": "nova",
            "cirurgia": assignacio_proposta["cirurgia"],
            "slot_actual": None,
            "slot_nou": assignacio_proposta["slot"],
        })

    # --------------------------------------------------------
    # CIRURGIES QUE SURTEN DEL PLANNER I TORNEN A PENDENTS
    # --------------------------------------------------------

    for cirurgia_id in ids_actuals - ids_proposta:

        assignacio_actual = actual_per_cirurgia[cirurgia_id]

        canvis.append({
            "tipus": "pendent",
            "cirurgia": assignacio_actual["cirurgia"],
            "slot_actual": assignacio_actual["slot"],
            "slot_nou": None,
        })

    return canvis