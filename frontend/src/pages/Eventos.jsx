import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { usePermisos } from "../auth/usePermissions";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import api from "../api/axios";
import { fetchAllPages, unwrapPaged } from "../api/pagination";
import { useDebounced } from "../hooks/useDebounced";
import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
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
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Add,
  CalendarMonth,
  Delete,
  Edit,
  LocationOn,
  Search,
  TableRows,
  Today,
  ViewModule,
  WarningAmber,
} from "@mui/icons-material";
import {
  casoLabel,
  clienteLabel,
  formatFriendlyDate,
  getApiError,
  sameDay,
  unwrapData,
  unwrapEntity,
} from "./tareasUtils";

export default function Eventos() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear, canEditar, canEliminar } = usePermisos("EVENTOS");

  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("proximos"); // proximos, pasados, todos
  const [tipoFilter, setTipoFilter] = useState("all");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [view, setView] = useState("list");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [orderBy, setOrderBy] = useState("fechas");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const debouncedSearch = useDebounced(search);

  const listParams = useMemo(() => {
    const params = {
      page: page + 1,
      limit: rowsPerPage,
      search: debouncedSearch.trim() || undefined,
      tipoId: tipoFilter === "all" ? undefined : Number(tipoFilter),
      estadoId: estadoFilter === "all" ? undefined : Number(estadoFilter),
      orderBy,
      order,
    };
    if (timeFilter === "proximos") params.upcoming = "true";
    if (timeFilter === "pasados") params.upcoming = "false";
    return params;
  }, [page, rowsPerPage, debouncedSearch, tipoFilter, estadoFilter, timeFilter, orderBy, order]);

  const eventosQuery = useQuery({
    queryKey: ["eventos", "list", listParams],
    queryFn: async () => {
      const { data } = await api.get("/eventos", { params: listParams });
      return unwrapPaged(data);
    },
    staleTime: 1000 * 60,
    placeholderData: (previous) => previous,
  });

  const tiposQuery = useQuery({
    queryKey: ["catalogos", "parametros", "TIPO_EVENTO"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "TIPO_EVENTO" } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const estadosQuery = useQuery({
    queryKey: ["catalogos", "parametros", "ESTADO_EVENTO"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "ESTADO_EVENTO" } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup"],
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const expedientesQuery = useQuery({
    queryKey: ["expedientes", "lookup"],
    queryFn: () => fetchAllPages("/expedientes"),
    staleTime: 1000 * 60 * 5,
  });

  const tiposById = useMemo(() => new Map((tiposQuery.data ?? []).map((t) => [Number(t.id), t])), [tiposQuery.data]);
  const estadosById = useMemo(() => new Map((estadosQuery.data ?? []).map((e) => [Number(e.id), e])), [estadosQuery.data]);
  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])), [clientesQuery.data]);
  const expedientesById = useMemo(() => new Map((expedientesQuery.data ?? []).map((x) => [Number(x.id), x])), [expedientesQuery.data]);

  const allEvents = eventosQuery.data?.items ?? [];
  const totalCount = eventosQuery.data?.meta?.total ?? 0;
  const displayEvents = allEvents;

  const kpiFilterParams = useMemo(() => {
    const params = {
      search: debouncedSearch.trim() || undefined,
      tipoId: tipoFilter === "all" ? undefined : Number(tipoFilter),
      estadoId: estadoFilter === "all" ? undefined : Number(estadoFilter),
    };
    if (timeFilter === "proximos") params.upcoming = "true";
    if (timeFilter === "pasados") params.upcoming = "false";
    return params;
  }, [debouncedSearch, tipoFilter, estadoFilter, timeFilter]);

  const eventosKpiQuery = useQuery({
    queryKey: ["eventos", "kpi", kpiFilterParams],
    queryFn: () => fetchAllPages("/eventos", kpiFilterParams),
    staleTime: 1000 * 60,
  });

  const kpiEvents = eventosKpiQuery.data ?? [];

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    setPage(0);
  };

  const kpis = useMemo(() => {
    const now = new Date();
    const todayEvents = kpiEvents.filter((e) => e.fechaInicio && sameDay(new Date(e.fechaInicio), now)).length;
    const upcomingEvents = kpiEvents.filter((e) => e.fechaInicio && new Date(e.fechaInicio) >= now).length;
    const noLocationEvents = kpiEvents.filter((e) => !e.ubicacion).length;

    return [
      { label: "Total Eventos", value: kpiEvents.length, icon: <CalendarMonth />, tone: theme.palette.primary.main },
      { label: "Para Hoy", value: todayEvents, icon: <Today />, tone: "hsl(32, 90%, 48%)" },
      { label: "Próximos", value: upcomingEvents, icon: <CalendarMonth />, tone: "hsl(150, 80%, 35%)" },
      { label: "Sin Ubicación", value: noLocationEvents, icon: <LocationOn />, tone: "hsl(200, 80%, 45%)" },
    ];
  }, [kpiEvents, theme.palette.primary.main]);

  function invalidateEventos() {
    queryClient.invalidateQueries({ queryKey: ["eventos"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/eventos/${id}`),
    onSuccess: () => {
      enqueueSnackbar("Evento eliminado correctamente", { variant: "success" });
      setDeleteTarget(null);
      invalidateEventos();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo eliminar el evento"), { variant: "error" }),
  });

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0 }}>Eventos</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>Gestión, audiencias, reuniones y cronogramas de tu estudio.</Typography>
        </Box>
        {canCrear && (
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate("/eventos/nuevo", { state: { from: currentPath } })} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            Nuevo Evento
          </Button>
        )}
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: "16px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
          <TextField
            size="small"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Buscar por descripción, cliente o expediente"
            sx={{ flex: 1, minWidth: { lg: 250 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: "text.secondary" }} /></InputAdornment> } }}
          />
          <Tabs value={timeFilter} onChange={(_, value) => { setTimeFilter(value); setPage(0); }} sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontWeight: 900 } }}>
            <Tab value="proximos" label="Próximos" />
            <Tab value="pasados" label="Pasados" />
            <Tab value="todos" label="Todos" />
          </Tabs>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 150 } }}>
            <InputLabel>Tipo</InputLabel>
            <Select label="Tipo" value={tipoFilter} onChange={(event) => { setTipoFilter(event.target.value); setPage(0); }}>
              <MenuItem value="all">Todos</MenuItem>
              {(tiposQuery.data ?? []).map((tipo) => <MenuItem key={tipo.id} value={tipo.id}>{tipo.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 150 } }}>
            <InputLabel>Estado</InputLabel>
            <Select label="Estado" value={estadoFilter} onChange={(event) => { setEstadoFilter(event.target.value); setPage(0); }}>
              <MenuItem value="all">Todos</MenuItem>
              {(estadosQuery.data ?? []).map((estado) => <MenuItem key={estado.id} value={estado.id}>{estado.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <ButtonGroup variant="outlined" size="small" sx={{ alignSelf: { xs: "flex-start", lg: "center" } }}>
            <Tooltip title="Vista de lista"><Button variant={view === "list" ? "contained" : "outlined"} onClick={() => setView("list")} aria-label="Vista de lista"><TableRows fontSize="small" /></Button></Tooltip>
            <Tooltip title="Vista de tarjetas"><Button variant={view === "grid" ? "contained" : "outlined"} onClick={() => setView("grid")} aria-label="Vista de tarjetas"><ViewModule fontSize="small" /></Button></Tooltip>
          </ButtonGroup>
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {kpis.map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Paper elevation={0} sx={{ p: 2.25, borderRadius: "16px", border: "1px solid", borderColor: alpha(kpi.tone, 0.35), bgcolor: "background.paper", transition: "transform 0.18s ease, box-shadow 0.18s ease", "&:hover": { transform: "translateY(-4px)", boxShadow: theme.palette.mode === "dark" ? "0 18px 38px rgba(0,0,0,0.34)" : "0 18px 38px rgba(15,23,42,0.08)" } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900, textTransform: "uppercase" }}>{kpi.label}</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 950, mt: 0.5 }}>{kpi.value}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(kpi.tone, 0.12), color: kpi.tone }}>{kpi.icon}</Avatar>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {eventosQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : totalCount === 0 && !eventosQuery.isFetching ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <CalendarMonth sx={{ fontSize: 58, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 900 }}>No hay eventos para mostrar</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>Probá ajustar los filtros o registrar un nuevo evento en tu agenda.</Typography>
        </Paper>
      ) : view === "grid" || isMobile ? (
        <Stack spacing={1.5}>
          <Grid container spacing={2}>
            {displayEvents.map((event) => (
              <Grid key={event.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <EventCard
                  event={event}
                  theme={theme}
                  tipo={tiposById.get(Number(event.tipoId))}
                  estado={estadosById.get(Number(event.estadoId))}
                  cliente={clientesById.get(Number(event.clienteId))}
                  caso={expedientesById.get(Number(event.casoId))}
                  currentPath={currentPath}
                  onOpen={() => navigate(`/eventos/${event.id}`, { state: { from: currentPath } })}
                  onEdit={(e) => { e.stopPropagation(); navigate(`/eventos/editar/${event.id}`, { state: { from: currentPath } }); }}
                  onDelete={(e) => { e.stopPropagation(); setDeleteTarget(event); }}
                  canEditar={canEditar}
                  canEliminar={canEliminar}
                />
              </Grid>
            ))}
          </Grid>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Filas:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            sx={{ borderTop: "1px solid", borderColor: "divider", mt: 1 }}
          />
        </Stack>
      ) : (
        <EventTable
          events={displayEvents}
          totalCount={totalCount}
          page={page}
          setPage={setPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          orderBy={orderBy}
          order={order}
          handleRequestSort={handleRequestSort}
          theme={theme}
          tiposById={tiposById}
          estadosById={estadosById}
          clientesById={clientesById}
          expedientesById={expedientesById}
          currentPath={currentPath}
          onOpen={(event) => navigate(`/eventos/${event.id}`, { state: { from: currentPath } })}
          onEdit={(e, event) => { e.stopPropagation(); navigate(`/eventos/editar/${event.id}`, { state: { from: currentPath } }); }}
          onDelete={(e, event) => { e.stopPropagation(); setDeleteTarget(event); }}
          canEditar={canEditar}
          canEliminar={canEliminar}
        />
      )}

      {eventosQuery.isFetching && !eventosQuery.isLoading && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>Sincronizando eventos...</Typography>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha("#EF4444", 0.12), color: "#EF4444" }}><WarningAmber /></Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar evento</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Esta acción requiere confirmación</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
            ¿Seguro que querés eliminar <Box component="span" sx={{ color: "text.primary", fontWeight: 900 }}>{deleteTarget?.descripcion || "este evento"}</Box>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            {deleteMutation.isPending ? <CircularProgress size={20} color="inherit" /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function formatEventDates(inicioStr, finStr) {
  if (!inicioStr) return "Sin fecha";
  const start = new Date(inicioStr);
  if (Number.isNaN(start.getTime())) return "Fecha inválida";
  
  const friendlyStart = formatFriendlyDate(inicioStr);
  if (!finStr) return friendlyStart;
  
  const end = new Date(finStr);
  if (Number.isNaN(end.getTime())) return friendlyStart;
  
  if (sameDay(start, end)) {
    const endTime = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(end);
    return `${friendlyStart} a ${endTime}`;
  }
  
  const friendlyEnd = formatFriendlyDate(finStr);
  return `${friendlyStart} al ${friendlyEnd}`;
}

function EventCard({ event, theme, tipo, estado, cliente, caso, currentPath, onOpen, onEdit, onDelete, canEditar = true, canEliminar = true }) {
  return (
    <Card elevation={0} sx={{ height: "100%", border: "1px solid", borderColor: "divider", borderRadius: "16px", cursor: "pointer", transition: "transform 0.16s ease, border-color 0.16s ease", "&:hover": { transform: "translateY(-3px)", borderColor: "primary.main" } }} onClick={onOpen}>
      <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
        <Stack spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.25, color: "text.primary" }}>{event.descripcion}</Typography>
            {event.ubicacion && (
              <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "text.secondary", mt: 0.5 }}>
                <LocationOn sx={{ fontSize: 13 }} /> {event.ubicacion}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {tipo && <Chip size="small" label={tipo.nombre} variant="outlined" sx={{ fontWeight: 900 }} />}
            {estado && <Chip size="small" label={estado.nombre} color="info" sx={{ fontWeight: 900 }} />}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
            {formatEventDates(event.fechaInicio, event.fechaFin)}
          </Typography>
          <Stack spacing={0.25}>
            {cliente && <Link component={RouterLink} to={`/clientes/${cliente.id}`} state={{ from: currentPath }} variant="caption" sx={{ fontWeight: 800, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{clienteLabel(cliente)}</Link>}
            {caso && <Link component={RouterLink} to={`/expedientes/${caso.id}`} state={{ from: currentPath }} variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.35, fontWeight: 800, textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{casoLabel(caso)}</Link>}
          </Stack>
          {(canEditar || canEliminar) && (
            <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
              {canEditar && <Tooltip title="Editar"><IconButton size="small" color="primary" onClick={onEdit}><Edit fontSize="small" /></IconButton></Tooltip>}
              {canEliminar && <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={onDelete}><Delete fontSize="small" /></IconButton></Tooltip>}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function EventTable({
  events,
  totalCount,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  orderBy,
  order,
  handleRequestSort,
  theme,
  tiposById,
  estadosById,
  clientesById,
  expedientesById,
  currentPath,
  onOpen,
  onEdit,
  onDelete,
  canEditar = true,
  canEliminar = true
}) {
  const columns = [
    { id: "evento", label: "Evento" },
    { id: "tipoEstado", label: "Tipo / Estado" },
    { id: "fechas", label: "Fechas" },
    { id: "vinculaciones", label: "Vinculaciones" },
    { id: "ubicacion", label: "Ubicación" },
    { id: "acciones", label: "Acciones" },
  ];

  return (
    <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
              {columns.map((column) => {
                const isSortable = column.id !== "acciones";
                return (
                  <TableCell
                    key={column.id}
                    sortDirection={orderBy === column.id ? order : false}
                    sx={{
                      fontWeight: 900,
                      fontSize: "0.72rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "text.secondary"
                    }}
                  >
                    {isSortable ? (
                      <TableSortLabel
                        active={orderBy === column.id}
                        direction={orderBy === column.id ? order : "asc"}
                        onClick={() => handleRequestSort(column.id)}
                        sx={{
                          "&.MuiTableSortLabel-active": { color: "text.primary" },
                          "& .MuiTableSortLabel-icon": { color: "text.secondary" }
                        }}
                      >
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((event) => {
              const cliente = clientesById.get(Number(event.clienteId));
              const caso = expedientesById.get(Number(event.casoId));
              const tipo = tiposById.get(Number(event.tipoId));
              const estado = estadosById.get(Number(event.estadoId));
              return (
                <TableRow
                  key={event.id}
                  hover
                  sx={{
                    cursor: "pointer",
                    "& td": { py: 0.75, px: 2 }
                  }}
                  onClick={() => onOpen(event)}
                >
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Tooltip title={event.descripcion}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 900,
                          color: "text.primary",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "block"
                        }}
                      >
                        {event.descripcion}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {tipo && <Chip size="small" label={tipo.nombre} variant="outlined" sx={{ fontWeight: 900 }} />}
                      {estado && <Chip size="small" label={estado.nombre} color="info" sx={{ fontWeight: 900 }} />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
                      {formatEventDates(event.fechaInicio, event.fechaFin)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      {cliente && (
                        <Tooltip title={clienteLabel(cliente)}>
                          <Link
                            component={RouterLink}
                            to={`/clientes/${cliente.id}`}
                            state={{ from: currentPath }}
                            variant="caption"
                            sx={{
                              fontWeight: 800,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 220,
                              display: "inline-block"
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {clienteLabel(cliente)}
                          </Link>
                        </Tooltip>
                      )}
                      {caso && (
                        <Tooltip title={casoLabel(caso)}>
                          <Link
                            component={RouterLink}
                            to={`/expedientes/${caso.id}`}
                            state={{ from: currentPath }}
                            variant="caption"
                            sx={{
                              fontWeight: 800,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 220,
                              display: "inline-block"
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {casoLabel(caso)}
                          </Link>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    {event.ubicacion ? (
                      <Tooltip title={event.ubicacion}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            width: "100%"
                          }}
                        >
                          <LocationOn sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {event.ubicacion}
                          </span>
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" sx={{ color: "text.disabled" }}>Sin ubicación</Typography>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: "nowrap" }}>
                    {canEditar && <Tooltip title="Editar"><IconButton size="small" color="primary" onClick={(e) => onEdit(e, event)}><Edit fontSize="small" /></IconButton></Tooltip>}
                    {canEliminar && <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={(e) => onDelete(e, event)}><Delete fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Filas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        sx={{ borderTop: "1px solid", borderColor: "divider" }}
      />
    </Paper>
  );
}
