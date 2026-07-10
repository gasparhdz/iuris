import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../api/axios";
import { usePermisos } from "../auth/usePermissions";
import { finanzasNuevoUrl, formatMoneyAr, isHonorarioPendiente, computeHonorarioAmounts, mapCuentaCorrienteApiRows } from "./finanzasUtils";
import PlanesPagoTable from "../components/finanzas/PlanesPagoTable";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  AccountBalanceWallet,
  Add,
  ArrowBack,
  Assignment,
  CalendarMonth,
  Contacts,
  Delete,
  Edit,
  ExpandLess,
  ExpandMore,
  FolderOpen,
  Gavel,
  NoteAdd,
  Paid,
  Payments,
  Print,
  ReceiptLong,
  Save,
  Timeline,
  WarningAmber,
  Work,
} from "@mui/icons-material";

const TIPO_PERSONA_FISICA_ID = 143;
const TAB_ITEMS = [
  { value: "expedientes", label: "Expedientes", icon: <FolderOpen fontSize="small" /> },
  { value: "tareas", label: "Tareas", icon: <Assignment fontSize="small" /> },
  { value: "eventos", label: "Eventos", icon: <CalendarMonth fontSize="small" /> },
  { value: "contactos", label: "Contactos", icon: <Contacts fontSize="small" /> },
  { value: "finanzas", label: "Finanzas", icon: <Paid fontSize="small" /> },
  { value: "notas", label: "Notas", icon: <NoteAdd fontSize="small" /> },
  { value: "timeline", label: "Timeline", icon: <Timeline fontSize="small" /> },
];

function unwrapDetalle(data) {
  return data?.data ?? data ?? {};
}

function isFisica(cliente) {
  return Number(cliente?.tipoPersonaId) === TIPO_PERSONA_FISICA_ID;
}

function nombreCliente(cliente) {
  if (!cliente) return "Cliente";
  if (!isFisica(cliente)) return cliente.razonSocial || "Persona jurídica";
  return [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") || [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") || "Persona física";
}

function initials(text = "") {
  return text
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "CL";
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(value) {
  return formatMoneyAr(value);
}

function toIsoDateTime(value) {
  return new Date(value).getTime() || 0;
}

function honorarioDetalleChip(item) {
  const codigo = (item?.estado?.codigo ?? "").toUpperCase();
  const vencimiento = item?.fechaVencimiento ? new Date(item.fechaVencimiento) : null;
  const vencido = vencimiento && !Number.isNaN(vencimiento.getTime()) && vencimiento < new Date();

  if (vencido && isHonorarioPendiente(item)) return { label: "Mora", color: "error" };
  if (codigo === "COBRADO" || codigo === "PAGADO" || codigo === "CONFIRMADO") return { label: "Cobrado", color: "success" };
  if (!isHonorarioPendiente(item)) return { label: item?.estado?.nombre || "Cobrado", color: "success" };
  return { label: "Pendiente", color: "warning" };
}

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const tareasPerm = usePermisos("TAREAS");
  const eventosPerm = usePermisos("EVENTOS");
  const notasPerm = usePermisos("NOTAS");
  const honorariosPerm = usePermisos("HONORARIOS");
  const gastosPerm = usePermisos("GASTOS");
  const ingresosPerm = usePermisos("INGRESOS");
  const { canEditar: canEditarCliente } = usePermisos("CLIENTES");
  const canCrearFinanzas = honorariosPerm.canCrear || gastosPerm.canCrear || ingresosPerm.canCrear;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam && TAB_ITEMS.some((t) => t.value === tabParam) ? tabParam : "expedientes";

  const setTab = (newTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", newTab);
      return next;
    }, { replace: true });
  };

  const [contactosOpen, setContactosOpen] = useState(true);
  const [nota, setNota] = useState("");
  const [deleteEventoTarget, setDeleteEventoTarget] = useState(null);
  const [finanzasSubTab, setFinanzasSubTab] = useState("cc");

  const detalleQuery = useQuery({
    queryKey: ["clientes", id, "detalle"],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${id}/detalle`);
      return unwrapDetalle(data);
    },
    enabled: Boolean(id),
  });

  const valorJusQuery = useQuery({
    queryKey: ["valorjus", "actual"],
    queryFn: async () => {
      const { data } = await api.get("/valorjus/actual");
      return data?.data ?? data;
    },
    staleTime: 60_000,
  });

  const catalogQuery = useQuery({
    queryKey: ["catalogos", "cliente-detalle-finanzas-global"],
    queryFn: async () => {
      const cats = ["MONEDA", "POLITICA_JUS", "ESTADO_GASTO", "CONCEPTO_GASTO"];
      const entries = await Promise.all(
        cats.map(async (categoria) => {
          const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
          const raw = data?.data ?? data;
          return [categoria, Array.isArray(raw) ? raw : []];
        })
      );
      return Object.fromEntries(entries);
    },
    staleTime: 300_000,
  });

  const planesQuery = useQuery({
    queryKey: ["planes", "cliente", id],
    queryFn: () => api.get(`/planes?clienteId=${id}`).then((r) => r.data?.data ?? []),
    enabled: Boolean(id),
  });

  const detalle = detalleQuery.data ?? {};
  const cliente = detalle.cliente ?? null;
  const contactos = cliente?.contactos ?? [];
  const casos = useMemo(() => detalle.casos ?? [], [detalle.casos]);
  const tareas = useMemo(() => detalle.tareas ?? [], [detalle.tareas]);
  const eventos = useMemo(() => detalle.eventos ?? [], [detalle.eventos]);
  const honorarios = detalle.honorarios ?? [];
  const gastos = detalle.gastos ?? [];
  const ingresos = detalle.ingresos ?? [];
  const notas = detalle.notas ?? [];

  const nombre = nombreCliente(cliente);

  const valorJusActual = Number(valorJusQuery.data?.valor ?? 0);
  const catalogMonedas = catalogQuery.data?.MONEDA ?? [];
  const catalogPoliticas = catalogQuery.data?.POLITICA_JUS ?? [];
  const conceptosGastoById = useMemo(
    () => new Map((catalogQuery.data?.CONCEPTO_GASTO ?? []).map((item) => [Number(item.id), item])),
    [catalogQuery.data?.CONCEPTO_GASTO],
  );
  const estadosGastoById = useMemo(
    () => new Map((catalogQuery.data?.ESTADO_GASTO ?? []).map((item) => [Number(item.id), item])),
    [catalogQuery.data?.ESTADO_GASTO],
  );

  // La cuenta corriente se calcula en el backend (motor Decimal); acá solo se renderiza.
  const cuentaCorrienteQuery = useQuery({
    queryKey: ["clientes", id, "cuenta-corriente"],
    queryFn: async () => {
      const { data } = await api.get(`/clientes/${id}/cuenta-corriente`);
      return data?.data ?? data;
    },
    enabled: Boolean(id),
  });
  const ccTotales = cuentaCorrienteQuery.data?.totales ?? null;

  const totalHonorarios = Number(ccTotales?.honorariosPesos ?? 0);
  const totalGastos = Number(ccTotales?.gastosPesos ?? 0);
  const totalIngresos = Number(ccTotales?.ingresosPesos ?? 0);

  const planesByHonorario = useMemo(() => {
    const map = new Map();
    (planesQuery.data ?? []).forEach((plan) => {
      const honorarioId = Number(plan.honorarioId);
      if (!honorarioId) return;
      const current = map.get(honorarioId) ?? { saldo: 0, cobrado: 0 };
      current.saldo += Number(plan.totalSaldoArs ?? 0);
      current.cobrado += Number(plan.totalCobradoArs ?? 0);
      map.set(honorarioId, current);
    });
    return map;
  }, [planesQuery.data]);

  const getHonorarioSaldoPendiente = useCallback((item, computed) => {
    const backendSaldo = item?.calc?.saldoPesos ?? computed?.saldoPesos;
    if (backendSaldo != null && Number.isFinite(Number(backendSaldo))) {
      return {
        value: Math.max(0, Number(backendSaldo)),
        currency: "ARS",
      };
    }
    const planSaldo = planesByHonorario.get(Number(item.id));
    if (planSaldo) {
      return {
        value: Math.max(0, planSaldo.saldo),
        currency: "ARS",
      };
    }
    const bruto = isHonorarioPendiente(item) ? Math.max(0, Number(computed?.updatedVal ?? 0)) : 0;
    const cobrado = Number(item.montoCobrado ?? 0);
    return {
      value: Math.max(0, bruto - cobrado),
      currency: computed?.currency ?? "ARS",
    };
  }, [planesByHonorario]);

  const cuentaCorrienteRows = useMemo(
    () => mapCuentaCorrienteApiRows(cuentaCorrienteQuery.data?.rows ?? []),
    [cuentaCorrienteQuery.data?.rows],
  );

  const saldo = Number(ccTotales?.saldoPesos ?? 0);

  const timeline = useMemo(() => {
    const items = [
      ...casos.map((caso) => ({
        id: `caso-${caso.id}`,
        tipo: "Expediente",
        titulo: caso.caratula || "Expediente sin carátula",
        fecha: caso.createdAt,
        detalle: caso.nroExpte ? `Expte. ${caso.nroExpte}` : "Alta de expediente",
      })),
      ...tareas.map((tarea) => ({
        id: `tarea-${tarea.id}`,
        tipo: "Tarea",
        titulo: tarea.titulo,
        fecha: tarea.fechaLimite || tarea.createdAt,
        detalle: tarea.completada ? "Completada" : "Pendiente",
      })),
      ...eventos.map((evento) => ({
        id: `evento-${evento.id}`,
        tipo: "Evento",
        titulo: evento.descripcion || evento.ubicacion || "Evento agendado",
        fecha: evento.fechaInicio,
        detalle: evento.ubicacion || "Agenda",
      })),
    ];
    return items.sort((a, b) => toIsoDateTime(b.fecha) - toIsoDateTime(a.fecha));
  }, [casos, eventos, tareas]);

  const createNotaMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/clientes/${id}/notas`, { contenido: nota.trim() });
      return data?.data ?? data;
    },
    onSuccess: () => {
      setNota("");
      enqueueSnackbar("Nota guardada", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["clientes", id, "detalle"] });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo guardar la nota", { variant: "error" });
    },
  });

  const deleteEventoMutation = useMutation({
    mutationFn: async (eventoId) => api.delete(`/eventos/${eventoId}`),
    onSuccess: () => {
      enqueueSnackbar("Evento eliminado", { variant: "success" });
      setDeleteEventoTarget(null);
      queryClient.invalidateQueries({ queryKey: ["clientes", id, "detalle"] });
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar el evento", { variant: "error" });
    },
  });

  const panelSx = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "16px",
    boxShadow: "none",
    bgcolor: "background.paper",
  };

  if (detalleQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (detalleQuery.isError || !cliente) {
    return (
      <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>No pudimos cargar el cliente</Typography>
        <Button onClick={() => {
          if (location.state?.from) navigate(location.state.from);
          else navigate("/clientes");
        }} sx={{ mt: 2 }}>Volver</Button>
      </Paper>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => {
        if (location.state?.from) navigate(location.state.from);
        else navigate("/clientes");
      }} sx={{ mb: 2, fontWeight: 800 }}>
        Volver
      </Button>

      <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 }, mb: 2.5, overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ xs: "center", sm: "center" }} justifyContent="space-between" textAlign={{ xs: "center", sm: "left" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", fontWeight: 900 }}>
              {initials(nombre)}
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.5, fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>
                {nombre}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: "center", sm: "flex-start" }} sx={{ mt: 1.5 }}>
                <Chip size="small" label={isFisica(cliente) ? "Persona Física" : "Persona Jurídica"} color="primary" sx={{ fontWeight: 800 }} />
                <Chip size="small" label={cliente.localidadId ? `Localidad #${cliente.localidadId}` : "Sin localidad"} variant="outlined" sx={{ fontWeight: 800 }} />
                <Chip size="small" label={cliente.activo ? "Activo" : "Inactivo"} color={cliente.activo ? "success" : "default"} sx={{ fontWeight: 800 }} />
              </Stack>
            </Box>
          </Stack>
          {canEditarCliente && (
            <Button variant="outlined" onClick={() => navigate(`/clientes/editar/${id}`)} sx={{ borderRadius: "10px", fontWeight: 900, width: { xs: "100%", sm: "auto" }, py: { xs: 1, sm: 0.5 } }}>
              Editar Cliente
            </Button>
          )}
        </Stack>

        <Divider sx={{ my: 2.5 }} />
        <Stack direction="row" alignItems="center" justifyContent="space-between" onClick={() => setContactosOpen((current) => !current)} sx={{ cursor: "pointer" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            Entrevista inicial
          </Typography>
          <IconButton>
            {contactosOpen ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
        <Collapse in={contactosOpen}>
          {cliente.observaciones ? (
            <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
              {cliente.observaciones}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
              No hay información de entrevista inicial cargada.
            </Typography>
          )}
        </Collapse>
      </Paper>

      <Paper elevation={0} sx={{ ...panelSx, mb: 2, overflow: "hidden" }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            "& .MuiTab-root": {
              minHeight: 56,
              fontWeight: 900,
              px: { xs: 1.5, sm: 3 },
              fontSize: { xs: "0.8rem", sm: "0.875rem" },
            },
          }}
        >
          {TAB_ITEMS.map((item) => (
            <Tab key={item.value} value={item.value} icon={item.icon} iconPosition="start" label={item.label} />
          ))}
        </Tabs>
      </Paper>

      {tab === "expedientes" && (
        <DataTable
          title="Expedientes"
          empty="No hay expedientes vinculados."
          columns={["Carátula", "Expediente", "Estado", "Acción"]}
          rows={casos.map((caso) => [
            caso.caratula || "Sin carátula",
            caso.nroExpte || "Sin expediente",
            <Chip key="estado" size="small" label={caso.activo ? "Activo" : "Inactivo"} color={caso.activo ? "primary" : "default"} />,
            <Button key="ver" size="small" onClick={() => navigate(`/expedientes/${caso.id}`)}>Ver expediente</Button>,
          ])}
        />
      )}

      {tab === "tareas" && (
        <Stack spacing={2}>
          {tareasPerm.canCrear && (
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => navigate(`/tareas/nuevo?clienteId=${id}`, { state: { from: location.pathname + location.search } })}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, borderRadius: "10px", fontWeight: 900, width: { xs: "100%", sm: "auto" } }}
            >
              Nueva Tarea
            </Button>
          )}
          <DataTable
            title="Tareas asociadas"
            empty="No hay tareas para este cliente."
            columns={["Tarea", "Vencimiento", "Estado"]}
            rows={tareas.map((tarea) => [
              tarea.titulo,
              formatDate(tarea.fechaLimite),
              <Chip key="estado" size="small" label={tarea.completada ? "Completada" : "Pendiente"} color={tarea.completada ? "success" : "warning"} sx={{ fontWeight: 800 }} />,
            ])}
          />
        </Stack>
      )}

      {tab === "eventos" && (
        <Stack spacing={2}>
          {eventosPerm.canCrear && (
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => navigate(`/eventos/nuevo?clienteId=${id}`, { state: { from: location.pathname + location.search } })}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, borderRadius: "10px", fontWeight: 900, width: { xs: "100%", sm: "auto" } }}
            >
              Nuevo Evento
            </Button>
          )}
        <DataTable
          title="Eventos"
          empty="No hay eventos asociados a este cliente."
          columns={["Evento", "Fecha", "Ubicación", "Acciones"]}
          rows={eventos.map((evento) => [
            evento.descripcion || "Evento agendado",
            formatDate(evento.fechaInicio),
            evento.ubicacion || "Sin ubicación",
            <Stack key="acciones" direction="row" spacing={0.5}>
              {eventosPerm.canEditar && (
                <IconButton size="small" color="primary" onClick={() => navigate(`/eventos/editar/${evento.id}`, { state: { from: location.pathname + location.search } })}>
                  <Edit fontSize="small" />
                </IconButton>
              )}
              {eventosPerm.canEliminar && (
                <IconButton size="small" color="error" onClick={() => setDeleteEventoTarget(evento)}>
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Stack>,
          ])}
        />
        </Stack>
      )}

      {tab === "contactos" && (
        <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>Contactos secundarios</Typography>
            {canEditarCliente && (
              <Button variant="outlined" size="small" onClick={() => navigate(`/clientes/editar/${id}`)} sx={{ borderRadius: "10px", fontWeight: 900 }}>
                Editar contactos
              </Button>
            )}
          </Stack>
          {contactos.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No hay contactos secundarios cargados.
            </Typography>
          ) : (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
              {contactos.map((contacto) => (
                <Card key={contacto.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "14px", minWidth: { xs: "100%", md: 260 } }}>
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{contacto.nombre}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{contacto.rol || "Contacto"}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>{contacto.email || "Sin email"}</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>{contacto.telefono || "Sin teléfono"}</Typography>
                    {contacto.observaciones && (
                      <Typography variant="body2" sx={{ mt: 1, color: "text.secondary", whiteSpace: "pre-wrap" }}>{contacto.observaciones}</Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {tab === "finanzas" && (
        <Stack spacing={3}>
          {canCrearFinanzas && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate(finanzasNuevoUrl({ clienteId: id }), { state: { from: `/clientes/${id}?tab=finanzas` } })}
              sx={{ fontWeight: 900, borderRadius: "10px", alignSelf: { xs: "stretch", sm: "flex-start" }, width: { xs: "100%", sm: "auto" } }}
            >
              Registrar movimiento
            </Button>
          )}
          <Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Honorarios</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoney(totalHonorarios)}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" }}><Payments /></Avatar>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Gastos</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoney(totalGastos)}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: "warning.main" }}><ReceiptLong /></Avatar>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Ingresos</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoney(totalIngresos)}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: "success.main" }}><AccountBalanceWallet /></Avatar>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Saldo Pendiente</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoney(saldo)}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(saldo > 0 ? theme.palette.error.main : theme.palette.success.main, 0.1), color: saldo > 0 ? "error.main" : "success.main" }}><Work /></Avatar>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
            <Tabs
              value={finanzasSubTab}
              onChange={(_, val) => setFinanzasSubTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.5),
                borderBottom: "1px solid",
                borderColor: "divider",
                "& .MuiTab-root": {
                  minHeight: 48,
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  textTransform: "none",
                }
              }}
            >
              <Tab value="cc" label="Cuenta Corriente" />
              <Tab value="honorarios" label="Honorarios" />
              <Tab value="gastos" label="Gastos" />
              <Tab value="ingresos" label="Ingresos" />
              <Tab value="planes" label="Planes de Pago" />
            </Tabs>
            
            <Box sx={{ p: 2.5 }}>
              {finanzasSubTab === "cc" && (
                <CuentaCorrienteLedger
                  subtitle={nombre}
                  rows={cuentaCorrienteRows}
                  formatDate={formatDate}
                  formatMoney={formatMoney}
                  onPrint={() => window.print()}
                />
              )}
              
              {finanzasSubTab === "honorarios" && (
                <DataTable
                  title="Honorarios"
                  empty="No hay honorarios registrados."
                  columns={["Concepto", "Fecha", "Monto", "Saldo", "Estado", "Acciones"]}
                  rows={honorarios.map((item) => {
                    const computed = computeHonorarioAmounts(
                      item,
                      valorJusActual,
                      catalogMonedas,
                      catalogPoliticas
                    );
                    const chip = honorarioDetalleChip(item);
                    const saldoPendiente = getHonorarioSaldoPendiente(item, computed);
                    const puedeCobrar = chip.label === "Pendiente" || chip.label === "Mora";
                    return [
                      item.descripcion || item.concepto?.nombre || `Honorario #${item.id}`,
                      formatDate(item.fechaRegulacion),
                      formatMoney(computed.originalVal),
                      formatMoney(saldoPendiente.value),
                      <Chip key="estado" size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 800 }} />,
                      <Stack key="acciones" direction="row" spacing={0.5}>
                        {puedeCobrar && ingresosPerm.canCrear && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => navigate(
                              finanzasNuevoUrl({
                                tipo: "ingreso",
                                clienteId: item.clienteId,
                                casoId: item.casoId || "",
                                honorarioId: item.id,
                                monto: saldoPendiente.value,
                              }),
                              { state: { from: `/clientes/${id}?tab=finanzas` } }
                            )}
                            sx={{ borderRadius: "8px", fontWeight: 900 }}
                          >
                            Cobrar
                          </Button>
                        )}
                      </Stack>
                    ];
                  })}
                />
              )}
              
              {finanzasSubTab === "gastos" && (
                <DataTable
                  title="Gastos"
                  empty="No hay gastos registrados."
                  columns={["Concepto", "Fecha", "Monto", "Estado", "Acción"]}
                  rows={gastos.map((gasto) => {
                    const concepto = conceptosGastoById.get(Number(gasto.conceptoId));
                    const estado = estadosGastoById.get(Number(gasto.estadoId));
                    const estadoCodigo = String(estado?.codigo ?? "").toUpperCase();
                    return [
                      gasto.descripcion || concepto?.nombre || `Gasto #${gasto.id}`,
                      formatDate(gasto.fechaGasto),
                      formatMoney(gasto.monto),
                      <Chip key="estado" size="small" label={estado?.nombre || "Pendiente"} color={estadoCodigo === "PAGADO" ? "success" : estadoCodigo === "PENDIENTE" ? "warning" : "default"} sx={{ fontWeight: 800 }} />,
                      ingresosPerm.canCrear ? (
                        <Button
                          key="reintegrar"
                          size="small"
                          color="success"
                          variant="outlined"
                          startIcon={<ReceiptLong fontSize="small" />}
                          disabled={["PAGADO", "ANULADO"].includes(estadoCodigo)}
                          onClick={() => navigate(
                            finanzasNuevoUrl({
                              tipo: "ingreso",
                              gastoId: gasto.id,
                              clienteId: gasto.clienteId,
                              casoId: gasto.casoId || "",
                              monto: gasto.monto,
                            }),
                            { state: { from: `/clientes/${id}?tab=finanzas` } },
                          )}
                          sx={{ borderRadius: "8px", fontWeight: 900 }}
                        >
                          Reintegrar
                        </Button>
                      ) : null,
                    ];
                  })}
                />
              )}
              
              {finanzasSubTab === "ingresos" && (
                <DataTable
                  title="Ingresos"
                  empty="No hay ingresos registrados."
                  columns={["Concepto", "Fecha de Pago", "Monto"]}
                  rows={ingresos.map((ingreso) => {
                    return [
                      ingreso.descripcion || `Ingreso #${ingreso.id}`,
                      formatDate(ingreso.fechaIngreso),
                      formatMoney(ingreso.monto),
                    ];
                  })}
                />
              )}
              
              {finanzasSubTab === "planes" && (
                <PlanesPagoTable
                  planes={planesQuery.data ?? []}
                  loading={planesQuery.isLoading}
                  error={planesQuery.error}
                  empty="Este cliente no tiene planes de pago"
                  invalidateKeys={[["clientes", Number(id), "detalle"]]}
                />
              )}
            </Box>
          </Paper>
        </Stack>
      )}

      {tab === "notas" && (
        <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <TextField
              multiline
              minRows={3}
              fullWidth
              label="Nueva nota"
              value={nota}
              onChange={(event) => setNota(event.target.value)}
            />
            {notasPerm.canCrear && (
              <Button
                variant="contained"
                disabled={!nota.trim() || createNotaMutation.isPending}
                onClick={() => createNotaMutation.mutate()}
                sx={{ alignSelf: { xs: "stretch", sm: "flex-end" }, width: { xs: "100%", sm: "auto" } }}
              >
                Agregar Nota
              </Button>
            )}
            {notas.map((item) => (
              <Paper key={item.id} elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: "12px" }}>
                <Typography variant="caption" color="text.secondary">{formatDate(item.createdAt)}</Typography>
                <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{item.contenido}</Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {tab === "timeline" && (
        <Paper elevation={0} sx={{ ...panelSx, p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>Timeline consolidado</Typography>
          <Stack spacing={1.5}>
            {timeline.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No hay actividad registrada.</Typography>
            ) : timeline.map((item) => (
              <Stack key={item.id} direction="row" spacing={1.5}>
                <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "secondary.main", mt: 0.7, flexShrink: 0 }} />
                <Box sx={{ pb: 1.5, borderBottom: "1px solid", borderColor: "divider", flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip size="small" label={item.tipo} sx={{ fontWeight: 800 }} />
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>{formatDate(item.fecha)}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 900, mt: 0.5 }}>{item.titulo}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>{item.detalle}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

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

    </Box>
  );
}

function DataTable({ title, empty, columns, rows }) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
      <Box sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>{title}</Typography>
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", px: 2.5, pb: 2.5 }}>{empty}</Typography>
      ) : (
        <>
          {/* Desktop Table View */}
          <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
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

          {/* Mobile Card List View — jerarquía 3 niveles */}
          <Box sx={{ display: { xs: "block", sm: "none" }, px: 2, pb: 2 }}>
            <Stack spacing={1.5}>
              {rows.map((row, index) => {
                // Detectar índices por semántica de columna
                const titleIdx = 0;
                const amountIdx = columns.findIndex((c) => /monto|saldo/i.test(c));
                const statusIdx = columns.findIndex((c) => /estado/i.test(c));
                const actionIdx = columns.findIndex((c) => /acci[oó]n/i.test(c));
                const contextIdxs = columns
                  .map((_, i) => i)
                  .filter((i) => i !== titleIdx && i !== amountIdx && i !== statusIdx && i !== actionIdx);

                return (
                  <Paper
                    key={index}
                    elevation={0}
                    sx={{
                      borderRadius: "12px",
                      border: "1px solid",
                      borderColor: "divider",
                      borderLeft: "4px solid",
                      borderLeftColor: statusIdx >= 0 && row[statusIdx]?.props?.color === "success"
                        ? "success.main"
                        : statusIdx >= 0 && row[statusIdx]?.props?.color === "warning"
                          ? "warning.main"
                          : "primary.light",
                      overflow: "hidden",
                      bgcolor: alpha(theme.palette.background.paper, 0.6),
                    }}
                  >
                    {/* Nivel 1 — título + monto */}
                    <Box sx={{ px: 2, pt: 1.75, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                      <Typography variant="body2" fontWeight={800} sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {row[titleIdx]}
                      </Typography>
                      {amountIdx >= 0 && (
                        <Typography variant="body2" fontWeight={800} color="primary.main" sx={{ flexShrink: 0 }}>
                          {row[amountIdx]}
                        </Typography>
                      )}
                    </Box>

                    {/* Nivel 2 — contexto (fecha, etc.) */}
                    {contextIdxs.length > 0 && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                          {contextIdxs.map((i) => row[i]).filter(Boolean).join(" · ")}
                        </Typography>
                      </Box>
                    )}

                    {/* Nivel 3 — estado + acciones */}
                    {(statusIdx >= 0 || actionIdx >= 0) && (
                      <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        {statusIdx >= 0 && <Box>{row[statusIdx]}</Box>}
                        {actionIdx >= 0 && <Box sx={{ ml: "auto" }}>{row[actionIdx]}</Box>}
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </>
      )}
    </Paper>
  );
}

function CuentaCorrienteLedger({ subtitle, rows, formatDate, formatMoney, onPrint }) {
  const theme = useTheme();
  const saldoFinal = Number(rows[rows.length - 1]?.saldo ?? 0);
  const saldoFinalColor = saldoFinal > 0 ? "error.main" : "success.main";
  return (
    <Paper elevation={0} className="print-ledger" sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
      <style>{`
        @media print {
          .print-only { display: block !important; }
          body * { visibility: hidden; }
          .print-ledger, .print-ledger * { visibility: visible; }
          .print-ledger { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { margin: 18mm; }
        }
      `}</style>
      
      {/* Formal Header for Printing only */}
      <Box className="print-only" sx={{ display: "none", p: 2, bgcolor: "background.paper" }}>
        <Typography variant="overline" sx={{ fontWeight: 900, color: "text.secondary" }}>Estudio Jurídico Iuris</Typography>
        <Typography variant="h5" sx={{ fontWeight: 950 }}>Libro Mayor - Cuenta Corriente</Typography>
        <Typography variant="body1" sx={{ fontWeight: 800, color: "text.secondary" }}>{subtitle}</Typography>
        <Divider sx={{ mt: 1.5 }} />
      </Box>

      {/* Screen Simplified Header */}
      <Stack className="no-print" direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={1.5} sx={{ p: 2, bgcolor: "background.paper" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 950 }}>Cuenta Corriente</Typography>
        </Box>
        <Button variant="contained" startIcon={<Print />} onClick={onPrint} sx={{ fontWeight: 900, borderRadius: "10px" }}>
          Imprimir Cuenta Corriente
        </Button>
      </Stack>
      <Divider className="no-print" />
      
      {/* Desktop Table View */}
      <TableContainer sx={{ display: { xs: "none", sm: "block" } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Fecha", "Tipo", "Descripcion", "Debe", "Haber", "Saldo Acumulado"].map((col) => (
                <TableCell key={col} sx={{ fontWeight: 900 }}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary" }}>No hay movimientos registrados.</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(row.fecha)}</TableCell>
                <TableCell><Chip size="small" label={row.tipo} sx={{ fontWeight: 900 }} /></TableCell>
                <TableCell sx={{ fontWeight: 800 }}>{row.descripcion}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                  {row.debe > 0 ? <MoneyWithNote value={row.debe} note={row.note} formatMoney={formatMoney} /> : "-"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900, color: "success.main" }}>
                  {row.haber > 0 ? <MoneyWithNote value={row.haber} note={row.note} formatMoney={formatMoney} /> : "-"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 950, color: row.saldo > 0 ? "error.main" : "success.main" }}>{formatMoney(row.saldo)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03), borderTop: "2px solid", borderColor: "divider" }}>
                <TableCell />
                <TableCell><Chip size="small" label="Saldo" sx={{ fontWeight: 900 }} /></TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 950, color: saldoFinalColor }}>{formatMoney(saldoFinal)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Mobile Card List View */}
      <Box className="no-print" sx={{ display: { xs: "block", sm: "none" }, px: 2, pb: 2 }}>
        {rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>No hay movimientos registrados.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {rows.map((row) => (
              <Paper
                key={row.id}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "12px",
                  p: 2,
                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                }}
              >
                <Stack spacing={1.25}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>{formatDate(row.fecha)}</Typography>
                    <Chip size="small" label={row.tipo} sx={{ fontWeight: 900, height: 20, fontSize: "0.7rem" }} />
                  </Box>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{row.descripcion}</Typography>
                  </Box>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Monto</Typography>
                    <Box sx={{ fontWeight: 800, fontSize: "0.875rem" }}>
                      {row.debe > 0 && (
                        <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="body2" color="error.main" sx={{ fontWeight: 900 }}>
                            -{formatMoney(row.debe)}
                          </Typography>
                          {row.note && <Typography variant="caption" color="text.secondary">{row.note}</Typography>}
                        </Box>
                      )}
                      {row.haber > 0 && (
                        <Box sx={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 900 }}>
                            +{formatMoney(row.haber)}
                          </Typography>
                          {row.note && <Typography variant="caption" color="text.secondary">{row.note}</Typography>}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Divider sx={{ borderStyle: "dashed" }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>Saldo Acumulado</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 950,
                        color: row.saldo > 0 ? "error.main" : "success.main",
                      }}
                    >
                      {formatMoney(row.saldo)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
            <Paper
              elevation={0}
              sx={{
                border: "2px solid",
                borderColor: "divider",
                borderRadius: "12px",
                p: 2,
                bgcolor: alpha(theme.palette.action.hover, 0.7),
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Chip size="small" label="Saldo" sx={{ fontWeight: 900, mb: 0.75 }} />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 950, color: saldoFinalColor }}>
                  {formatMoney(saldoFinal)}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

function MoneyWithNote({ value, note, formatMoney }) {
  return (
    <Box>
      <Box>{formatMoney(value)}</Box>
      {note && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{note}</Typography>}
    </Box>
  );
}

function FinancialPanel({ title, total, columns, rows }) {
  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}>
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>{title}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>{formatMoney(total)}</Typography>
      </Paper>
      <DataTable title={`Detalle de ${title.toLowerCase()}`} empty={`No hay ${title.toLowerCase()} registrados.`} columns={columns} rows={rows} />
    </Stack>
  );
}
