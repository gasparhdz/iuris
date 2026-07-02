import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams, Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { fetchAllPages } from "../api/pagination";
import { usePermisos } from "../auth/usePermissions";
import { addParticipanteCaso, createTercero, fetchAllTerceros, fetchParticipantesCaso, removeParticipanteCaso } from "../api/terceros";
import { getAuditoriaExpediente } from "../api/auditoria.api";
import SisfeSyncButton from "../components/SisfeSyncButton";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add,
  ArrowBack,
  Assignment,
  AttachFile,
  CalendarMonth,
  CloudSync,
  Delete,
  Description,
  Edit,
  Folder,
  Gavel,
  History as HistoryIcon,
  NoteAdd,
  People,
  Timeline,
  UploadFile,
  Visibility,
  WarningAmber,
} from "@mui/icons-material";

function unwrapItems(data) {
  const raw = Array.isArray(data) ? data : data?.data?.items ?? data?.data ?? [];
  return Array.isArray(raw) ? raw : [];
}

function uploadToPresignedPost(presigned, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(presigned.method, presigned.url);
    Object.entries(presigned.headers ?? {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded * 100) / event.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("DIRECT_UPLOAD_FAILED"));
    };
    xhr.onerror = () => reject(new Error("DIRECT_UPLOAD_FAILED"));

    if (presigned.method === "POST") {
      const formData = new FormData();
      Object.entries(presigned.fields ?? {}).forEach(([key, value]) => formData.append(key, value));
      formData.append("file", file);
      xhr.send(formData);
      return;
    }

    xhr.send(file);
  });
}

function clienteNombre(cliente) {
  if (!cliente) return "Sin cliente";
  return cliente.razonSocial || [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") || cliente.nombre || "Sin cliente";
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

// Chip de plazo de un movimiento. La fecha sale de la tarea-plazo vinculada (la tarea ES el
// plazo) o, en su defecto, del vencimiento cargado manualmente en el movimiento.
function getVencimientoChip(vencimientoStr) {
  if (!vencimientoStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const vDateMidnight = new Date(vencimientoStr);
  vDateMidnight.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((vDateMidnight.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return <Chip size="small" color="error" label={`Vencido el ${formatDate(vencimientoStr)}`} sx={{ fontWeight: 800 }} />;
  } else if (diffDays <= 3) {
    const daysText = diffDays === 0 ? "hoy" : diffDays === 1 ? "mañana" : `en ${diffDays} días`;
    return <Chip size="small" color="warning" label={`Vence ${daysText}`} sx={{ fontWeight: 800 }} />;
  }
  return <Chip size="small" color="info" label={`Vence el ${formatDate(vencimientoStr)}`} sx={{ fontWeight: 800 }} />;
}

// Fecha de plazo efectiva de un movimiento: prioriza la tarea-plazo vinculada.
function plazoDe(mov) {
  return mov.tareaVencimiento ?? mov.vencimiento ?? null;
}

function getTipoMovimientoColor(tipo) {
  const t = String(tipo ?? "").toLowerCase();
  if (t.includes("escrito")) return "info";
  if (t.includes("resolución") || t.includes("resolucion") || t.includes("sentencia")) return "success";
  if (t.includes("notificación") || t.includes("notificacion")) return "error";
  return "default";
}

function unwrapData(data) {
  return Array.isArray(data?.data) ? data.data : [];
}

function nullableString(value) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function dateIso(value) {
  const text = nullableString(value);
  if (!text) return null;
  if (text.includes("T")) return text;
  return `${text}T00:00:00.000Z`;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(value));
}

/*
function money(value) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
*/


function terceroLabel(tercero) {
  if (!tercero) return "";
  return tercero.razonSocial || [tercero.apellido, tercero.nombre].filter(Boolean).join(", ") || tercero.nombre || `Tercero #${tercero.id}`;
}

function estadoColor(nombre = "") {
  const text = nombre.toLowerCase();
  if (text.includes("final")) return "success";
  if (text.includes("apel")) return "warning";
  if (text.includes("arch")) return "default";
  if (text.includes("trámite") || text.includes("tramite")) return "info";
  return "primary";
}

function auditoriaActionColor(accion) {
  if (accion === "CREATE" || accion === "COMPLETADA") return "success";
  if (accion === "DELETE") return "error";
  if (accion === "ESTADO_CHANGED") return "warning";
  return "primary";
}

function auditoriaActionLabel(accion) {
  const labels = {
    CREATE: "Creación",
    UPDATE: "Actualización",
    DELETE: "Eliminación",
    ESTADO_CHANGED: "Cambio de estado",
    COMPLETADA: "Completada",
  };
  return labels[accion] ?? accion;
}

function formatAuditField(key) {
  const labels = {
    tipoId: "Tipo",
    estadoId: "Estado",
    radicacionId: "Radicación",
    estadoRadicacionId: "Estado de radicación",
    caratula: "Carátula",
    nroExpte: "Nro. expediente",
    descripcion: "Descripción",
    fechaEstado: "Fecha de estado",
  };
  return labels[key] ?? key.replace(/Id$/, "").replace(/([A-Z])/g, " $1").trim();
}

function formatAuditValue(value, key, paramsById) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (key?.endsWith("Id")) {
    const param = paramsById?.get(Number(value));
    if (param) return param.nombre ?? param.codigo ?? String(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const TAB_MAP = ["sisfe", "participantes", "tareas", "eventos", "expediente_digital", "notas", "historial"];

export default function ExpedienteDetalle() {
  const { id } = useParams();
  const casoId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const casosPerm = usePermisos("CASOS");
  const tareasPerm = usePermisos("TAREAS");
  const eventosPerm = usePermisos("EVENTOS");
  const notasPerm = usePermisos("NOTAS");
  const adjuntosPerm = usePermisos("ADJUNTOS");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tabIndex = TAB_MAP.indexOf(tabParam);
  const tab = tabIndex !== -1 ? tabIndex : 0;

  const setTab = (newTabIndex) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", TAB_MAP[newTabIndex]);
      return next;
    }, { replace: true });
  };
  const [newNote, setNewNote] = useState("");
  const [participantOpen, setParticipantOpen] = useState(false);
  const [participantForm, setParticipantForm] = useState({ terceroId: "", rolId: "", observaciones: "" });
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementForm, setMovementForm] = useState({ fecha: "", tipo: "", foja: "", vencimiento: "", descripcion: "" });
  const [movPage, setMovPage] = useState(0);
  const [movRowsPerPage, setMovRowsPerPage] = useState(10);
  const [movOrderBy, setMovOrderBy] = useState("fecha");
  const [movOrder, setMovOrder] = useState("desc");

  const [deleteEventoTarget, setDeleteEventoTarget] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [folderIdInput, setFolderIdInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const casoQuery = useQuery({
    queryKey: ["expedientes", casoId],
    queryFn: async () => {
      const { data } = await api.get(`/expedientes/${casoId}`);
      return data?.data ?? data;
    },
    enabled: Boolean(casoId),
  });

  const useCatalogQuery = (categoria) => useQuery({
    queryKey: ["catalogos", "parametros", categoria],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const tipos = useCatalogQuery("TIPO_CASO").data ?? [];
  const ramas = useCatalogQuery("RAMA_DERECHO").data ?? [];
  const estados = useCatalogQuery("ESTADO_CASO").data ?? [];
  const radicaciones = useCatalogQuery("RADICACION").data ?? [];
  const roles = useCatalogQuery("ROL_PARTICIPANTE").data ?? [];

  const participantesQuery = useQuery({
    queryKey: ["expedientes", casoId, "participantes"],
    queryFn: () => fetchParticipantesCaso(casoId),
    enabled: Boolean(casoId),
  });

  const tercerosQuery = useQuery({
    queryKey: ["terceros", "lookup"],
    queryFn: fetchAllTerceros,
  });

  const notasQuery = useQuery({
    queryKey: ["expedientes", casoId, "notas"],
    queryFn: async () => {
      const { data } = await api.get(`/expedientes/${casoId}/notas`);
      return unwrapData(data);
    },
    enabled: Boolean(casoId),
  });

  const movimientosQuery = useQuery({
    queryKey: ["expedientes", casoId, "movimientos"],
    queryFn: async () => {
      const { data } = await api.get(`/expedientes/${casoId}/movimientos`);
      return unwrapData(data);
    },
    enabled: Boolean(casoId),
  });

  const adjuntosQuery = useQuery({
    queryKey: ["adjuntos", "CASO", casoId],
    queryFn: async () => {
      const { data } = await api.get("/adjuntos", { params: { scope: "CASO", scopeId: casoId } });
      return unwrapData(data);
    },
    enabled: Boolean(casoId),
  });



  const tareasQuery = useQuery({
    queryKey: ["expedientes", casoId, "tareas"],
    queryFn: async () => {
      const { data } = await api.get(`/expedientes/${casoId}/tareas`);
      return data?.data ?? [];
    },
    enabled: Boolean(casoId),
  });

  const eventosQuery = useQuery({
    queryKey: ["expedientes", casoId, "eventos"],
    queryFn: async () => {
      const { data } = await api.get(`/expedientes/${casoId}/eventos`);
      return data?.data ?? [];
    },
    enabled: Boolean(casoId),
  });

  useEffect(() => {
    if (tab !== 6 || !casoId) return;

    let active = true;
    setHistorialLoading(true);

    getAuditoriaExpediente(casoId)
      .then((items) => {
        if (active) setHistorial(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setHistorial([]);
      })
      .finally(() => {
        if (active) setHistorialLoading(false);
      });

    return () => {
      active = false;
    };
  }, [casoId, tab]);

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup"],
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const tercerosById = useMemo(() => new Map((tercerosQuery.data ?? []).map((t) => [t.id, t])), [tercerosQuery.data]);
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [c.id, c])), [clientesQuery.data]);
  const paramsById = useMemo(() => new Map([...tipos, ...ramas, ...estados, ...radicaciones].map((p) => [p.id, p])), [tipos, ramas, estados, radicaciones]);
  const caso = casoQuery.data;
  const tipo = paramsById.get(caso?.tipoId);
  const rama = paramsById.get(tipo?.parentId);
  const estado = paramsById.get(caso?.estadoId);
  const cliente = caso ? clientesById.get(caso.clienteId) : null;
  const nombreCliente = cliente ? clienteNombre(cliente) : "Cargando...";

  const panelSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "16px",
    boxShadow: "none",
    bgcolor: "background.paper",
  };

  const hasUrgentPlazos = useMemo(() => {
    const movimientos = movimientosQuery.data ?? [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return movimientos.some((mov) => {
      const venc = plazoDe(mov);
      if (!venc) return false;
      const vDate = new Date(venc);
      vDate.setHours(0, 0, 0, 0);
      const diffTime = vDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3; // True if overdue or under 3 days
    });
  }, [movimientosQuery.data]);

  const sortedAndPaginatedMovimientos = useMemo(() => {
    const raw = movimientosQuery.data ?? [];
    const sorted = [...raw].sort((a, b) => {
      let valA = a[movOrderBy];
      let valB = b[movOrderBy];
      
      if (movOrderBy === "novedad") {
        valA = a.novedad || a.tipo || "";
        valB = b.novedad || b.tipo || "";
      }
      
      if (valA === null || valA === undefined) valA = "";
      if (valB === null || valB === undefined) valB = "";
      
      if (typeof valA === "string" && typeof valB === "string") {
        return movOrder === "asc"
          ? valA.localeCompare(valB, "es", { sensitivity: "base" })
          : valB.localeCompare(valA, "es", { sensitivity: "base" });
      }
      
      if (movOrderBy === "fecha") {
        const dateA = new Date(valA).getTime();
        const dateB = new Date(valB).getTime();
        return movOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
      
      return movOrder === "asc"
        ? (valA < valB ? -1 : valA > valB ? 1 : 0)
        : (valA > valB ? -1 : valA < valB ? 1 : 0);
    });
    return sorted;
  }, [movimientosQuery.data, movOrderBy, movOrder]);

  const paginatedMovimientos = useMemo(() => {
    const start = movPage * movRowsPerPage;
    return sortedAndPaginatedMovimientos.slice(start, start + movRowsPerPage);
  }, [sortedAndPaginatedMovimientos, movPage, movRowsPerPage]);

  const handleRequestSort = (property) => {
    const isAsc = movOrderBy === property && movOrder === "asc";
    setMovOrder(isAsc ? "desc" : "asc");
    setMovOrderBy(property);
    setMovPage(0);
  };

  const addNoteMutation = useMutation({
    mutationFn: async () => api.post(`/expedientes/${casoId}/notas`, { contenido: newNote.trim() }),
    onSuccess: () => {
      setNewNote("");
      enqueueSnackbar("Nota agregada", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId, "notas"] });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async () => addParticipanteCaso(casoId, {
      terceroId: Number(participantForm.terceroId),
      rolId: Number(participantForm.rolId),
      rolNombre: rolesById.get(Number(participantForm.rolId))?.nombre,
      observaciones: nullableString(participantForm.observaciones),
    }),
    onSuccess: () => {
      setParticipantOpen(false);
      setParticipantForm({ terceroId: "", rolId: "", observaciones: "" });
      enqueueSnackbar("Participante agregado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId, "participantes"] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participanteId) => removeParticipanteCaso(casoId, participanteId),
    onSuccess: () => {
      enqueueSnackbar("Participante removido", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId, "participantes"] });
    },
  });

  const quickCreateTerceroMutation = useMutation({
    mutationFn: createTercero,
    onSuccess: (tercero) => {
      enqueueSnackbar("Contacto registrado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["terceros", "lookup"] });
      setParticipantForm((f) => ({ ...f, terceroId: tercero.id }));
    },
  });

  const addMovementMutation = useMutation({
    mutationFn: async () => api.post(`/expedientes/${casoId}/movimientos`, {
      fecha: dateIso(movementForm.fecha),
      tipo: movementForm.tipo.trim(),
      foja: nullableString(movementForm.foja),
      vencimiento: dateIso(movementForm.vencimiento),
      descripcion: nullableString(movementForm.descripcion),
    }),
    onSuccess: () => {
      setMovementOpen(false);
      setMovementForm({ fecha: "", tipo: "", foja: "", vencimiento: "", descripcion: "" });
      enqueueSnackbar("Movimiento cargado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId, "movimientos"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get("/adjuntos/indexar", { params: { scope: "CASO", scopeId: casoId } });
      return data?.data ?? { creados: 0, eliminados: 0 };
    },
    onSuccess: (result) => {
      enqueueSnackbar(`Sincronización completa: ${result.creados} creados, ${result.eliminados} eliminados`, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["adjuntos", "CASO", casoId] });
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo sincronizar Drive", { variant: "error" }),
  });

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/drive/expedientes/${casoId}/create`);
      return data?.data ?? data;
    },
    onSuccess: () => {
      enqueueSnackbar("Carpeta de Google Drive creada con éxito", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId] });
      queryClient.invalidateQueries({ queryKey: ["adjuntos", "CASO", casoId] });
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo crear la carpeta en Drive", { variant: "error" }),
  });

  const vincularFolderMutation = useMutation({
    mutationFn: async (driveFolderId) => {
      const { data } = await api.put(`/drive/expedientes/${casoId}/vincular`, { driveFolderId });
      return data?.data ?? data;
    },
    onSuccess: () => {
      enqueueSnackbar("Carpeta de Google Drive vinculada con éxito", { variant: "success" });
      setLinkDialogOpen(false);
      setFolderIdInput("");
      setLinkError("");
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId] });
      queryClient.invalidateQueries({ queryKey: ["adjuntos", "CASO", casoId] });
    },
    onError: (error) => {
      const msg = error?.response?.data?.error?.message ?? "No se pudo vincular la carpeta";
      setLinkError(msg);
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploadProgress(0);
      try {
        const { data } = await api.post("/adjuntos/presign", {
          scope: "CASO",
          scopeId: Number(casoId),
          nombre: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
        const presigned = data?.data ?? data;
        await uploadToPresignedPost(presigned, file, setUploadProgress);
        return api.post("/adjuntos/confirm", {
          scope: "CASO",
          scopeId: Number(casoId),
          key: presigned.key,
          nombre: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
      } catch (error) {
        if (error?.response?.data?.error?.code !== "PRESIGNED_UPLOAD_NOT_SUPPORTED") throw error;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("size", String(file.size));
      return api.post("/adjuntos/upload", formData, {
        params: { scope: "CASO", scopeId: casoId },
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });
    },
    onSuccess: () => {
      enqueueSnackbar("Archivo subido", { variant: "success" });
      setUploadProgress(0);
      queryClient.invalidateQueries({ queryKey: ["adjuntos", "CASO", casoId] });
    },
    onError: (error) => {
      setUploadProgress(0);
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo subir el archivo", { variant: "error" });
    },
  });

  const deleteAdjuntoMutation = useMutation({
    mutationFn: async (adjuntoId) => api.delete(`/adjuntos/${adjuntoId}`),
    onSuccess: () => {
      enqueueSnackbar("Archivo eliminado", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["adjuntos", "CASO", casoId] });
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar el archivo", { variant: "error" }),
  });

  const deleteEventoMutation = useMutation({
    mutationFn: async (eventoId) => api.delete(`/eventos/${eventoId}`),
    onSuccess: () => {
      enqueueSnackbar("Evento eliminado", { variant: "success" });
      setDeleteEventoTarget(null);
      queryClient.invalidateQueries({ queryKey: ["expedientes", casoId, "eventos"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar el evento", { variant: "error" }),
  });



  if (casoQuery.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => {
        if (location.state?.from) navigate(location.state.from);
        else navigate("/expedientes");
      }} sx={{ mb: 2, fontWeight: 800 }}>Volver</Button>
      
      {hasUrgentPlazos && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: "12px", fontWeight: 700 }}>
          Atención: Este expediente posee plazos procesales urgentes o vencidos en su línea de tiempo.
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: "16px", border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Stack direction="column" spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>{caso?.caratula}</Typography>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 700 }}>
                  Expte. {caso?.nroExpte || "—"}
                </Typography>
                
                <Typography variant="body2" color="text.disabled">•</Typography>
                
                <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
                  Cliente:{" "}
                  <Link component={RouterLink} to={`/clientes/${caso?.clienteId}`} sx={{ fontWeight: 800, textDecoration: "none" }}>
                    {nombreCliente}
                  </Link>
                </Typography>
                
                {(rama?.nombre || tipo?.nombre) && (
                  <>
                    <Typography variant="body2" color="text.disabled">•</Typography>
                    <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 700 }}>
                      {rama?.nombre ? `${rama.nombre}${tipo?.nombre ? ` — ${tipo.nombre}` : ""}` : (tipo?.nombre ?? "")}
                    </Typography>
                  </>
                )}
                
                {estado && (
                  <>
                    <Typography variant="body2" color="text.disabled">•</Typography>
                    <Chip size="small" color={estadoColor(estado.nombre)} label={estado.nombre} sx={{ fontWeight: 800 }} role="status" aria-label={`Estado: ${estado.nombre}`} />
                  </>
                )}

                {caso?.responsableNombre && (
                  <>
                    <Typography variant="body2" color="text.disabled">•</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>
                      Responsable: <strong>{caso.responsableNombre}</strong>
                    </Typography>
                  </>
                )}
              </Stack>
            </Box>
            <Button
              variant="outlined"
              onClick={() => navigate(`/expedientes/editar/${casoId}`)}
              sx={{ borderRadius: "10px", fontWeight: 900, alignSelf: { xs: "stretch", md: "center" }, width: { xs: "100%", md: "auto" } }}
            >
              Editar Expediente
            </Button>
          </Stack>

          {caso?.descripcion && (
            <>
              <Divider />
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", mb: 0.5 }}>
                  Descripción / Notas Internas
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>
                  {caso.descripcion}
                </Typography>
              </Box>
            </>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden", mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 1, borderBottom: "1px solid", borderColor: "divider", "& .MuiTab-root": { minHeight: 56, fontWeight: 900 } }}
        >
          <Tab icon={<Gavel />} iconPosition="start" label="SISFE" />
          <Tab icon={<People />} iconPosition="start" label="Participantes" />
          <Tab icon={<Assignment />} iconPosition="start" label="Tareas" />
          <Tab icon={<CalendarMonth />} iconPosition="start" label="Eventos" />
          <Tab icon={<Description />} iconPosition="start" label="Expediente Digital" />
          <Tab icon={<NoteAdd />} iconPosition="start" label="Notas" />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="Historial" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Stack spacing={2}>
          <SisfeSyncButton casoId={casoId} variant="contained" lastSyncAt={caso?.sisfeLastSyncAt} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, borderRadius: "10px", fontWeight: 900, width: { xs: "100%", sm: "auto" } }}>
            Sincronizar SISFE
          </SisfeSyncButton>
          <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          <Stack spacing={4}>
            {/* Sección 1: Información Oficial de SISFE */}
            <Box sx={{ p: 2.5, borderRadius: "12px", bgcolor: (theme) => alpha(theme.palette.primary.main, 0.015), border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ mb: 2.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Gavel color="primary" sx={{ fontSize: 24, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "text.primary", lineHeight: 1.2 }}>
                      Información Oficial de SISFE
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Datos del expediente sincronizados oficialmente desde el Poder Judicial
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Juzgado radicación
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>
                      {caso?.sisfeRadicadoEn || "Sin radicación sincronizada"}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Localidad Radicacion
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {caso?.sisfeLocalidad || "Sin localidad"}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Fecha Ingreso en MEU
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {caso?.sisfeFechaIngresoMeu ? formatDate(caso.sisfeFechaIngresoMeu) : "Sin fecha"}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Ubicación actual
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>
                      {caso?.sisfeUbicacionActual || "Sin ubicación registrada"}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      fecha ubicación
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {caso?.sisfeFechaUbicacionActual ? formatDateTime(caso.sisfeFechaUbicacionActual) : "Sin fecha"}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      ultima actualización en tribunales
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {caso?.sisfeFechaUltimaActualizacion ? formatDateTime(caso.sisfeFechaUltimaActualizacion) : "Sin fecha"}
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            {/* Sección 2: Movimientos Judiciales */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                    Movimientos Judiciales
                  </Typography>
                </Box>
              </Stack>

              {/* Vista Desktop (Tabla) */}
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <TableSortLabel
                            active={movOrderBy === "tipo"}
                            direction={movOrderBy === "tipo" ? movOrder : "asc"}
                            onClick={() => handleRequestSort("tipo")}
                            sx={{ fontWeight: 900 }}
                          >
                            Tipo
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={movOrderBy === "fecha"}
                            direction={movOrderBy === "fecha" ? movOrder : "asc"}
                            onClick={() => handleRequestSort("fecha")}
                            sx={{ fontWeight: 900 }}
                          >
                            Fecha
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={movOrderBy === "novedad"}
                            direction={movOrderBy === "novedad" ? movOrder : "asc"}
                            onClick={() => handleRequestSort("novedad")}
                            sx={{ fontWeight: 900 }}
                          >
                            Novedad
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Descripción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedMovimientos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3, color: "text.secondary" }}>
                            No hay movimientos para este expediente.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedMovimientos.map((mov) => (
                          <TableRow key={mov.id} hover>
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip size="small" color={getTipoMovimientoColor(mov.tipo)} label={mov.tipo || "Trámite"} sx={{ fontWeight: 900 }} />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(mov.fecha)}</TableCell>
                            <TableCell sx={{ fontWeight: 900 }}>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                                <span>{mov.novedad || mov.tipo}</span>
                                {getVencimientoChip(plazoDe(mov))}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ color: "text.secondary", minWidth: 260 }}>{mov.descripcion || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Vista Mobile (Timeline) */}
              <Box sx={{ display: { xs: "block", md: "none" }, position: "relative", pl: 3 }}>
                <Box sx={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 2, bgcolor: alpha(theme.palette.primary.main, 0.25) }} />
                {paginatedMovimientos.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
                    No hay movimientos para este expediente.
                  </Typography>
                ) : (
                  paginatedMovimientos.map((mov) => (
                    <Box key={mov.id} sx={{ position: "relative", mb: 2.5 }}>
                      <Box sx={{ position: "absolute", left: -22, top: 8, width: 14, height: 14, borderRadius: "50%", bgcolor: "primary.main" }} />
                      <Paper elevation={0} sx={{ p: 2, borderRadius: "12px", border: "1px solid", borderColor: "divider" }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                          <Chip size="small" color={getTipoMovimientoColor(mov.tipo)} label={mov.tipo || "Trámite"} sx={{ fontWeight: 900 }} />
                          <Chip size="small" label={formatDate(mov.fecha)} />
                          {getVencimientoChip(plazoDe(mov))}
                        </Stack>
                        <Typography sx={{ mt: 1, fontWeight: 900 }}>{mov.novedad || mov.tipo}</Typography>
                        {mov.descripcion && (
                          <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>{mov.descripcion}</Typography>
                        )}
                      </Paper>
                    </Box>
                  ))
                )}
              </Box>

              {/* Paginador (Compartido) */}
              {sortedAndPaginatedMovimientos.length > 0 && (
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={sortedAndPaginatedMovimientos.length}
                  rowsPerPage={movRowsPerPage}
                  page={movPage}
                  onPageChange={(_, newPage) => setMovPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setMovRowsPerPage(parseInt(e.target.value, 10));
                    setMovPage(0);
                  }}
                  labelRowsPerPage=""
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                  sx={{ "& .MuiTablePagination-toolbar": { flexWrap: "wrap", justifyContent: "flex-end", gap: 0.5, px: { xs: 0, sm: 2 } } }}
                />
              )}
            </Box>

            <Divider />

            {/* Sección 3: Metadata */}
            <Box sx={{ pt: 1 }}>
              <Stack spacing={0.5}>
                {caso?.creadoPorNombre && caso?.createdAt && (
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    Registrado por <strong>{caso.creadoPorNombre}</strong> el {formatDateTime(caso.createdAt)}
                  </Typography>
                )}
                {caso?.modificadoPorNombre && caso?.updatedAt && (
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    Última modificación por <strong>{caso.modificadoPorNombre}</strong> el {formatDateTime(caso.updatedAt)}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {casosPerm.canEditar && (
          <Button startIcon={<Add />} variant="contained" onClick={() => setParticipantOpen(true)} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, borderRadius: "10px", fontWeight: 800, width: { xs: "100%", sm: "auto" } }}>
            Sumar Participante
          </Button>
          )}
          <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          {/* Sección: Participantes del Expediente */}
          <Box>
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                Participantes del Expediente
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Personas, abogados, mediadores y peritos intervinientes en el caso
              </Typography>
            </Box>

            {/* Lista Unificada de Participantes */}
            {(participantesQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
                No hay participantes registrados en este expediente.
              </Typography>
            ) : (
              <Stack spacing={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
                {(participantesQuery.data ?? []).map((p, idx, arr) => {
                  const tercero = p.tercero || tercerosById.get(p.terceroId);
                  const rol = rolesById.get(p.rolId);
                  const rolNombre = p.rolNombre || p.rol || rol?.nombre || `Rol #${p.rolId}`;
                  const rolUpper = rolNombre.toUpperCase();
                  const chipColor = rolUpper.includes("CONTRAPARTE") ? "error" : rolUpper.includes("ABOG") ? "warning" : rolUpper.includes("MEDIADOR") ? "info" : rolUpper.includes("PERITO") ? "success" : "default";
                  
                  return (
                    <Box 
                      key={p.id} 
                      sx={{ 
                        p: 2.5, 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 2, 
                        flexWrap: "wrap",
                        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
                        borderBottom: idx < arr.length - 1 ? "1px solid" : "none",
                        borderColor: "divider",
                        "&:hover": {
                          bgcolor: (theme) => alpha(theme.palette.action.hover, 0.4)
                        }
                      }}
                    >
                      <Avatar sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), color: "primary.main", fontWeight: 800 }}>
                        {terceroLabel(tercero)[0]?.toUpperCase() ?? "T"}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>
                          {terceroLabel(tercero)}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: "wrap", gap: 1 }}>
                          <Chip size="small" color={chipColor} label={rolNombre} sx={{ fontWeight: 900 }} />
                          {tercero?.email && <Chip size="small" variant="outlined" label={tercero.email} sx={{ fontWeight: 500 }} />}
                          {tercero?.telefono && <Chip size="small" variant="outlined" label={tercero.telefono} sx={{ fontWeight: 500 }} />}
                        </Stack>
                        {p.observaciones && (
                          <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 1, pl: 1, borderLeft: "2px solid", borderColor: "divider" }}>
                            {p.observaciones}
                          </Typography>
                        )}
                      </Box>
                      <IconButton color="error" onClick={() => removeParticipantMutation.mutate(p.id)} sx={{ alignSelf: { xs: "flex-end", sm: "center" }, p: { xs: 1.25, md: 0.75 } }} aria-label={`Eliminar participante ${terceroLabel(tercero)}`}>
                        <Delete />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Paper>
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={2}>
          {tareasPerm.canCrear && (
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => navigate(`/tareas/nuevo?casoId=${casoId}&clienteId=${caso?.clienteId ?? ""}`, { state: { from: location.pathname + location.search } })}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, borderRadius: "10px", fontWeight: 900, width: { xs: "100%", sm: "auto" } }}
            >
              Nueva Tarea
            </Button>
          )}
          <DataTable
            title="Tareas asociadas"
            empty="No hay tareas para este expediente."
            columns={["Tarea", "Vencimiento", "Estado"]}
            rows={(tareasQuery.data ?? []).map((tarea) => [
              tarea.titulo,
              formatDate(tarea.fechaLimite),
              <Chip key="estado" size="small" label={tarea.completada ? "Completada" : "Pendiente"} color={tarea.completada ? "success" : "warning"} sx={{ fontWeight: 800 }} role="status" aria-label={`Estado: ${tarea.completada ? "Completada" : "Pendiente"}`} />,
            ])}
          />
        </Stack>
      )}

      {tab === 3 && (
        <Stack spacing={2}>
          {eventosPerm.canCrear && (
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => navigate(`/eventos/nuevo?casoId=${casoId}&clienteId=${caso?.clienteId ?? ""}`, { state: { from: location.pathname + location.search } })}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, borderRadius: "10px", fontWeight: 900, width: { xs: "100%", sm: "auto" } }}
            >
              Nuevo Evento
            </Button>
          )}
          <DataTable
            title="Eventos"
            empty="No hay eventos asociados a este expediente."
            columns={["Evento", "Fecha", "Ubicación", "Acciones"]}
            rows={(eventosQuery.data ?? []).map((evento) => [
              evento.descripcion || "Evento agendado",
              formatDate(evento.fechaInicio),
              evento.ubicacion || "Sin ubicación",
              <Stack key="acciones" direction="row" spacing={0.5}>
                {eventosPerm.canEditar && (
                  <IconButton size="small" color="primary" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => navigate(`/eventos/editar/${evento.id}`, { state: { from: location.pathname + location.search } })} aria-label={`Editar evento ${evento.descripcion || "agendado"}`}>
                    <Edit fontSize="small" />
                  </IconButton>
                )}
                {eventosPerm.canEliminar && (
                  <IconButton size="small" color="error" sx={{ p: { xs: 1.25, md: 0.75 } }} onClick={() => setDeleteEventoTarget(evento)} aria-label={`Eliminar evento ${evento.descripcion || "agendado"}`}>
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Stack>,
            ])}
          />
        </Stack>
      )}

      {tab === 4 && (
        <Stack spacing={2}>
          {caso?.driveFolderId && (
            <>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "flex-start" } }}>
                <Button startIcon={<CloudSync />} variant="contained" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()} sx={{ borderRadius: "10px", fontWeight: 900, minWidth: 180 }}>
                  {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Drive"}
                </Button>
                {adjuntosPerm.canCrear && (
                  <Button component="label" startIcon={<UploadFile />} variant="outlined" disabled={uploadMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900, minWidth: 180 }}>
                    {uploadMutation.isPending ? "Subiendo..." : "Subir Archivo"}
                    <input hidden type="file" onChange={(event) => event.target.files?.[0] && uploadMutation.mutate(event.target.files[0])} />
                  </Button>
                )}
                <Link href={`https://drive.google.com/drive/folders/${caso.driveFolderId}`} target="_blank" rel="noreferrer" sx={{ textDecoration: "none", display: { xs: "flex", sm: "inline-flex" } }}>
                  <Button variant="text" startIcon={<Folder />} sx={{ borderRadius: "10px", fontWeight: 900, minWidth: 180, width: "100%" }}>
                    Ver Carpeta en Drive
                  </Button>
                </Link>
              </Stack>
              {(syncMutation.isPending || uploadMutation.isPending) && (
                <LinearProgress variant={uploadMutation.isPending && uploadProgress > 0 ? "determinate" : "indeterminate"} value={uploadProgress} />
              )}
            </>
          )}
          <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          {!caso?.driveFolderId ? (
            <Stack spacing={3} alignItems="center" sx={{ py: 5, textAlign: "center" }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: "warning.main", width: 64, height: 64 }}>
                <WarningAmber sx={{ fontSize: 32 }} />
              </Avatar>
              <Box sx={{ maxWidth: 480 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                  Carpeta de Google Drive no configurada
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500, lineHeight: 1.6 }}>
                  Este expediente no cuenta con un espacio asignado en Google Drive. Podés crear una carpeta vacía automáticamente o asociar una carpeta existente ingresando su identificador (ID).
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%", maxWidth: 420 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<CloudSync />}
                  disabled={createFolderMutation.isPending}
                  onClick={() => createFolderMutation.mutate()}
                  sx={{ borderRadius: "10px", fontWeight: 800 }}
                >
                  {createFolderMutation.isPending ? "Creando carpeta..." : "Crear Carpeta Automática"}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    setLinkError("");
                    setFolderIdInput("");
                    setLinkDialogOpen(true);
                  }}
                  sx={{ borderRadius: "10px", fontWeight: 800 }}
                >
                  Vincular Existente
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              {/* Vista Desktop (Tabla limpia) */}
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 900 }}>Nombre de archivo</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Fecha de creación</TableCell>
                        <TableCell sx={{ fontWeight: 900, textAlign: "right" }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(adjuntosQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>
                            No hay archivos cargados en este expediente.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (adjuntosQuery.data ?? []).map((file) => (
                          <TableRow key={file.id} hover>
                            <TableCell sx={{ py: 1.5 }}>
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <AttachFile color="action" fontSize="small" />
                                <Typography sx={{ fontWeight: 800 }}>{file.nombre}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              {file.creadoEn ? formatDateTime(file.creadoEn) : "—"}
                            </TableCell>
                            <TableCell align="right" sx={{ py: 1 }}>
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <IconButton
                                  color="primary"
                                  href={`https://drive.google.com/file/d/${file.driveFileId}/view`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Abrir en Google Drive"
                                  aria-label={`Visualizar archivo ${file.nombre}`}
                                >
                                  <Visibility />
                                </IconButton>
                                {adjuntosPerm.canEliminar && (
                                  <IconButton
                                    color="error"
                                    disabled={deleteAdjuntoMutation.isPending}
                                    onClick={() => {
                                      if (window.confirm(`¿Estás seguro de que deseas eliminar el archivo "${file.nombre}"?`)) {
                                        deleteAdjuntoMutation.mutate(file.id);
                                      }
                                    }}
                                    title="Eliminar archivo"
                                    aria-label={`Eliminar archivo ${file.nombre}`}
                                  >
                                    <Delete />
                                  </IconButton>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Vista Mobile (Tarjetas Simplificadas) */}
              <Box sx={{ display: { xs: "block", md: "none" } }}>
                {(adjuntosQuery.data ?? []).length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>
                    No hay archivos cargados en este expediente.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {(adjuntosQuery.data ?? []).map((file) => (
                      <Paper
                        key={file.id}
                        elevation={0}
                        sx={{
                          p: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "12px",
                          bgcolor: alpha(theme.palette.background.paper, 0.5),
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ overflow: "hidden", mr: 1 }}>
                            <AttachFile color="action" fontSize="small" />
                            <Typography sx={{ fontWeight: 800 }} noWrap>
                              {file.nombre}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              color="primary"
                              sx={{ p: { xs: 1.25, md: 0.75 } }}
                              href={`https://drive.google.com/file/d/${file.driveFileId}/view`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Visualizar archivo ${file.nombre}`}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                            {adjuntosPerm.canEliminar && (
                              <IconButton
                                size="small"
                                color="error"
                                sx={{ p: { xs: 1.25, md: 0.75 } }}
                                disabled={deleteAdjuntoMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`¿Estás seguro de que deseas eliminar el archivo "${file.nombre}"?`)) {
                                    deleteAdjuntoMutation.mutate(file.id);
                                  }
                                }}
                                aria-label={`Eliminar archivo ${file.nombre}`}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}
        </Paper>
        </Stack>
      )}

      {tab === 5 && (
        <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <TextField multiline minRows={3} fullWidth label="Nueva nota" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            {notasPerm.canCrear && (
              <Button variant="contained" disabled={!newNote.trim() || addNoteMutation.isPending} onClick={() => addNoteMutation.mutate()} sx={{ alignSelf: { xs: "stretch", sm: "flex-end" }, width: { xs: "100%", sm: "auto" } }}>Agregar Nota</Button>
            )}
            {(notasQuery.data ?? []).map((nota) => (
              <Paper key={nota.id} elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: "12px" }}>
                <Typography variant="caption" color="text.secondary">{formatDate(nota.createdAt)}</Typography>
                <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{nota.contenido}</Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}



      {tab === 6 && (
        <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          {historialLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : historial.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Aún no hay actividad registrada para este expediente
            </Typography>
          ) : (
            <Box sx={{ position: "relative", pl: 3 }}>
              <Box sx={{ position: "absolute", left: 7, top: 0, bottom: 0, width: 2, bgcolor: alpha(theme.palette.primary.main, 0.25) }} />
              {historial.map((log) => {
                const before = log.cambios?.before ?? {};
                const after = log.cambios?.after ?? {};
                const diffKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

                return (
                  <Box key={log.id} sx={{ position: "relative", mb: 2.5 }}>
                    <Box sx={{ position: "absolute", left: -22, top: 8, width: 14, height: 14, borderRadius: "50%", bgcolor: "primary.main", border: "2px solid", borderColor: "background.paper" }} />
                    <Paper elevation={0} sx={{ p: 2, borderRadius: "12px", border: "1px solid", borderColor: "divider" }}>
                      <Stack spacing={1.25}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} sx={{ flexWrap: "wrap" }}>
                          <Typography variant="body2" sx={{ fontWeight: 900 }}>
                            {formatDateTime(log.createdAt)} — {log.usuarioNombre || "Sistema"}
                          </Typography>
                          <Chip
                            size="small"
                            color={auditoriaActionColor(log.accion)}
                            variant={log.accion === "COMPLETADA" ? "outlined" : "filled"}
                            label={auditoriaActionLabel(log.accion)}
                            sx={{ fontWeight: 900 }}
                            role="status"
                            aria-label={`Estado: ${auditoriaActionLabel(log.accion)}`}
                          />
                        </Stack>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {log.descripcion || "Cambio registrado"}
                        </Typography>
                        {diffKeys.length > 0 && (
                          <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "10px", overflow: "hidden" }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 900 }}>Campo</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Antes</TableCell>
                                  <TableCell sx={{ fontWeight: 900 }}>Después</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {diffKeys.map((key) => (
                                  <TableRow key={key}>
                                    <TableCell sx={{ fontWeight: 800 }}>{formatAuditField(key)}</TableCell>
                                    <TableCell sx={{ wordBreak: "break-word" }}>{formatAuditValue(before[key], key, paramsById)}</TableCell>
                                    <TableCell sx={{ wordBreak: "break-word" }}>{formatAuditValue(after[key], key, paramsById)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      )}

      <ParticipantDialog
        open={participantOpen}
        onClose={() => setParticipantOpen(false)}
        terceros={tercerosQuery.data ?? []}
        roles={roles}
        form={participantForm}
        setForm={setParticipantForm}
        loading={addParticipantMutation.isPending}
        onSubmit={() => addParticipantMutation.mutate()}
        onQuickCreate={(data) => quickCreateTerceroMutation.mutate(data)}
        quickCreating={quickCreateTerceroMutation.isPending}
      />
      <MovementDialog
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        form={movementForm}
        setForm={setMovementForm}
        loading={addMovementMutation.isPending}
        onSubmit={() => addMovementMutation.mutate()}
      />
      <Dialog
        open={Boolean(deleteEventoTarget)}
        onClose={() => !deleteEventoMutation.isPending && setDeleteEventoTarget(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.12), color: "error.main" }}>
              <WarningAmber />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar evento</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Esta acción no se puede deshacer.</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Seguro que querés eliminar <Box component="span" sx={{ fontWeight: 900 }}>{deleteEventoTarget?.descripcion || "este evento"}</Box>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteEventoTarget(null)} disabled={deleteEventoMutation.isPending}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteEventoMutation.isPending}
            onClick={() => deleteEventoMutation.mutate(deleteEventoTarget.id)}
          >
            {deleteEventoMutation.isPending ? <CircularProgress size={18} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={linkDialogOpen}
        onClose={() => !vincularFolderMutation.isPending && setLinkDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Vincular Carpeta de Drive</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Ingresá el identificador (ID) de la carpeta de Google Drive que querés asociar a este expediente:
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="ID Carpeta de Drive"
              placeholder="Ej: 1A2b3C-4D5e6F..."
              value={folderIdInput}
              onChange={(e) => {
                setFolderIdInput(e.target.value);
                setLinkError("");
              }}
              error={Boolean(linkError)}
              helperText={linkError}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLinkDialogOpen(false)} disabled={vincularFolderMutation.isPending} sx={{ fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={!folderIdInput.trim() || vincularFolderMutation.isPending}
            onClick={() => vincularFolderMutation.mutate(folderIdInput.trim())}
            sx={{ borderRadius: "10px", fontWeight: 800 }}
          >
            {vincularFolderMutation.isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InfoCard({ label, value, wide = false }) {
  return (
    <Grid size={{ xs: 12, md: wide ? 12 : 4 }}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: "12px", height: "100%" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, mt: 0.5 }}>{value}</Typography>
      </Paper>
    </Grid>
  );
}



function ParticipantDialog({ open, onClose, terceros, roles, form, setForm, loading, onSubmit, onQuickCreate, quickCreating }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ tipoPersonaId: 1, nombre: "", apellido: "", razonSocial: "", email: "", telefono: "", observaciones: "" });
  const selected = terceros.find((t) => Number(t.id) === Number(form.terceroId)) ?? null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Sumar Participante</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete options={terceros} value={selected} getOptionLabel={terceroLabel} onChange={(_, value) => setForm((c) => ({ ...c, terceroId: value?.id ?? "" }))} renderInput={(params) => <TextField {...params} label="Tercero" />} />
          <Button size="small" startIcon={<Add />} onClick={() => setQuickOpen((v) => !v)} sx={{ alignSelf: "flex-start", fontWeight: 900 }}>
            Registrar Nuevo Contacto
          </Button>
          {quickOpen && (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: "12px" }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}><TextField size="small" fullWidth label="Nombre" value={quickForm.nombre} onChange={(e) => setQuickForm((f) => ({ ...f, nombre: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField size="small" fullWidth label="Apellido" value={quickForm.apellido} onChange={(e) => setQuickForm((f) => ({ ...f, apellido: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12 }}><TextField size="small" fullWidth label="Razón Social" value={quickForm.razonSocial} onChange={(e) => setQuickForm((f) => ({ ...f, razonSocial: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField size="small" fullWidth label="Email" value={quickForm.email} onChange={(e) => setQuickForm((f) => ({ ...f, email: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField size="small" fullWidth label="Teléfono" value={quickForm.telefono} onChange={(e) => setQuickForm((f) => ({ ...f, telefono: e.target.value }))} /></Grid>
              </Grid>
              <Button sx={{ mt: 1.5, fontWeight: 900 }} variant="outlined" size="small" disabled={quickCreating || (!quickForm.razonSocial && !quickForm.nombre)} onClick={() => onQuickCreate({ ...quickForm, tipoPersonaId: quickForm.razonSocial ? 2 : 1 })}>
                {quickCreating ? "Guardando..." : "Crear y seleccionar"}
              </Button>
            </Paper>
          )}
          <FormControl fullWidth>
            <InputLabel>Rol</InputLabel>
            <Select label="Rol" value={form.rolId} onChange={(e) => setForm((c) => ({ ...c, rolId: e.target.value }))}>
              {roles.map((rol) => <MenuItem key={rol.id} value={rol.id}>{rol.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField multiline minRows={3} label="Observaciones" value={form.observaciones} onChange={(e) => setForm((c) => ({ ...c, observaciones: e.target.value }))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!form.terceroId || !form.rolId || loading} onClick={onSubmit}>{loading ? <CircularProgress size={18} /> : "Agregar"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function MovementDialog({ open, onClose, form, setForm, loading, onSubmit }) {
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cargar Movimiento Judicial</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="date" label="Fecha" value={form.fecha} onChange={set("fecha")} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Tipo" value={form.tipo} onChange={set("tipo")} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Foja" value={form.foja} onChange={set("foja")} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="date" label="Vencimiento" value={form.vencimiento} onChange={set("vencimiento")} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={3} label="Descripción" value={form.descripcion} onChange={set("descripcion")} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!form.fecha || !form.tipo.trim() || loading} onClick={onSubmit}>{loading ? <CircularProgress size={18} /> : "Guardar"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function DataTable({ title, empty, columns, rows }) {
  return (
    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
      <Box sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>{title}</Typography>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", px: 2.5, pb: 2.5 }}>{empty}</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 900 }}>{column}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${index}-${cellIndex}`}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
