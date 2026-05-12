import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const API_URL = "https://tfg-planificador-hbp.onrender.com";
const TOKEN_KEY = "planner_hbp_token";
const USER_KEY = "planner_hbp_user";

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
  slot_de_curs: false,
  cirurgia_benigna: false,
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

const mesos = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [usuari, setUsuari] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [errorLogin, setErrorLogin] = useState("");
  const [pestanya, setPestanya] = useState("alta");
  const [sidebarOberta, setSidebarOberta] = useState(true);

  const [form, setForm] = useState(formInicial);
  const [cirugias, setCirugias] = useState([]);
  const [cerca, setCerca] = useState("");
  const [cercaHistoric, setCercaHistoric] = useState("");
  const [subPestanyaRegistrades, setSubPestanyaRegistrades] = useState("actives");
  const [cirurgiaEditant, setCirurgiaEditant] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [slots, setSlots] = useState([]);
  const [mesActual, setMesActual] = useState(new Date());
  const [diaSeleccionat, setDiaSeleccionat] = useState(null);
  const [modalSlot, setModalSlot] = useState(false);
  const [accioSlot, setAccioSlot] = useState(null);
  const [slotForm, setSlotForm] = useState(slotInicial);
  const [slotEditant, setSlotEditant] = useState(null);

  const [planificacioValidada, setPlanificacioValidada] = useState([]);
  const [propostaReprogramacio, setPropostaReprogramacio] = useState(null);
  const [avisReprogramacio, setAvisReprogramacio] = useState(null);
  const [vistaPlanner, setVistaPlanner] = useState("mensual");
  const [cirurgiaPlannerSeleccionada, setCirurgiaPlannerSeleccionada] = useState(null);
  const plannerRef = useRef(null);
  const esAdmin = usuari?.role === "admin";

  const [esMobil, setEsMobil] = useState(window.innerWidth < 768);

useEffect(() => {
  const detectarMobil = () => setEsMobil(window.innerWidth < 768);
  window.addEventListener("resize", detectarMobil);
  return () => window.removeEventListener("resize", detectarMobil);
}, []);

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  const authFetch = (url, options = {}) => {
    const headers = { ...(options.headers || {}), ...authHeaders() };
    return fetch(url, { ...options, headers }).then((res) => {
      if (res.status === 401) {
        tancarSessio();
        throw new Error("Sessió caducada");
      }
      return res;
    });
  };

  const iniciarSessio = () => {
    setErrorLogin("");
    fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "No s'ha pogut iniciar sessió.");
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.access_token);
        setUsuari(data.user);
        setLoginForm({ username: "", password: "" });
      })
      .catch((error) => setErrorLogin(error.message));
  };

  const tancarSessio = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUsuari(null);
    setPlanificacioValidada([]);
    setPropostaReprogramacio(null);
  };

  const carregarCirurgies = () => {
    authFetch(`${API_URL}/cirugias`)
      .then((res) => res.json())
      .then((data) => setCirugias(data || []))
      .catch(console.error);
  };

  const carregarSlots = () => {
    authFetch(`${API_URL}/slots`)
      .then((res) => res.json())
      .then((data) => setSlots((data || []).filter((slot) => slot.tipus_registre !== "Dia de curs")))
      .catch(console.error);
  };

  const carregarPlannerActual = () => {
    authFetch(`${API_URL}/planner/actual`)
      .then((res) => res.json())
      .then((data) => setPlanificacioValidada(data || []))
      .catch(console.error);
  };

  useEffect(() => {
    if (!token) return;
    carregarCirurgies();
    carregarSlots();
    carregarPlannerActual();
  }, [token]);

  useEffect(() => {
    if (!esAdmin && pestanya === "slots") {
      setPestanya("planificacio");
    }
  }, [esAdmin, pestanya]);

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

  const formatDataVista = (dataText) => {
    if (!dataText) return "";
    const [any, mes, dia] = String(dataText).split("-");
    if (!any || !mes || !dia) return String(dataText);
    return `${dia}/${mes}/${any}`;
  };

  const formatDataLlarga = (data) =>
    data.toLocaleDateString("ca-ES", { day: "numeric", month: "long", year: "numeric" });

  const avuiText = () => formatDataLocal(new Date());

  const calcularDiesEspera = (cirurgia) => {
    const dataBase = cirurgia?.data_solicitud_operacio || cirurgia?.created_at;
    if (!dataBase) return 0;
    const inici = new Date(dataBase);
    const avui = new Date();
    inici.setHours(0, 0, 0, 0);
    avui.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((avui - inici) / (1000 * 60 * 60 * 24)));
  };

  const getSlotData = (slot) => slot?.fecha || "";
  const getSlotQuirofan = (slot) => slot?.quirofano || "";
  const getSlotFranja = (slot) => slot?.franja || "";
  const getSlotTipus = (slot) => parseArray(slot?.tipo_cirugia);
  const getSlotCirurgians = (slot) => parseArray(slot?.cirujanos_disponibles);
  const esDiaCurs = (slot) => slot?.tipus_registre === "Dia de curs";
  const esSlotDeCurs = (slot) => slot?.slot_de_curs === true;
  const esSlotBenigne = (slot) => slot?.cirurgia_benigna === true;

  const diaTeSlotDeCurs = (data) =>
    slots.some((slot) => getSlotData(slot) === formatDataLocal(data) && esSlotDeCurs(slot));

  const getUsuariActualRegistre = () => usuari?.username || usuari?.email || usuari?.id || "demo";

  const getRegistratPer = (cirurgia) =>
    cirurgia?.registrat_per ||
    cirurgia?.registrado_por ||
    cirurgia?.created_by ||
    cirurgia?.creat_per ||
    cirurgia?.user?.username ||
    cirurgia?.usuari?.username ||
    cirurgia?.user_id ||
    "No informat";

  const normalitza = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const esSlotCompatibleAmbCirurgia = (slot, cirurgia) => {
    if (!slot || !cirurgia || esDiaCurs(slot) || esSlotBenigne(slot)) return false;
    const tipusSlot = getSlotTipus(slot).map(normalitza);
    const quirofan = String(getSlotQuirofan(slot));
    const tipusCirurgia = normalitza(cirurgia.tipo_cirugia);
    if (tipusCirurgia === "robotica") return quirofan === "2.1" || quirofan === "2.2" || tipusSlot.includes("robotica");
    if (tipusCirurgia === "oberta") return tipusSlot.includes("oberta");
    if (tipusCirurgia === "laparoscopica") return tipusSlot.includes("laparoscopica");
    return true;
  };

  const datesDiaCursDisponibles = (dades) => {
    const dates = [
      ...new Set(
        slots
          .filter((slot) => esSlotDeCurs(slot))
          .filter((slot) => getSlotData(slot) >= avuiText())
          .filter((slot) => dades?.tipo_cirugia && esSlotCompatibleAmbCirurgia(slot, { tipo_cirugia: dades.tipo_cirugia }))
          .map((slot) => getSlotData(slot))
          .filter(Boolean)
      ),
    ];
    return dates.sort((a, b) => a.localeCompare(b));
  };

  const slotsQuirurgicsDisponiblesPerData = () => {
    const mapa = {};
    slots
      .filter((s) => !esDiaCurs(s) && !esSlotBenigne(s))
      .filter((s) => getSlotData(s) >= avuiText())
      .forEach((slot) => {
        const data = getSlotData(slot);
        if (!data) return;
        if (!mapa[data]) mapa[data] = [];
        mapa[data].push(slot);
      });

    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, slotsDia]) => ({
        data,
        slots: slotsDia.sort((a, b) => String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || ""))),
      }));
  };

  const seleccionarDataIntelligent = (camp, data, mode = "alta") => {
    const dades = mode === "alta" ? form : editForm;
    const setDades = mode === "alta" ? setForm : setEditForm;
    setDades({ ...dades, [camp]: data });
  };

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
    if (area === "Vesícula biliar") return ["Colecistectomia + segmentectomia 4b + 5", "Segmentectomia 4b + 5"];
    return [];
  };

  const actualitzarCamp = (e, mode = "alta") => {
    const { name, value, type, checked } = e.target;
    const dades = mode === "alta" ? form : editForm;
    const setDades = mode === "alta" ? setForm : setEditForm;

    if (name === "area_neoplasia") {
      setDades({ ...dades, area_neoplasia: value, tipus_neoplasia: value === "Vesícula biliar" ? "Vesícula biliar" : "", operacio: "", lateralitat: "", segments: [] });
      return;
    }

    if (name === "tumor") {
      setDades({ ...dades, tumor: value, operacio: "", lateralitat: "", segments: [] });
      return;
    }

    if (name === "dia_curs") {
      setDades({ ...dades, dia_curs: checked, fijada: checked ? false : dades.fijada, fecha_fijada: checked ? "" : dades.fecha_fijada, fecha_dia_curs: checked ? dades.fecha_dia_curs : "" });
      return;
    }

    if (name === "fijada") {
      setDades({ ...dades, fijada: checked, dia_curs: checked ? false : dades.dia_curs, fecha_dia_curs: checked ? "" : dades.fecha_dia_curs });
      return;
    }

    setDades({ ...dades, [name]: type === "checkbox" ? checked : value });
  };

  const canviarSegment = (segment, mode = "alta") => {
    const dades = mode === "alta" ? form : editForm;
    const setDades = mode === "alta" ? setForm : setEditForm;
    const segments = dades.segments.includes(segment) ? dades.segments.filter((s) => s !== segment) : [...dades.segments, segment];
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
      data_solicitud_operacio: cirurgiaOriginal?.data_solicitud_operacio || new Date().toISOString().split("T")[0],
      user_id: cirurgiaOriginal?.user_id || getUsuariActualRegistre(),
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
      fecha_fijada: dades.fijada ? dades.fecha_fijada || null : dades.dia_curs ? dades.fecha_dia_curs || null : null,
      hora_inicio_fija: cirurgiaOriginal?.hora_inicio_fija || null,
      comentarios: dades.comentarios || null,
      realizada_validada: dades.estat_cas === "Operat",
      dia_curs: dades.dia_curs,
      fecha_dia_curs: dades.dia_curs ? dades.fecha_dia_curs || null : null,
    };
  };

  const validarFormulari = (dades) => {
    if (!dades.codigo.trim()) return "El codi del cas és obligatori.";
    if (dades.neoadjuvancia && dades.fecha_fin_neo && dades.fecha_fin_neo > avuiText()) return "La data de finalització de la neoadjuvància no pot ser futura.";
    if (!dades.tumor) return "Selecciona si el tumor és benigne o maligne.";
    if (!dades.area_neoplasia) return "Selecciona l’origen de la neoplàsia.";
    if (!dades.tipus_neoplasia) return "Selecciona el tipus de neoplàsia.";
    if (!dades.tipo_cirugia) return "Selecciona el tipus de cirurgia.";
    if (!dades.operacio) return "Selecciona el tipus d’operació.";
    if (dades.operacio === "Hepatectomia" && !dades.lateralitat) return "Selecciona la lateralitat.";
    if (dades.operacio === "Segmentectomia" && dades.segments.length === 0) return "Selecciona almenys un segment.";
    if (dades.dia_curs && !dades.fecha_dia_curs) return "Selecciona un slot de curs compatible.";
    if (dades.fijada && !dades.fecha_fijada) return "Selecciona una data fixada.";
    return null;
  };

  const guardarCirurgia = () => {
    const error = validarFormulari(form);
    if (error) return alert(error);
    authFetch(`${API_URL}/cirugias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadCirurgia(form)),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
      })
      .then(() => {
        setForm(formInicial);
        carregarCirurgies();
        alert("Cirurgia afegida correctament.");
      })
      .catch((error) => alert(`Error guardant cirurgia:\n${error.message}`));
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

    const payload = crearPayloadCirurgia(editForm, cirurgiaEditant);
    authFetch(`${API_URL}/cirugias/${cirurgiaEditant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data, null, 2));
        return data;
      })
      .then(() => {
        setCirurgiaEditant(null);
        setEditForm(null);
        carregarCirurgies();
        carregarPlannerActual();
        alert("Canvis guardats correctament.");
      })
      .catch((error) => alert(`Error guardant canvis:\n${error.message}`));
  };

  const eliminarCirurgiaEditant = () => {
    if (!cirurgiaEditant) return;
    if (!window.confirm(`Segur que vols eliminar la cirurgia ${cirurgiaEditant.codigo}? Aquesta acció no es pot desfer.`)) return;
    authFetch(`${API_URL}/cirugias/${cirurgiaEditant.id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
      })
      .then(() => {
        setCirurgiaEditant(null);
        setEditForm(null);
        carregarCirurgies();
        carregarPlannerActual();
        alert("Cirurgia eliminada correctament.");
      })
      .catch((error) => alert(`Error eliminant cirurgia:\n${error.message}`));
  };

  const validarCirurgiaRealitzada = (cirurgiaId) => {
  if (!window.confirm("Confirmes que aquesta cirurgia s’ha realitzat?")) return;

  authFetch(`${API_URL}/cirugias/${cirurgiaId}/validar-realitzada`, {
    method: "POST",
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No s’ha pogut validar la cirurgia.");
      return data;
    })
    .then(() => {
      carregarCirurgies();
      carregarPlannerActual();
      alert("Cirurgia validada com a realitzada.");
    })
    .catch((error) => alert(`Error:\n${error.message}`));
};

const retornarCirurgiaAPendents = (cirurgiaId) => {
  if (!window.confirm("Confirmes que aquesta cirurgia NO s’ha realitzat i ha de tornar a pendents?")) return;

  authFetch(`${API_URL}/cirugias/${cirurgiaId}/retornar-pendents`, {
    method: "POST",
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No s’ha pogut retornar la cirurgia a pendents.");
      return data;
    })
    .then(() => {
      carregarCirurgies();
      carregarPlannerActual();
      alert("Cirurgia retornada a pendents.");
    })
    .catch((error) => alert(`Error:\n${error.message}`));
};
  const obrirModalDia = (data) => {
    setDiaSeleccionat(data);
    setAccioSlot(null);
    setSlotEditant(null);
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
    setAccioSlot("slot");
    setSlotForm({
      quirofan: quirofansFixos.includes(quirofan) ? quirofan : "Altres",
      quirofan_altres: quirofansFixos.includes(quirofan) ? "" : quirofan,
      franja: getSlotFranja(slot) || "Matí",
      hora_inicio: slot.hora_inicio || "08:00",
      hora_fin: slot.hora_fin || "15:00",
      tipus_cirurgia: Array.isArray(tipusGuardats) && tipusGuardats.length > 0 ? tipusGuardats : quirofan === "2.1" || quirofan === "2.2" ? ["Robòtica"] : ["Oberta", "Laparoscòpica"],
      cirurgians: getSlotCirurgians(slot),
      slot_de_curs: !!slot.slot_de_curs,
      cirurgia_benigna: !!slot.cirurgia_benigna,
      comentarios: slot.comentari || "",
    });
    setModalSlot(true);
  };

  const canviarQuirofan = (valor) => {
    let tipus = [];
    if (valor === "1.6" || valor === "1.7") tipus = ["Oberta", "Laparoscòpica"];
    else if (valor === "2.1" || valor === "2.2") tipus = ["Robòtica"];
    setSlotForm({ ...slotForm, quirofan: valor, quirofan_altres: valor === "Altres" ? slotForm.quirofan_altres : "", tipus_cirurgia: tipus });
  };

  const toggleTipusCirurgia = (tipus) => {
    const novaLlista = slotForm.tipus_cirurgia.includes(tipus) ? slotForm.tipus_cirurgia.filter((t) => t !== tipus) : [...slotForm.tipus_cirurgia, tipus];
    setSlotForm({ ...slotForm, tipus_cirurgia: novaLlista });
  };

  const toggleCirurgiaDisponible = (nom) => {
    const novaLlista = slotForm.cirurgians.includes(nom) ? slotForm.cirurgians.filter((c) => c !== nom) : [...slotForm.cirurgians, nom];
    setSlotForm({ ...slotForm, cirurgians: novaLlista });
  };

  const crearPayloadSlot = () => {
    const numeroQuirofan = slotForm.quirofan === "Altres" ? slotForm.quirofan_altres.trim() : slotForm.quirofan;
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
      slot_de_curs: !!slotForm.slot_de_curs,
      cirurgia_benigna: !!slotForm.cirurgia_benigna,
    };
  };

  const existeixSlotDuplicat = () => {
    if (!diaSeleccionat) return false;
    const dataText = formatDataLocal(diaSeleccionat);
    const numeroQuirofan = slotForm.quirofan === "Altres" ? slotForm.quirofan_altres.trim() : slotForm.quirofan;
    return slots.some((slot) => !esDiaCurs(slot) && slot.id !== slotEditant?.id && getSlotData(slot) === dataText && String(getSlotQuirofan(slot)) === String(numeroQuirofan) && String(getSlotFranja(slot)) === String(slotForm.franja));
  };

  const guardarSlot = () => {
    if (slotForm.quirofan === "Altres" && !slotForm.quirofan_altres.trim()) return alert("Escriu el número de quiròfan.");
    if (slotForm.tipus_cirurgia.length === 0) return alert("Selecciona almenys un tipus de cirurgia.");
    if (existeixSlotDuplicat()) return alert("Ja existeix un slot en aquest quiròfan, data i franja horària.");

    const url = slotEditant ? `${API_URL}/slots/${slotEditant.id}` : `${API_URL}/slots`;
    authFetch(url, {
      method: slotEditant ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crearPayloadSlot()),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data, null, 2));
      })
      .then(() => {
        setModalSlot(false);
        setDiaSeleccionat(null);
        setAccioSlot(null);
        setSlotEditant(null);
        setSlotForm(slotInicial);
        carregarSlots();
        carregarPlannerActual();
      })
      .catch((error) => alert(`Error guardant slot:\n${error.message}`));
  };

  const eliminarSlot = () => {
    if (!slotEditant) return;
    if (!window.confirm("Vols eliminar aquest slot?")) return;
    authFetch(`${API_URL}/slots/${slotEditant.id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
      })
      .then(() => {
        setModalSlot(false);
        setSlotEditant(null);
        setAccioSlot(null);
        carregarSlots();
        carregarPlannerActual();
      })
      .catch((error) => alert(`Error eliminant slot:\n${error.message}`));
  };

  const getDataFixadaCirurgia = (cirurgia) => cirurgia?.fecha_dia_curs || cirurgia?.fecha_fijada || null;

  const assignacioRespectaFixacio = (assignacio) => {
    const cirurgia = assignacio?.cirurgia;
    const slot = assignacio?.slot;
    const dataFixada = getDataFixadaCirurgia(cirurgia);
    if ((cirurgia?.fijada || cirurgia?.dia_curs) && dataFixada) return getSlotData(slot) === dataFixada;
    return true;
  };

  const generarProgramacioActual = () => propostaReprogramacio || planificacioValidada || [];

  const executarReprogramacio = () => {
    if (!window.confirm("Segur que vols reprogramar les cirurgies?")) return;
    authFetch(`${API_URL}/planner/proposta`)
      .then((res) => res.json())
      .then((data) => {
        let proposta = data.assignacions || [];
        const assignacionsInvalides = proposta.filter((assignacio) => !assignacioRespectaFixacio(assignacio));
        proposta = proposta.filter(assignacioRespectaFixacio);
        if (assignacionsInvalides.length > 0) alert("S’han descartat assignacions que no respectaven una data fixada manualment o una cirurgia de curs.");
        if (proposta.length === 0) return alert("No s’ha pogut programar cap cirurgia. Revisa que hi hagi cirurgies pendents i slots quirúrgics compatibles.");
        setPropostaReprogramacio(proposta);
        if ((data.conflictes_fixades || []).length > 0) {
  const textConflictes = data.conflictes_fixades
    .map((conflicte) => {
      const cirurgies = (conflicte.cirurgies || [])
        .map((c) => `- ${c.codigo} · ${c.tipo_operacion_principal || "Operació no informada"} · ${c.tipo_cirugia || "Tipus no informat"}`)
        .join("\n");

      return `Data ${formatDataVista(conflicte.data)}\n${conflicte.missatge}\n${cirurgies}`;
    })
    .join("\n\n");

  alert(`Conflictes detectats en cirurgies fixades:\n\n${textConflictes}`);
}

setAvisReprogramacio(data.canvis || []);
      })
      .catch(console.error);
  };

  const validarReprogramacio = () => {
    authFetch(`${API_URL}/planner/validar`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        alert(`Planificació validada. ${data.total_programades} cirurgies programades.`);
        setAvisReprogramacio(null);
        setPropostaReprogramacio(null);
        carregarCirurgies();
        carregarSlots();
        carregarPlannerActual();
      })
      .catch(console.error);
  };

  const cancelarReprogramacio = () => {
    setAvisReprogramacio(null);
    setPropostaReprogramacio(null);
  };

  const slotsDelDiaSeleccionat = () => {
    if (!diaSeleccionat) return [];
    const dataText = formatDataLocal(diaSeleccionat);
    return slots
      .filter((slot) => getSlotData(slot) === dataText)
      .filter((slot) => !esDiaCurs(slot))
      .sort((a, b) => String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || "")));
  };

  const cirurgiesFiltrades = cirugias.filter((c) => c.codigo?.toLowerCase().includes(cerca.toLowerCase()));
  const cirurgiesPendents = cirurgiesFiltrades.filter((c) => c.estat_cas === "Pendent");

const cirurgiesProgramades = cirurgiesFiltrades.filter((c) => c.estat_cas === "Programat");

const cirurgiesPendentsValidacio = cirugias
  .filter((c) => c.estat_cas === "Pendent validació")
  .filter((c) => c.codigo?.toLowerCase().includes(cercaHistoric.toLowerCase()));

const cirurgiesOperadesFiltrades = cirugias
  .filter((c) => c.estat_cas === "Operat")
  .filter((c) => c.codigo?.toLowerCase().includes(cercaHistoric.toLowerCase()));

  const SelectorDatesDiaCurs = ({ dades, mode }) => {
    const datesDisponibles = datesDiaCursDisponibles(dades);
    const datesSet = new Set(datesDisponibles);
    const dataBase = dades.fecha_dia_curs ? new Date(dades.fecha_dia_curs) : mesActual;
    const any = dataBase.getFullYear();
    const mes = dataBase.getMonth();
    const primerDia = new Date(any, mes, 1);
    const iniciCalendari = new Date(primerDia);
    const diaSetmana = primerDia.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);
    const dies = Array.from({ length: 42 }, (_, i) => {
      const data = new Date(iniciCalendari);
      data.setDate(iniciCalendari.getDate() + i);
      return data;
    });

    if (datesDisponibles.length === 0) return <div style={avisSelector}>Encara no hi ha cap slot de curs futur compatible amb aquest tipus de cirurgia.</div>;

    return (
      <div style={selectorDatesBox}>
        <div style={miniCalendarTop}>
          <button type="button" style={miniCalendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button>
          <strong>{mesos[mes]} del {any}</strong>
          <button type="button" style={miniCalendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button>
        </div>
        <div style={miniCalendarGrid}>
          {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => <div key={d} style={miniCalendarHeader}>{d}</div>)}
          {dies.map((data) => {
            const dataText = formatDataLocal(data);
            const esDisponible = datesSet.has(dataText);
            const foraMes = data.getMonth() !== mes;
            const esSeleccionada = dades.fecha_dia_curs === dataText;
            return (
              <button
                key={dataText}
                type="button"
                disabled={!esDisponible}
                style={{ ...miniCalendarDay, ...(foraMes ? miniCalendarDayForaMes : {}), ...(esDisponible ? miniCalendarDayCurs : {}), ...(esSeleccionada ? miniCalendarDaySeleccionat : {}) }}
                onClick={() => seleccionarDataIntelligent("fecha_dia_curs", dataText, mode)}
              >
                {data.getDate()}
              </button>
            );
          })}
        </div>
        <div style={miniCalendarLlegenda}>Els dies marcats en groc tenen un slot de curs compatible.</div>
      </div>
    );
  };

  const SelectorDataManual = ({ dades, mode }) => {
  const datesDisponibles = [
    ...new Set(
      slots
        .filter((slot) => !esDiaCurs(slot))
        .filter((slot) => !esSlotBenigne(slot))
        .filter((slot) => getSlotData(slot) >= avuiText())
        .filter((slot) =>
          dades?.tipo_cirugia &&
          esSlotCompatibleAmbCirurgia(slot, {
            tipo_cirugia: dades.tipo_cirugia,
          })
        )
        .map((slot) => getSlotData(slot))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const datesSet = new Set(datesDisponibles);
  const datesCursSet = new Set(
  slots
    .filter((slot) => esSlotDeCurs(slot))
    .filter((slot) => !esSlotBenigne(slot))
    .filter((slot) => getSlotData(slot) >= avuiText())
    .filter((slot) =>
      dades?.tipo_cirugia &&
      esSlotCompatibleAmbCirurgia(slot, {
        tipo_cirugia: dades.tipo_cirugia,
      })
    )
    .map((slot) => getSlotData(slot))
    .filter(Boolean)
);
  const dataBase = dades.fecha_fijada ? new Date(dades.fecha_fijada) : mesActual;
  const any = dataBase.getFullYear();
  const mes = dataBase.getMonth();

  const primerDia = new Date(any, mes, 1);
  const iniciCalendari = new Date(primerDia);
  const diaSetmana = primerDia.getDay();
  const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
  iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);

  const dies = Array.from({ length: 42 }, (_, i) => {
    const data = new Date(iniciCalendari);
    data.setDate(iniciCalendari.getDate() + i);
    return data;
  });

  if (!dades.tipo_cirugia) {
    return (
      <div style={avisSelector}>
        Primer selecciona el tipus de cirurgia per veure els slots compatibles.
      </div>
    );
  }

  if (datesDisponibles.length === 0) {
    return (
      <div style={avisSelector}>
        No hi ha cap slot futur compatible amb aquest tipus de cirurgia.
      </div>
    );
  }

  if (dades.fecha_fijada) {
    return (
      <div style={dataManualSeleccionadaBox}>
        <div>
          <span style={dataManualLabel}>Data fixada</span>
          <strong>{formatDataVista(dades.fecha_fijada)}</strong>
        </div>
        <button
          type="button"
          style={dataManualCanviarBtn}
          onClick={() => seleccionarDataIntelligent("fecha_fijada", "", mode)}
        >
          Canviar
        </button>
      </div>
    );
  }

  return (
    <div style={selectorDatesBox}>
      <div style={miniCalendarTop}>
        <button
          type="button"
          style={miniCalendarBtn}
          onClick={() => setMesActual(new Date(any, mes - 1, 1))}
        >
          ‹
        </button>

        <strong>
          {mesos[mes]} del {any}
        </strong>

        <button
          type="button"
          style={miniCalendarBtn}
          onClick={() => setMesActual(new Date(any, mes + 1, 1))}
        >
          ›
        </button>
      </div>

      <div style={miniCalendarGrid}>
        {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => (
          <div key={d} style={miniCalendarHeader}>
            {d}
          </div>
        ))}

        {dies.map((data) => {
          const dataText = formatDataLocal(data);
          const foraMes = data.getMonth() !== mes;
          const esDisponible = datesSet.has(dataText);
          const esCurs = datesCursSet.has(dataText);
          const esSeleccionada = dades.fecha_fijada === dataText;

          return (
            <button
              key={dataText}
              type="button"
              disabled={!esDisponible}
              style={{
                ...miniCalendarDay,
                ...(foraMes ? miniCalendarDayForaMes : {}),
                ...(esDisponible ? miniCalendarDayDisponible : {}),
                ...(esCurs ? miniCalendarDayCurs : {}),
                ...(esSeleccionada ? miniCalendarDaySeleccionat : {}),
              }}
              onClick={() =>
                seleccionarDataIntelligent("fecha_fijada", dataText, mode)
              }
            >
              {data.getDate()}
            </button>
          );
        })}
      </div>

      <div style={miniCalendarLlegenda}>
        Només es poden seleccionar dies amb slots futurs compatibles.
      </div>
    </div>
  );
};

  const FormulariCirurgia = ({ dades, mode }) => (
    <>
      <label style={labelFull}>Codi del cas<input name="codigo" value={dades.codigo} onChange={(e) => actualitzarCamp(e, mode)} style={input} placeholder="Introdueix el codi o identificador del cas" /></label>

      {mode === "edicio" && (
        <label style={labelFull}>Estat del cas<select name="estat_cas" value={dades.estat_cas} onChange={(e) => actualitzarCamp(e, mode)} style={input}><option>Pendent</option><option>Programat</option><option>Operat</option><option>Cancel·lat</option></select></label>
      )}

      <div style={gridDosColumnes}>
        <section>
          <div style={capcalera}>Variables clíniques</div>
          {mode === "edicio" && <label style={label}>Registrat per<input value={getRegistratPer(cirurgiaEditant)} disabled style={input} /></label>}
          <label style={label}>Tumor<select name="tumor" value={dades.tumor} onChange={(e) => actualitzarCamp(e, mode)} style={input}><option value="">Selecciona una opció</option><option>Benigne</option><option>Maligne</option></select></label>
          <label style={checkLabel}><input type="checkbox" name="neoadjuvancia" checked={dades.neoadjuvancia} onChange={(e) => actualitzarCamp(e, mode)} />Neoadjuvància</label>
          {dades.neoadjuvancia && <label style={label}>Data de finalització de la neoadjuvància<input type="date" name="fecha_fin_neo" value={dades.fecha_fin_neo} max={avuiText()} onChange={(e) => actualitzarCamp(e, mode)} style={input} /></label>}
          <label style={label}>Bilirrubina mg/dl<input type="number" step="0.1" name="bilirrubina" value={dades.bilirrubina} onChange={(e) => actualitzarCamp(e, mode)} style={input} placeholder="0,0" /></label>
          <label style={label}>Origen de neoplàsia<select name="area_neoplasia" value={dades.area_neoplasia} onChange={(e) => actualitzarCamp(e, mode)} style={input}><option value="">Selecciona una opció</option><option>Fetge</option><option>Pàncrees</option><option>Vesícula biliar</option></select></label>
          <label style={label}>Tipus de neoplàsia<select name="tipus_neoplasia" value={dades.tipus_neoplasia} onChange={(e) => actualitzarCamp(e, mode)} style={input} disabled={!dades.area_neoplasia}><option value="">Selecciona una opció</option>{opcionsNeoplasia(dades.area_neoplasia).map((opcio) => <option key={opcio}>{opcio}</option>)}</select></label>
        </section>

        <section>
          <div style={capcalera}>Procediment</div>
          <label style={label}>Tipus de cirurgia<select name="tipo_cirugia" value={dades.tipo_cirugia} onChange={(e) => actualitzarCamp(e, mode)} style={input}><option value="">Selecciona una opció</option><option>Laparoscòpica</option><option>Oberta</option><option>Robòtica</option></select></label>
          <label style={label}>Tipus d’operació<select name="operacio" value={dades.operacio} onChange={(e) => actualitzarCamp(e, mode)} style={input} disabled={!dades.area_neoplasia || !dades.tumor}><option value="">Selecciona una opció</option>{opcionsOperacio(dades.area_neoplasia, dades.tumor).map((opcio) => <option key={opcio}>{opcio}</option>)}</select></label>
          {dades.operacio === "Hepatectomia" && <label style={label}>Lateralitat<select name="lateralitat" value={dades.lateralitat} onChange={(e) => actualitzarCamp(e, mode)} style={input}><option value="">Selecciona una opció</option><option>Dreta</option><option>Esquerra</option></select></label>}
          {dades.operacio === "Segmentectomia" && <div style={segmentsBox}><span style={miniTitle}>Segments hepàtics</span>{["1", "2", "3", "4a", "4b", "5", "6", "7", "8"].map((segment) => <label key={segment} style={segmentLabel}><input type="checkbox" checked={dades.segments.includes(segment)} onChange={() => canviarSegment(segment, mode)} /> S{segment}</label>)}</div>}
          <label style={checkLabel}><input type="checkbox" name="dia_curs" checked={dades.dia_curs} onChange={(e) => actualitzarCamp(e, mode)} />Cirurgia de curs</label>
          {dades.dia_curs && SelectorDatesDiaCurs({ dades, mode })}
          {!dades.dia_curs && <label style={checkLabel}><input type="checkbox" name="fijada" checked={dades.fijada} onChange={(e) => actualitzarCamp(e, mode)} />Fixar manualment</label>}
          {dades.fijada && !dades.dia_curs && SelectorDataManual({ dades, mode })}
          <label style={label}>Comentaris<textarea name="comentarios" value={dades.comentarios} onChange={(e) => actualitzarCamp(e, mode)} style={textarea} placeholder="Comentaris clínics o organitzatius" /></label>
        </section>
      </div>
    </>
  );

  const ChipsSelector = ({ opcions, seleccionades, onToggle }) => (
    <div style={chipsBox}>
      {seleccionades.length > 0 && <div style={chipsSeleccionades}>{seleccionades.map((opcio) => <button key={opcio} type="button" style={chipSelected} onClick={() => onToggle(opcio)}>{opcio} ×</button>)}</div>}
      <div style={chipsOpcions}>{opcions.filter((opcio) => !seleccionades.includes(opcio)).map((opcio) => <button key={opcio} type="button" style={chipOption} onClick={() => onToggle(opcio)}>{opcio}</button>)}</div>
    </div>
  );

  const CalendariSlots = () => {
    const any = mesActual.getFullYear();
    const mes = mesActual.getMonth();
    const primerDia = new Date(any, mes, 1);
    const iniciCalendari = new Date(primerDia);
    const diaSetmana = primerDia.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);
    const dies = Array.from({ length: 42 }, (_, i) => {
      const data = new Date(iniciCalendari);
      data.setDate(iniciCalendari.getDate() + i);
      return data;
    });
    const slotsPerDia = (data) => slots.filter((s) => getSlotData(s) === formatDataLocal(data));

    return (
      <>
        <div style={calendarTop}>
          <div style={{ display: "flex", gap: "8px" }}><button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button><button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button></div>
          <h2 style={{ margin: 0 }}>{mesos[mes]} del {any}</h2>
          <div />
        </div>
        <div style={calendarGrid}>
          {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => <div key={d} style={calendarHeader}>{d}</div>)}
          {dies.map((data) => {
            const events = slotsPerDia(data).filter((s) => !esDiaCurs(s));
            const teSlotCurs = diaTeSlotDeCurs(data);
            return (
              <div key={formatDataLocal(data)} style={{ ...calendarDay, opacity: data.getMonth() !== mes ? 0.35 : 1 }} onClick={() => obrirModalDia(data)}>
                <div style={calendarNumber}><span style={teSlotCurs ? calendarNumberCurs : {}}>{data.getDate()}</span></div>
                {events.slice(0, 2).map((slot) => (
                  <div key={slot.id} style={esSlotBenigne(slot) ? eventSlotBenigna : esSlotDeCurs(slot) ? eventSlotCurs : eventSlot} onClick={(e) => obrirEditorSlot(e, slot)}>
                    {getSlotQuirofan(slot) ? `Q${getSlotQuirofan(slot)}` : "Q?"} · {getSlotFranja(slot) || "Franja"}
                    {esSlotDeCurs(slot) && " · curs"}
                    {esSlotBenigne(slot) && " · benign"}
                  </div>
                ))}
                {events.length > 2 && <div style={eventSlotMes}>+{events.length - 2} slots més</div>}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const getTipusCanviAssignacio = (assignacio) => {
    if (!propostaReprogramacio) return "validada";
    const cirurgiaId = assignacio?.cirurgia?.id;
    const canvi = (avisReprogramacio || []).find((c) => c?.cirurgia?.id === cirurgiaId);
    return canvi?.tipus || "igual";
  };

  const getEstilAssignacioPlanner = (assignacio) => {
    const tipus = getTipusCanviAssignacio(assignacio);
    if (tipus === "igual") return eventOperacioSenseCanvis;
    if (tipus === "nova") return eventOperacioNova;
    if (tipus === "moguda") return eventOperacioMoguda;
    return eventOperacioProgramada;
  };

  const cirurgiesPendentsPerReprogramacio = () => (avisReprogramacio || []).filter((canvi) => canvi.tipus === "pendent");

  const descarregarPlannerPDF = async () => {
    if (!plannerRef.current) return;
    const canvas = await html2canvas(plannerRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("landscape", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20));
    pdf.save(`planner_${vistaPlanner}.pdf`);
  };

  const obrirModalCirurgiaPlanner = (e, assignacio) => {
    e.stopPropagation();
    setCirurgiaPlannerSeleccionada(assignacio);
  };

  const iniciSetmana = (dataBase) => {
    const data = new Date(dataBase);
    const diaSetmana = data.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    data.setDate(data.getDate() - offsetDilluns);
    return data;
  };

  const diesSetmanaActual = () => {
    const inici = iniciSetmana(mesActual);
    return Array.from({ length: 7 }, (_, i) => {
      const data = new Date(inici);
      data.setDate(inici.getDate() + i);
      return data;
    });
  };

  const moureSetmana = (quantitat) => {
    const novaData = new Date(mesActual);
    novaData.setDate(novaData.getDate() + quantitat * 7);
    setMesActual(novaData);
  };

  const franjaSolapada = (slotA, slotB) => getSlotData(slotA) === getSlotData(slotB) && getSlotFranja(slotA) === getSlotFranja(slotB);

  const cirurgiansOcupatsPerSlot = (assignacioActual) => {
    const ocupats = new Set();
    generarProgramacioActual().forEach((assignacio) => {
      if (!assignacioActual || !assignacio) return;
      if (assignacio.cirurgia.id === assignacioActual.cirurgia.id) return;
      if (franjaSolapada(assignacio.slot, assignacioActual.slot)) (assignacio.cirujanos_asignados || []).forEach((nom) => ocupats.add(nom));
    });
    return Array.from(ocupats);
  };

  const toggleCirurgiaPlannerParticipant = (nom) => {
    if (!cirurgiaPlannerSeleccionada) return;
    const ocupats = cirurgiansOcupatsPerSlot(cirurgiaPlannerSeleccionada);
    const seleccionats = cirurgiaPlannerSeleccionada.cirujanos_asignados || [];
    if (ocupats.includes(nom) && !seleccionats.includes(nom)) return;
    const novaLlista = seleccionats.includes(nom) ? seleccionats.filter((c) => c !== nom) : [...seleccionats, nom];
    setCirurgiaPlannerSeleccionada({ ...cirurgiaPlannerSeleccionada, cirujanos_asignados: novaLlista });
  };

  const guardarCirurgiansPlanner = () => {
    const seleccionats = cirurgiaPlannerSeleccionada?.cirujanos_asignados || [];
    authFetch(`${API_URL}/planner/cirujanos/${cirurgiaPlannerSeleccionada.cirurgia.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cirujanos_asignados: seleccionats }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(JSON.stringify(await res.json().catch(() => ({}))));
      })
      .then(() => {
        if (propostaReprogramacio) {
          setPropostaReprogramacio(propostaReprogramacio.map((a) => (a.cirurgia.id === cirurgiaPlannerSeleccionada.cirurgia.id ? { ...a, cirujanos_asignados: seleccionats } : a)));
        }
        setPlanificacioValidada(planificacioValidada.map((a) => (a.cirurgia.id === cirurgiaPlannerSeleccionada.cirurgia.id ? { ...a, cirujanos_asignados: seleccionats } : a)));
        setCirurgiaPlannerSeleccionada(null);
        carregarPlannerActual();
      })
      .catch((error) => alert(`Error guardant cirurgians:\n${error.message}`));
  };

  const CalendariPlanner = () => {
    const assignacions = generarProgramacioActual();
    const any = mesActual.getFullYear();
    const mes = mesActual.getMonth();
    const primerDia = new Date(any, mes, 1);
    const iniciCalendari = new Date(primerDia);
    const diaSetmana = primerDia.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);
    const dies = Array.from({ length: 42 }, (_, i) => {
      const data = new Date(iniciCalendari);
      data.setDate(iniciCalendari.getDate() + i);
      return data;
    });
    const assignacionsPerDia = (data) => assignacions.filter((a) => getSlotData(a.slot) === formatDataLocal(data));
    const pendents = cirurgiesPendentsPerReprogramacio();

    return (
      <>
        <div style={plannerToolbar}>
          <button style={botoPlannerSecundariBlau} onClick={() => setVistaPlanner(vistaPlanner === "mensual" ? "setmanal" : "mensual")}>{vistaPlanner === "mensual" ? "Visualització setmanal" : "Visualització mensual"}</button>
          <button style={botoPlannerPetit} onClick={descarregarPlannerPDF}>Descarregar PDF</button>
        </div>

        {propostaReprogramacio && pendents.length > 0 && (
          <div style={avisPendentsBox}>
            <div>Cirurgies que tornen a la llista de pendents:</div>
            <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
              {pendents.map((canvi) => <li key={canvi.cirurgia.id}>{canvi.cirurgia.codigo} · {canvi.cirurgia.tipo_operacion_principal || "Operació no informada"}</li>)}
            </ul>
          </div>
        )}

        <div ref={plannerRef}>
          <div style={plannerTop}>
            <div style={{ display: "flex", gap: "8px" }}>
              {vistaPlanner === "mensual" ? (
                <><button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button><button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button></>
              ) : (
                <><button style={calendarBtn} onClick={() => moureSetmana(-1)}>‹</button><button style={calendarBtn} onClick={() => moureSetmana(1)}>›</button></>
              )}
            </div>
            <h2 style={{ margin: 0 }}>{vistaPlanner === "mensual" ? `${mesos[mes]} del ${any}` : `Setmana del ${formatDataVista(formatDataLocal(diesSetmanaActual()[0]))} al ${formatDataVista(formatDataLocal(diesSetmanaActual()[6]))}`}</h2>
            <div />
          </div>

          {vistaPlanner === "mensual" && (
            <div style={calendarGrid}>
              {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => <div key={d} style={calendarHeader}>{d}</div>)}
              {dies.map((data) => {
                const assignacionsDia = assignacionsPerDia(data);
                return (
                  <div key={formatDataLocal(data)} style={{ ...calendarDayPlanificacio, opacity: data.getMonth() !== mes ? 0.35 : 1 }}>
                    <div style={calendarNumber}><span style={diaTeSlotDeCurs(data) ? calendarNumberCurs : {}}>{data.getDate()}</span></div>
                    {assignacionsDia.map((assignacio) => {
                      const { cirurgia, slot, fixada } = assignacio;
                      return (
                        <div key={`${slot.id}-${cirurgia.id}`} style={esSlotDeCurs(slot) ? eventOperacioCurs : assignacio.cirurgia.fijada ? eventOperacioFixada : getEstilAssignacioPlanner(assignacio)} onClick={(e) => obrirModalCirurgiaPlanner(e, assignacio)}>
                          <div style={plannerOperacioHeader}><span><strong>Q{getSlotQuirofan(slot)}</strong> · {cirurgia.codigo}</span><span style={plannerDiesEspera}>{calcularDiesEspera(cirurgia)} d</span></div>
                          <div>{cirurgia.tipo_operacion_principal || "Operació"}{fixada && <span> · fixada</span>}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {vistaPlanner === "setmanal" && (
            <div style={setmanaGrid}>
              {diesSetmanaActual().map((data) => {
                const dataText = formatDataLocal(data);
                const slotsDia = slots
                  .filter((slot) => getSlotData(slot) === dataText)
                  .filter((slot) => !esDiaCurs(slot))
                  .sort((a, b) => {
                    const ordreFranja = { Matí: 1, Tarda: 2 };
                    const franjaA = ordreFranja[getSlotFranja(a)] || 99;
                    const franjaB = ordreFranja[getSlotFranja(b)] || 99;
                    if (franjaA !== franjaB) return franjaA - franjaB;
                    return String(a.hora_inicio || "").localeCompare(String(b.hora_inicio || ""));
                  });
                const assignacionsDia = assignacionsPerDia(data);
                return (
                  <div key={dataText} style={setmanaDia}>
                    <div style={setmanaHeaderDia}><span style={diaTeSlotDeCurs(data) ? setmanaHeaderDiaCurs : {}}>{data.toLocaleDateString("ca-ES", { weekday: "short", day: "2-digit", month: "2-digit" })}</span></div>
                    {slotsDia.map((slot) => {
                      const assignacioSlot = assignacionsDia.find((a) => a.slot.id === slot.id);
                      if (!assignacioSlot) return null;
                      return (
                        <div key={slot.id} style={esSlotDeCurs(slot) ? setmanaOperacioCurs : assignacioSlot.cirurgia.fijada ? setmanaOperacioFixada : setmanaOperacioBlauVerd} onClick={(e) => obrirModalCirurgiaPlanner(e, assignacioSlot)}>
                          <div style={setmanaOperacioHeader}><strong>Q{getSlotQuirofan(slot) || "?"}</strong><span>{getSlotFranja(slot) || "Franja"}</span></div>
                          <div style={plannerOperacioHeader}><span></span><span style={plannerDiesEsperaClar}>{calcularDiesEspera(assignacioSlot.cirurgia)} d espera</span></div>
                          <div style={setmanaOperacioText}><strong>{assignacioSlot.cirurgia.codigo}</strong></div>
                          <div style={setmanaOperacioText}>{assignacioSlot.cirurgia.tipo_operacion_principal || "Operació no informada"}</div>
                          {(assignacioSlot.cirujanos_asignados || []).length > 0 && <div style={setmanaOperacioDoctors}>{assignacioSlot.cirujanos_asignados.join(", ")}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {esAdmin && <div style={plannerActions}><button style={botoPlannerPetit} onClick={executarReprogramacio}>Reprogramació quirúrgica</button></div>}
        {esAdmin && propostaReprogramacio && <div style={plannerActions}><button style={botoPrincipal} onClick={validarReprogramacio}>Validar proposta</button><button style={botoSecundari} onClick={cancelarReprogramacio}>Cancel·lar proposta</button></div>}
      </>
    );
  };

  if (!token) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h1 style={loginTitle}>Planner quirúrgic HBP</h1>
          <p style={loginSubtitle}>Accés restringit a personal autoritzat</p>
          <label style={label}>Usuari<input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} style={input} placeholder="Introdueix l’usuari" onKeyDown={(e) => e.key === "Enter" && iniciarSessio()} /></label>
          <label style={label}>Contrasenya<input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} style={input} placeholder="Introdueix la contrasenya" onKeyDown={(e) => e.key === "Enter" && iniciarSessio()} /></label>
          {errorLogin && <div style={loginError}>{errorLogin}</div>}
          <button onClick={iniciarSessio} style={botoPrincipal}>Entrar</button>
          <div style={loginHint}>Usuari inicial local: <strong>admin</strong> · Contrasenya: <strong>admin1234</strong></div>
        </div>
      </div>
    );
  }

  return (
    <div style={esMobil ? appLayoutMobil : appLayout}>
      {esMobil ? (
  <>
    <div style={topbarMobil}>
      <button
        style={topbarBtn}
        onClick={() => setSidebarOberta(!sidebarOberta)}
      >
        ☰
      </button>

      <div style={{ fontWeight: 700, fontSize: "18px" }}>
        Planner HBP
      </div>

      <button style={topbarBtn} onClick={tancarSessio}>
        ⏻
      </button>
    </div>

    {sidebarOberta && (
      <div style={menuMobil}>
        {[
          ["alta", "Alta de cirurgia", "＋"],
          ["registrades", "Cirurgies registrades", "▦"],
          ["planificacio", "Planner", "▣"],
          ...(usuari?.role === "admin"
            ? [["slots", "Calendari de slots", "◷"]]
            : []),
        ].map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => {
              setPestanya(key);
              setSidebarOberta(false);
            }}
            style={
              pestanya === key
                ? botoMenuMobilActiu
                : botoMenuMobil
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    )}
  </>
) : (
  <aside style={sidebarOberta ? sidebar : sidebarTancada}>
    <div style={sidebarHeader}>
      {sidebarOberta && (
        <div>
          <div style={sidebarTitle}>Planner HBP</div>
          <div style={sidebarSubtitle}>
            Planificació quirúrgica
          </div>
        </div>
      )}

      <button
        style={sidebarToggle}
        onClick={() => setSidebarOberta(!sidebarOberta)}
        title={sidebarOberta ? "Plegar menú" : "Desplegar menú"}
      >
        {sidebarOberta ? "‹" : "›"}
      </button>
    </div>

    <nav style={sidebarNav}>
      {[
        ["alta", "Alta de cirurgia", "＋"],
        ["registrades", "Cirurgies registrades", "▦"],
        ["planificacio", "Planner", "▣"],
        ...(usuari?.role === "admin"
          ? [["slots", "Calendari de slots", "◷"]]
          : []),
      ].map(([key, label, icon]) => (
        <button
          key={key}
          onClick={() => setPestanya(key)}
          style={
            pestanya === key
              ? sidebarItemActiu
              : sidebarItem
          }
          title={!sidebarOberta ? label : undefined}
        >
          <span style={sidebarIcon}>{icon}</span>
          {sidebarOberta && <span>{label}</span>}
        </button>
      ))}
    </nav>

    <div style={sidebarUserBox}>
      {sidebarOberta ? (
        <>
          <div style={sidebarUserLabel}>
            Sessió iniciada
          </div>
          <div style={sidebarUserName}>
            {usuari?.username}
          </div>
          <div style={sidebarUserRole}>
            {usuari?.role}
          </div>
        </>
      ) : (
        <div style={sidebarUserCompact}>
          {String(usuari?.username || "U")
            .charAt(0)
            .toUpperCase()}
        </div>
      )}

      <button
        style={sidebarLogoutBtn}
        onClick={tancarSessio}
      >
        {sidebarOberta ? "Tancar sessió" : "⏻"}
      </button>
    </div>
  </aside>
)}

      <main style={esMobil ? mainContentMobil : mainContent}>
        <h1 style={esMobil ? titleMobil : title}>Planner quirúrgic HBP</h1>

        {pestanya === "alta" && <div style={esMobil ? cardMobil : card}>{FormulariCirurgia({ dades: form, mode: "alta" })}<button onClick={guardarCirurgia} style={botoPrincipal}>Guardar cirurgia</button></div>}

        {pestanya === "registrades" && (
  <div style={esMobil ? cardMobil : cardAmple}>
            <div style={subTabsBoxDreta}>
              <button
                style={subPestanyaRegistrades === "actives" ? subTabActiva : subTab}
                onClick={() => setSubPestanyaRegistrades("actives")}
              >
                Pendents i programades
              </button>

              <button
                style={subPestanyaRegistrades === "historic" ? subTabActiva : subTab}
                onClick={() => setSubPestanyaRegistrades("historic")}
              >
                Històric de cirurgies
              </button>
            </div>

            {subPestanyaRegistrades === "actives" && (
              <>
                <div style={registradesTopSimple}>
                  <input
                    type="text"
                    placeholder="Cercar per codi del cas..."
                    value={cerca}
                    onChange={(e) => setCerca(e.target.value)}
                    style={registradesSearch}
                  />
                </div>

                <div style={esMobil ? registradesUnaColumna : registradesDuesColumnes}>
                  <section style={esMobil ? { ...registradesPanelTaula, overflowX: "auto" } : registradesPanelTaula}>
                    <div style={registradesPanelHeader}>
                      <span>Cirurgies pendents</span>
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{cirurgiesPendents.length}</span>
                    </div>

                    <table style={taulaRegistrades}>
                      <thead>
                        <tr>
                          <th style={thRegistrades}>Codi</th>
                          <th style={thRegistrades}>Origen</th>
                          <th style={thRegistrades}>Tipus</th>
                          <th style={thRegistrades}>Cirurgia</th>
                          <th style={thRegistrades}>Operació</th>
                          <th style={{ ...thRegistrades, textAlign: "right" }}>Espera</th>
                          <th style={thRegistrades}>Sol·licitat per</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cirurgiesPendents.length === 0 && (
                          <tr>
                            <td style={tdRegistradesBuit} colSpan="7">No hi ha cirurgies pendents.</td>
                          </tr>
                        )}

                        {cirurgiesPendents.map((c) => (
                          <tr key={c.id} style={trRegistrades} onClick={() => obrirEditor(c)}>
                            <td style={tdRegistrades}><strong>{c.codigo}</strong></td>
                            <td style={tdRegistrades}>{c.area_neoplasia || "—"}</td>
                            <td style={tdRegistrades}>{c.tipus_neoplasia || "—"}</td>
                            <td style={tdRegistrades}>{c.tipo_cirugia || "—"}</td>
                            <td style={tdRegistrades}>{c.tipo_operacion_principal || "—"}</td>
                            <td style={{ ...tdRegistrades, textAlign: "right" }}>{calcularDiesEspera(c)} dies</td>
                            <td style={tdRegistrades}>{getRegistratPer(c)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  <section style={esMobil ? { ...registradesPanelTaula, overflowX: "auto" } : registradesPanelTaula}>
                    <div style={registradesPanelHeader}>
                      <span>Cirurgies programades</span>
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{cirurgiesProgramades.length}</span>
                    </div>

                    <table style={taulaRegistrades}>
                      <thead>
                        <tr>
                          <th style={thRegistrades}>Codi</th>
                          <th style={thRegistrades}>Data</th>
                          <th style={thRegistrades}>Origen</th>
                          <th style={thRegistrades}>Tipus</th>
                          <th style={thRegistrades}>Cirurgia</th>
                          <th style={thRegistrades}>Operació</th>
                          <th style={{ ...thRegistrades, textAlign: "right" }}>Espera</th>
                          <th style={thRegistrades}>Sol·licitat per</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cirurgiesProgramades.length === 0 && (
                          <tr>
                            <td style={tdRegistradesBuit} colSpan="8">No hi ha cirurgies programades.</td>
                          </tr>
                        )}

                        {cirurgiesProgramades.map((c) => (
                          <tr key={c.id} style={trRegistrades} onClick={() => obrirEditor(c)}>
                            <td style={tdRegistrades}><strong>{c.codigo}</strong></td>
                            <td style={tdRegistrades}>{c.fecha_fijada || "Sense data"}</td>
                            <td style={tdRegistrades}>{c.area_neoplasia || "—"}</td>
                            <td style={tdRegistrades}>{c.tipus_neoplasia || "—"}</td>
                            <td style={tdRegistrades}>{c.tipo_cirugia || "—"}</td>
                            <td style={tdRegistrades}>{c.tipo_operacion_principal || "—"}</td>
                            <td style={{ ...tdRegistrades, textAlign: "right" }}>{calcularDiesEspera(c)} dies</td>
                            <td style={tdRegistrades}>{getRegistratPer(c)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </div>
              </>
            )}

            {subPestanyaRegistrades === "historic" && (
              <>
                <div style={registradesTopSimple}>
                  <input
                    type="text"
                    placeholder="Cercar històric per codi..."
                    value={cercaHistoric}
                    onChange={(e) => setCercaHistoric(e.target.value)}
                    style={registradesSearch}
                  />
                </div>

                <div style={historicScrollTaula}>
                  <table style={taulaRegistrades}>
                    <thead>
                      <tr>
                        <th style={thRegistrades}>Codi</th>
                        <th style={thRegistrades}>Origen</th>
                        <th style={thRegistrades}>Tipus</th>
                        <th style={thRegistrades}>Cirurgia</th>
                        <th style={thRegistrades}>Operació</th>
                        <th style={thRegistrades}>Estat</th>
                        <th style={thRegistrades}>Accions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cirurgiesPendentsValidacio.length === 0 && cirurgiesOperadesFiltrades.length === 0 && (
  <tr>
    <td style={tdRegistradesBuit} colSpan="7">No hi ha cirurgies a l’històric.</td>
  </tr>
)}

{cirurgiesPendentsValidacio.map((c) => (
  <tr key={c.id} style={{ ...trRegistrades, background: "#fff7cc" }}>
    <td style={tdRegistrades}><strong>{c.codigo}</strong></td>
    <td style={tdRegistrades}>{c.area_neoplasia || "—"}</td>
    <td style={tdRegistrades}>{c.tipus_neoplasia || "—"}</td>
    <td style={tdRegistrades}>{c.tipo_cirugia || "—"}</td>
    <td style={tdRegistrades}>{c.tipo_operacion_principal || "—"}</td>
    <td style={tdRegistrades}><strong>Pendent de validació</strong></td>
    <td style={tdRegistrades}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          style={botoValidarPetit}
          onClick={() => validarCirurgiaRealitzada(c.id)}
        >
          Validar realitzada
        </button>
        <button
          type="button"
          style={botoRetornarPetit}
          onClick={() => retornarCirurgiaAPendents(c.id)}
        >
          Retornar a pendents
        </button>
      </div>
    </td>
  </tr>
))}

{cirurgiesOperadesFiltrades.map((c) => (
                        <tr key={c.id} style={trRegistrades} onClick={() => obrirEditor(c)}>
                          <td style={tdRegistrades}><strong>{c.codigo}</strong></td>
                          <td style={tdRegistrades}>{c.area_neoplasia || "—"}</td>
                          <td style={tdRegistrades}>{c.tipus_neoplasia || "—"}</td>
                          <td style={tdRegistrades}>{c.tipo_cirugia || "—"}</td>
                          <td style={tdRegistrades}>{c.tipo_operacion_principal || "—"}</td>
                          <td style={tdRegistrades}>Operat</td>
                          <td style={tdRegistrades}>—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {pestanya === "planificacio" && <div style={esMobil ? cardMobil : cardAmple}><CalendariPlanner /></div>}
        {pestanya === "slots" && <div style={esMobil ? cardMobil : cardAmple}><CalendariSlots /></div>}

        {cirurgiaEditant && editForm && (
          <div style={modalFons}>
            <div style={modal}>
              <h2 style={{ textAlign: "center" }}>Editar cirurgia</h2>
              {FormulariCirurgia({ dades: editForm, mode: "edicio" })}
              <div style={modalActionsTres}><button onClick={guardarEdicio} style={botoPrincipal}>Guardar canvis</button><button onClick={eliminarCirurgiaEditant} style={botoVermell}>Eliminar cirurgia</button><button onClick={() => { setCirurgiaEditant(null); setEditForm(null); }} style={botoSecundari}>Cancel·lar</button></div>
            </div>
          </div>
        )}

        {cirurgiaPlannerSeleccionada && (
          <div style={modalFons}>
            <div style={modalPetit}>
              <h2 style={{ textAlign: "center", marginTop: 0 }}>Detall de cirurgia programada</h2>
              <div style={detallPlannerGrid}>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Codi del cas</span><strong>{cirurgiaPlannerSeleccionada.cirurgia.codigo}</strong></div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Data</span>{formatDataVista(getSlotData(cirurgiaPlannerSeleccionada.slot))}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Quiròfan</span>Q{getSlotQuirofan(cirurgiaPlannerSeleccionada.slot)}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Franja</span>{getSlotFranja(cirurgiaPlannerSeleccionada.slot) || "No informada"}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Tipus de cirurgia</span>{cirurgiaPlannerSeleccionada.cirurgia.tipo_cirugia || "No informat"}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Tipus d’operació</span>{cirurgiaPlannerSeleccionada.cirurgia.tipo_operacion_principal || "No informat"}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Origen de neoplàsia</span>{cirurgiaPlannerSeleccionada.cirurgia.area_neoplasia || "No informat"}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Tipus de neoplàsia</span>{cirurgiaPlannerSeleccionada.cirurgia.tipus_neoplasia || "No informat"}</div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <div style={capcalera}>Cirurgians participants</div>
                <div style={chipsBox}>
                  <div style={chipsOpcions}>
                    {getSlotCirurgians(cirurgiaPlannerSeleccionada.slot).map((nom) => {
                      const seleccionats = cirurgiaPlannerSeleccionada.cirujanos_asignados || [];
                      const ocupats = cirurgiansOcupatsPerSlot(cirurgiaPlannerSeleccionada);
                      const seleccionat = seleccionats.includes(nom);
                      const ocupat = ocupats.includes(nom) && !seleccionat;
                      return <button key={nom} type="button" disabled={ocupat} style={ocupat ? chipDisabled : seleccionat ? chipSelected : chipOption} onClick={() => toggleCirurgiaPlannerParticipant(nom)}>{nom}{seleccionat ? " ×" : ""}{ocupat ? " · ocupat" : ""}</button>;
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><button style={botoPrincipal} onClick={guardarCirurgiansPlanner}>Guardar cirurgians</button><button style={botoSecundari} onClick={() => setCirurgiaPlannerSeleccionada(null)}>Cancel·lar</button></div>
            </div>
          </div>
        )}

        {modalSlot && diaSeleccionat && (
          <div style={modalFons}>
            <div style={modalPetit}>
              {!accioSlot && (
                <div style={modalDiaContainer}>
                  <div style={modalDiaHeaderNou}><span>Dia seleccionat:</span><strong>{formatDataLlarga(diaSeleccionat)}</strong></div>
                  {slotsDelDiaSeleccionat().length > 0 && (
                    <div style={slotsDiaBoxCompacte}>
                      <div style={slotsDiaTitle}>Slots existents</div>
                      {slotsDelDiaSeleccionat().map((slot) => (
                        <button key={slot.id} type="button" style={slotDiaItem} onClick={(e) => obrirEditorSlot(e, slot)}>
                          <div style={slotDiaItemTop}><strong>Q{getSlotQuirofan(slot) || "?"}</strong><span>{getSlotFranja(slot) || "Franja"}</span></div>
                          <div style={slotDiaItemMeta}>{(slot.hora_inicio || "--:--")} - {(slot.hora_fin || "--:--")}{getSlotTipus(slot).length > 0 && ` · ${getSlotTipus(slot).join(", ")}`}{esSlotDeCurs(slot) && " · slot de curs"}{esSlotBenigne(slot) && " · cirurgia benigna"}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={modalDiaActionsSimple}><button type="button" onClick={() => setAccioSlot("slot")} style={accioFilaBlava}><span style={accioIconaBlava}>+</span><span>Afegir slot quirúrgic</span></button></div>
                  <div style={modalDiaFooter}><button type="button" onClick={() => { setModalSlot(false); setDiaSeleccionat(null); }} style={botoModalCancelar}>Cancel·lar</button></div>
                </div>
              )}

              {accioSlot === "slot" && (
                <>
                  <label style={label}>Número de quiròfan<select value={slotForm.quirofan} onChange={(e) => canviarQuirofan(e.target.value)} style={input}><option>1.7</option><option>1.6</option><option>2.1</option><option>2.2</option><option>Altres</option></select></label>
                  {slotForm.quirofan === "Altres" && <label style={label}>Escriu el número de quiròfan<input value={slotForm.quirofan_altres} onChange={(e) => setSlotForm({ ...slotForm, quirofan_altres: e.target.value })} style={input} /></label>}
                  <label style={label}>Franja<select value={slotForm.franja} onChange={(e) => setSlotForm({ ...slotForm, franja: e.target.value })} style={input}><option>Matí</option><option>Tarda</option></select></label>
                  <div style={esMobil ? gridUnaColumna : gridDosColumnes}><label style={label}>Hora d’inici<input type="time" value={slotForm.hora_inicio} onChange={(e) => setSlotForm({ ...slotForm, hora_inicio: e.target.value })} style={input} /></label><label style={label}>Hora de fi<input type="time" value={slotForm.hora_fin} onChange={(e) => setSlotForm({ ...slotForm, hora_fin: e.target.value })} style={input} /></label></div>
                  <label style={label}>Tipus de cirurgia{ChipsSelector({ opcions: ["Oberta", "Laparoscòpica", "Robòtica"], seleccionades: slotForm.tipus_cirurgia, onToggle: toggleTipusCirurgia })}</label>
                  <label style={checkLabel}><input type="checkbox" checked={slotForm.slot_de_curs} onChange={(e) => setSlotForm({ ...slotForm, slot_de_curs: e.target.checked })} />Slot de curs</label>
                  <label style={checkLabel}><input type="checkbox" checked={slotForm.cirurgia_benigna} onChange={(e) => setSlotForm({ ...slotForm, cirurgia_benigna: e.target.checked })} />Cirurgia benigna</label>
                  <label style={label}>Cirurgians disponibles{ChipsSelector({ opcions: cirurgiansDisponibles, seleccionades: slotForm.cirurgians, onToggle: toggleCirurgiaDisponible })}</label>
                  <label style={label}>Comentaris<textarea value={slotForm.comentarios} onChange={(e) => setSlotForm({ ...slotForm, comentarios: e.target.value })} style={textarea} placeholder="Comentaris del slot" /></label>
                  <div style={{ display: "flex", gap: "12px" }}><button onClick={guardarSlot} style={botoPrincipal}>{slotEditant ? "Guardar canvis" : "Guardar slot"}</button>{slotEditant && <button onClick={eliminarSlot} style={botoVermell}>Eliminar</button>}<button onClick={() => { setAccioSlot(null); setSlotEditant(null); setSlotForm(slotInicial); }} style={botoSecundari}>Enrere</button></div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const loginPage = { minHeight: "100vh", background: "#f7f9fc", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Inter, Arial, sans-serif", color: "#1f2a44", padding: "20px" };
const loginCard = { width: "420px", background: "white", borderRadius: "20px", padding: "28px", boxShadow: "0 20px 60px rgba(15, 43, 87, 0.14)" };
const loginTitle = { textAlign: "center", fontSize: "30px", margin: "0 0 6px", color: "#0f2b57" };
const loginSubtitle = { textAlign: "center", margin: "0 0 22px", color: "#4b5b76", fontWeight: "600" };
const loginError = { background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b", borderRadius: "10px", padding: "10px", margin: "10px 0", fontSize: "14px", fontWeight: "700" };
const loginHint = { marginTop: "14px", fontSize: "12px", color: "#6b7280", textAlign: "center" };

const appLayout = { minHeight: "100vh", background: "#f7f9fc", display: "flex", fontFamily: "Inter, Arial, sans-serif", color: "#1f2a44" };
const sidebar = { width: "270px", minWidth: "270px", minHeight: "100vh", background: "#0f2b57", color: "white", padding: "18px 14px", boxSizing: "border-box", display: "flex", flexDirection: "column", position: "sticky", top: 0, alignSelf: "flex-start", transition: "width 0.2s ease, min-width 0.2s ease" };
const sidebarTancada = { ...sidebar, width: "78px", minWidth: "78px", alignItems: "center" };
const sidebarHeader = { width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "24px" };
const sidebarTitle = { fontSize: "22px", fontWeight: "800", lineHeight: "1.1" };
const sidebarSubtitle = { marginTop: "5px", fontSize: "12px", color: "#bfd0ea", fontWeight: "600" };
const sidebarToggle = { width: "34px", height: "34px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", color: "white", fontSize: "24px", fontWeight: "800", cursor: "pointer", flexShrink: 0 };
const sidebarNav = { width: "100%", display: "flex", flexDirection: "column", gap: "9px", flex: 1 };
const sidebarItem = { width: "100%", minHeight: "44px", border: "1px solid transparent", background: "transparent", color: "#e7eefb", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", fontWeight: "700", cursor: "pointer", textAlign: "left" };
const sidebarItemActiu = { ...sidebarItem, background: "white", color: "#0f2b57", border: "1px solid white", boxShadow: "0 10px 25px rgba(0,0,0,0.18)" };
const sidebarIcon = { width: "26px", minWidth: "26px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "900" };
const sidebarUserBox = { width: "100%", borderTop: "1px solid rgba(255,255,255,0.18)", paddingTop: "14px", marginTop: "16px" };
const sidebarUserLabel = { fontSize: "11px", color: "#bfd0ea", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em" };
const sidebarUserName = { marginTop: "5px", fontSize: "16px", fontWeight: "800", overflow: "hidden", textOverflow: "ellipsis" };
const sidebarUserRole = { marginTop: "2px", fontSize: "13px", color: "#dbeafe", fontWeight: "600" };
const sidebarUserCompact = { width: "40px", height: "40px", borderRadius: "999px", background: "white", color: "#0f2b57", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", margin: "0 auto 10px" };
const sidebarLogoutBtn = { width: "100%", marginTop: "12px", border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "white", borderRadius: "12px", padding: "10px 12px", fontSize: "14px", fontWeight: "800", cursor: "pointer" };
const mainContent = { flex: 1, minWidth: 0, padding: "14px 22px 24px", boxSizing: "border-box", overflowX: "auto" };
const title = { textAlign: "center", fontSize: "34px", margin: "4px 0 16px", color: "#0f2b57" };
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
const selectorDatesBox = { background: "#f7f9fc", border: "1px solid #d6dbe3", borderRadius: "12px", padding: "10px", marginBottom: "12px" };
const avisSelector = { background: "#fff7cc", border: "1px solid #facc15", color: "#3f2f00", borderRadius: "10px", padding: "10px", marginBottom: "12px", fontSize: "13px", fontWeight: "700" };
const miniCalendarTop = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", color: "#0f2b57" };
const miniCalendarBtn = { background: "#0f2b57", color: "white", border: "none", borderRadius: "8px", width: "34px", height: "32px", fontSize: "20px", cursor: "pointer" };
const miniCalendarGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" };
const miniCalendarHeader = { textAlign: "center", fontSize: "12px", fontWeight: "800", color: "#4b5b76", padding: "4px 0" };
const miniCalendarDay = { height: "34px", borderRadius: "999px", border: "1px solid transparent", background: "#edf1f7", color: "#9aa4b2", fontWeight: "700", cursor: "not-allowed" };
const miniCalendarDayForaMes = { opacity: 0.35 };
const miniCalendarDayCurs = { background: "#facc15", border: "2px solid #eab308", color: "#3f2f00", cursor: "pointer" };
const miniCalendarDaySeleccionat = { background: "#0f2b57", border: "2px solid #0f2b57", color: "white" };
const miniCalendarDayDisponible = { background: "white", border: "1px solid #9ec9ff", color: "#0f2b57", cursor: "pointer" };
const miniCalendarLlegenda = { marginTop: "8px", fontSize: "12px", color: "#4b5b76", fontWeight: "600" };
const dataManualSeleccionadaBox = { background: "#eef6ff", border: "1px solid #9ec9ff", color: "#0f2b57", borderRadius: "12px", padding: "12px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" };
const dataManualLabel = { display: "block", fontSize: "12px", color: "#4b5b76", fontWeight: "800", textTransform: "uppercase", marginBottom: "3px" };
const dataManualCanviarBtn = { border: "1px solid #d5dce8", background: "white", color: "#0f2b57", borderRadius: "10px", padding: "8px 12px", fontSize: "13px", fontWeight: "800", cursor: "pointer" };
const botoPrincipal = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#0f2b57", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoSecundari = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "1px solid #d5dce8", background: "white", color: "#0f2b57", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoVermell = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#ef4444", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoPlannerPetit = { width: "auto", minWidth: "230px", padding: "10px 18px", borderRadius: "12px", border: "none", background: "#0f2b57", color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer" };
const modalFons = { position: "fixed", inset: 0, background: "rgba(15, 43, 87, 0.35)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modal = { background: "white", width: "950px", maxHeight: "90vh", overflowY: "auto", borderRadius: "18px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalPetit = { background: "white", width: "720px", maxHeight: "90vh", overflowY: "auto", borderRadius: "18px", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalActionsTres = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" };
const calendarTop = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: "10px" };
const plannerTop = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: "10px" };
const plannerActions = { display: "flex", justifyContent: "center", marginTop: "14px", gap: "12px" };
const calendarBtn = { background: "#0f2b57", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "20px", fontWeight: "800", cursor: "pointer" };
const calendarGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid #dde2ea", borderLeft: "1px solid #dde2ea" };
const calendarHeader = { padding: "7px", textAlign: "center", fontWeight: "700", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea" };
const calendarDay = { minHeight: "118px", padding: "6px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", cursor: "pointer", background: "white", overflow: "hidden" };
const calendarDayPlanificacio = { minHeight: "102px", padding: "5px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", background: "white", overflow: "hidden" };
const calendarNumber = { textAlign: "right", fontWeight: "600", marginBottom: "4px", fontSize: "13px" };
const calendarNumberCurs = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "25px", height: "25px", borderRadius: "999px", background: "#facc15", color: "#3f2f00", border: "2px solid #eab308", fontWeight: "800" };
const eventSlot = { background: "#2563eb", color: "white", borderRadius: "6px", padding: "5px 7px", fontSize: "11px", fontWeight: "800", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" };
const eventSlotCurs = { ...eventSlot, background: "#facc15", color: "#3f2f00", border: "1px solid #eab308" };
const eventSlotBenigna = { ...eventSlot, background: "#94a3b8", color: "white", border: "1px solid #64748b" };
const eventSlotMes = { background: "#eef6ff", color: "#0f2b57", border: "1px solid #9ec9ff", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", fontWeight: "900", textAlign: "center" };
const eventOperacioProgramada = { background: "#0f766e", color: "white", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", marginBottom: "4px", lineHeight: "1.25" };
const eventOperacioSenseCanvis = { ...eventOperacioProgramada, background: "#6b7280" };
const eventOperacioNova = { ...eventOperacioProgramada, background: "#16a34a" };
const eventOperacioMoguda = { ...eventOperacioProgramada, background: "#7f1d1d" };
const eventOperacioCurs = { ...eventOperacioProgramada, background: "#facc15", color: "#3f2f00", border: "1px solid #eab308" };
const eventOperacioFixada = { ...eventOperacioProgramada, background: "#d97706", color: "white", border: "1px solid #b45309" };
const chipsBox = { marginTop: "6px", border: "1px solid #d6dbe3", background: "#f1f3f7", borderRadius: "10px", padding: "8px" };
const chipsSeleccionades = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" };
const chipsOpcions = { display: "flex", flexWrap: "wrap", gap: "8px" };
const chipSelected = { border: "none", background: "#0f2b57", color: "white", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", fontWeight: "700", cursor: "pointer" };
const chipOption = { border: "1px solid #d5dce8", background: "white", color: "#1f2a44", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", cursor: "pointer" };
const chipDisabled = { border: "1px solid #d1d5db", background: "#e5e7eb", color: "#6b7280", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", fontWeight: "700", cursor: "not-allowed", opacity: 0.75 };
const registreUsuariTaula = { marginTop: "3px", color: "#64748b", fontSize: "11px", fontWeight: "700" };
const modalDiaContainer = { display: "flex", flexDirection: "column", gap: "14px" };
const modalDiaFooter = { display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: "12px" };
const botoModalCancelar = { border: "1px solid #d5dce8", background: "white", color: "#0f2b57", borderRadius: "10px", padding: "9px 14px", fontSize: "14px", fontWeight: "800", cursor: "pointer" };
const slotsDiaTitle = { color: "#0f2b57", fontSize: "15px", fontWeight: "900", marginBottom: "10px", textAlign: "left" };
const slotDiaItem = { width: "100%", border: "1px solid #d5dce8", background: "white", color: "#1f2a44", borderRadius: "12px", padding: "10px 12px", marginBottom: "8px", cursor: "pointer", textAlign: "left" };
const slotDiaItemTop = { display: "flex", justifyContent: "space-between", alignItems: "center", color: "#0f2b57", fontSize: "15px", fontWeight: "800", marginBottom: "4px" };
const slotDiaItemMeta = { color: "#4b5b76", fontSize: "13px", fontWeight: "600", lineHeight: "1.35" };
const modalDiaHeaderNou = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "14px", padding: "14px 16px", color: "#0f2b57", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", fontSize: "17px", fontWeight: "700", marginBottom: "8px" };
const modalDiaActionsSimple = { display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" };
const accioFilaBlava = { width: "100%", border: "1px solid #9ec9ff", background: "#eef6ff", color: "#0f2b57", borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: "900", cursor: "pointer", textAlign: "left" };
const accioIconaBlava = { width: "28px", height: "28px", borderRadius: "8px", background: "#2563eb", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "900", lineHeight: 1 };
const slotsDiaBoxCompacte = { background: "#f7f9fc", border: "1px solid #d6dbe3", borderRadius: "14px", padding: "10px", marginBottom: "12px", maxHeight: "220px", overflowY: "auto" };
const plannerToolbar = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" };
const botoPlannerSecundariBlau = { width: "auto", minWidth: "230px", padding: "10px 18px", borderRadius: "12px", border: "1px solid #9ec9ff", background: "#eef6ff", color: "#0f2b57", fontSize: "15px", fontWeight: "800", cursor: "pointer" };
const avisPendentsBox = { background: "#fff7cc", border: "1px solid #facc15", color: "#3f2f00", borderRadius: "12px", padding: "12px", margin: "12px 0", fontSize: "14px", fontWeight: "700" };
const detallPlannerGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" };
const detallPlannerItem = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "12px", padding: "10px", fontSize: "14px" };
const detallPlannerLabel = { display: "block", fontSize: "12px", color: "#64748b", fontWeight: "900", textTransform: "uppercase", marginBottom: "4px" };
const setmanaGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid #dde2ea", borderLeft: "1px solid #dde2ea" };
const setmanaDia = { minHeight: "560px", padding: "8px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", background: "white" };
const setmanaHeaderDia = { textAlign: "center", fontWeight: "900", color: "#0f2b57", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #e5e7eb" };
const setmanaHeaderDiaCurs = { display: "inline-block", background: "#facc15", border: "2px solid #eab308", color: "#3f2f00", borderRadius: "8px", padding: "3px 8px" };
const setmanaOperacioBlauVerd = { background: "#0f766e", color: "white", borderRadius: "12px", padding: "10px", marginBottom: "10px", fontSize: "12px", lineHeight: "1.35", cursor: "pointer", boxShadow: "0 6px 14px rgba(15, 118, 110, 0.18)" };
const setmanaOperacioCurs = { ...setmanaOperacioBlauVerd, background: "#facc15", color: "#3f2f00", border: "1px solid #eab308", boxShadow: "0 6px 14px rgba(234, 179, 8, 0.22)" };
const setmanaOperacioFixada = { ...setmanaOperacioBlauVerd, background: "#d97706", color: "white", border: "1px solid #b45309", boxShadow: "0 6px 14px rgba(217, 119, 6, 0.22)" };
const setmanaOperacioHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "13px", fontWeight: "900" };
const setmanaOperacioText = { marginTop: "4px", fontWeight: "700" };
const setmanaOperacioDoctors = { marginTop: "8px", paddingTop: "7px", borderTop: "1px solid rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: "700", lineHeight: "1.35" };
const plannerOperacioHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" };
const plannerDiesEspera = { marginLeft: "auto", fontSize: "10px", fontWeight: "900", background: "rgba(255,255,255,0.18)", padding: "2px 5px", borderRadius: "999px", whiteSpace: "nowrap" };
const plannerDiesEsperaClar = { marginLeft: "auto", fontSize: "11px", fontWeight: "900", background: "rgba(255,255,255,0.22)", padding: "3px 7px", borderRadius: "999px", whiteSpace: "nowrap" };
const subTabsBox = { display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px" };

const subTabsBoxDreta = { display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "18px" };
const registradesTopSimple = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px", marginBottom: "14px" };
const registradesPanelTaula = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "18px", padding: "14px", overflowX: "auto" };
const taulaRegistrades = { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px", background: "white", border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" };
const thRegistrades = { background: "#eef6ff", color: "#0f2b57", padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: "900", borderBottom: "1px solid #d5dce8", whiteSpace: "nowrap" };
const tdRegistrades = { padding: "10px", borderBottom: "1px solid #edf2f7", color: "#1f2a44", fontWeight: "600", verticalAlign: "top" };
const tdRegistradesBuit = { padding: "18px", color: "#64748b", textAlign: "center", fontWeight: "800" };
const trRegistrades = { cursor: "pointer" };
const historicScrollTaula = { maxHeight: "650px", overflowY: "auto", overflowX: "auto", paddingRight: "6px" };

const subTab = { border: "1px solid #9ec9ff", background: "#eef6ff", color: "#0f2b57", borderRadius: "12px", padding: "10px 18px", fontSize: "15px", fontWeight: "800", cursor: "pointer" };
const subTabActiva = { ...subTab, background: "#0f2b57", color: "white" };
const registradesTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" };
const registradesTitle = { margin: 0, color: "#0f2b57", fontSize: "19px", fontWeight: "900" };
const registradesSubtitle = { margin: "5px 0 0", color: "#64748b", fontSize: "13px", fontWeight: "700" };
const registradesSearch = { width: "280px", boxSizing: "border-box", padding: "10px 12px", borderRadius: "12px", border: "1px solid #d6dbe3", background: "#f8fafc", fontSize: "14px" };
const registradesDuesColumnes = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
const registradesPanel = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "18px", padding: "14px" };
const registradesPanelHeader = { background: "#eef6ff", border: "1px solid #9ec9ff", color: "#0f2b57", borderRadius: "14px", padding: "12px 14px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "900" };
const registradesLlista = { display: "flex", flexDirection: "column", gap: "10px" };
const registradesCard = { background: "white", border: "1px solid #e2e8f0", borderLeft: "5px solid #0f766e", borderRadius: "14px", padding: "12px", cursor: "pointer", boxShadow: "0 8px 18px rgba(15, 43, 87, 0.06)" };
const registradesCardProgramada = { ...registradesCard, borderLeft: "5px solid #0f2b57" };
const registradesCardTop = { display: "flex", justifyContent: "space-between", gap: "10px", color: "#1f2a44", fontSize: "15px", fontWeight: "900" };
const registradesMeta = { marginTop: "6px", color: "#475569", fontSize: "13px", fontWeight: "700", lineHeight: "1.35" };
const registradesBuit = { background: "white", border: "1px dashed #cbd5e1", color: "#64748b", borderRadius: "14px", padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "800" };
const historicScrollAmple = { maxHeight: "650px", overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", paddingRight: "6px" };
const historicItem = { background: "white", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "11px", cursor: "pointer" };
const botoValidarPetit = {
  border: "none",
  background: "#16a34a",
  color: "white",
  borderRadius: "8px",
  padding: "7px 10px",
  fontSize: "12px",
  fontWeight: "800",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const botoRetornarPetit = {
  border: "1px solid #d97706",
  background: "#fff7cc",
  color: "#92400e",
  borderRadius: "8px",
  padding: "7px 10px",
  fontSize: "12px",
  fontWeight: "800",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const appLayoutMobil = {
  minHeight: "100vh",
  background: "#f7f9fc",
  display: "flex",
  fontFamily: "Inter, Arial, sans-serif",
  color: "#1f2a44",
  overflowX: "hidden",
};

const sidebarMobilTancada = {
  width: "72px",
  minWidth: "72px",
  minHeight: "100vh",
  background: "#0f2b57",
  color: "white",
  padding: "14px 8px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  position: "fixed",
  top: 0,
  left: 0,
  zIndex: 2000,
};

const sidebarMobilOberta = {
  ...sidebarMobilTancada,
  width: "82vw",
  minWidth: "82vw",
  maxWidth: "340px",
  boxShadow: "8px 0 30px rgba(0,0,0,0.35)",
};

const mainContentMobil = {
  flex: 1,
  minWidth: 0,
  padding: "14px 10px 24px",
  marginLeft: 0,
marginTop: "64px",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const titleMobil = {
  textAlign: "center",
  fontSize: "30px",
  lineHeight: "0.95",
  margin: "18px 0 18px",
  color: "#0f2b57",
};

const cardMobil = {
  width: "100%",
  maxWidth: "100%",
  margin: "0 auto",
  background: "white",
  borderRadius: "18px",
  padding: "14px",
  boxSizing: "border-box",
  boxShadow: "0 10px 30px rgba(15, 43, 87, 0.08)",
  overflowX: "hidden",
};

const gridUnaColumna = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "18px",
};

const registradesUnaColumna = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "18px",
};

const taulaScrollMobil = {
  width: "100%",
  overflowX: "auto",
};

const topbarMobil = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: "64px",
  background: "#0f2b57",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 14px",
  zIndex: 3000,
  boxSizing: "border-box",
};

const topbarBtn = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "white",
  borderRadius: "12px",
  width: "44px",
  height: "44px",
  fontSize: "22px",
};

const menuMobil = {
  position: "fixed",
  top: "64px",
  left: 0,
  width: "82%",
  maxWidth: "320px",
  bottom: 0,
  background: "#0f2b57",
  padding: "18px",
  zIndex: 2999,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow: "10px 0 30px rgba(0,0,0,0.35)",
};

const botoMenuMobil = {
  border: "none",
  borderRadius: "16px",
  padding: "16px",
  background: "transparent",
  color: "white",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  fontSize: "18px",
  fontWeight: 600,
};

const botoMenuMobilActiu = {
  ...botoMenuMobil,
  background: "white",
  color: "#0f2b57",
};

export default App;
