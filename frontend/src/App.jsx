import { useEffect, useMemo, useRef, useState } from "react";
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

const userFormInicial = {
  username: "",
  password: "",
  confirmPassword: "",
  role: "user",
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

const mesos = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [usuari, setUsuari] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });

  const esAdmin = usuari?.role === "admin";

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [errorLogin, setErrorLogin] = useState("");

  const [pestanya, setPestanya] = useState("alta");
  const [sidebarOberta, setSidebarOberta] = useState(true);
  const [esMobil, setEsMobil] = useState(() => window.innerWidth < 768);

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
  const [slotForm, setSlotForm] = useState(slotInicial);
  const [slotEditant, setSlotEditant] = useState(null);

  const [planificacioValidada, setPlanificacioValidada] = useState([]);
  const [propostaReprogramacio, setPropostaReprogramacio] = useState(null);
  const [avisReprogramacio, setAvisReprogramacio] = useState([]);
  const [vistaPlanner, setVistaPlanner] = useState("mensual");
  const [cirurgiaPlannerSeleccionada, setCirurgiaPlannerSeleccionada] = useState(null);
  const plannerRef = useRef(null);

  const [usuaris, setUsuaris] = useState([]);
  const [userForm, setUserForm] = useState(userFormInicial);
  const [passwordReset, setPasswordReset] = useState({});

  const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {});

  const tancarSessio = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUsuari(null);
    setPestanya("alta");
    setCirugias([]);
    setSlots([]);
    setPlanificacioValidada([]);
    setPropostaReprogramacio(null);
    setAvisReprogramacio([]);
    setUsuaris([]);
  };

  const authFetch = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...authHeaders(),
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      tancarSessio();
      throw new Error("Sessió caducada. Torna a iniciar sessió.");
    }

    return res;
  };

  const llegirJson = async (res, fallback) => {
    try {
      return await res.json();
    } catch {
      return fallback;
    }
  };

  const carregarCirurgies = async () => {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/cirugias`);
      const data = await llegirJson(res, []);
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));
      setCirugias(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error carregant cirurgies:", error);
      setCirugias([]);
    }
  };

  const carregarSlots = async () => {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/slots`);
      const data = await llegirJson(res, []);
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));
      setSlots(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error carregant slots:", error);
      setSlots([]);
    }
  };

  const carregarPlannerActual = async () => {
    if (!token) return;
    try {
      const res = await authFetch(`${API_URL}/planner/actual`);
      const data = await llegirJson(res, []);
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));
      setPlanificacioValidada(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error carregant planner:", error);
      setPlanificacioValidada([]);
    }
  };

  const carregarUsuaris = async () => {
    if (!token || !esAdmin) return;
    try {
      const res = await authFetch(`${API_URL}/users`);
      const data = await llegirJson(res, []);
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));
      setUsuaris(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error carregant usuaris:", error);
      setUsuaris([]);
    }
  };

  const carregarDades = async () => {
    await Promise.allSettled([carregarCirurgies(), carregarSlots(), carregarPlannerActual()]);
    if (esAdmin && pestanya === "gestio_usuaris") await carregarUsuaris();
  };

  useEffect(() => {
    const detectarMobil = () => setEsMobil(window.innerWidth < 768);
    window.addEventListener("resize", detectarMobil);
    return () => window.removeEventListener("resize", detectarMobil);
  }, []);

  useEffect(() => {
    if (!token) return;
    carregarDades();

    const interval = setInterval(() => {
      carregarDades();
    }, 30000);

    return () => clearInterval(interval);
  }, [token, esAdmin, pestanya]);

  useEffect(() => {
    if (!esAdmin && (pestanya === "slots" || pestanya === "gestio_usuaris")) {
      setPestanya("planificacio");
    }
  }, [esAdmin, pestanya]);

  const iniciarSessio = async () => {
    setErrorLogin("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(data.detail || "No s'ha pogut iniciar sessió.");

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setToken(data.access_token);
      setUsuari(data.user);
      setLoginForm({ username: "", password: "" });
      setPestanya("alta");
    } catch (error) {
      setErrorLogin(error.message);
    }
  };

  const parseArray = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === "string") {
      try {
        const parsed = JSON.parse(valor);
        return Array.isArray(parsed) ? parsed : valor ? [valor] : [];
      } catch {
        return valor ? [valor] : [];
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

  const avuiText = () => formatDataLocal(new Date());

  const formatDataVista = (dataText) => {
    if (!dataText) return "";
    const [any, mes, dia] = String(dataText).split("-");
    if (!any || !mes || !dia) return String(dataText);
    return `${dia}/${mes}/${any}`;
  };

  const formatDataLlarga = (data) =>
    data.toLocaleDateString("ca-ES", { day: "numeric", month: "long", year: "numeric" });

  const normalitza = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const getSlotData = (slot) => slot?.fecha || "";
  const getSlotQuirofan = (slot) => slot?.quirofano || "";
  const getSlotFranja = (slot) => slot?.franja || "";
  const getSlotTipus = (slot) => parseArray(slot?.tipo_cirugia);
  const getSlotCirurgians = (slot) => parseArray(slot?.cirujanos_disponibles);
  const esDiaCurs = (slot) => slot?.tipus_registre === "Dia de curs";
  const esSlotDeCurs = (slot) => slot?.slot_de_curs === true;
  const esSlotBenigne = (slot) => slot?.cirurgia_benigna === true;

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

  const calcularDiesEspera = (cirurgia) => {
    const dataBase = cirurgia?.data_solicitud_operacio || cirurgia?.created_at;
    if (!dataBase) return 0;
    const inici = new Date(dataBase);
    const avui = new Date();
    inici.setHours(0, 0, 0, 0);
    avui.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((avui - inici) / (1000 * 60 * 60 * 24)));
  };

  const esSlotCompatibleAmbCirurgia = (slot, cirurgia) => {
    if (!slot || !cirurgia || esDiaCurs(slot) || esSlotBenigne(slot)) return false;
    const tipusSlot = getSlotTipus(slot).map(normalitza);
    const quirofan = String(getSlotQuirofan(slot));
    const tipusCirurgia = normalitza(cirurgia.tipo_cirugia);

    if (tipusCirurgia === "robotica") {
      return quirofan === "2.1" || quirofan === "2.2" || tipusSlot.includes("robotica");
    }

    if (tipusCirurgia === "oberta") return tipusSlot.includes("oberta");
    if (tipusCirurgia === "laparoscopica") return tipusSlot.includes("laparoscopica");
    return true;
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
      setDades({ ...dades, tumor: value, operacio: "", lateralitat: "", segments: [] });
      return;
    }

    if (name === "dia_curs") {
      setDades({
        ...dades,
        dia_curs: checked,
        fijada: checked ? false : dades.fijada,
        fecha_fijada: checked ? "" : dades.fecha_fijada,
        fecha_dia_curs: checked ? dades.fecha_dia_curs : "",
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
    if (dades.neoadjuvancia && dades.fecha_fin_neo && dades.fecha_fin_neo > avuiText()) {
      return "La data de finalització de la neoadjuvància no pot ser futura.";
    }
    if (!dades.tumor) return "Selecciona si el tumor és benigne o maligne.";
    if (!dades.area_neoplasia) return "Selecciona l’origen de la neoplàsia.";
    if (!dades.tipus_neoplasia) return "Selecciona el tipus de neoplàsia.";
    if (!dades.tipo_cirugia) return "Selecciona el tipus de cirurgia.";
    if (!dades.operacio) return "Selecciona el tipus d’operació.";
    if (dades.operacio === "Hepatectomia" && !dades.lateralitat) return "Selecciona la lateralitat.";
    if (dades.operacio === "Segmentectomia" && dades.segments.length === 0) {
      return "Selecciona almenys un segment.";
    }
    if (dades.dia_curs && !dades.fecha_dia_curs) return "Selecciona un slot de curs compatible.";
    if (dades.fijada && !dades.fecha_fijada) return "Selecciona una data fixada.";
    return null;
  };

  const guardarCirurgia = async () => {
    const error = validarFormulari(form);
    if (error) return alert(error);

    try {
      const res = await authFetch(`${API_URL}/cirugias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crearPayloadCirurgia(form)),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setForm(formInicial);
      await carregarDades();
      alert("Cirurgia afegida correctament.");
    } catch (error) {
      alert(`Error guardant cirurgia:\n${error.message}`);
    }
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
      segments: Array.isArray(detall.segments) ? detall.segments : [],
      fijada: !!c.fijada && !c.dia_curs,
      fecha_fijada: c.fecha_fijada || "",
      dia_curs: !!c.dia_curs,
      fecha_dia_curs: c.fecha_dia_curs || "",
      comentarios: c.comentarios || "",
      estat_cas: c.estat_cas || "Pendent",
    });
  };

  const guardarEdicio = async () => {
    const error = validarFormulari(editForm);
    if (error) return alert(error);

    try {
      const res = await authFetch(`${API_URL}/cirugias/${cirurgiaEditant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crearPayloadCirurgia(editForm, cirurgiaEditant)),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setCirurgiaEditant(null);
      setEditForm(null);
      await carregarDades();
      alert("Canvis guardats correctament.");
    } catch (error) {
      alert(`Error guardant canvis:\n${error.message}`);
    }
  };

  const eliminarCirurgiaEditant = async () => {
    if (!cirurgiaEditant) return;
    if (!window.confirm(`Segur que vols eliminar la cirurgia ${cirurgiaEditant.codigo}?`)) return;

    try {
      const res = await authFetch(`${API_URL}/cirugias/${cirurgiaEditant.id}`, { method: "DELETE" });
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setCirurgiaEditant(null);
      setEditForm(null);
      await carregarDades();
      alert("Cirurgia eliminada correctament.");
    } catch (error) {
      alert(`Error eliminant cirurgia:\n${error.message}`);
    }
  };

  const validarCirurgiaRealitzada = async (cirurgiaId) => {
    if (!window.confirm("Confirmes que aquesta cirurgia s’ha realitzat?")) return;

    try {
      const res = await authFetch(`${API_URL}/cirugias/${cirurgiaId}/validar-realitzada`, {
        method: "POST",
      });
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      await carregarDades();
      alert("Cirurgia validada com a realitzada.");
    } catch (error) {
      alert(`Error:\n${error.message}`);
    }
  };

  const retornarCirurgiaAPendents = async (cirurgiaId) => {
    if (!window.confirm("Confirmes que aquesta cirurgia NO s’ha realitzat i ha de tornar a pendents?")) {
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/cirugias/${cirurgiaId}/retornar-pendents`, {
        method: "POST",
      });
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      await carregarDades();
      alert("Cirurgia retornada a pendents.");
    } catch (error) {
      alert(`Error:\n${error.message}`);
    }
  };

  const datesDiaCursDisponibles = (dades) =>
    [
      ...new Set(
        slots
          .filter((slot) => esSlotDeCurs(slot))
          .filter((slot) => getSlotData(slot) >= avuiText())
          .filter((slot) => dades?.tipo_cirugia && esSlotCompatibleAmbCirurgia(slot, { tipo_cirugia: dades.tipo_cirugia }))
          .map((slot) => getSlotData(slot))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

  const datesSlotsDisponibles = (dades) =>
    [
      ...new Set(
        slots
          .filter((slot) => !esDiaCurs(slot))
          .filter((slot) => !esSlotBenigne(slot))
          .filter((slot) => getSlotData(slot) >= avuiText())
          .filter((slot) => dades?.tipo_cirugia && esSlotCompatibleAmbCirurgia(slot, { tipo_cirugia: dades.tipo_cirurgia }))
          .map((slot) => getSlotData(slot))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

  const MiniSelectorData = ({ dades, mode, camp, dates, missatgeBuit }) => {
    if (!dades.tipo_cirugia) {
      return <div style={avisSelector}>Primer selecciona el tipus de cirurgia per veure els slots compatibles.</div>;
    }

    if (dates.length === 0) return <div style={avisSelector}>{missatgeBuit}</div>;

    return (
      <select
        style={input}
        value={dades[camp] || ""}
        onChange={(e) => {
          const setDades = mode === "alta" ? setForm : setEditForm;
          setDades({ ...dades, [camp]: e.target.value });
        }}
      >
        <option value="">Selecciona una data</option>
        {dates.map((data) => (
          <option key={data} value={data}>
            {formatDataVista(data)}
          </option>
        ))}
      </select>
    );
  };

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
            <option>Pendent validació</option>
            <option>Operat</option>
            <option>Cancel·lat</option>
          </select>
        </label>
      )}

      <div style={esMobil ? gridUnaColumna : gridDosColumnes}>
        <section>
          <div style={capcalera}>Variables clíniques</div>

          {mode === "edicio" && (
            <label style={label}>
              Registrat per
              <input value={getRegistratPer(cirurgiaEditant)} disabled style={input} />
            </label>
          )}

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
              <input type="date" name="fecha_fin_neo" value={dades.fecha_fin_neo} max={avuiText()} onChange={(e) => actualitzarCamp(e, mode)} style={input} />
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
                  <input type="checkbox" checked={dades.segments.includes(segment)} onChange={() => canviarSegment(segment, mode)} /> S{segment}
                </label>
              ))}
            </div>
          )}

          <label style={checkLabel}>
            <input type="checkbox" name="dia_curs" checked={dades.dia_curs} onChange={(e) => actualitzarCamp(e, mode)} />
            Cirurgia de curs
          </label>

          {dades.dia_curs && (
            <MiniSelectorData
              dades={dades}
              mode={mode}
              camp="fecha_dia_curs"
              dates={datesDiaCursDisponibles(dades)}
              missatgeBuit="Encara no hi ha cap slot de curs futur compatible amb aquest tipus de cirurgia."
            />
          )}

          {!dades.dia_curs && (
            <label style={checkLabel}>
              <input type="checkbox" name="fijada" checked={dades.fijada} onChange={(e) => actualitzarCamp(e, mode)} />
              Fixar manualment
            </label>
          )}

          {dades.fijada && !dades.dia_curs && (
            <MiniSelectorData
              dades={dades}
              mode={mode}
              camp="fecha_fijada"
              dates={datesSlotsDisponibles(dades)}
              missatgeBuit="No hi ha cap slot futur compatible amb aquest tipus de cirurgia."
            />
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
      <div style={chipsOpcions}>
        {opcions.map((opcio) => {
          const seleccionada = seleccionades.includes(opcio);
          return (
            <button key={opcio} type="button" style={seleccionada ? chipSelected : chipOption} onClick={() => onToggle(opcio)}>
              {opcio}
              {seleccionada ? " ×" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );

  const obrirModalDia = (data) => {
    setDiaSeleccionat(data);
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
    setSlotForm({
      quirofan: quirofansFixos.includes(quirofan) ? quirofan : "Altres",
      quirofan_altres: quirofansFixos.includes(quirofan) ? "" : quirofan,
      franja: getSlotFranja(slot) || "Matí",
      hora_inicio: slot.hora_inicio || "08:00",
      hora_fin: slot.hora_fin || "15:00",
      tipus_cirurgia:
        tipusGuardats.length > 0
          ? tipusGuardats
          : quirofan === "2.1" || quirofan === "2.2"
            ? ["Robòtica"]
            : ["Oberta", "Laparoscòpica"],
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
    if (valor === "2.1" || valor === "2.2") tipus = ["Robòtica"];
    setSlotForm({
      ...slotForm,
      quirofan: valor,
      quirofan_altres: valor === "Altres" ? slotForm.quirofan_altres : "",
      tipus_cirurgia: tipus,
    });
  };

  const toggleTipusCirurgia = (tipus) => {
    setSlotForm({
      ...slotForm,
      tipus_cirurgia: slotForm.tipus_cirurgia.includes(tipus)
        ? slotForm.tipus_cirurgia.filter((t) => t !== tipus)
        : [...slotForm.tipus_cirurgia, tipus],
    });
  };

  const toggleCirurgiaDisponible = (nom) => {
    setSlotForm({
      ...slotForm,
      cirurgians: slotForm.cirurgians.includes(nom)
        ? slotForm.cirurgians.filter((c) => c !== nom)
        : [...slotForm.cirurgians, nom],
    });
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

  const guardarSlot = async () => {
    if (slotForm.quirofan === "Altres" && !slotForm.quirofan_altres.trim()) return alert("Escriu el número de quiròfan.");
    if (slotForm.tipus_cirurgia.length === 0) return alert("Selecciona almenys un tipus de cirurgia.");

    try {
      const url = slotEditant ? `${API_URL}/slots/${slotEditant.id}` : `${API_URL}/slots`;
      const res = await authFetch(url, {
        method: slotEditant ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(crearPayloadSlot()),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setModalSlot(false);
      setDiaSeleccionat(null);
      setSlotEditant(null);
      setSlotForm(slotInicial);
      await carregarDades();
    } catch (error) {
      alert(`Error guardant slot:\n${error.message}`);
    }
  };

  const eliminarSlot = async () => {
    if (!slotEditant) return;
    if (!window.confirm("Vols eliminar aquest slot?")) return;

    try {
      const res = await authFetch(`${API_URL}/slots/${slotEditant.id}`, { method: "DELETE" });
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setModalSlot(false);
      setSlotEditant(null);
      await carregarDades();
    } catch (error) {
      alert(`Error eliminant slot:\n${error.message}`);
    }
  };

  const executarReprogramacio = async () => {
    if (!window.confirm("Segur que vols reprogramar les cirurgies?")) return;

    try {
      const res = await authFetch(`${API_URL}/planner/proposta`);
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      const proposta = Array.isArray(data.assignacions) ? data.assignacions : [];
      if (proposta.length === 0) {
        return alert("No s’ha pogut programar cap cirurgia. Revisa que hi hagi cirurgies pendents i slots quirúrgics compatibles.");
      }

      setPropostaReprogramacio(proposta);
      setAvisReprogramacio(Array.isArray(data.canvis) ? data.canvis : []);
    } catch (error) {
      alert(`Error generant proposta:\n${error.message}`);
    }
  };

  const validarReprogramacio = async () => {
    try {
      const res = await authFetch(`${API_URL}/planner/validar`, { method: "POST" });
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      alert(`Planificació validada. ${data.total_programades || 0} cirurgies programades.`);
      setAvisReprogramacio([]);
      setPropostaReprogramacio(null);
      await carregarDades();
    } catch (error) {
      alert(`Error validant proposta:\n${error.message}`);
    }
  };

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

  const generarProgramacioActual = () => propostaReprogramacio || planificacioValidada || [];

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

  const franjaSolapada = (slotA, slotB) =>
    getSlotData(slotA) === getSlotData(slotB) && getSlotFranja(slotA) === getSlotFranja(slotB);

  const cirurgiansOcupatsPerSlot = (assignacioActual) => {
    const ocupats = new Set();

    generarProgramacioActual().forEach((assignacio) => {
      if (!assignacioActual || !assignacio) return;
      if (assignacio.cirurgia?.id === assignacioActual.cirurgia?.id) return;
      if (franjaSolapada(assignacio.slot, assignacioActual.slot)) {
        (assignacio.cirujanos_asignados || []).forEach((nom) => ocupats.add(nom));
      }
    });

    return Array.from(ocupats);
  };

  const toggleCirurgiaPlannerParticipant = (nom) => {
    if (!cirurgiaPlannerSeleccionada) return;

    const ocupats = cirurgiansOcupatsPerSlot(cirurgiaPlannerSeleccionada);
    const seleccionats = cirurgiaPlannerSeleccionada.cirujanos_asignados || [];
    if (ocupats.includes(nom) && !seleccionats.includes(nom)) return;

    const novaLlista = seleccionats.includes(nom)
      ? seleccionats.filter((c) => c !== nom)
      : [...seleccionats, nom];

    setCirurgiaPlannerSeleccionada({
      ...cirurgiaPlannerSeleccionada,
      cirujanos_asignados: novaLlista,
    });
  };

  const guardarCirurgiansPlanner = async () => {
    if (!cirurgiaPlannerSeleccionada) return;

    try {
      const seleccionats = cirurgiaPlannerSeleccionada.cirujanos_asignados || [];
      const res = await authFetch(`${API_URL}/planner/cirujanos/${cirurgiaPlannerSeleccionada.cirurgia.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cirujanos_asignados: seleccionats }),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setCirurgiaPlannerSeleccionada(null);
      await carregarDades();
    } catch (error) {
      alert(`Error guardant cirurgians:\n${error.message}`);
    }
  };

  const crearUsuari = async () => {
    if (!userForm.username.trim()) return alert("El nom d’usuari és obligatori.");
    if (userForm.password.length < 6) return alert("La contrasenya ha de tenir almenys 6 caràcters.");
    if (userForm.password !== userForm.confirmPassword) return alert("Les contrasenyes no coincideixen.");

    try {
      const res = await authFetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userForm.username.trim(),
          password: userForm.password,
          role: userForm.role,
        }),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setUserForm(userFormInicial);
      await carregarUsuaris();
      alert("Usuari creat correctament.");
    } catch (error) {
      alert(`Error:\n${error.message}`);
    }
  };

  const eliminarUsuari = async (user) => {
    if (!window.confirm(`Segur que vols eliminar l’usuari ${user.username}?`)) return;

    try {
      const res = await authFetch(`${API_URL}/users/${user.id}`, { method: "DELETE" });
      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      await carregarUsuaris();
      alert("Usuari eliminat correctament.");
    } catch (error) {
      alert(`Error:\n${error.message}`);
    }
  };

  const canviarContrasenyaUsuari = async (user) => {
    const novaPassword = passwordReset[user.id] || "";
    if (novaPassword.length < 6) return alert("La nova contrasenya ha de tenir almenys 6 caràcters.");

    try {
      const res = await authFetch(`${API_URL}/users/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: novaPassword }),
      });

      const data = await llegirJson(res, {});
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));

      setPasswordReset({ ...passwordReset, [user.id]: "" });
      alert("Contrasenya actualitzada correctament.");
    } catch (error) {
      alert(`Error:\n${error.message}`);
    }
  };

  const cirurgiesFiltrades = useMemo(
    () => cirugias.filter((c) => c.codigo?.toLowerCase().includes(cerca.toLowerCase())),
    [cirugias, cerca]
  );

  const cirurgiesPendents = cirurgiesFiltrades.filter((c) => c.estat_cas === "Pendent");
  const cirurgiesProgramades = cirurgiesFiltrades.filter((c) => c.estat_cas === "Programat");

  const cirurgiesPendentsValidacio = cirugias
    .filter((c) => c.estat_cas === "Pendent validació")
    .filter((c) => c.codigo?.toLowerCase().includes(cercaHistoric.toLowerCase()));

  const cirurgiesOperadesFiltrades = cirugias
    .filter((c) => c.estat_cas === "Operat")
    .filter((c) => c.codigo?.toLowerCase().includes(cercaHistoric.toLowerCase()));

  const slotsPerDia = (data) =>
    slots
      .filter((s) => getSlotData(s) === formatDataLocal(data))
      .filter((s) => !esDiaCurs(s));

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

    return (
      <>
        <div style={calendarTop}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button>
            <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button>
          </div>
          <h2 style={{ margin: 0 }}>{mesos[mes]} del {any}</h2>
          <div />
        </div>

        <div style={calendarGrid}>
          {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => (
            <div key={d} style={calendarHeader}>{d}</div>
          ))}

          {dies.map((data) => {
            const events = slotsPerDia(data);
            return (
              <div key={formatDataLocal(data)} style={{ ...calendarDay, opacity: data.getMonth() !== mes ? 0.35 : 1 }} onClick={() => obrirModalDia(data)}>
                <div style={calendarNumber}>{data.getDate()}</div>
                {events.slice(0, 3).map((slot) => (
                  <div key={slot.id} style={esSlotBenigne(slot) ? eventSlotBenigna : esSlotDeCurs(slot) ? eventSlotCurs : eventSlot} onClick={(e) => obrirEditorSlot(e, slot)}>
                    Q{getSlotQuirofan(slot) || "?"} · {getSlotFranja(slot) || "Franja"}
                    {esSlotDeCurs(slot) && " · curs"}
                    {esSlotBenigne(slot) && " · benign"}
                  </div>
                ))}
                {events.length > 3 && <div style={eventSlotMes}>+{events.length - 3} slots més</div>}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const CalendariPlanner = () => {
    const assignacions = generarProgramacioActual();
    const any = mesActual.getFullYear();
    const mes = mesActual.getMonth();
    const diesSetmana = diesSetmanaActual();

    const primerDia = new Date(any, mes, 1);
    const iniciCalendari = new Date(primerDia);
    const diaSetmana = primerDia.getDay();
    const offsetDilluns = diaSetmana === 0 ? 6 : diaSetmana - 1;
    iniciCalendari.setDate(primerDia.getDate() - offsetDilluns);

    const diesMes = Array.from({ length: 42 }, (_, i) => {
      const data = new Date(iniciCalendari);
      data.setDate(iniciCalendari.getDate() + i);
      return data;
    });

    const assignacionsPerDia = (data) =>
      assignacions.filter((a) => getSlotData(a.slot) === formatDataLocal(data));

    return (
      <>
        <div style={plannerToolbar}>
          <button style={botoPlannerSecundariBlau} onClick={() => setVistaPlanner(vistaPlanner === "mensual" ? "setmanal" : "mensual")}>
            {vistaPlanner === "mensual" ? "Visualització setmanal" : "Visualització mensual"}
          </button>
          <button style={botoPlannerPetit} onClick={descarregarPlannerPDF}>Descarregar PDF</button>
        </div>

        {propostaReprogramacio && avisReprogramacio.length > 0 && (
          <div style={panellCanvisReprogramacio}>
            <div style={panellCanvisTitol}>Canvis de la reprogramació</div>
            {avisReprogramacio.map((canvi, index) => (
              <div key={`${canvi.tipus}-${canvi.cirurgia?.id || index}`} style={panellCanviItem}>
                <strong>{canvi.cirurgia?.codigo || "Cirurgia"}</strong>
                <div style={panellCanviText}>
                  {canvi.tipus === "moguda" && (
                    <>
                      es mou del {formatDataVista(getSlotData(canvi.slot_actual))} Q{getSlotQuirofan(canvi.slot_actual)} al {formatDataVista(getSlotData(canvi.slot_nou))} Q{getSlotQuirofan(canvi.slot_nou)}.
                    </>
                  )}
                  {canvi.tipus === "pendent" && <>torna a cirurgies pendents.</>}
                  {canvi.tipus === "nova" && <>s’afegeix a la nova planificació.</>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={plannerRef}>
          <div style={plannerTop}>
            <div style={{ display: "flex", gap: "8px" }}>
              {vistaPlanner === "mensual" ? (
                <>
                  <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes - 1, 1))}>‹</button>
                  <button style={calendarBtn} onClick={() => setMesActual(new Date(any, mes + 1, 1))}>›</button>
                </>
              ) : (
                <>
                  <button style={calendarBtn} onClick={() => moureSetmana(-1)}>‹</button>
                  <button style={calendarBtn} onClick={() => moureSetmana(1)}>›</button>
                </>
              )}
            </div>
            <h2 style={{ margin: 0 }}>
              {vistaPlanner === "mensual"
                ? `${mesos[mes]} del ${any}`
                : `Setmana del ${formatDataVista(formatDataLocal(diesSetmana[0]))} al ${formatDataVista(formatDataLocal(diesSetmana[6]))}`}
            </h2>
            <div />
          </div>

          {vistaPlanner === "mensual" && (
            <div style={calendarGrid}>
              {["dl.", "dt.", "dc.", "dj.", "dv.", "ds.", "dg."].map((d) => (
                <div key={d} style={calendarHeader}>{d}</div>
              ))}
              {diesMes.map((data) => (
                <div key={formatDataLocal(data)} style={{ ...calendarDayPlanificacio, opacity: data.getMonth() !== mes ? 0.35 : 1 }}>
                  <div style={calendarNumber}>{data.getDate()}</div>
                  {assignacionsPerDia(data).map((assignacio) => (
                    <div key={`${assignacio.slot?.id}-${assignacio.cirurgia?.id}`} style={eventOperacioProgramada} onClick={() => setCirurgiaPlannerSeleccionada(assignacio)}>
                      <div style={plannerOperacioHeader}>
                        <span><strong>Q{getSlotQuirofan(assignacio.slot)}</strong> · {assignacio.cirurgia?.codigo}</span>
                        <span style={plannerDiesEspera}>{calcularDiesEspera(assignacio.cirurgia)} d</span>
                      </div>
                      <div>{assignacio.cirurgia?.tipo_operacion_principal || "Operació"}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {vistaPlanner === "setmanal" && (
            <div style={setmanaGrid}>
              {diesSetmana.map((data) => {
                const dataText = formatDataLocal(data);
                const assignacionsDia = assignacionsPerDia(data);
                return (
                  <div key={dataText} style={setmanaDia}>
                    <div style={setmanaHeaderDia}>
                      {data.toLocaleDateString("ca-ES", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </div>
                    {assignacionsDia.map((assignacio) => (
                      <div key={`${assignacio.slot?.id}-${assignacio.cirurgia?.id}`} style={setmanaOperacioBlauVerd} onClick={() => setCirurgiaPlannerSeleccionada(assignacio)}>
                        <div style={setmanaOperacioHeader}>
                          <strong>Q{getSlotQuirofan(assignacio.slot) || "?"}</strong>
                          <span>{getSlotFranja(assignacio.slot) || "Franja"}</span>
                        </div>
                        <div style={plannerOperacioHeader}>
                          <span />
                          <span style={plannerDiesEsperaClar}>{calcularDiesEspera(assignacio.cirurgia)} d espera</span>
                        </div>
                        <div style={setmanaOperacioText}><strong>{assignacio.cirurgia?.codigo}</strong></div>
                        <div style={setmanaOperacioText}>{assignacio.cirurgia?.tipo_operacion_principal || "Operació no informada"}</div>
                        {(assignacio.cirujanos_asignados || []).length > 0 && (
                          <div style={setmanaOperacioDoctors}>{assignacio.cirujanos_asignados.join(", ")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {esAdmin && (
          <div style={plannerActions}>
            <button style={botoPlannerPetit} onClick={executarReprogramacio}>Reprogramació quirúrgica</button>
          </div>
        )}

        {esAdmin && propostaReprogramacio && (
          <div style={plannerActions}>
            <button style={botoPrincipal} onClick={validarReprogramacio}>Validar proposta</button>
            <button style={botoSecundari} onClick={() => { setAvisReprogramacio([]); setPropostaReprogramacio(null); }}>Cancel·lar proposta</button>
          </div>
        )}
      </>
    );
  };

  const GestioUsuaris = () => (
    <div style={esMobil ? cardMobil : cardAmple}>
      <h2 style={{ marginTop: 0, color: "#0f2b57" }}>Gestió d’usuaris</h2>

      <div style={esMobil ? gridUnaColumna : gestioUsuarisGrid}>
        <section style={gestioUsuarisPanel}>
          <div style={capcalera}>Crear nou usuari</div>

          <label style={label}>
            Tipus d’usuari
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={input}>
              <option value="user">Usuari</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <label style={label}>
            Nom d’usuari
            <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} style={input} placeholder="Nom d’usuari" />
          </label>

          <label style={label}>
            Contrasenya
            <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} style={input} placeholder="Mínim 6 caràcters" />
          </label>

          <label style={label}>
            Confirmar contrasenya
            <input type="password" value={userForm.confirmPassword} onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })} style={input} placeholder="Repeteix la contrasenya" />
          </label>

          <button style={botoPrincipal} onClick={crearUsuari}>Crear usuari</button>
        </section>

        <section style={gestioUsuarisPanel}>
          <div style={capcalera}>Usuaris registrats</div>

          <div style={llistaUsuaris}>
            {(!Array.isArray(usuaris) || usuaris.length === 0) && (
              <div style={registradesBuit}>No hi ha usuaris registrats o l’endpoint /users encara no respon.</div>
            )}

            {Array.isArray(usuaris) &&
              usuaris.map((user) => (
                <div key={user.id || user.username} style={usuariCard}>
                  <div>
                    <strong>{user.username}</strong>
                    <div style={usuariMeta}>
                      Rol: {user.role}
                      {user.id === usuari?.id && " · sessió actual"}
                    </div>
                  </div>

                  <div style={usuariActions}>
                    <input
                      type="password"
                      value={passwordReset[user.id] || ""}
                      onChange={(e) => setPasswordReset({ ...passwordReset, [user.id]: e.target.value })}
                      style={inputPetit}
                      placeholder="Nova contrasenya"
                    />

                    <button style={botoPetitBlau} onClick={() => canviarContrasenyaUsuari(user)}>Canviar</button>

                    <button style={botoPetitVermell} disabled={user.id === usuari?.id} onClick={() => eliminarUsuari(user)}>Eliminar</button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );

  const menuItems = [
    ["alta", "Alta de cirurgia", "＋"],
    ["registrades", "Cirurgies registrades", "▦"],
    ["planificacio", "Planner", "▣"],
    ...(esAdmin
      ? [
          ["slots", "Calendari de slots", "◷"],
          ["gestio_usuaris", "Gestió d’usuaris", "👤"],
        ]
      : []),
  ];

  if (!token) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h1 style={loginTitle}>Planner quirúrgic HPB</h1>
          <p style={loginSubtitle}>Accés restringit a personal autoritzat</p>

          <label style={label}>
            Usuari
            <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} style={input} placeholder="Introdueix l’usuari" onKeyDown={(e) => e.key === "Enter" && iniciarSessio()} />
          </label>

          <label style={label}>
            Contrasenya
            <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} style={input} placeholder="Introdueix la contrasenya" onKeyDown={(e) => e.key === "Enter" && iniciarSessio()} />
          </label>

          {errorLogin && <div style={loginError}>{errorLogin}</div>}

          <button onClick={iniciarSessio} style={botoPrincipal}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={esMobil ? appLayoutMobil : appLayout}>
      {esMobil ? (
        <>
          <div style={topbarMobil}>
            <button style={topbarBtn} onClick={() => setSidebarOberta(!sidebarOberta)}>☰</button>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>Planner HPB</div>
            <button style={topbarBtn} onClick={tancarSessio}>⏻</button>
          </div>

          {sidebarOberta && (
            <div style={menuMobil}>
              {menuItems.map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => {
                    setPestanya(key);
                    setSidebarOberta(false);
                  }}
                  style={pestanya === key ? botoMenuMobilActiu : botoMenuMobil}
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
                <div style={sidebarTitle}>Planner HPB</div>
                <div style={sidebarSubtitle}>Planificació quirúrgica</div>
              </div>
            )}

            <button style={sidebarToggle} onClick={() => setSidebarOberta(!sidebarOberta)}>
              {sidebarOberta ? "‹" : "›"}
            </button>
          </div>

          <nav style={sidebarNav}>
            {menuItems.map(([key, label, icon]) => (
              <button key={key} onClick={() => setPestanya(key)} style={pestanya === key ? sidebarItemActiu : sidebarItem} title={!sidebarOberta ? label : undefined}>
                <span style={sidebarIcon}>{icon}</span>
                {sidebarOberta && <span>{label}</span>}
              </button>
            ))}
          </nav>

          <div style={sidebarUserBox}>
            {sidebarOberta ? (
              <>
                <div style={sidebarUserLabel}>Sessió iniciada</div>
                <div style={sidebarUserName}>{usuari?.username}</div>
                <div style={sidebarUserRole}>{usuari?.role}</div>
              </>
            ) : (
              <div style={sidebarUserCompact}>{String(usuari?.username || "U").charAt(0).toUpperCase()}</div>
            )}

            <button style={sidebarLogoutBtn} onClick={tancarSessio}>
              {sidebarOberta ? "Tancar sessió" : "⏻"}
            </button>
          </div>
        </aside>
      )}

      <main style={esMobil ? mainContentMobil : mainContent}>
        <h1 style={esMobil ? titleMobil : title}>Planner quirúrgic HPB</h1>

        {pestanya === "alta" && (
          <div style={esMobil ? cardMobil : card}>
            <FormulariCirurgia dades={form} mode="alta" />
            <button onClick={guardarCirurgia} style={botoPrincipal}>Guardar cirurgia</button>
          </div>
        )}

        {pestanya === "registrades" && (
          <div style={esMobil ? cardMobil : cardAmple}>
            <div style={subTabsBoxDreta}>
              <button style={subPestanyaRegistrades === "actives" ? subTabActiva : subTab} onClick={() => setSubPestanyaRegistrades("actives")}>
                Pendents i programades
              </button>
              <button style={subPestanyaRegistrades === "historic" ? subTabActiva : subTab} onClick={() => setSubPestanyaRegistrades("historic")}>
                Històric de cirurgies
              </button>
            </div>

            {subPestanyaRegistrades === "actives" && (
              <>
                <div style={registradesTopSimple}>
                  <input type="text" placeholder="Cercar per codi del cas..." value={cerca} onChange={(e) => setCerca(e.target.value)} style={registradesSearch} />
                </div>

                <div style={esMobil ? registradesUnaColumna : registradesDuesColumnes}>
                  <section style={registradesPanelTaula}>
                    <div style={registradesPanelHeader}>
                      <span>Cirurgies pendents</span>
                      <span>{cirurgiesPendents.length}</span>
                    </div>
                    <TaulaCirurgies cirurgies={cirurgiesPendents} buida="No hi ha cirurgies pendents." onClick={obrirEditor} />
                  </section>

                  <section style={registradesPanelTaula}>
                    <div style={registradesPanelHeader}>
                      <span>Cirurgies programades</span>
                      <span>{cirurgiesProgramades.length}</span>
                    </div>
                    <TaulaCirurgies cirurgies={cirurgiesProgramades} buida="No hi ha cirurgies programades." onClick={obrirEditor} mostrarData />
                  </section>
                </div>
              </>
            )}

            {subPestanyaRegistrades === "historic" && (
              <>
                <div style={registradesTopSimple}>
                  <input type="text" placeholder="Cercar històric per codi..." value={cercaHistoric} onChange={(e) => setCercaHistoric(e.target.value)} style={registradesSearch} />
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
                              <button type="button" style={botoValidarPetit} onClick={() => validarCirurgiaRealitzada(c.id)}>Validar realitzada</button>
                              <button type="button" style={botoRetornarPetit} onClick={() => retornarCirurgiaAPendents(c.id)}>Retornar a pendents</button>
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

        {pestanya === "planificacio" && (
          <div style={esMobil ? cardMobil : cardAmple}>
            <CalendariPlanner />
          </div>
        )}

        {pestanya === "slots" && esAdmin && (
          <div style={esMobil ? cardMobil : cardAmple}>
            <CalendariSlots />
          </div>
        )}

        {pestanya === "gestio_usuaris" && esAdmin && <GestioUsuaris />}

        {cirurgiaEditant && editForm && (
          <div style={modalFons}>
            <div style={modal}>
              <h2 style={{ textAlign: "center" }}>Editar cirurgia</h2>
              <FormulariCirurgia dades={editForm} mode="edicio" />
              <div style={modalActionsTres}>
                <button onClick={guardarEdicio} style={botoPrincipal}>Guardar canvis</button>
                <button onClick={eliminarCirurgiaEditant} style={botoVermell}>Eliminar cirurgia</button>
                <button onClick={() => { setCirurgiaEditant(null); setEditForm(null); }} style={botoSecundari}>Cancel·lar</button>
              </div>
            </div>
          </div>
        )}

        {cirurgiaPlannerSeleccionada && (
          <div style={modalFons}>
            <div style={modalPetit}>
              <h2 style={{ textAlign: "center", marginTop: 0 }}>Detall de cirurgia programada</h2>

              <div style={detallPlannerGrid}>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Codi del cas</span><strong>{cirurgiaPlannerSeleccionada.cirurgia?.codigo}</strong></div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Data</span>{formatDataVista(getSlotData(cirurgiaPlannerSeleccionada.slot))}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Quiròfan</span>Q{getSlotQuirofan(cirurgiaPlannerSeleccionada.slot)}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Franja</span>{getSlotFranja(cirurgiaPlannerSeleccionada.slot) || "No informada"}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Tipus de cirurgia</span>{cirurgiaPlannerSeleccionada.cirurgia?.tipo_cirugia || "No informat"}</div>
                <div style={detallPlannerItem}><span style={detallPlannerLabel}>Tipus d’operació</span>{cirurgiaPlannerSeleccionada.cirurgia?.tipo_operacion_principal || "No informat"}</div>
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

                      return (
                        <button key={nom} type="button" disabled={ocupat} style={ocupat ? chipDisabled : seleccionat ? chipSelected : chipOption} onClick={() => toggleCirurgiaPlannerParticipant(nom)}>
                          {nom}{seleccionat ? " ×" : ""}{ocupat ? " · ocupat" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <button style={botoPrincipal} onClick={guardarCirurgiansPlanner}>Guardar cirurgians</button>
                <button style={botoSecundari} onClick={() => setCirurgiaPlannerSeleccionada(null)}>Cancel·lar</button>
              </div>
            </div>
          </div>
        )}

        {modalSlot && diaSeleccionat && (
          <div style={modalFons}>
            <div style={modalPetit}>
              <div style={modalDiaHeaderNou}>
                <span>Dia seleccionat:</span>
                <strong>{formatDataLlarga(diaSeleccionat)}</strong>
              </div>

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
                  <input value={slotForm.quirofan_altres} onChange={(e) => setSlotForm({ ...slotForm, quirofan_altres: e.target.value })} style={input} />
                </label>
              )}

              <label style={label}>
                Franja
                <select value={slotForm.franja} onChange={(e) => setSlotForm({ ...slotForm, franja: e.target.value })} style={input}>
                  <option>Matí</option>
                  <option>Tarda</option>
                </select>
              </label>

              <div style={esMobil ? gridUnaColumna : gridDosColumnes}>
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
                <ChipsSelector opcions={["Oberta", "Laparoscòpica", "Robòtica"]} seleccionades={slotForm.tipus_cirurgia} onToggle={toggleTipusCirurgia} />
              </label>

              <label style={checkLabel}>
                <input type="checkbox" checked={slotForm.slot_de_curs} onChange={(e) => setSlotForm({ ...slotForm, slot_de_curs: e.target.checked })} />
                Slot de curs
              </label>

              <label style={checkLabel}>
                <input type="checkbox" checked={slotForm.cirurgia_benigna} onChange={(e) => setSlotForm({ ...slotForm, cirurgia_benigna: e.target.checked })} />
                Cirurgia benigna
              </label>

              <label style={label}>
                Cirurgians disponibles
                <ChipsSelector opcions={cirurgiansDisponibles} seleccionades={slotForm.cirurgians} onToggle={toggleCirurgiaDisponible} />
              </label>

              <label style={label}>
                Comentaris
                <textarea value={slotForm.comentarios} onChange={(e) => setSlotForm({ ...slotForm, comentarios: e.target.value })} style={textarea} placeholder="Comentaris del slot" />
              </label>

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={guardarSlot} style={botoPrincipal}>{slotEditant ? "Guardar canvis" : "Guardar slot"}</button>
                {slotEditant && <button onClick={eliminarSlot} style={botoVermell}>Eliminar</button>}
                <button onClick={() => { setModalSlot(false); setDiaSeleccionat(null); setSlotEditant(null); setSlotForm(slotInicial); }} style={botoSecundari}>Cancel·lar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  function TaulaCirurgies({ cirurgies, buida, onClick, mostrarData = false }) {
    return (
      <table style={taulaRegistrades}>
        <thead>
          <tr>
            <th style={thRegistrades}>Codi</th>
            {mostrarData && <th style={thRegistrades}>Data</th>}
            <th style={thRegistrades}>Origen</th>
            <th style={thRegistrades}>Tipus</th>
            <th style={thRegistrades}>Cirurgia</th>
            <th style={thRegistrades}>Operació</th>
            <th style={{ ...thRegistrades, textAlign: "right" }}>Espera</th>
            <th style={thRegistrades}>Sol·licitat per</th>
          </tr>
        </thead>
        <tbody>
          {cirurgies.length === 0 && (
            <tr>
              <td style={tdRegistradesBuit} colSpan={mostrarData ? 8 : 7}>{buida}</td>
            </tr>
          )}

          {cirurgies.map((c) => (
            <tr key={c.id} style={trRegistrades} onClick={() => onClick(c)}>
              <td style={tdRegistrades}><strong>{c.codigo}</strong></td>
              {mostrarData && <td style={tdRegistrades}>{c.fecha_fijada || "Sense data"}</td>}
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
    );
  }
}

const loginPage = { minHeight: "100vh", background: "#f7f9fc", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "Inter, Arial, sans-serif", color: "#1f2a44", padding: "20px" };
const loginCard = { width: "420px", background: "white", borderRadius: "20px", padding: "28px", boxShadow: "0 20px 60px rgba(15, 43, 87, 0.14)" };
const loginTitle = { textAlign: "center", fontSize: "30px", margin: "0 0 6px", color: "#0f2b57" };
const loginSubtitle = { textAlign: "center", margin: "0 0 22px", color: "#4b5b76", fontWeight: "600" };
const loginError = { background: "#fee2e2", border: "1px solid #ef4444", color: "#991b1b", borderRadius: "10px", padding: "10px", margin: "10px 0", fontSize: "14px", fontWeight: "700" };

const appLayout = { minHeight: "100vh", background: "#f7f9fc", display: "flex", fontFamily: "Inter, Arial, sans-serif", color: "#1f2a44" };
const appLayoutMobil = { minHeight: "100vh", background: "#f7f9fc", display: "flex", fontFamily: "Inter, Arial, sans-serif", color: "#1f2a44", overflowX: "hidden" };

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

const topbarMobil = { position: "fixed", top: 0, left: 0, right: 0, height: "64px", background: "#0f2b57", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", zIndex: 3000, boxSizing: "border-box" };
const topbarBtn = { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", color: "white", borderRadius: "12px", width: "44px", height: "44px", fontSize: "22px" };
const menuMobil = { position: "fixed", top: "64px", left: 0, width: "82%", maxWidth: "320px", bottom: 0, background: "#0f2b57", padding: "18px", zIndex: 2999, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "10px 0 30px rgba(0,0,0,0.35)" };
const botoMenuMobil = { border: "none", borderRadius: "16px", padding: "16px", background: "transparent", color: "white", display: "flex", alignItems: "center", gap: "12px", fontSize: "18px", fontWeight: 600 };
const botoMenuMobilActiu = { ...botoMenuMobil, background: "white", color: "#0f2b57" };

const mainContent = { flex: 1, minWidth: 0, padding: "14px 22px 24px", boxSizing: "border-box", overflowX: "auto" };
const mainContentMobil = { flex: 1, minWidth: 0, padding: "14px 10px 24px", marginLeft: 0, marginTop: "64px", boxSizing: "border-box", overflowX: "hidden" };
const title = { textAlign: "center", fontSize: "34px", margin: "4px 0 16px", color: "#0f2b57" };
const titleMobil = { textAlign: "center", fontSize: "26px", lineHeight: "1", margin: "12px 0 12px", color: "#0f2b57" };

const card = { maxWidth: "1180px", margin: "0 auto", background: "white", borderRadius: "18px", padding: "18px 22px", boxShadow: "0 10px 30px rgba(15, 43, 87, 0.08)" };
const cardAmple = { maxWidth: "1500px", margin: "0 auto", background: "white", borderRadius: "18px", padding: "14px 18px", boxShadow: "0 10px 30px rgba(15, 43, 87, 0.08)" };
const cardMobil = { width: "100%", maxWidth: "100%", margin: "0 auto", background: "white", borderRadius: "16px", padding: "12px", boxSizing: "border-box", boxShadow: "0 8px 22px rgba(15, 43, 87, 0.08)", overflowX: "hidden" };

const gridDosColumnes = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" };
const gridUnaColumna = { display: "grid", gridTemplateColumns: "1fr", gap: "12px" };
const capcalera = { background: "#eef6ff", border: "1px solid #9ec9ff", borderRadius: "12px", padding: "14px", marginBottom: "14px", color: "#003b8e", fontWeight: "700", fontSize: "17px", textAlign: "center" };
const label = { display: "block", textAlign: "left", fontSize: "14px", fontWeight: "600", marginBottom: "8px" };
const labelFull = { ...label, marginBottom: "14px" };
const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", marginTop: "5px", borderRadius: "10px", border: "1px solid #d6dbe3", background: "#f1f3f7", fontSize: "15px" };
const textarea = { ...input, height: "78px", resize: "vertical" };
const checkLabel = { display: "flex", alignItems: "center", gap: "8px", textAlign: "left", fontSize: "14px", fontWeight: "600", marginBottom: "12px" };
const segmentsBox = { background: "#f7f9fc", border: "1px solid #e0e6ef", borderRadius: "12px", padding: "10px", marginBottom: "12px" };
const miniTitle = { display: "block", fontSize: "14px", fontWeight: "700", marginBottom: "8px" };
const segmentLabel = { marginRight: "10px", fontSize: "14px" };
const avisSelector = { background: "#fff7cc", border: "1px solid #facc15", color: "#3f2f00", borderRadius: "10px", padding: "10px", marginBottom: "12px", fontSize: "13px", fontWeight: "700" };

const botoPrincipal = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#0f2b57", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoSecundari = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "1px solid #d5dce8", background: "white", color: "#0f2b57", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoVermell = { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "none", background: "#ef4444", color: "white", fontSize: "16px", fontWeight: "700", cursor: "pointer" };
const botoPlannerPetit = { width: "auto", minWidth: "230px", padding: "10px 18px", borderRadius: "12px", border: "none", background: "#0f2b57", color: "white", fontSize: "15px", fontWeight: "700", cursor: "pointer" };
const botoPlannerSecundariBlau = { width: "auto", minWidth: "230px", padding: "10px 18px", borderRadius: "12px", border: "1px solid #9ec9ff", background: "#eef6ff", color: "#0f2b57", fontSize: "15px", fontWeight: "800", cursor: "pointer" };

const modalFons = { position: "fixed", inset: 0, background: "rgba(15, 43, 87, 0.35)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modal = { background: "white", width: "950px", maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", borderRadius: "18px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalPetit = { background: "white", width: "720px", maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", borderRadius: "18px", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalActionsTres = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" };

const calendarTop = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: "10px" };
const plannerTop = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: "10px" };
const plannerActions = { display: "flex", justifyContent: "center", marginTop: "14px", gap: "12px", flexWrap: "wrap" };
const plannerToolbar = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" };
const calendarBtn = { background: "#0f2b57", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "20px", fontWeight: "800", cursor: "pointer" };
const calendarGrid = { display: "grid", gridTemplateColumns: "repeat(7, minmax(110px, 1fr))", borderTop: "1px solid #dde2ea", borderLeft: "1px solid #dde2ea", overflowX: "auto" };
const calendarHeader = { padding: "7px", textAlign: "center", fontWeight: "700", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea" };
const calendarDay = { minHeight: "118px", padding: "6px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", cursor: "pointer", background: "white", overflow: "hidden" };
const calendarDayPlanificacio = { minHeight: "102px", padding: "5px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", background: "white", overflow: "hidden" };
const calendarNumber = { textAlign: "right", fontWeight: "600", marginBottom: "4px", fontSize: "13px" };
const eventSlot = { background: "#2563eb", color: "white", borderRadius: "6px", padding: "5px 7px", fontSize: "11px", fontWeight: "800", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" };
const eventSlotCurs = { ...eventSlot, background: "#facc15", color: "#3f2f00", border: "1px solid #eab308" };
const eventSlotBenigna = { ...eventSlot, background: "#94a3b8", color: "white", border: "1px solid #64748b" };
const eventSlotMes = { background: "#eef6ff", color: "#0f2b57", border: "1px solid #9ec9ff", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", fontWeight: "900", textAlign: "center" };

const eventOperacioProgramada = { background: "#0f766e", color: "white", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", marginBottom: "4px", lineHeight: "1.25", cursor: "pointer" };
const plannerOperacioHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" };
const plannerDiesEspera = { marginLeft: "auto", fontSize: "10px", fontWeight: "900", background: "rgba(255,255,255,0.18)", padding: "2px 5px", borderRadius: "999px", whiteSpace: "nowrap" };
const plannerDiesEsperaClar = { marginLeft: "auto", fontSize: "11px", fontWeight: "900", background: "rgba(255,255,255,0.22)", padding: "3px 7px", borderRadius: "999px", whiteSpace: "nowrap" };

const setmanaGrid = { display: "grid", gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", borderTop: "1px solid #dde2ea", borderLeft: "1px solid #dde2ea", overflowX: "auto" };
const setmanaDia = { minHeight: "560px", padding: "8px", borderRight: "1px solid #dde2ea", borderBottom: "1px solid #dde2ea", background: "white" };
const setmanaHeaderDia = { textAlign: "center", fontWeight: "900", color: "#0f2b57", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #e5e7eb" };
const setmanaOperacioBlauVerd = { background: "#0f766e", color: "white", borderRadius: "12px", padding: "10px", marginBottom: "10px", fontSize: "12px", lineHeight: "1.35", cursor: "pointer", boxShadow: "0 6px 14px rgba(15, 118, 110, 0.18)" };
const setmanaOperacioHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "13px", fontWeight: "900" };
const setmanaOperacioText = { marginTop: "4px", fontWeight: "700" };
const setmanaOperacioDoctors = { marginTop: "8px", paddingTop: "7px", borderTop: "1px solid rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: "700", lineHeight: "1.35" };

const chipsBox = { marginTop: "6px", border: "1px solid #d6dbe3", background: "#f1f3f7", borderRadius: "10px", padding: "8px" };
const chipsOpcions = { display: "flex", flexWrap: "wrap", gap: "8px" };
const chipSelected = { border: "none", background: "#0f2b57", color: "white", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", fontWeight: "700", cursor: "pointer" };
const chipOption = { border: "1px solid #d5dce8", background: "white", color: "#1f2a44", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", cursor: "pointer" };
const chipDisabled = { border: "1px solid #d1d5db", background: "#e5e7eb", color: "#6b7280", borderRadius: "7px", padding: "7px 10px", fontSize: "14px", fontWeight: "700", cursor: "not-allowed", opacity: 0.75 };

const subTabsBoxDreta = { display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "18px", flexWrap: "wrap" };
const subTab = { border: "1px solid #9ec9ff", background: "#eef6ff", color: "#0f2b57", borderRadius: "12px", padding: "10px 18px", fontSize: "15px", fontWeight: "800", cursor: "pointer" };
const subTabActiva = { ...subTab, background: "#0f2b57", color: "white" };
const registradesTopSimple = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "16px", marginBottom: "14px" };
const registradesSearch = { width: "280px", boxSizing: "border-box", padding: "10px 12px", borderRadius: "12px", border: "1px solid #d6dbe3", background: "#f8fafc", fontSize: "14px" };
const registradesDuesColumnes = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" };
const registradesUnaColumna = { display: "grid", gridTemplateColumns: "1fr", gap: "18px" };
const registradesPanelTaula = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "18px", padding: "14px", overflowX: "auto" };
const registradesPanelHeader = { background: "#eef6ff", border: "1px solid #9ec9ff", color: "#0f2b57", borderRadius: "14px", padding: "12px 14px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "900" };
const taulaRegistrades = { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "13px", background: "white", border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" };
const thRegistrades = { background: "#eef6ff", color: "#0f2b57", padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: "900", borderBottom: "1px solid #d5dce8", whiteSpace: "nowrap" };
const tdRegistrades = { padding: "10px", borderBottom: "1px solid #edf2f7", color: "#1f2a44", fontWeight: "600", verticalAlign: "top" };
const tdRegistradesBuit = { padding: "18px", color: "#64748b", textAlign: "center", fontWeight: "800" };
const trRegistrades = { cursor: "pointer" };
const historicScrollTaula = { maxHeight: "650px", overflowY: "auto", overflowX: "auto", paddingRight: "6px" };
const registradesBuit = { background: "white", border: "1px dashed #cbd5e1", color: "#64748b", borderRadius: "14px", padding: "16px", textAlign: "center", fontSize: "14px", fontWeight: "800" };

const botoValidarPetit = { border: "none", background: "#16a34a", color: "white", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" };
const botoRetornarPetit = { border: "1px solid #d97706", background: "#fff7cc", color: "#92400e", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" };

const panellCanvisReprogramacio = { background: "#f8fafc", border: "1px solid #cbd5e1", borderLeft: "5px solid #7f1d1d", borderRadius: "14px", padding: "14px", margin: "12px 0", boxShadow: "0 8px 22px rgba(15, 43, 87, 0.08)" };
const panellCanvisTitol = { color: "#0f2b57", fontSize: "16px", fontWeight: "900", marginBottom: "10px" };
const panellCanviItem = { background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px", marginBottom: "8px", fontSize: "14px", color: "#1f2a44" };
const panellCanviText = { marginTop: "4px", color: "#475569", fontWeight: "600", lineHeight: "1.35" };

const detallPlannerGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" };
const detallPlannerItem = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "12px", padding: "10px", fontSize: "14px" };
const detallPlannerLabel = { display: "block", fontSize: "12px", color: "#64748b", fontWeight: "900", textTransform: "uppercase", marginBottom: "4px" };

const modalDiaHeaderNou = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "14px", padding: "14px 16px", color: "#0f2b57", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", fontSize: "17px", fontWeight: "700", marginBottom: "8px" };

const gestioUsuarisGrid = { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "18px" };
const gestioUsuarisPanel = { background: "#f8fafc", border: "1px solid #d5dce8", borderRadius: "18px", padding: "14px" };
const llistaUsuaris = { display: "flex", flexDirection: "column", gap: "10px" };
const usuariCard = { background: "white", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "12px", display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "center" };
const usuariMeta = { marginTop: "4px", color: "#64748b", fontSize: "13px", fontWeight: "700" };
const usuariActions = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const inputPetit = { width: "170px", boxSizing: "border-box", padding: "8px 10px", borderRadius: "9px", border: "1px solid #d6dbe3", background: "#f1f3f7", fontSize: "13px" };
const botoPetitBlau = { border: "none", background: "#0f2b57", color: "white", borderRadius: "9px", padding: "8px 10px", fontSize: "13px", fontWeight: "800", cursor: "pointer" };
const botoPetitVermell = { border: "none", background: "#ef4444", color: "white", borderRadius: "9px", padding: "8px 10px", fontSize: "13px", fontWeight: "800", cursor: "pointer" };

export default App;
