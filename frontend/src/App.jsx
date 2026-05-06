import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const formInicial = {
  codigo: "",
  tumor: "",
  neoadjuvancia: false,
  fecha_fin_neo: "",
  bilirrubina: "",
  area_neoplasia: "",
  tipus_neoplasia: "",
  tipo_cirugia: "",
  operacio: "",
  lateralitat: "",
  segments: [],
  fijada: false,
  fecha_fijada: "",
  dia_curs: false,
  fecha_dia_curs: "",
  comentarios: "",
  estat_cas: "Pendent",
};

const slotInicial = {
  quirofan: "1.7",
  quirofan_altres: "",
  franja: "Matí",
  hora_inicio: "08:00",
  hora_fin: "15:00",
  tipus_cirurgia: ["Oberta", "Laparoscòpica"],
  cirurgians: [],
  comentarios: "",
};

const cirurgiansDisponibles = [
  "Dr. Espín",
  "Dr. Pardo",
  "Dr. Cremades",
  "Dra. Zárate",
  "Dra. Vidal",
  "Dra. Sentí",
  "Dra. Lucas",
  "Resident gran",
  "Resident jr",
];

function App() {
  const [pestanya, setPestanya] = useState("alta");
  const [form, setForm] = useState(formInicial);
  const [cirugias, setCirugias] = useState([]);
  const [cerca, setCerca] = useState("");
  const [cirurgiaEditant, setCirurgiaEditant] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [slots, setSlots] = useState([]);
  const [mesActual, setMesActual] = useState(new Date());
  const [diaSeleccionat, setDiaSeleccionat] = useState(null);
  const [modalSlot, setModalSlot] = useState(false);
  const [accioSlot, setAccioSlot] = useState(null);
  const [slotForm, setSlotForm] = useState(slotInicial);
  const [slotEditant, setSlotEditant] = useState(null);
  const [diaCursEditant, setDiaCursEditant] = useState(null);
  const [dataDiaCursEdit, setDataDiaCursEdit] = useState("");

  const [planificacioValidada, setPlanificacioValidada] = useState(null);
  const [propostaReprogramacio, setPropostaReprogramacio] = useState(null);
  const [avisReprogramacio, setAvisReprogramacio] = useState(null);

  const carregarCirurgies = () => {
    fetch(`${API_URL}/cirugias`)
      .then((res) => res.json())
      .then((data) => setCirugias(data))
      .catch(console.error);
  };

  const carregarSlots = () => {
    fetch(`${API_URL}/slots`)
      .then((res) => res.json())
      .then((data) => setSlots(data))
      .catch(console.error);
  };

  useEffect(() => {
    carregarCirurgies();
    carregarSlots();
  }, []);

  const normalitza = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const parseArray = (valor) => {
    if (Array.isArray(valor)) return valor;

    if (typeof valor === "string") {
      try {
        const parsed = JSON.parse(valor);
        return Array.isArray(parsed) ? parsed : [valor];
      } catch {
        return [valor];
      }
    }

    return [];
  };

  const formatDataLocal = (data) => {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getSlotData = (slot) => slot.fecha || "";
  const getSlotQuirofan = (slot) => slot.quirofano || "";
  const getSlotFranja = (slot) => slot.franja || "";
  const getSlotTipus = (slot) => parseArray(slot.tipo_cirugia);
  const getSlotCirurgians = (slot) => parseArray(slot.cirujanos_disponibles);
  const esDiaCurs = (slot) => slot.tipus_registre === "Dia de curs";

  const opcionsNeoplasia = (area) => {
    if (area === "Fetge") return ["HCC", "pCCA", "iCCA", "M1CCR", "M1 altres", "Altres"];
    if (area === "Pàncrees") return ["Ampul·loma", "dCCA", "M1", "ADK", "TPMi", "PTNE", "Altres"];
    if (area === "Vesícula biliar") return ["Vesícula biliar"];
    return [];
  };

  const opcionsOperacio = (area, tumor) => {
    if (!area || !tumor) return [];

    if (area === "Fetge") {
      const base = ["Hepatectomia", "Segmentectomia", "Cirurgia hepàtica extrema"];
      return tumor === "Benigne" ? [...base, "Marsupialització"] : base;
    }

    if (area === "Pàncrees") {
      const base = [
        "DPC",
        "Pancreatectomia central",
        "Enucleació",
        "Ampul·lectomia",
        "Pancreatectomia corporocaudal",
        "Pancreatectomia corporocaudal amb preservació esplènica",
        "RAMPS",
        "RAMPS posterior",
      ];
      return tumor === "Benigne" ? [...base, "Puestow"] : base;
    }

    if (area === "Vesícula biliar") {
      return ["Colecistectomia + segmentectomia 4b + 5", "Segmentectomia 4b + 5"];
    }

    return [];
  };

  const actualitzarCamp = (e, mode = "alta") => {
    const { name, value, type, checked } = e.target;
    const dades = mode === "alta" ? form : editForm;
    const setDades = mode === "alta" ? setForm : setEditForm;

    if (name === "area_neoplasia") {
      setDades({
        ...dades,
        area_neoplasia: value,
        tipus_neoplasia: value === "Vesícula biliar" ? "Vesícula biliar" : "",
        operacio: "",
        lateralitat: "",
        segments: [],
      });
      return;
    }

    if (name === "tumor") {
      setDades({
        ...dades,
        tumor: value,
        operacio: "",
        lateralitat: "",
        segments: [],
      });
      return;
    }

    if (name === "dia_curs") {
      setDades({
        ...dades,
        dia_curs: checked,
        fijada: checked ? false : dades.fijada,
        fecha_fijada: checked ? "" : dades.fecha_fijada,
      });
      return;
    }

    if (name === "fijada") {
      setDades({
        ...dades,
        fijada: checked,
        dia_curs: checked ? false : dades.dia_curs,
        fecha_dia_curs: checked ? "" : dades.fecha_dia_curs,
      });
      return;
    }

    setDades({ ...dades, [name]: type === "checkbox" ? checked : value });
  };

  const canviarSegment = (segment, mode = "alta") => {
    const dades = mode === "alta" ? form : editForm;
    const setDades = mode === "alta" ? setForm : setEditForm;

    const segments = dades.segments.includes(segment)
      ? dades.segments.filter((s) => s !== segment)
      : [...dades.segments, segment];

    setDades({ ...dades, segments });
  };

  const crearPayloadCirurgia = (dades, cirurgiaOriginal = null) => {
    const detallOperacio = {
      area: dades.area_neoplasia,
      operacio: dades.operacio,
      lateralitat: dades.lateralitat || null,
      segments: dades.segments || [],
    };

    return {
      data_solicitud_operacio:
        cirurgiaOriginal?.data_solicitud_operacio || new Date().toISOString().split("T")[0],
      user_id: cirurgiaOriginal?.user_id || "demo",
      codigo: dades.codigo,
      tipo_cirugia: dades.tipo_cirugia,
      duracion_min: cirurgiaOriginal?.duracion_min || 300,
      requiere_robot: dades.tipo_cirugia === "Robòtica",
      maligno: dades.tumor === "Maligne",
      estat_cas: dades.estat_cas || "Pendent",
      area_neoplasia: dades.area_neoplasia,
      tipus_neoplasia: dades.tipus_neoplasia,
      tipo_operacion_principal: dades.operacio,
      detalle_operacion: JSON.stringify(detallOperacio),
      fecha_fin_neo: dades.neoadjuvancia ? dades.fecha_fin_neo || null : null,
      bilirrubina: Number(dades.bilirrubina || 0),
      prioridad_puntos: cirurgiaOriginal?.prioridad_puntos || 0,
      fijada: dades.fijada || dades.dia_curs,
      fecha_fijada: dades.fijada
        ? dades.fecha_fijada || null
        : dades.dia_curs
        ? dades.fecha_dia_curs || null
        : null,
      hora_inicio_fija: cirurgiaOriginal?.hora_inicio_fija || null,
      comentarios: dades.comentarios || null,
      realizada_validada: dades.estat_cas === "Operat",
      dia_curs: dades.dia_curs,
      fecha_dia_curs: dades.dia_curs ? dades.fecha_dia_curs || null : null,
    };
  };

  const validarFormulari = (dades) => {
    if (!dades.codigo.trim()) return "El codi del cas és obligatori.";
    if (!dades.tumor) return "Selecciona si el tumor és benigne o maligne.";
    if (!dades.area_neoplasia) return "Selecciona l’origen de la neoplàsia.";
    if (!dades.tipus_neoplasia) return "Selecciona el tipus de neoplàsia.";
    if (!dades.tipo_cirugia) return "Selecciona el tipus de cirurgia.";
    if (!dades.operacio) return "Selecciona el tipus d’operació.";
    if (dades.operacio === "Hepatectomia" && !dades.lateralitat) return "Selecciona la lateralitat.";
    if (dades.operacio === "Segmentectomia" && dades.segments.length === 0) return "Selecciona almenys un segment.";
    return null;
  };

  const guardarCirurgia = () => {
    const error = validarFormulari(form);
    if (error) return alert(error);

    fetch(`${API_URL}/cirugias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadCirurgia(form)),
    })
      .then(() => {
        setForm(formInicial);
        carregarCirurgies();
        alert("Cirurgia afegida correctament.");
      })
      .catch(console.error);
  };

  const obrirEditor = (c) => {
    let detall = {};

    try {
      detall = c.detalle_operacion ? JSON.parse(c.detalle_operacion) : {};
    } catch {
      detall = {};
    }

    setCirurgiaEditant(c);
    setEditForm({
      codigo: c.codigo || "",
      tumor: c.maligno ? "Maligne" : "Benigne",
      neoadjuvancia: !!c.fecha_fin_neo,
      fecha_fin_neo: c.fecha_fin_neo || "",
      bilirrubina: c.bilirrubina ?? "",
      area_neoplasia: c.area_neoplasia || "",
      tipus_neoplasia: c.tipus_neoplasia || "",
      tipo_cirugia: c.tipo_cirugia || "",
      operacio: c.tipo_operacion_principal || "",
      lateralitat: detall.lateralitat || "",
      segments: detall.segments || [],
      fijada: !!c.fijada && !c.dia_curs,
      fecha_fijada: c.fecha_fijada || "",
      dia_curs: !!c.dia_curs,
      fecha_dia_curs: c.fecha_dia_curs || "",
      comentarios: c.comentarios || "",
      estat_cas: c.estat_cas || "Pendent",
    });
  };

  const guardarEdicio = () => {
    const error = validarFormulari(editForm);
    if (error) return alert(error);

    fetch(`${API_URL}/cirugias/${cirurgiaEditant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadCirurgia(editForm, cirurgiaEditant)),
    })
      .then(() => {
        setCirurgiaEditant(null);
        setEditForm(null);
        carregarCirurgies();
      })
      .catch(console.error);
  };

  const obrirModalDia = (data, diaCurs = null) => {
    setDiaSeleccionat(data);
    setAccioSlot(null);
    setSlotEditant(null);
    setDiaCursEditant(diaCurs);
    setDataDiaCursEdit(diaCurs ? getSlotData(diaCurs) : "");
    setSlotForm(slotInicial);
    setModalSlot(true);
  };

  const obrirEditorSlot = (e, slot) => {
    e.stopPropagation();

    const quirofan = getSlotQuirofan(slot);
    const quirofansFixos = ["1.7", "1.6", "2.1", "2.2"];
    const tipusGuardats = getSlotTipus(slot);

    setDiaSeleccionat(new Date(getSlotData(slot)));
    setSlotEditant(slot);
    setDiaCursEditant(null);
    setAccioSlot("slot");
    setSlotForm({
      quirofan: quirofansFixos.includes(quirofan) ? quirofan : "Altres",
      quirofan_altres: quirofansFixos.includes(quirofan) ? "" : quirofan,
      franja: getSlotFranja(slot) || "Matí",
      hora_inicio: slot.hora_inicio || "08:00",
      hora_fin: slot.hora_fin || "15:00",
      tipus_cirurgia:
        Array.isArray(tipusGuardats) && tipusGuardats.length > 0
          ? tipusGuardats
          : quirofan === "1.6" || quirofan === "1.7"
          ? ["Oberta", "Laparoscòpica"]
          : quirofan === "2.1" || quirofan === "2.2"
          ? ["Robòtica"]
          : [],
      cirurgians: getSlotCirurgians(slot),
      comentarios: slot.comentari || "",
    });
    setModalSlot(true);
  };

  const canviarQuirofan = (valor) => {
    let tipus = [];

    if (valor === "1.6" || valor === "1.7") {
      tipus = ["Oberta", "Laparoscòpica"];
    } else if (valor === "2.1" || valor === "2.2") {
      tipus = ["Robòtica"];
    }

    setSlotForm({
      ...slotForm,
      quirofan: valor,
      quirofan_altres: valor === "Altres" ? slotForm.quirofan_altres : "",
      tipus_cirurgia: tipus,
    });
  };

  const toggleTipusCirurgia = (tipus) => {
    const novaLlista = slotForm.tipus_cirurgia.includes(tipus)
      ? slotForm.tipus_cirurgia.filter((t) => t !== tipus)
      : [...slotForm.tipus_cirurgia, tipus];

    setSlotForm({ ...slotForm, tipus_cirurgia: novaLlista });
  };

  const toggleCirurgiaDisponible = (nom) => {
    const novaLlista = slotForm.cirurgians.includes(nom)
      ? slotForm.cirurgians.filter((c) => c !== nom)
      : [...slotForm.cirurgians, nom];

    setSlotForm({ ...slotForm, cirurgians: novaLlista });
  };

  const crearPayloadSlot = () => {
    const numeroQuirofan =
      slotForm.quirofan === "Altres" ? slotForm.quirofan_altres.trim() : slotForm.quirofan;

    return {
      fecha: formatDataLocal(diaSeleccionat),
      quirofano: numeroQuirofan,
      franja: slotForm.franja,
      hora_inicio: slotForm.hora_inicio,
      hora_fin: slotForm.hora_fin,
      tipo_cirugia: slotForm.tipus_cirurgia,
      cirujanos_disponibles: slotForm.cirurgians,
      tipus_registre: "Slot quirúrgic",
      comentari: slotForm.comentarios || null,
    };
  };

  const guardarSlot = () => {
    if (slotForm.quirofan === "Altres" && !slotForm.quirofan_altres.trim()) {
      return alert("Escriu el número de quiròfan.");
    }

    if (slotForm.tipus_cirurgia.length === 0) {
      return alert("Selecciona almenys un tipus de cirurgia.");
    }

    const url = slotEditant ? `${API_URL}/slots/${slotEditant.id}` : `${API_URL}/slots`;

    fetch(url, {
      method: slotEditant ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadSlot()),
    })
      .then(() => {
        setModalSlot(false);
        setDiaSeleccionat(null);
        setAccioSlot(null);
        setSlotEditant(null);
        setSlotForm(slotInicial);
        carregarSlots();
      })
      .catch(console.error);
  };

  const crearPayloadDiaCurs = (fecha) => ({
    fecha,
    quirofano: null,
    franja: null,
    hora_inicio: null,
    hora_fin: null,
    tipo_cirugia: [],
    cirujanos_disponibles: [],
    tipus_registre: "Dia de curs",
    comentari: "Dia de curs",
  });

  const marcarDiaCurs = () => {
    const fecha = formatDataLocal(diaSeleccionat);

    fetch(`${API_URL}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadDiaCurs(fecha)),
    })
      .then(() => {
        setModalSlot(false);
        setDiaSeleccionat(null);
        setAccioSlot(null);
        setDiaCursEditant(null);
        carregarSlots();
      })
      .catch(console.error);
  };

  const guardarDiaCursEditat = () => {
    if (!dataDiaCursEdit) return alert("Selecciona una data.");

    fetch(`${API_URL}/slots/${diaCursEditant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadDiaCurs(dataDiaCursEdit)),
    })
      .then(() => {
        setModalSlot(false);
        setDiaCursEditant(null);
        setAccioSlot(null);
        carregarSlots();
      })
      .catch(console.error);
  };

  const eliminarSlot = () => {
    const slot = slotEditant || diaCursEditant;
    if (!slot) return;

    const segur = window.confirm("Vols eliminar aquest registre?");
    if (!segur) return;

    fetch(`${API_URL}/slots/${slot.id}`, {
      method: "DELETE",
    })
      .then(() => {
        setModalSlot(false);
        setSlotEditant(null);
        setDiaCursEditant(null);
        setAccioSlot(null);
        carregarSlots();
      })
      .catch(console.error);
  };

  const esSlotCompatibleAmbCirurgia = (slot, cirurgia) => {
    if (esDiaCurs(slot)) return false;

    const tipusSlot = getSlotTipus(slot).map(normalitza);
    const quirofan = getSlotQuirofan(slot);
    const tipusCirurgia = normalitza(cirurgia.tipo_cirugia);

    if (tipusCirurgia === "robotica") {
      return quirofan === "2.1" || quirofan === "2.2" || tipusSlot.includes("robotica");
    }

    if (tipusCirurgia === "oberta") return tipusSlot.includes("oberta");
    if (tipusCirurgia === "laparoscopica") return tipusSlot.includes("laparoscopica");

    return true;
  };

  const ordenarCirurgiesPerPrioritat = (llista) =>
    [...llista].sort((a, b) => {
      if ((b.prioridad_puntos || 0) !== (a.prioridad_puntos || 0)) {
        return (b.prioridad_puntos || 0) - (a.prioridad_puntos || 0);
      }

      return String(a.data_solicitud_operacio || "").localeCompare(
        String(b.data_solicitud_operacio || "")
      );
    });

  const avuiText = () => formatDataLocal(new Date());

  const slotsQuirurgicsOrdenats = () =>
    slots
      .filter((s) => !esDiaCurs(s))
      .filter((s) => getSlotData(s) >= avuiText())
      .sort((a, b) => {
        const dataA = getSlotData(a);
        const dataB = getSlotData(b);
        if (dataA !== dataB) return dataA.localeCompare(dataB);
        return String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || ""));
      });

  const generarProgramacioActual = () => {
    const slotsDisponibles = slotsQuirurgicsOrdenats();
    const slotsUsats = new Set();

    const cirurgiesProgramades = cirugias.filter(
      (c) =>
        c.estat_cas === "Programat" &&
        c.fecha_fijada &&
        c.estat_cas !== "Operat"
    );

    const assignacions = [];

    ordenarCirurgiesPerPrioritat(cirurgiesProgramades).forEach((cirurgia) => {
      const slotCompatible = slotsDisponibles.find(
        (slot) =>
          !slotsUsats.has(slot.id) &&
          getSlotData(slot) === cirurgia.fecha_fijada &&
          esSlotCompatibleAmbCirurgia(slot, cirurgia)
      );

      if (slotCompatible) {
        assignacions.push({
          cirurgia,
          slot: slotCompatible,
          fixada: !!cirurgia.fijada,
        });
        slotsUsats.add(slotCompatible.id);
      }
    });

    return assignacions;
  };

  const generarPropostaReprogramacio = () => {
    const slotsDisponibles = slotsQuirurgicsOrdenats();
    const slotsUsats = new Set();
    const cirurgiesUsades = new Set();
    const assignacions = [];

    const cirurgiesPendentsPlanificables = ordenarCirurgiesPerPrioritat(
      cirugias.filter((c) => c.estat_cas !== "Operat" && c.estat_cas !== "Cancel·lat")
    );

    const cirurgiesFixades = cirurgiesPendentsPlanificables.filter(
      (c) => c.fijada && c.fecha_fijada
    );

    cirurgiesFixades.forEach((cirurgia) => {
      const slotCompatible = slotsDisponibles.find(
        (slot) =>
          !slotsUsats.has(slot.id) &&
          getSlotData(slot) === cirurgia.fecha_fijada &&
          esSlotCompatibleAmbCirurgia(slot, cirurgia)
      );

      if (slotCompatible) {
        assignacions.push({ cirurgia, slot: slotCompatible, fixada: true });
        slotsUsats.add(slotCompatible.id);
        cirurgiesUsades.add(cirurgia.id);
      }
    });

    cirurgiesPendentsPlanificables
      .filter((c) => !cirurgiesUsades.has(c.id))
      .forEach((cirurgia) => {
        const slotCompatible = slotsDisponibles.find(
          (slot) => !slotsUsats.has(slot.id) && esSlotCompatibleAmbCirurgia(slot, cirurgia)
        );

        if (slotCompatible) {
          assignacions.push({ cirurgia, slot: slotCompatible, fixada: false });
          slotsUsats.add(slotCompatible.id);
          cirurgiesUsades.add(cirurgia.id);
        }
      });

    return assignacions;
  };

  const detectarCanvisReprogramacio = (actual, proposta) => {
    const canvis = [];

    actual.forEach((assignacioActual) => {
      const assignacioNovaMateixSlot = proposta.find(
        (a) => a.slot.id === assignacioActual.slot.id
      );

      if (
        assignacioNovaMateixSlot &&
        assignacioNovaMateixSlot.cirurgia.id !== assignacioActual.cirurgia.id
      ) {
        canvis.push({
          surt: assignacioActual.cirurgia,
          entra: assignacioNovaMateixSlot.cirurgia,
          slot: assignacioActual.slot,
        });
      }
    });

    return canvis;
  };

  const executarReprogramacio = () => {
    const actual = planificacioValidada || generarProgramacioActual();
    const proposta = generarPropostaReprogramacio();

    if (proposta.length === 0) {
      alert(
        "No s’ha pogut programar cap cirurgia. Revisa que hi hagi cirurgies pendents i slots quirúrgics compatibles."
      );
      return;
    }

    const canvis = detectarCanvisReprogramacio(actual, proposta);

    setPropostaReprogramacio(proposta);

    if (canvis.length > 0) {
      setAvisReprogramacio(canvis);
      return;
    }

    setPlanificacioValidada(proposta);
    alert(`S'han programat ${proposta.length} cirurgies compatibles.`);
  };

  const validarReprogramacio = () => {
    setPlanificacioValidada(propostaReprogramacio || []);
    setAvisReprogramacio(null);
    setPropostaReprogramacio(null);
  };

  const cancelarReprogramacio = () => {
    setAvisReprogramacio(null);
    setPropostaReprogramacio(null);
  };

  const cirurgiesFiltrades = cirugias.filter((c) =>
    c.codigo?.toLowerCase().includes(cerca.toLowerCase())
  );

  const cirurgiesPendents = cirurgiesFiltrades.filter((c) => c.estat_cas !== "Operat");
  const cirurgiesOperades = cirurgiesFiltrades.filter((c) => c.estat_cas === "Operat");

  const FormulariCirurgia = ({ dades, mode }) => (
    <>
      <label style={labelFull}>
        Codi del cas
        <input
          name="codigo"
          value={dades.codigo}
          onChange={(e) => actualitzarCamp(e, mode)}
          style={input}
          placeholder="Introdueix el codi o identificador del cas"
        />
      </label>

      {mode === "edicio" && (
        <label style={labelFull}>
          Estat del cas
          <select name="estat_cas" value={dades.estat_cas} onChange={(e) => actualitzarCamp(e, mode)} style={input}>
            <option>Pendent</option>
            <option>Programat</option>
            <option>Operat</option>
            <option>Cancel·lat</option>
          </select>
        </label>
      )}

      <div style={gridDosColumnes}>
        <section>
          <div style={capcalera}>Variables clíniques</div>

          <label style={label}>
            Tumor
            <select name="tumor" value={dades.tumor} onChange={(e) => actualitzarCamp(e, mode)} style={input}>
              <option value="">Selecciona una opció</option>
              <option>Benigne</option>
              <option>Maligne</option>
            </select>
          </label>

          <label style={checkLabel}>
            <input type="checkbox" name="neoadjuvancia" checked={dades.neoadjuvancia} onChange={(e) => actualitzarCamp(e, mode)} />
            Neoadjuvància
          </label>

          {dades.neoadjuvancia && (
            <label style={label}>
              Data de finalització de la neoadjuvància
              <input type="date" name="fecha_fin_neo" value={dades.fecha_fin_neo} onChange={(e) => actualitzarCamp(e, mode)} style={input} />
            </label>
          )}

          <label style={label}>
            Bilirrubina mg/dl
            <input type="number" step="0.1" name="bilirrubina" value={dades.bilirrubina} onChange={(e) => actualitzarCamp(e, mode)} style={input} placeholder="0,0" />
          </label>

          <label style={label}>
            Origen de neoplàsia
            <select name="area_neoplasia" value={dades.area_neoplasia} onChange={(e) => actualitzarCamp(e, mode)} style={input}>
              <option value="">Selecciona una opció</option>
              <option>Fetge</option>
              <option>Pàncrees</option>
              <option>Vesícula biliar</option>
            </select>
          </label>

          <label style={label}>
            Tipus de neoplàsia
            <select name="tipus_neoplasia" value={dades.tipus_neoplasia} onChange={(e) => actualitzarCamp(e, mode)} style={input} disabled={!dades.area_neoplasia}>
              <option value="">Selecciona una opció</option>
              {opcionsNeoplasia(dades.area_neoplasia).map((opcio) => (
                <option key={opcio}>{opcio}</option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <div style={capcalera}>Procediment</div>

          <label style={label}>
            Tipus de cirurgia
            <select name="tipo_cirugia" value={dades.tipo_cirugia} onChange={(e) => actualitzarCamp(e, mode)} style={input}>
              <option value="">Selecciona una opció</option>
              <option>Laparoscòpica</option>
              <option>Oberta</option>
              <option>Robòtica</option>
            </select>
          </label>

          <label style={label}>
            Tipus d’operació
            <select name="operacio" value={dades.operacio} onChange={(e) => actualitzarCamp(e, mode)} style={input} disabled={!dades.area_neoplasia || !dades.tumor}>
              <option value="">Selecciona una opció</option>
              {opcionsOperacio(dades.area_neoplasia, dades.tumor).map((opcio) => (
                <option key={opcio}>{opcio}</option>
              ))}
            </select>
          </label>

          {dades.operacio === "Hepatectomia" && (
            <label style={label}>
              Lateralitat
              <select name="lateralitat" value={dades.lateralitat} onChange={(e) => actualitzarCamp(e, mode)} style={input}>
                <option value="">Selecciona una opció</option>
                <option>Dreta</option>
                <option>Esquerra</option>
              </select>
            </label>
          )}

          {dades.operacio === "Segmentectomia" && (
            <div style={segmentsBox}>
              <span style={miniTitle}>Segments hepàtics</span>
              {["1", "2", "3", "4a", "4b", "5", "6", "7", "8"].map((segment) => (
                <label key={segment} style={segmentLabel}>
                  <input type="checkbox" checked={dades.segments.includes(segment)} onChange={() => canviarSegment(segment, mode)} />
                  S{segment}
                </label>
              ))}
            </div>
          )}

          <label style={checkLabel}>
            <input type="checkbox" name="dia_curs" checked={dades.dia_curs} onChange={(e) => actualitzarCamp(e, mode)} />
            Afegir dia de curs
          </label>

          {dades.dia_curs && (
            <label style={label}>
              Data del dia de curs
              <input type="date" name="fecha_dia_curs" value={dades.fecha_dia_curs} onChange={(e) => actualitzarCamp(e, mode)} style={input} />
            </label>
          )}

          {!dades.dia_curs && (
            <label style={checkLabel}>
              <input type="checkbox" name="fijada" checked={dades.fijada} onChange={(e) => actualitzarCamp(e, mode)} />
              Fixar manualment
            </label>
          )}

          {dades.fijada && !dades.dia_curs && (
            <label style={label}>
              Data fixada
              <input type="date" name="fecha_fijada" value={dades.fecha_fijada} onChange={(e) => actualitzarCamp(e, mode)} style={input} />
            </label>
          )}

          <label style={label}>
            Comentaris
            <textarea name="comentarios" value={dades.comentarios} onChange={(e) => actualitzarCamp(e, mode)} style={textarea} placeholder="Comentaris clínics o organitzatius" />
          </label>
        </section>
      </div>
    </>
  );

  const ChipsSelector = ({ opcions, seleccionades, onToggle }) => (
    <div style={chipsBox}>
      {seleccionades.length > 0 && (
        <div style={chipsSeleccionades}>
          {seleccionades.map((opcio) => (
            <button key={opcio} type="button" style={chipSelected} onClick={() => onToggle(opcio)}>
              {opcio} ×
            </button>
          ))}
        </div>
      )}

      <div style={chipsOpcions}>
        {opcions
          .filter((opcio) => !seleccionades.includes(opcio))
          .map((opcio) => (
            <button key={opcio} type="button" style={chipOption} onClick={() => onToggle(opcio)}>
              {opcio}
            </button>
          ))}
      </div>
    </div>
  );

  const CalendariSlots = () => {
    const mesos = [
      "gener", "febrer", "març", "abril", "maig", "juny",
      "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
    ];

    const any = mesActual.getFullYear();
    const mes = mesActual.getMonth();

    const primerDia = new Date(any, mes, 1);
    const iniciCalendari = new Date(primerDia);
    const diaSetmana = primerDia.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);

    const dies = [];
    for (let i = 0; i < 42; i++) {
      const data = new Date(iniciCalendari);
      data.setDate(iniciCalendari.getDate() + i);
      dies.push(data);
    }

    const slotsPerDia = (data) => {
      const dataText = formatDataLocal(data);
      return slots.filter((s) => getSlotData(s) === dataText);
    };

    return (
      <>
        <div style={calendarTop}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button>
            <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button>
          </div>

          <h2 style={{ margin: 0 }}>{mesos[mes]} del {any}</h2>
        </div>

        <div style={calendarGrid}>
          {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => (
            <div key={d} style={calendarHeader}>{d}</div>
          ))}

          {dies.map((data) => {
            const foraMes = data.getMonth() !== mes;
            const events = slotsPerDia(data);
            const slotDiaCurs = events.find(esDiaCurs);
            const teDiaCurs = !!slotDiaCurs;
            const slotsQuirurgics = events.filter((s) => !esDiaCurs(s));

            return (
              <div
                key={formatDataLocal(data)}
                style={{
                  ...calendarDay,
                  ...(teDiaCurs ? calendarDayCurs : {}),
                  opacity: foraMes ? 0.35 : 1,
                }}
                onClick={() => obrirModalDia(data, slotDiaCurs || null)}
              >
                <div style={calendarNumber}>{data.getDate()}</div>

                {slotsQuirurgics.map((slot) => {
                  const quirofan = getSlotQuirofan(slot);
                  const franja = getSlotFranja(slot);

                  return (
                    <div key={slot.id} style={eventSlot} onClick={(e) => obrirEditorSlot(e, slot)}>
                      {quirofan ? `Q${quirofan}` : "Q?"} · {franja || "Franja"}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const CalendariPlanner = () => {
    const mesos = [
      "gener", "febrer", "març", "abril", "maig", "juny",
      "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
    ];

    const assignacions = planificacioValidada || generarProgramacioActual();

    const any = mesActual.getFullYear();
    const mes = mesActual.getMonth();

    const primerDia = new Date(any, mes, 1);
    const iniciCalendari = new Date(primerDia);
    const diaSetmana = primerDia.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);

    const dies = [];
    for (let i = 0; i < 42; i++) {
      const data = new Date(iniciCalendari);
      data.setDate(iniciCalendari.getDate() + i);
      dies.push(data);
    }

    const diaEsCurs = (data) => {
      const dataText = formatDataLocal(data);
      return slots.some((s) => getSlotData(s) === dataText && esDiaCurs(s));
    };

    const assignacionsPerDia = (data) => {
      const dataText = formatDataLocal(data);
      return assignacions.filter((a) => getSlotData(a.slot) === dataText);
    };

    return (
      <>
        <div style={plannerTop}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button>
            <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button>
          </div>

          <h2 style={{ margin: 0 }}>{mesos[mes]} del {any}</h2>

          <button style={botoPlanner} onClick={executarReprogramacio}>
            Reprogramació quirúrgica
          </button>
        </div>

        <div style={resumPlanner}>
          Cirurgies programades al planner: <strong>{assignacions.length}</strong>
        </div>

        <div style={calendarGrid}>
          {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => (
            <div key={d} style={calendarHeader}>{d}</div>
          ))}

          {dies.map((data) => {
            const foraMes = data.getMonth() !== mes;
            const teDiaCurs = diaEsCurs(data);
            const assignacionsDia = assignacionsPerDia(data);

            return (
              <div
                key={formatDataLocal(data)}
                style={{
                  ...calendarDayPlanificacio,
                  ...(teDiaCurs ? calendarDayCurs : {}),
                  opacity: foraMes ? 0.35 : 1,
                }}
              >
                <div style={calendarNumber}>{data.getDate()}</div>

                {assignacionsDia.map(({ cirurgia, slot, fixada }) => (
                  <div key={`${slot.id}-${cirurgia.id}`} style={eventOperacioProgramada}>
                    <strong>Q{getSlotQuirofan(slot)}</strong> · {cirurgia.codigo}
                    <br />
                    {cirurgia.tipo_operacion_principal || "Operació"}
                    {fixada && <span> · fixada</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div style={page}>
      <h1 style={title}>Planner quirúrgic HBP</h1>

      <div style={tabs}>
        {[
          ["alta", "Alta de cirurgia"],
          ["registrades", "Cirurgies registrades"],
          ["planificacio", "Planner"],
          ["slots", "Calendari de slots"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setPestanya(key)} style={pestanya === key ? tabActive : tab}>
            {label}
          </button>
        ))}
      </div>

      {pestanya === "alta" && (
        <div style={card}>
          <FormulariCirurgia dades={form} mode="alta" />
          <button onClick={guardarCirurgia} style={botoPrincipal}>Guardar cirurgia</button>
        </div>
      )}

      {pestanya === "registrades" && (
        <div style={card}>
          <h2 style={{ textAlign: "center" }}>Cirurgies registrades</h2>

          <input
            type="text"
            placeholder="Cercar per codi del cas..."
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            style={{ ...input, marginBottom: "18px" }}
          />

          <div style={gridDosColumnes}>
            <section>
              <div style={capcalera}>Cirurgies pendents</div>
              <table style={taula}>
                <tbody>
                  {cirurgiesPendents.map((c) => (
                    <tr key={c.id} style={filaClickable} onClick={() => obrirEditor(c)}>
                      <td style={td}><strong>{c.codigo}</strong></td>
                      <td style={td}>{c.area_neoplasia}</td>
                      <td style={td}>{c.tipus_neoplasia}</td>
                      <td style={td}>{c.tipo_cirugia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <div style={capcalera}>Històric de cirurgies operades</div>
              <table style={taula}>
                <tbody>
                  {cirurgiesOperades.map((c) => (
                    <tr key={c.id} style={filaClickable} onClick={() => obrirEditor(c)}>
                      <td style={td}><strong>{c.codigo}</strong></td>
                      <td style={td}>{c.area_neoplasia}</td>
                      <td style={td}>{c.tipus_neoplasia}</td>
                      <td style={td}>{c.tipo_cirugia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      {pestanya === "planificacio" && (
        <div style={cardAmple}>
          <CalendariPlanner />
        </div>
      )}

      {pestanya === "slots" && (
        <div style={cardAmple}>
          <CalendariSlots />
        </div>
      )}

      {avisReprogramacio && (
        <div style={modalFons}>
          <div style={modalPetit}>
            <h2 style={{ textAlign: "center", marginTop: 0 }}>Validar reprogramació</h2>

            {avisReprogramacio.map((canvi, index) => (
              <div key={index} style={avisCanvi}>
                Aquesta reprogramació mourà la cirurgia{" "}
                <strong>{canvi.surt.codigo}</strong> ({canvi.surt.tipo_operacion_principal || "Operació"})
                {" "}per la cirurgia{" "}
                <strong>{canvi.entra.codigo}</strong> ({canvi.entra.tipo_operacion_principal || "Operació"})
                {" "}al quiròfan <strong>Q{getSlotQuirofan(canvi.slot)}</strong> del dia{" "}
                <strong>{getSlotData(canvi.slot)}</strong>.
              </div>
            ))}

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={validarReprogramacio} style={botoPrincipal}>Validar reprogramació</button>
              <button onClick={cancelarReprogramacio} style={botoSecundari}>Cancel·lar</button>
            </div>
          </div>
        </div>
      )}

      {cirurgiaEditant && editForm && (
        <div style={modalFons}>
          <div style={modal}>
            <h2 style={{ textAlign: "center" }}>Editar cirurgia</h2>
            <FormulariCirurgia dades={editForm} mode="edicio" />

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={guardarEdicio} style={botoPrincipal}>Guardar canvis</button>
              <button onClick={() => { setCirurgiaEditant(null); setEditForm(null); }} style={botoSecundari}>
                Cancel·lar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSlot && diaSeleccionat && (
        <div style={modalFons}>
          <div style={modalPetit}>
            <h2 style={{ textAlign: "center", marginTop: 0 }}>
              {slotEditant
                ? "Editar slot quirúrgic"
                : accioSlot === "dia_curs"
                ? "Editar dia de curs"
                : diaSeleccionat.toLocaleDateString("ca-ES")}
            </h2>

            {!accioSlot && (
              <>
                {diaCursEditant && (
                  <button onClick={() => setAccioSlot("dia_curs")} style={botoGroc}>
                    Editar dia de curs
                  </button>
                )}

                <button onClick={() => setAccioSlot("slot")} style={botoPrincipal}>
                  Afegir slot quirúrgic
                </button>

                {!diaCursEditant && (
                  <button onClick={marcarDiaCurs} style={botoVerd}>
                    Marcar dia de curs
                  </button>
                )}

                <button onClick={() => {
                  setModalSlot(false);
                  setDiaSeleccionat(null);
                  setDiaCursEditant(null);
                }} style={botoSecundari}>
                  Cancel·lar
                </button>
              </>
            )}

            {accioSlot === "dia_curs" && (
              <>
                <label style={label}>
                  Data del dia de curs
                  <input
                    type="date"
                    value={dataDiaCursEdit}
                    onChange={(e) => setDataDiaCursEdit(e.target.value)}
                    style={input}
                  />
                </label>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={guardarDiaCursEditat} style={botoPrincipal}>Guardar canvis</button>
                  <button onClick={eliminarSlot} style={botoVermell}>Eliminar</button>
                  <button onClick={() => setAccioSlot(null)} style={botoSecundari}>
                    Enrere
                  </button>
                </div>
              </>
            )}

            {accioSlot === "slot" && (
              <>
                <label style={label}>
                  Número de quiròfan
                  <select value={slotForm.quirofan} onChange={(e) => canviarQuirofan(e.target.value)} style={input}>
                    <option>1.7</option>
                    <option>1.6</option>
                    <option>2.1</option>
                    <option>2.2</option>
                    <option>Altres</option>
                  </select>
                </label>

                {slotForm.quirofan === "Altres" && (
                  <label style={label}>
                    Escriu el número de quiròfan
                    <input
                      value={slotForm.quirofan_altres}
                      onChange={(e) => setSlotForm({ ...slotForm, quirofan_altres: e.target.value })}
                      style={input}
                    />
                  </label>
                )}

                <label style={label}>
                  Franja
                  <select value={slotForm.franja} onChange={(e) => setSlotForm({ ...slotForm, franja: e.target.value })} style={input}>
                    <option>Matí</option>
                    <option>Tarda</option>
                  </select>
                </label>

                <div style={gridDosColumnes}>
                  <label style={label}>
                    Hora d’inici
                    <input type="time" value={slotForm.hora_inicio} onChange={(e) => setSlotForm({ ...slotForm, hora_inicio: e.target.value })} style={input} />
                  </label>

                  <label style={label}>
                    Hora de fi
                    <input type="time" value={slotForm.hora_fin} onChange={(e) => setSlotForm({ ...slotForm, hora_fin: e.target.value })} style={input} />
                  </label>
                </div>

                <label style={label}>
                  Tipus de cirurgia
                  <ChipsSelector
                    opcions={["Oberta", "Laparoscòpica", "Robòtica"]}
                    seleccionades={slotForm.tipus_cirurgia}
                    onToggle={toggleTipusCirurgia}
                  />
                </label>

                <label style={label}>
                  Cirurgians disponibles
                  <ChipsSelector
                    opcions={cirurgiansDisponibles}
                    seleccionades={slotForm.cirurgians}
                    onToggle={toggleCirurgiaDisponible}
                  />
                </label>

                <label style={label}>
                  Comentaris
                  <textarea
                    value={slotForm.comentarios}
                    onChange={(e) => setSlotForm({ ...slotForm, comentarios: e.target.value })}
                    style={textarea}
                    placeholder="Comentaris del slot"
                  />
                </label>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={guardarSlot} style={botoPrincipal}>
                    {slotEditant ? "Guardar canvis" : "Guardar slot"}
                  </button>

                  {slotEditant && (
                    <button onClick={eliminarSlot} style={botoVermell}>
                      Eliminar
                    </button>
                  )}

                  <button onClick={() => {
                    setAccioSlot(null);
                    setSlotEditant(null);
                    setSlotForm(slotInicial);
                  }} style={botoSecundari}>
                    Enrere
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const page = { minHeight: "100vh", background: "#f7f9fc", padding: "12px 22px", fontFamily: "Inter, Arial, sans-serif", color: "#1f2a44" };
const title = { textAlign: "center", fontSize: "34px", margin: "4px 0 12px", color: "#0f2b57" };
const tabs = { display: "flex", justifyContent: "center", gap: "10px", marginBottom: "12px" };
const tab = { border: "1px solid #d5dce8", background: "white", borderRadius: "999px", padding: "8px 15px", cursor: "pointer", fontSize: "15px" };
const tabActive = { ...tab, background: "#0f2b57", color: "white", border: "1px solid #0f2b57" };

const card = { maxWidth: "1180px", margin: "0 auto", background: "white", borderRadius: "18px", padding: "18px 22px", boxShadow: "0 10px 30px rgba(15, 43, 87, 0.08)" };
const cardAmple = { maxWidth: "1500px", margin: "0 auto", background: "white", borderRadius: "18px", padding: "14px 18px", boxShadow: "0 10px 30px rgba(15, 43, 87, 0.08)" };

const gridDosColumnes = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" };
const capcalera = { background: "#eef6ff", border: "1px solid #9ec9ff", borderRadius: "12px", padding: "14px", marginBottom: "14px", color: "#003b8e", fontWeight: "700", fontSize: "17px", textAlign: "center" };
const label = { display: "block", textAlign: "left", fontSize: "14px", fontWeight: "600", marginBottom: "8px" };
const labelFull = { ...label, marginBottom: "14px" };
const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", marginTop: "5px", borderRadius: "10px", border: "1px solid #d6dbe3", background: "#f1f3f7", fontSize: "15px" };
const textarea = { ...input, height: "78px", resize: "vertical" };
const checkLabel = { display: "flex", alignItems: "center", gap: "8px", textAlign: "left", fontSize: "14px", fontWeight: "600", marginBottom: "12px" };
const segmentsBox = { background: "#f7f9fc", border: "1px solid #e0e6ef", borderRadius: "12px", padding: "10px", marginBottom: "12px" };
const miniTitle = { display: "block", fontSize: "14px", fontWeight: "700", marginBottom: "8px" };
const segmentLabel = { marginRight: "10px", fontSize: "14px" };

const botoPrincipal = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#0f2b57", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoSecundari = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "1px solid #d5dce8", background: "white", color: "#0f2b57", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoVerd = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#22c55e", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoVermell = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#ef4444", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoGroc = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#facc15", color: "#3f2f00", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoPlanner = { padding: "10px 16px", borderRadius: "12px", border: "none", background: "#16a34a", color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer" };

const taula = { width: "100%", borderCollapse: "collapse", fontSize: "14px" };
const td = { padding: "10px", borderBottom: "1px solid #e1e6ef" };
const filaClickable = { cursor: "pointer" };

const modalFons = { position: "fixed", inset: 0, background: "rgba(15, 43, 87, 0.35)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modal = { background: "white", width: "950px", maxHeight: "90vh", overflowY: "auto", borderRadius: "18px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalPetit = { background: "white", width: "720px", maxHeight: "90vh", overflowY: "auto", borderRadius: "18px", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const avisCanvi = { background: "#fff7cc", border: "1px solid #facc15", borderRadius: "12px", padding: "12px", marginBottom: "10px", lineHeight: "1.5" };

const calendarTop = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" };
const plannerTop = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: "10px" };
const calendarBtn = { background: "#ff4b55", color: "white", border: "none", borderRadius: "6px", padding: "8px 14px", fontSize: "20px", cursor: "pointer" };
const calendarGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid #dde2ea", borderLeft: "1px solid #dde2ea" };
const calendarHeader = { padding: "7px", textAlign: "center", fontWeight: "700", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea" };
const calendarDay = { height: "88px", padding: "5px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", cursor: "pointer", background: "white", overflow: "hidden" };
const calendarDayPlanificacio = { minHeight: "102px", padding: "5px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", background: "white", overflow: "hidden" };
const calendarDayCurs = { background: "#fff1a8", border: "2px solid #facc15" };
const calendarNumber = { textAlign: "right", fontWeight: "600", marginBottom: "4px", fontSize: "13px" };
const eventSlot = { background: "#3b82f6", color: "white", borderRadius: "5px", padding: "3px 5px", fontSize: "11px", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" };
const eventOperacioProgramada = { background: "#16a34a", color: "white", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", marginBottom: "4px", lineHeight: "1.25" };
const resumPlanner = { background: "#eef6ff", border: "1px solid #9ec9ff", color: "#003b8e", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px", fontWeight: "700" };

const chipsBox = { marginTop: "6px", border: "1px solid #d6dbe3", background: "#f1f3f7", borderRadius: "10px", padding: "8px" };
const chipsSeleccionades = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" };
const chipsOpcions = { display: "flex", flexWrap: "wrap", gap: "8px" };
const chipSelected = { border: "none", background: "#ff4b55", color: "white", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", cursor: "pointer" };
const chipOption = { border: "1px solid #d5dce8", background: "white", color: "#1f2a44", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", cursor: "pointer" };

export default App;
