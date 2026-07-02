import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { alpha, useTheme } from "@mui/material/styles";
import { denseTableSx } from "../theme/tableStyles";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AccountBalanceWallet,
  Assignment,
  CalendarMonth,
  CheckCircle,
  Delete,
  ExpandLess,
  ExpandMore,
  FolderSpecial,
  History,
  Paid,
  People,
  ReceiptLong,
  Save,
  Update,
} from "@mui/icons-material";
import api from "../api/axios";
import { getAuditoriaLogs } from "../api/auditoria.api";

const entidadOptions = [
  { value: "", label: "Todos" },
  { value: "caso", label: "Expediente" },
  { value: "cliente", label: "Cliente" },
  { value: "tarea", label: "Tarea" },
  { value: "evento", label: "Evento" },
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
  { value: "honorario", label: "Honorario" },
];

const entidadMeta = {
  caso: { label: "Expediente", icon: <FolderSpecial fontSize="small" /> },
  cliente: { label: "Cliente", icon: <People fontSize="small" /> },
  tarea: { label: "Tarea", icon: <Assignment fontSize="small" /> },
  evento: { label: "Evento", icon: <CalendarMonth fontSize="small" /> },
  ingreso: { label: "Ingreso", icon: <AccountBalanceWallet fontSize="small" /> },
  gasto: { label: "Gasto", icon: <ReceiptLong fontSize="small" /> },
  honorario: { label: "Honorario", icon: <Paid fontSize="small" /> },
};

const accionMeta = {
  CREATE: { label: "Creacion", color: "success", icon: <Save fontSize="small" /> },
  UPDATE: { label: "Actualizacion", color: "primary", icon: <Update fontSize="small" /> },
  DELETE: { label: "Eliminacion", color: "error", icon: <Delete fontSize="small" /> },
  ESTADO_CHANGED: { label: "Cambio de estado", color: "warning", icon: <Update fontSize="small" /> },
  COMPLETADA: { label: "Completada", color: "success", variant: "outlined", icon: <CheckCircle fontSize="small" /> },
};

const catalogCategories = [
  "TIPO_CASO",
  "ESTADO_CASO",
  "ESTADO_RADICACION",
  "TIPO_EVENTO",
  "ESTADO_EVENTO",
  "PRIORIDAD",
  "CONCEPTO_HONORARIO",
  "PARTES",
  "CONCEPTO_GASTO",
  "CONCEPTO_INGRESO",
  "MONEDA",
  "ESTADO_INGRESO",
  "ESTADO_HONORARIO",
  "TIPO_PERSONA",
  "ESTADO_GASTO",
  "POLITICA_JUS",
];

const fieldLabels = {
  tipoPersonaId: "Tipo de persona",
  tipoId: "Tipo",
  estadoId: "Estado",
  radicacionId: "Radicacion",
  estadoRadicacionId: "Estado de radicacion",
  prioridadId: "Prioridad",
  conceptoId: "Concepto",
  parteId: "Parte",
  monedaId: "Moneda",
  politicaJusId: "Politica JUS",
  clienteId: "Cliente",
  casoId: "Expediente",
  cuotaId: "Cuota",
  asignadoA: "Asignado a",
  titulo: "Titulo",
  descripcion: "Descripcion",
  observaciones: "Observaciones",
  caratula: "Caratula",
  nroExpte: "Nro. expediente",
  fechaEstado: "Fecha de estado",
  fechaInicio: "Inicio",
  fechaFin: "Fin",
  allDay: "Todo el dia",
  recordatorio: "Recordatorio",
  recordatorioEnviado: "Recordatorio enviado",
  ubicacion: "Ubicacion",
  fechaLimite: "Fecha limite",
  completada: "Completada",
  completadaAt: "Completada el",
  fechaGasto: "Fecha del gasto",
  fechaIngreso: "Fecha del ingreso",
  fechaRegulacion: "Fecha de regulacion",
  fechaVencimiento: "Fecha de vencimiento",
  monto: "Monto",
  montoPesos: "Monto en pesos",
  jus: "JUS",
  valorJusRef: "Valor JUS de referencia",
  tasaInteresMensual: "Tasa de interes mensual",
  cotizacionArs: "Cotizacion ARS",
  razonSocial: "Razon social",
  nombre: "Nombre",
  apellido: "Apellido",
  dni: "DNI",
  cuit: "CUIT",
  email: "Email",
  telefono: "Telefono",
  telFijo: "Telefono fijo",
  telCelular: "Celular",
  dirCalle: "Calle",
  dirNro: "Numero",
  dirPiso: "Piso",
  dirDepto: "Depto.",
  codigoPostal: "Codigo postal",
  provinciaId: "Provincia",
  localidadId: "Localidad",
};

const catalogByEntityField = {
  caso: {
    tipoId: "TIPO_CASO",
    estadoId: "ESTADO_CASO",
    radicacionId: "ESTADO_RADICACION",
    estadoRadicacionId: "ESTADO_RADICACION",
  },
  cliente: {
    tipoPersonaId: "TIPO_PERSONA",
  },
  tarea: {
    prioridadId: "PRIORIDAD",
  },
  evento: {
    tipoId: "TIPO_EVENTO",
    estadoId: "ESTADO_EVENTO",
  },
  ingreso: {
    tipoId: "CONCEPTO_INGRESO",
    estadoId: "ESTADO_INGRESO",
    monedaId: "MONEDA",
  },
  gasto: {
    conceptoId: "CONCEPTO_GASTO",
    estadoId: "ESTADO_GASTO",
    monedaId: "MONEDA",
  },
  honorario: {
    conceptoId: "CONCEPTO_HONORARIO",
    parteId: "PARTES",
    estadoId: "ESTADO_HONORARIO",
    monedaId: "MONEDA",
    politicaJusId: "POLITICA_JUS",
  },
};

function unwrapData(data) {
  const raw = Array.isArray(data?.data) ? data.data : data?.data?.items ?? data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatFieldName(key) {
  return fieldLabels[key] ?? key.replace(/Id$/, "").replace(/([A-Z])/g, " $1").trim();
}

function looksLikeDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function formatAuditValue(value, field, entidad, catalog) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (looksLikeDate(value) || value instanceof Date) return formatDateTime(value);

  const category = catalogByEntityField[entidad]?.[field];
  const catalogItem = category ? catalog?.[category]?.get(Number(value)) : null;
  if (catalogItem) return catalogItem.nombre ?? catalogItem.codigo ?? String(value);

  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function AccionChip({ accion }) {
  const meta = accionMeta[accion] ?? { label: accion, color: "default" };
  return (
    <Chip
      size="small"
      color={meta.color}
      variant={meta.variant ?? "filled"}
      icon={meta.icon}
      label={meta.label}
      sx={{ fontWeight: 800 }}
    />
  );
}

function EntidadLabel({ entidad }) {
  const meta = entidadMeta[entidad] ?? { label: entidad || "Sin entidad", icon: <History fontSize="small" /> };
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: "text.secondary", display: "inline-flex" }}>{meta.icon}</Box>
      <Typography variant="body2" sx={{ fontWeight: 800 }}>{meta.label}</Typography>
    </Stack>
  );
}

function DiffPanel({ cambios, entidad, catalog }) {
  const before = cambios?.before ?? {};
  const after = cambios?.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  if (keys.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin detalle de cambios para este registro.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 900 }}>Campo</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Antes</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Despues</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key}>
              <TableCell sx={{ fontWeight: 900, color: "text.secondary", width: "28%" }}>{formatFieldName(key)}</TableCell>
              <TableCell sx={{ wordBreak: "break-word" }}>{formatAuditValue(before[key], key, entidad, catalog)}</TableCell>
              <TableCell sx={{ wordBreak: "break-word", fontWeight: 800 }}>{formatAuditValue(after[key], key, entidad, catalog)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function AuditoriaRowMobile({ item, catalog }) {
  const [open, setOpen] = useState(false);
  const hasChanges = Boolean(item.cambios?.before || item.cambios?.after);
  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Box sx={{ p: 2, cursor: hasChanges ? "pointer" : "default" }} onClick={() => hasChanges && setOpen((v) => !v)}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap", gap: 0.5 }}>
              <EntidadLabel entidad={item.entidad} />
              <AccionChip accion={item.accion} />
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.descripcion || "Sin descripcion"}</Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{formatDateTime(item.createdAt)}</Typography>
              <Typography variant="caption" color="text.secondary">·</Typography>
              <Typography variant="caption" color="text.secondary">{item.usuarioNombre || "Sistema"}</Typography>
            </Stack>
          </Box>
          {hasChanges && (
            <IconButton size="small" sx={{ flexShrink: 0 }}>
              {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          )}
        </Stack>
      </Box>
      {hasChanges && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2, pb: 2, bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.035) }}>
            <DiffPanel cambios={item.cambios} entidad={item.entidad} catalog={catalog} />
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

function AuditoriaRow({ item, catalog }) {
  const [open, setOpen] = useState(false);
  const hasChanges = Boolean(item.cambios?.before || item.cambios?.after);

  return (
    <>
      <TableRow hover sx={{ cursor: hasChanges ? "pointer" : "default" }} onClick={() => hasChanges && setOpen((value) => !value)}>
        <TableCell sx={{ width: 48, py: 0.75, px: 2 }}>
          {hasChanges && (
            <IconButton size="small" aria-label={open ? "Contraer cambios" : "Expandir cambios"}>
              {open ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 800, py: 0.75, px: 2 }}>{formatDateTime(item.createdAt)}</TableCell>
        <TableCell sx={{ py: 0.75, px: 2 }}>{item.usuarioNombre || "Sistema"}</TableCell>
        <TableCell sx={{ py: 0.75, px: 2 }}><EntidadLabel entidad={item.entidad} /></TableCell>
        <TableCell sx={{ py: 0.75, px: 2 }}><AccionChip accion={item.accion} /></TableCell>
        <TableCell sx={{ minWidth: 260, py: 0.75, px: 2 }}>{item.descripcion || "Sin descripcion"}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? "1px solid" : 0, borderColor: "divider" }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2.5, bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.035) }}>
              <DiffPanel cambios={item.cambios} entidad={item.entidad} catalog={catalog} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function Auditoria() {
  const theme = useTheme();
  const [filters, setFilters] = useState({ entidad: "", usuarioId: "", desde: "", hasta: "" });
  const [appliedFilters, setAppliedFilters] = useState({ entidad: "", usuarioId: "", desde: "", hasta: "" });
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const catalogQuery = useQuery({
    queryKey: ["auditoria", "catalogos"],
    queryFn: async () => {
      const entries = await Promise.all(catalogCategories.map(async (categoria) => {
        const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
        return [categoria, unwrapData(data)];
      }));

      return Object.fromEntries(entries.map(([categoria, rows]) => [
        categoria,
        new Map(rows.map((row) => [Number(row.id), row])),
      ]));
    },
    staleTime: 1000 * 60 * 30,
  });

  const usuariosQuery = useQuery({
    queryKey: ["auditoria", "usuarios"],
    queryFn: async () => {
      const { data } = await api.get("/equipo/usuarios");
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = {
          page,
          limit: 50,
          entidad: appliedFilters.entidad || undefined,
          usuarioId: appliedFilters.usuarioId || undefined,
          desde: appliedFilters.desde || undefined,
          hasta: appliedFilters.hasta || undefined,
        };
        const data = await getAuditoriaLogs(params);
        if (active) {
          setLogs(data?.items ?? []);
          setMeta(data?.meta ?? { total: 0, page, limit: 50 });
        }
      } catch (err) {
        if (active) {
          setLogs([]);
          setMeta({ total: 0, page, limit: 50 });
          setError(err?.response?.data?.error?.message ?? "No se pudo cargar el registro de auditoria.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  const catalog = catalogQuery.data ?? {};
  const usuarios = usuariosQuery.data ?? [];
  const columns = [
    { id: "expand", label: "" },
    { id: "createdAt", label: "Fecha/Hora" },
    { id: "usuarioNombre", label: "Usuario" },
    { id: "entidad", label: "Entidad" },
    { id: "accion", label: "Accion" },
    { id: "descripcion", label: "Descripcion" },
  ];

  const sortedLogs = useMemo(() => {
    const getValue = (item) => {
      if (orderBy === "createdAt") return item.createdAt ? new Date(item.createdAt).getTime() : 0;
      if (orderBy === "entidad") return entidadMeta[item.entidad]?.label ?? item.entidad ?? "";
      if (orderBy === "accion") return accionMeta[item.accion]?.label ?? item.accion ?? "";
      return item[orderBy] ?? "";
    };

    return [...logs].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      let result = 0;

      if (typeof valA === "number" && typeof valB === "number") {
        result = valA - valB;
      } else {
        result = String(valA).localeCompare(String(valB), "es", { numeric: true, sensitivity: "base" });
      }

      return order === "desc" ? -result : result;
    });
  }, [logs, order, orderBy]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    const empty = { entidad: "", usuarioId: "", desde: "", hasta: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setPage(1);
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>Registro de Auditoria</Typography>
          <Typography variant="body2" color="text.secondary">Actividad reciente del estudio y cambios relevantes.</Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 2.6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Entidad</InputLabel>
              <Select label="Entidad" value={filters.entidad} onChange={(event) => setFilters((current) => ({ ...current, entidad: event.target.value }))}>
                {entidadOptions.map((option) => (
                  <MenuItem key={option.value || "all"} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2.8 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Usuario</InputLabel>
              <Select label="Usuario" value={filters.usuarioId} onChange={(event) => setFilters((current) => ({ ...current, usuarioId: event.target.value }))}>
                <MenuItem value="">Todos</MenuItem>
                {usuarios.map((usuario) => (
                  <MenuItem key={usuario.id} value={usuario.id}>
                    {[usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Desde" value={filters.desde} onChange={(event) => setFilters((current) => ({ ...current, desde: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Hasta" value={filters.hasta} onChange={(event) => setFilters((current) => ({ ...current, hasta: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 2.6 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
              <Button variant="contained" onClick={applyFilters} sx={{ fontWeight: 900 }}>Filtrar</Button>
              <Button variant="outlined" onClick={clearFilters} sx={{ fontWeight: 900 }}>Limpiar filtros</Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
            <History sx={{ fontSize: 52, color: "text.disabled", mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>No se pudo cargar auditoria</Typography>
            <Typography variant="body2" color="text.secondary">{error}</Typography>
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
            <History sx={{ fontSize: 52, color: "text.disabled", mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>No hay actividad para mostrar</Typography>
            <Typography variant="body2" color="text.secondary">Proba ajustar los filtros o volver mas tarde.</Typography>
          </Box>
        ) : (
          <>
            {/* Desktop */}
            <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
              <Table size="small" sx={denseTableSx}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                    {columns.map((column) => {
                      const isSortable = column.id !== "expand";
                      return (
                        <TableCell key={column.id} sortDirection={orderBy === column.id ? order : false} sx={{ fontWeight: 900, color: "text.secondary", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {isSortable ? (
                            <TableSortLabel active={orderBy === column.id} direction={orderBy === column.id ? order : "asc"} onClick={() => handleRequestSort(column.id)} sx={{ "&.MuiTableSortLabel-active": { color: "text.primary" }, "& .MuiTableSortLabel-icon": { color: "text.secondary" } }}>
                              {column.label}
                            </TableSortLabel>
                          ) : column.label}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedLogs.map((item) => <AuditoriaRow key={item.id} item={item} catalog={catalog} />)}
                </TableBody>
              </Table>
            </TableContainer>
            {/* Mobile */}
            <Stack spacing={0} sx={{ display: { xs: "flex", md: "none" } }}>
              {sortedLogs.map((item) => <AuditoriaRowMobile key={item.id} item={item} catalog={catalog} />)}
            </Stack>
            <Divider />
            <TablePagination
              component="div"
              count={meta.total || 0}
              page={page - 1}
              onPageChange={(_, value) => setPage(value + 1)}
              rowsPerPage={meta.limit || 50}
              rowsPerPageOptions={[50]}
              labelRowsPerPage="Filas por pagina"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
