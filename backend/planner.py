from datetime import date


def normalitza(text):
    return str(text or "").lower().replace("ò", "o").replace("à", "a").replace("è", "e").replace("é", "e").replace("í", "i").replace("ï", "i")


def es_dia_curs(slot):
    return slot.get("tipus_registre") == "Dia de curs"


def es_slot_compatible(slot, cirurgia):
    if es_dia_curs(slot):
        return False

    tipus_slot = [normalitza(t) for t in slot.get("tipo_cirugia", [])]
    quirofano = slot.get("quirofano") or ""
    tipus_cirurgia = normalitza(cirurgia.get("tipo_cirugia"))

    if tipus_cirurgia == "robotica":
        return quirofano in ["2.1", "2.2"] or "robotica" in tipus_slot

    if tipus_cirurgia == "oberta":
        return "oberta" in tipus_slot

    if tipus_cirurgia == "laparoscopica":
        return "laparoscopica" in tipus_slot

    return True


def ordenar_cirugias(cirugias):
    return sorted(
        cirugias,
        key=lambda c: (
            -(c.get("prioridad_puntos") or 0),
            str(c.get("data_solicitud_operacio") or ""),
        ),
    )


def ordenar_slots(slots):
    avui = date.today().isoformat()

    return sorted(
        [
            s for s in slots
            if not es_dia_curs(s)
            and str(s.get("fecha") or "") >= avui
        ],
        key=lambda s: (
            str(s.get("fecha") or ""),
            str(s.get("hora_inicio") or ""),
        ),
    )


def generar_proposta_reprogramacio(cirugias, slots):
    slots_disponibles = ordenar_slots(slots)
    slots_usats = set()
    cirugies_usades = set()
    assignacions = []

    cirurgies_planificables = ordenar_cirugias([
        c for c in cirugias
        if c.get("estat_cas") not in ["Operat", "Cancel·lat"]
    ])

    cirurgies_fixades = [
        c for c in cirurgies_planificables
        if c.get("fijada") and c.get("fecha_fijada")
    ]

    for cirurgia in cirurgies_fixades:
        slot_compatible = next(
            (
                slot for slot in slots_disponibles
                if slot["id"] not in slots_usats
                and str(slot.get("fecha")) == str(cirurgia.get("fecha_fijada"))
                and es_slot_compatible(slot, cirurgia)
            ),
            None,
        )

        if slot_compatible:
            assignacions.append({
                "cirurgia": cirurgia,
                "slot": slot_compatible,
                "fixada": True,
            })
            slots_usats.add(slot_compatible["id"])
            cirugies_usades.add(cirurgia["id"])

    for cirurgia in cirurgies_planificables:
        if cirurgia["id"] in cirugies_usades:
            continue

        slot_compatible = next(
            (
                slot for slot in slots_disponibles
                if slot["id"] not in slots_usats
                and es_slot_compatible(slot, cirurgia)
            ),
            None,
        )

        if slot_compatible:
            assignacions.append({
                "cirurgia": cirurgia,
                "slot": slot_compatible,
                "fixada": False,
            })
            slots_usats.add(slot_compatible["id"])
            cirugies_usades.add(cirurgia["id"])

    return assignacions


def generar_programacio_actual(cirugias, slots):
    slots_disponibles = ordenar_slots(slots)
    slots_usats = set()
    assignacions = []

    cirurgies_programades = ordenar_cirugias([
        c for c in cirugias
        if c.get("estat_cas") == "Programat"
        and c.get("fecha_fijada")
        and c.get("estat_cas") != "Operat"
    ])

    for cirurgia in cirurgies_programades:
        slot_compatible = next(
            (
                slot for slot in slots_disponibles
                if slot["id"] not in slots_usats
                and str(slot.get("fecha")) == str(cirurgia.get("fecha_fijada"))
                and es_slot_compatible(slot, cirurgia)
            ),
            None,
        )

        if slot_compatible:
            assignacions.append({
                "cirurgia": cirurgia,
                "slot": slot_compatible,
                "fixada": bool(cirurgia.get("fijada")),
            })
            slots_usats.add(slot_compatible["id"])

    return assignacions


def detectar_canvis(actual, proposta):
    canvis = []

    for assignacio_actual in actual:
        nova_mateix_slot = next(
            (
                a for a in proposta
                if a["slot"]["id"] == assignacio_actual["slot"]["id"]
            ),
            None,
        )

        if nova_mateix_slot and nova_mateix_slot["cirurgia"]["id"] != assignacio_actual["cirurgia"]["id"]:
            canvis.append({
                "surt": assignacio_actual["cirurgia"],
                "entra": nova_mateix_slot["cirurgia"],
                "slot": assignacio_actual["slot"],
            })

    return canvis