import { useMemo, useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import * as XLSX from "xlsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { usePermisos } from "../auth/usePermissions";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import api from "../api/axios";
import { fetchAllPages, unwrapPaged } from "../api/pagination";
import { useDebounced } from "../hooks/useDebounced";
import SisfeSyncButton from "../components/SisfeSyncButton";
import { denseTableSx } from "../theme/tableStyles";
import {
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
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
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
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  Delete,
  Download,
  Edit,
  FolderOpen,
  Search,
  Visibility,
  WarningAmber,
} from "@mui/icons-material";

function unwrapData(data) {
  return Array.isArray(data?.data) ? data.data : [];
}

function clienteNombre(cliente) {
  if (!cliente) return "Sin cliente";
  return cliente.razonSocial || [cliente.apellido, cliente.nombre].filter(Boolean).join(", ") || cliente.nombre || "Sin cliente";
}

function estadoColor(nombre = "") {
  const text = nombre.toLowerCase();
  if (text.includes("final")) return "success";
  if (text.includes("apel")) return "warning";
  if (text.includes("arch")) return "default";
  if (text.includes("trámite") || text.includes("tramite")) return "info";
  return "primary";
}

export default function Expedientes() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear, canEditar, canEliminar } = usePermisos("CASOS");

  const [search, setSearch] = useState("");
  const [ramaFilter, setRamaFilter] = useState("all");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [radicacionFilter, setRadicacionFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [orderBy, setOrderBy] = useState("caratula");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const debouncedSearch = useDebounced(search);

  const listParams = useMemo(() => ({
    page: page + 1,
    limit: rowsPerPage,
    search: debouncedSearch.trim() || undefined,
    ramaId: ramaFilter === "all" ? undefined : Number(ramaFilter),
    estadoId: estadoFilter === "all" ? undefined : Number(estadoFilter),
    radicacionParentId: radicacionFilter === "all" ? undefined : Number(radicacionFilter),
    orderBy,
    order,
  }), [page, rowsPerPage, debouncedSearch, ramaFilter, estadoFilter, radicacionFilter, orderBy, order]);

  const casosQuery = useQuery({
    queryKey: ["expedientes", "list", listParams],
    queryFn: async () => {
      const { data } = await api.get("/expedientes", { params: listParams });
      return unwrapPaged(data);
    },
    placeholderData: (previous) => previous,
  });

  const clientesQuery = useQuery({
    queryKey: ["clientes", "lookup"],
    queryFn: () => fetchAllPages("/clientes"),
    staleTime: 1000 * 60 * 5,
  });

  const useCatalogQuery = (categoria) => useQuery({
    queryKey: ["catalogos", "parametros", categoria],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria } });
      return unwrapData(data);
    },
    staleTime: 1000 * 60 * 30,
  });

  const ramasQuery = useCatalogQuery("RAMA_DERECHO");
  const tiposQuery = useCatalogQuery("TIPO_CASO");
  const estadosQuery = useCatalogQuery("ESTADO_CASO");
  const radicacionesQuery = useCatalogQuery("RADICACION");
  const localidadesRadicacionQuery = useCatalogQuery("LOCALIDAD_RADICACION");

  const ramas = useMemo(() => ramasQuery.data ?? [], [ramasQuery.data]);
  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data]);
  const estados = useMemo(() => estadosQuery.data ?? [], [estadosQuery.data]);
  const radicaciones = useMemo(() => radicacionesQuery.data ?? [], [radicacionesQuery.data]);
  const localidadesRadicacion = useMemo(() => localidadesRadicacionQuery.data ?? [], [localidadesRadicacionQuery.data]);

  const clientesById = useMemo(() => new Map((clientesQuery.data ?? []).map((c) => [c.id, c])), [clientesQuery.data]);
  const tiposById = useMemo(() => new Map(tipos.map((p) => [p.id, p])), [tipos]);
  const estadosById = useMemo(() => new Map(estados.map((p) => [p.id, p])), [estados]);
  const radicacionesById = useMemo(() => new Map(radicaciones.map((p) => [p.id, p])), [radicaciones]);

  const casos = casosQuery.data?.items ?? [];
  const totalCount = casosQuery.data?.meta?.total ?? 0;
  const displayRows = casos;

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    setPage(0);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/expedientes/${id}`),
    onSuccess: () => {
      enqueueSnackbar("Expediente eliminado correctamente", { variant: "success" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["expedientes"] });
    },
    onError: (error) => enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar el expediente", { variant: "error" }),
  });

  const loading = casosQuery.isLoading;

  async function handleExportExcel() {
    try {
      const exportBase = {
        limit: 100,
        search: search.trim() || undefined,
        ramaId: ramaFilter === "all" ? undefined : Number(ramaFilter),
        estadoId: estadoFilter === "all" ? undefined : Number(estadoFilter),
        radicacionParentId: radicacionFilter === "all" ? undefined : Number(radicacionFilter),
      };
      const allCasos = await fetchAllPages("/expedientes", exportBase);
      const exportRows = allCasos.map((caso) => {
        const cliente = clientesById.get(caso.clienteId);
        const tipo = tiposById.get(caso.tipoId);
        const rama = ramas.find((r) => r.id === tipo?.parentId);
        const estado = estadosById.get(caso.estadoId);
        const radicacion = radicacionesById.get(caso.radicacionId);

        return {
          "Carátula": caso.caratula || "",
          "Cliente": clienteNombre(cliente),
          "Nro. Expediente": caso.nroExpte || "Sin número",
          "Tipo de Caso": tipo?.nombre || "Sin tipo",
          "Rama del Derecho": rama?.nombre || "Sin rama",
          "Juzgado / Radicación": radicacion?.nombre || "Sin radicación",
          "Estado": estado?.nombre || "Sin estado",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expedientes");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `expedientes_${today}.xlsx`);
      enqueueSnackbar("Exportación generada correctamente", { variant: "success" });
    } catch {
      enqueueSnackbar("No se pudo exportar el listado", { variant: "error" });
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Expedientes</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>CRM operativo del estudio jurídico.</Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <SisfeSyncButton sx={{ width: { xs: "100%", sm: "auto" } }} />
          <Button variant="outlined" startIcon={<Download />} onClick={handleExportExcel} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            Exportar
          </Button>
          {canCrear && (
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate("/expedientes/nuevo")} sx={{ borderRadius: "10px", fontWeight: 900 }}>
              Nuevo Expediente
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: "16px", border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
          <TextField
            size="small"
            placeholder="Buscar por carátula, expediente o cliente"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            sx={{ flex: 1 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
          />
          <FilterSelect label="Rama" value={ramaFilter} onChange={(val) => { setRamaFilter(val); setPage(0); }} items={ramas} allLabel="Todas" />
          <FilterSelect label="Estado" value={estadoFilter} onChange={(val) => { setEstadoFilter(val); setPage(0); }} items={estados} allLabel="Todos" />
          <FilterSelect label="Radicación" value={radicacionFilter} onChange={(val) => { setRadicacionFilter(val); setPage(0); }} items={localidadesRadicacion} allLabel="Todas" />
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : totalCount === 0 && !casosQuery.isFetching ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: "16px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <FolderOpen sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            No hay expedientes para mostrar
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Probá ajustar los filtros o registrá un nuevo expediente.
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {displayRows.map((caso) => {
            const cliente = clientesById.get(caso.clienteId);
            const estado = estadosById.get(caso.estadoId);
            return (
              <Card 
                key={caso.id} 
                elevation={0} 
                sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
                onClick={() => navigate(`/expedientes/${caso.id}`)}
              >
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{caso.caratula}</Typography>
                  <Stack direction="row" spacing={1} sx={{ my: 1 }} alignItems="center" onClick={(e) => e.stopPropagation()}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: 13 }}>{clienteNombre(cliente)[0] ?? "C"}</Avatar>
                    <Link
                      component={RouterLink}
                      to={`/clientes/${caso.clienteId}`}
                      variant="body2"
                      sx={{ fontWeight: 800, textDecoration: "none", color: "primary.main", "&:hover": { textDecoration: "underline" } }}
                    >
                      {clienteNombre(cliente)}
                    </Link>
                  </Stack>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Expediente: {caso.nroExpte || "Sin número"}</Typography>
                  <Box sx={{ mt: 1 }}>
                    {estado && <Chip size="small" color={estadoColor(estado.nombre)} label={estado.nombre} sx={{ fontWeight: 800 }} />}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
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
        <Paper elevation={0} sx={{ borderRadius: "16px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <TableContainer>
            <Table size="small" sx={denseTableSx}>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  {[
                    { id: "caratula", label: "Carátula" },
                    { id: "cliente", label: "Cliente" },
                    { id: "nroExpte", label: "Expediente" },
                    { id: "tipo", label: "Tipo de Caso" },
                    { id: "juzgado", label: "Juzgado" },
                    { id: "estado", label: "Estado" },
                    { id: "acciones", label: "Acciones" }
                  ].map((column) => {
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
                {displayRows.map((caso) => {
                  const cliente = clientesById.get(caso.clienteId);
                  const tipo = tiposById.get(caso.tipoId);
                  const estado = estadosById.get(caso.estadoId);
                  const radicacion = radicacionesById.get(caso.radicacionId);
                  return (
                    <TableRow
                      key={caso.id}
                      hover
                      sx={{
                        cursor: "pointer",
                        "& td": { py: 0.75, px: 2 }
                      }}
                      onClick={() => navigate(`/expedientes/${caso.id}`)}
                    >
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontWeight: 800,
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {caso.caratula}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()} sx={{ maxWidth: 180 }}>
                        <Link
                          component={RouterLink}
                          to={`/clientes/${caso.clienteId}`}
                          noWrap
                          sx={{
                            fontWeight: 800,
                            textDecoration: "none",
                            color: "primary.main",
                            display: "block",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            "&:hover": { textDecoration: "underline" }
                          }}
                        >
                          {clienteNombre(cliente)}
                        </Link>
                      </TableCell>
                      <TableCell>{caso.nroExpte || "Sin número"}</TableCell>
                      <TableCell>{tipo?.nombre || "Sin tipo"}</TableCell>
                      <TableCell>{radicacion?.nombre || "Sin radicación"}</TableCell>
                      <TableCell>{estado ? <Chip size="small" color={estadoColor(estado.nombre)} label={estado.nombre} sx={{ fontWeight: 800 }} /> : "Sin estado"}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        {canEditar && <Tooltip title="Editar"><IconButton size="small" color="primary" onClick={() => navigate(`/expedientes/editar/${caso.id}`)}><Edit fontSize="small" /></IconButton></Tooltip>}
                        {canEliminar && <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => setDeleteTarget(caso)}><Delete fontSize="small" /></IconButton></Tooltip>}
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
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", maxWidth: 420 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha("#EF4444", 0.12), color: "#EF4444" }}><WarningAmber /></Avatar>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar expediente</Typography>
        </DialogTitle>
        <DialogContent><Typography variant="body2" sx={{ color: "text.secondary" }}>¿Seguro que querés eliminar este expediente?</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function FilterSelect({ label, value, onChange, items, allLabel }) {
  return (
    <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 190 } }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <MenuItem value="all">{allLabel}</MenuItem>
        {items.map((item) => <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>)}
      </Select>
    </FormControl>
  );
}
