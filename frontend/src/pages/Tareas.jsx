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
import { useListState } from "../hooks/useListState";
import { denseTableSx, tableHeadCellSx } from "../theme/tableStyles";
import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
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
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Add,
  CalendarToday,
  CheckCircle,
  Delete,
  Edit,
  ErrorOutline,
  FolderOpen,
  PlaylistAddCheck,
  Search,
  TableRows,
  ViewModule,
  WarningAmber,
} from "@mui/icons-material";
import {
  casoLabel,
  casoCaratulaLabel,
  checklistStats,
  clienteLabel,
  formatFriendlyDate,
  getApiError,
  isOverdue,
  priorityStyles,
  unwrapData,
  unwrapEntity,
} from "./tareasUtils";

export default function Tareas() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear, canEditar, canEliminar } = usePermisos("TAREAS");
  const [list, setList] = useListState({
    search: "",
    statusFilter: "pendientes",
    priorityFilter: "all",
    view: "list",
    orderBy: "titulo",
    order: "asc",
    page: 0,
    rowsPerPage: 10,
  });
  const {
    search,
    statusFilter,
    priorityFilter,
    view,
    orderBy,
    order,
    page,
    rowsPerPage,
  } = list;
  const setSearch = (search) => setList({ search });
  const setStatusFilter = (statusFilter) => setList({ statusFilter });
  const setPriorityFilter = (priorityFilter) => setList({ priorityFilter });
  const setView = (view) => setList({ view });
  const setOrderBy = (orderBy) => setList({ orderBy });
  const setOrder = (order) => setList({ order });
  const setPage = (page) => setList({ page });
  const setRowsPerPage = (rowsPerPage) => setList({ rowsPerPage });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cascadeTarget, setCascadeTarget] = useState(null);

  const debouncedSearch = useDebounced(search);

  const listParams = useMemo(() => {
    const sortable = new Set(["titulo", "prioridad", "vencimiento", "vinculacion"]);
    const params = {
      page: page + 1,
      limit: rowsPerPage,
      search: debouncedSearch.trim() || undefined,
      prioridadId: priorityFilter === "all" ? undefined : Number(priorityFilter),
      orderBy: sortable.has(orderBy) ? orderBy : "titulo",
      order,
    };
    if (statusFilter === "pendientes") params.completada = "false";
    if (statusFilter === "completadas") params.completada = "true";
    return params;
  }, [page, rowsPerPage, debouncedSearch, priorityFilter, statusFilter, orderBy, order]);

  const tareasQuery = useQuery({
    queryKey: ["tareas", "list", listParams],
    queryFn: async () => {
      const { data } = await api.get("/tareas", { params: listParams });
      return unwrapPaged(data);
    },
    staleTime: 1000 * 60,
    placeholderData: (previous) => previous,
  });

  const prioridadesQuery = useQuery({
    queryKey: ["catalogos", "parametros", "PRIORIDAD"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "PRIORIDAD" } });
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

  const prioridadesById = useMemo(() => new Map((prioridadesQuery.data ?? []).map((p) => [Number(p.id), p])), [prioridadesQuery.data]);
  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [Number(c.id), c])), [clientesQuery.data]);
  const expedientesById = useMemo(() => new Map((expedientesQuery.data ?? []).map((c) => [Number(c.id), c])), [expedientesQuery.data]);
  const allTasks = tareasQuery.data?.items ?? [];
  const totalCount = tareasQuery.data?.meta?.total ?? 0;
  const displayTasks = allTasks;

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    setPage(0);
  };

  function invalidateTareas() {
    queryClient.invalidateQueries({ queryKey: ["tareas"] });
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ task, cascade }) => {
      const { data } = await api.put(`/tareas/${task.id}`, {
        completada: !task.completada,
        completarSubtareas: cascade,
      });
      return unwrapEntity(data);
    },
    onSuccess: (_, { task }) => {
      enqueueSnackbar(task.completada ? "Tarea marcada como pendiente" : "Tarea completada", { variant: "success" });
      invalidateTareas();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo actualizar la tarea"), { variant: "error" }),
  });

  async function handleToggleTask(task) {
    if (task.completada) {
      toggleMutation.mutate({ task, cascade: false });
      return;
    }

    try {
      const { data } = await api.get(`/tareas/${task.id}`);
      const detailedTask = unwrapEntity(data);
      const subtasks = Array.isArray(detailedTask.items) ? detailedTask.items : [];
      const incompleteCount = subtasks.filter((item) => !item.completada).length;

      if (incompleteCount > 0) {
        setCascadeTarget({ task, incompleteCount });
        return;
      }
    } catch {
      // Si falla la consulta de detalle, mantenemos el flujo principal funcionando.
    }

    toggleMutation.mutate({ task, cascade: false });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/tareas/${id}`),
    onSuccess: () => {
      enqueueSnackbar("Tarea eliminada correctamente", { variant: "success" });
      setDeleteTarget(null);
      invalidateTareas();
    },
    onError: (error) => enqueueSnackbar(getApiError(error, "No se pudo eliminar la tarea"), { variant: "error" }),
  });

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0 }}>Tareas</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>Gestión operativa de pendientes, vencimientos y subtareas del estudio.</Typography>
        </Box>
        {canCrear && (
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate("/tareas/nuevo", { state: { from: currentPath } })} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            Nueva Tarea
          </Button>
        )}
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: "16px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
          <TextField
            size="small"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Buscar por título, descripción, cliente o expediente"
            sx={{ flex: 1, minWidth: { lg: 300 } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: "text.secondary" }} /></InputAdornment> } }}
          />
          <Tabs value={statusFilter} onChange={(_, value) => { setStatusFilter(value); setPage(0); }} sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontWeight: 900 } }}>
            <Tab value="pendientes" label="Pendientes" />
            <Tab value="completadas" label="Completadas" />
            <Tab value="todas" label="Todas" />
          </Tabs>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 190 } }}>
            <InputLabel>Prioridad</InputLabel>
            <Select label="Prioridad" value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(0); }}>
              <MenuItem value="all">Todas</MenuItem>
              {(prioridadesQuery.data ?? []).map((prioridad) => <MenuItem key={prioridad.id} value={prioridad.id}>{prioridad.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <ButtonGroup variant="outlined" size="small" sx={{ alignSelf: { xs: "flex-start", lg: "center" } }}>
            <Tooltip title="Vista de lista"><Button variant={view === "list" ? "contained" : "outlined"} onClick={() => setView("list")} aria-label="Vista de lista"><TableRows fontSize="small" /></Button></Tooltip>
            <Tooltip title="Vista de tarjetas"><Button variant={view === "grid" ? "contained" : "outlined"} onClick={() => setView("grid")} aria-label="Vista de tarjetas"><ViewModule fontSize="small" /></Button></Tooltip>
          </ButtonGroup>
        </Stack>
      </Paper>

      {tareasQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : tareasQuery.isError ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            No se pudieron cargar las tareas
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, mb: 2 }}>
            Hubo un problema de conexión o el servidor no respondió. Probá de nuevo.
          </Typography>
          <Button variant="contained" onClick={() => tareasQuery.refetch()} sx={{ fontWeight: 800 }}>
            Reintentar
          </Button>
        </Paper>
      ) : totalCount === 0 && !tareasQuery.isFetching ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <PlaylistAddCheck sx={{ fontSize: 58, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 900 }}>No hay tareas para mostrar</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>Probá ajustar los filtros o cargar un nuevo pendiente.</Typography>
        </Paper>
      ) : view === "grid" || isMobile ? (
        <Stack spacing={1.5}>
          <Grid container spacing={2}>
            {displayTasks.map((task) => (
              <Grid key={task.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <TaskCard
                  task={task}
                  theme={theme}
                  priority={prioridadesById.get(Number(task.prioridadId))}
                  cliente={clientesById.get(Number(task.clienteId))}
                  caso={expedientesById.get(Number(task.casoId))}
                  currentPath={currentPath}
                  onOpen={() => navigate(`/tareas/${task.id}`, { state: { from: currentPath } })}
                  onToggle={(event) => { event.stopPropagation(); handleToggleTask(task); }}
                  onEdit={(event) => { event.stopPropagation(); navigate(`/tareas/editar/${task.id}`, { state: { from: currentPath } }); }}
                  onDelete={(event) => { event.stopPropagation(); setDeleteTarget(task); }}
                  canEditar={canEditar}
                  canEliminar={canEliminar}
                  disabled={toggleMutation.isPending}
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
        <TaskTable
          tasks={displayTasks}
          totalCount={totalCount}
          page={page}
          setPage={setPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          orderBy={orderBy}
          order={order}
          handleRequestSort={handleRequestSort}
          theme={theme}
          prioridadesById={prioridadesById}
          clientesById={clientesById}
          expedientesById={expedientesById}
          currentPath={currentPath}
          onOpen={(task) => navigate(`/tareas/${task.id}`, { state: { from: currentPath } })}
          onToggle={(event, task) => { event.stopPropagation(); handleToggleTask(task); }}
          onEdit={(event, task) => { event.stopPropagation(); navigate(`/tareas/editar/${task.id}`, { state: { from: currentPath } }); }}
          onDelete={(event, task) => { event.stopPropagation(); setDeleteTarget(task); }}
          canEditar={canEditar}
          canEliminar={canEliminar}
          disabled={toggleMutation.isPending}
        />
      )}

      {tareasQuery.isFetching && !tareasQuery.isLoading && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>Sincronizando tareas...</Typography>
      )}

      <CascadeConfirmDialog
        open={Boolean(cascadeTarget)}
        incompleteCount={cascadeTarget?.incompleteCount ?? 0}
        onClose={() => setCascadeTarget(null)}
        onOnlyTask={() => {
          if (cascadeTarget?.task) toggleMutation.mutate({ task: cascadeTarget.task, cascade: false });
          setCascadeTarget(null);
        }}
        onCascade={() => {
          if (cascadeTarget?.task) toggleMutation.mutate({ task: cascadeTarget.task, cascade: true });
          setCascadeTarget(null);
        }}
        theme={theme}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha("#EF4444", 0.12), color: "#EF4444" }}><WarningAmber /></Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar tarea</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Esta acción requiere confirmación</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
            ¿Seguro que querés eliminar <Box component="span" sx={{ color: "text.primary", fontWeight: 900 }}>{deleteTarget?.titulo}</Box>?
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

function PriorityChip({ priority, theme }) {
  const styles = priorityStyles(priority, theme);
  return (
    <Chip
      size="small"
      label={priority?.nombre ?? "Sin prioridad"}
      sx={{ bgcolor: styles.bg, color: styles.color, border: "1px solid", borderColor: styles.border, fontWeight: 800, height: 22, fontSize: "0.7rem" }}
    />
  );
}

function CascadeConfirmDialog({ open, incompleteCount, onClose, onOnlyTask, onCascade, theme }) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: "16px", p: 1, width: "100%", maxWidth: 500 } }}>
      <DialogTitle sx={{ display: "flex", gap: 1.5, alignItems: "center", pb: 1 }}>
        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
          <CheckCircle />
        </Avatar>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>¿Completar subtareas pendientes?</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Confirmación de completado en cascada</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
          Esta tarea tiene{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 900 }}>
            {incompleteCount}
          </Box>{" "}
          subtareas sin completar. ¿Querés marcarlas todas como completadas también?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: "wrap" }}>
        <Button variant="outlined" color="inherit" onClick={onClose} sx={{ borderRadius: "10px", fontWeight: 800 }}>
          Cancelar
        </Button>
        <Button variant="outlined" onClick={onOnlyTask} sx={{ borderRadius: "10px", fontWeight: 900 }}>
          Solo la tarea
        </Button>
        <Button variant="contained" onClick={onCascade} sx={{ borderRadius: "10px", fontWeight: 900 }}>
          Sí, completar todo
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TaskMeta({ task, cliente, caso, showDate = true, currentPath }) {
  const overdue = isOverdue(task);
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
      {showDate && (
        <Typography variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: overdue ? "error.main" : "text.secondary", fontWeight: 800, whiteSpace: "nowrap" }}>
          {overdue ? <ErrorOutline sx={{ fontSize: 15 }} /> : <CalendarToday sx={{ fontSize: 14 }} />}
          {formatFriendlyDate(task.fechaLimite)}
        </Typography>
      )}
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
              maxWidth: 180,
              display: "inline-block"
            }}
            onClick={(event) => event.stopPropagation()}
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
              display: "inline-flex",
              alignItems: "center",
              gap: 0.35,
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 220
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <FolderOpen sx={{ fontSize: 15, flexShrink: 0 }} />
            <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {casoCaratulaLabel(caso)}
            </Box>
          </Link>
        </Tooltip>
      )}
    </Stack>
  );
}

function ChecklistProgress({ task, compact = false }) {
  const stats = checklistStats(task);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: compact ? 72 : 120 }}>
      <LinearProgress variant="determinate" value={stats.percent} sx={{ flex: 1, height: 6, borderRadius: 99 }} />
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }}>{stats.done}/{stats.total}</Typography>
    </Stack>
  );
}

function TaskCard({ task, theme, priority, cliente, caso, currentPath, onOpen, onToggle, onEdit, onDelete, canEditar = true, canEliminar = true, disabled }) {
  return (
    <Card elevation={0} sx={{ height: "100%", border: "1px solid", borderColor: isOverdue(task) ? alpha(theme.palette.error.main, 0.45) : "divider", borderRadius: "16px", cursor: "pointer", transition: "transform 0.16s ease, border-color 0.16s ease", "&:hover": { transform: "translateY(-3px)", borderColor: "primary.main" } }} onClick={onOpen}>
      <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Checkbox checked={Boolean(task.completada)} disabled={disabled} onClick={(event) => event.stopPropagation()} onChange={onToggle} sx={{ p: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.25, textDecoration: task.completada ? "line-through" : "none", color: task.completada ? "text.secondary" : "text.primary" }}>{task.titulo}</Typography>
              {task.descripcion && <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }} noWrap>{task.descripcion}</Typography>}
            </Box>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <PriorityChip priority={priority} theme={theme} />
            <ChecklistProgress task={task} />
          </Stack>
          <TaskMeta task={task} cliente={caso ? undefined : cliente} caso={caso} currentPath={currentPath} />
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

function TaskTable({
  tasks,
  totalCount,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  orderBy,
  order,
  handleRequestSort,
  theme,
  prioridadesById,
  clientesById,
  expedientesById,
  currentPath,
  onOpen,
  onToggle,
  onEdit,
  onDelete,
  canEditar = true,
  canEliminar = true,
  disabled
}) {
  const columns = [
    { id: "titulo", label: "Tarea", sortable: true },
    { id: "prioridad", label: "Prioridad", width: 130, sortable: true },
    { id: "vencimiento", label: "Vencimiento", width: 140, sortable: true },
    { id: "vinculacion", label: "Expte / Cliente", width: 220, sortable: true },
    { id: "checklist", label: "Checklist", width: 130, sortable: false },
    { id: "acciones", label: "Acciones", width: 100, sortable: false }
  ];

  return (
    <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <TableContainer>
        <Table size="small" sx={{ ...denseTableSx, tableLayout: "fixed", minWidth: 900 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
              {columns.map((column) => {
                const isSortable = column.sortable !== false;
                return (
                  <TableCell
                    key={column.id}
                    sortDirection={orderBy === column.id ? order : false}
                    sx={{ ...tableHeadCellSx, width: column.width }}
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
            {tasks.map((task) => {
              const cliente = clientesById.get(Number(task.clienteId));
              const caso = expedientesById.get(Number(task.casoId));
              return (
                <TableRow
                  key={task.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => onOpen(task)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                      <Checkbox
                        checked={Boolean(task.completada)}
                        disabled={disabled}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => onToggle(event, task)}
                        size="small"
                        sx={{ p: 0.25 }}
                      />
                      <Tooltip title={task.descripcion || task.titulo}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontWeight: 800,
                            fontSize: "0.8125rem",
                            textDecoration: task.completada ? "line-through" : "none",
                            color: task.completada ? "text.secondary" : "text.primary"
                          }}
                        >
                          {task.titulo}
                        </Typography>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <PriorityChip priority={prioridadesById.get(Number(task.prioridadId))} theme={theme} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography
                      variant="caption"
                      sx={{ color: isOverdue(task) ? "error.main" : "text.secondary", fontWeight: 800, whiteSpace: "nowrap", fontSize: "0.8125rem" }}
                    >
                      {formatFriendlyDate(task.fechaLimite)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240, whiteSpace: "nowrap" }}>
                    <TaskMeta task={task} cliente={caso ? undefined : cliente} caso={caso} showDate={false} currentPath={currentPath} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <ChecklistProgress task={task} compact />
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()} sx={{ whiteSpace: "nowrap" }}>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" color="primary" sx={{ p: 0.5 }} onClick={(event) => onEdit(event, task)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" sx={{ p: 0.5 }} onClick={(event) => onDelete(event, task)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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
