import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { usePermisos } from "../auth/usePermissions";
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
  Business,
  Delete,
  Download,
  Edit,
  Email,
  FolderOpen,
  Person,
  PhoneIphone,
  Search,
  WarningAmber,
} from "@mui/icons-material";

const AVATAR_COLORS = ["#6366F1", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#10B981"];
const TIPO_PERSONA_FISICA_ID = 143;
const TIPO_PERSONA_JURIDICA_ID = 144;

function isPersonaFisicaId(value) {
  return Number(value) === TIPO_PERSONA_FISICA_ID;
}

function nullableString(value) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableIsoDateTime(value) {
  const text = nullableString(value);
  if (!text) return null;
  if (text.includes("T")) return text;
  return `${text}T00:00:00.000Z`;
}

function compactJoin(parts, separator = " ") {
  return parts.filter(Boolean).join(separator);
}

function buildDireccion(c) {
  const calle = compactJoin([c.dirCalle, c.dirNro]);
  const piso = c.dirPiso ? `Piso ${c.dirPiso}` : "";
  const depto = c.dirDepto ? `Depto ${c.dirDepto}` : "";
  return [calle, piso, depto].filter(Boolean).join(", ");
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

function getAvatarColor(name = "") {
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function mapDbToFrontend(c) {
  const isFisica = isPersonaFisicaId(c.tipoPersonaId);
  const nombre = isFisica
    ? compactJoin([c.nombre, c.apellido])
    : c.razonSocial ?? "";

  return {
    ...c,
    nombre,
    tipo: isFisica ? "fisica" : "juridica",
    identificacion: c.cuit || c.dni || "",
    telefono: c.telCelular || c.telFijo || "",
    direccion: buildDireccion(c),
    notas: c.observaciones ?? "",
    casosActivos: c.casosActivos ?? 0,
    activo: c.activo ?? true,
  };
}

export function mapFrontendToDb(form) {
  const isFisica = form.tipo === "fisica" || isPersonaFisicaId(form.tipoPersonaId);
  let nombre = nullableString(form.nombre);
  let apellido = nullableString(form.apellido);

  if (isFisica && nombre && !apellido) {
    const parts = nombre.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      apellido = parts.slice(1).join(" ");
      nombre = parts[0];
    } else {
      apellido = ".";
    }
  }

  return {
    tipoPersonaId: isFisica ? TIPO_PERSONA_FISICA_ID : TIPO_PERSONA_JURIDICA_ID,
    nombre: isFisica ? nombre : null,
    apellido: isFisica ? apellido : null,
    razonSocial: isFisica ? null : nullableString(form.razonSocial),
    dni: isFisica ? nullableString(form.dni) : null,
    cuit: nullableString(form.cuit),
    fechaNacimiento: nullableIsoDateTime(form.fechaNacimiento),
    email: nullableString(form.email),
    telFijo: nullableString(form.telFijo),
    telCelular: nullableString(form.telCelular),
    dirCalle: nullableString(form.dirCalle),
    dirNro: nullableString(form.dirNro),
    dirPiso: nullableString(form.dirPiso),
    dirDepto: nullableString(form.dirDepto),
    codigoPostal: nullableString(form.codigoPostal),
    provinciaId: nullableNumber(form.provinciaId),
    localidadId: nullableNumber(form.localidadId),
    observaciones: nullableString(form.observaciones),
    activo: form.activo ?? true,
  };
}

export default function Clientes() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear, canEditar, canEliminar } = usePermisos("CLIENTES");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [orderBy, setOrderBy] = useState("nombre");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data: clientes = [], isLoading, isFetching } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await api.get("/clientes", { params: { limit: 100 } });
      const rawItems = Array.isArray(data) ? data : (data?.data?.items ?? data?.data ?? []);
      const itemsArray = Array.isArray(rawItems) ? rawItems : [];
      return itemsArray.map(mapDbToFrontend);
    },
    staleTime: 1000 * 60 * 2,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/clientes/${id}`);
      return id;
    },
    onSuccess: () => {
      enqueueSnackbar("Cliente eliminado correctamente", { variant: "success" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo eliminar el cliente", { variant: "error" });
    },
  });

  const filteredClientes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientes.filter((cliente) => {
      const searchable = [
        cliente.nombre,
        cliente.identificacion,
        cliente.email,
        cliente.telCelular,
        cliente.telFijo,
        cliente.telefono,
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || searchable.includes(q);
      const matchesType = typeFilter === "all" || cliente.tipo === typeFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? cliente.activo : !cliente.activo);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [clientes, search, statusFilter, typeFilter]);

  const sortedClientes = useMemo(() => {
    const comparator = (a, b) => {
      let valA = a[orderBy];
      let valB = b[orderBy];

      if (orderBy === "activo") {
        valA = a.activo ? 1 : 0;
        valB = b.activo ? 1 : 0;
      }
      if (orderBy === "tipo") {
        valA = a.tipo || "";
        valB = b.tipo || "";
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === "string") {
        return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      }

      return valA < valB ? -1 : 1;
    };

    const stabilized = [...filteredClientes].sort((a, b) => {
      const cmp = comparator(a, b);
      return order === "desc" ? -cmp : cmp;
    });

    return stabilized;
  }, [filteredClientes, orderBy, order]);

  const paginatedClientes = useMemo(() => {
    return sortedClientes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedClientes, page, rowsPerPage]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    setPage(0);
  };

  const applyScreenFilters = (items) => {
    const q = search.trim().toLowerCase();
    return items.filter((cliente) => {
      const searchable = [
        cliente.nombre,
        cliente.identificacion,
        cliente.email,
        cliente.telCelular,
        cliente.telFijo,
        cliente.telefono,
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !q || searchable.includes(q);
      const matchesType = typeFilter === "all" || cliente.tipo === typeFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? cliente.activo : !cliente.activo);
      return matchesSearch && matchesType && matchesStatus;
    });
  };

  async function handleExportExcel() {
    try {
      const { data } = await api.get("/clientes", { params: { limit: 100, search: search.trim() || undefined } });
      const rawItems = Array.isArray(data) ? data : (data?.data?.items ?? data?.data ?? []);
      const itemsArray = Array.isArray(rawItems) ? rawItems : [];
      const exportItems = applyScreenFilters(itemsArray.map(mapDbToFrontend));
      const rows = exportItems.map((cliente) => ({
        "Nombre/Apellido / Razón Social": cliente.nombre || "",
        "CUIT / Identificación": cliente.identificacion || "",
        Email: cliente.email || "",
        "Teléfono": cliente.telefono || "",
        Estado: cliente.activo ? "Activo" : "Inactivo",
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `clientes_${today}.xlsx`);
      enqueueSnackbar("Exportación generada correctamente", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.error?.message ?? "No se pudo exportar el listado", { variant: "error" });
    }
  }

  const goToEdit = (id) => navigate(`/clientes/editar/${id}`);

  const panelSx = {
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: "background.paper",
    boxShadow: "none",
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0 }}>
            Clientes
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Administración integral de personas físicas y jurídicas.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportExcel}
            sx={{ borderRadius: "10px", fontWeight: 800 }}
          >
            Exportar
          </Button>
          {canCrear && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate("/clientes/nuevo")}
              sx={{ borderRadius: "10px", fontWeight: 800 }}
            >
              Nuevo Cliente
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ ...panelSx, p: 2, borderRadius: "16px", mb: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            placeholder="Buscar por nombre, identificación, mail o teléfono"
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 170 } }}>
            <InputLabel>Tipo</InputLabel>
            <Select label="Tipo" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(0); }}>
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="fisica">Física</MenuItem>
              <MenuItem value="juridica">Jurídica</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 160 } }}>
            <InputLabel>Estado</InputLabel>
            <Select label="Estado" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="active">Activos</MenuItem>
              <MenuItem value="inactive">Inactivos</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredClientes.length === 0 ? (
        <Paper elevation={0} sx={{ ...panelSx, p: 5, borderRadius: "16px", textAlign: "center" }}>
          <Person sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            No hay clientes para mostrar
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Probá ajustar la búsqueda o registrá un nuevo cliente.
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {paginatedClientes.map((cliente) => (
            <Card 
              key={cliente.id} 
              elevation={0} 
              sx={{ ...panelSx, borderRadius: "16px", cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
              onClick={() => navigate(`/clientes/${cliente.id}`)}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: getAvatarColor(cliente.nombre), fontWeight: 900, width: 32, height: 32, fontSize: "0.85rem" }}>
                    {getInitials(cliente.nombre)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                      {cliente.nombre || "Sin nombre"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {cliente.identificacion || "Sin identificación"}
                    </Typography>
                  </Box>
                  <Chip size="small" label={cliente.activo ? "Activo" : "Inactivo"} color={cliente.activo ? "success" : "default"} sx={{ fontWeight: 800 }} />
                </Stack>
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  {cliente.email && (
                    <Typography component="a" href={`mailto:${cliente.email}`} variant="body2" sx={{ color: "primary.main", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
                      <Email sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.75 }} />
                      {cliente.email}
                    </Typography>
                  )}
                  {cliente.telefono && (
                    <Typography component="a" href={`tel:${cliente.telefono}`} variant="body2" sx={{ color: "text.secondary", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
                      <PhoneIphone sx={{ fontSize: 16, verticalAlign: "text-bottom", mr: 0.75 }} />
                      {cliente.telefono}
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }} onClick={(e) => e.stopPropagation()}>
                  <Chip icon={<FolderOpen />} size="small" label={`${cliente.casosActivos} expedientes`} sx={{ fontWeight: 800 }} />
                  <Box>
                    {canEditar && (
                      <IconButton color="primary" onClick={() => goToEdit(cliente.id)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    )}
                    {canEliminar && (
                      <IconButton color="error" onClick={() => setDeleteTarget(cliente)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
          <TablePagination
            component="div"
            count={filteredClientes.length}
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
        <Paper elevation={0} sx={{ ...panelSx, borderRadius: "16px", overflow: "hidden" }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                  {[
                    { id: "nombre", label: "Nombre" },
                    { id: "identificacion", label: "Identificación" },
                    { id: "telCelular", label: "Celular" },
                    { id: "email", label: "Email" },
                    { id: "casosActivos", label: "Expedientes Activos" },
                    { id: "activo", label: "Estado" },
                    { id: "acciones", label: "Acciones" }
                  ].map((column) => {
                    const isSortable = column.id !== "acciones";
                    return (
                      <TableCell
                        key={column.id}
                        sortDirection={orderBy === column.id ? order : false}
                        sx={{
                          fontWeight: 900,
                          color: "text.secondary",
                          fontSize: "0.72rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase"
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
                {paginatedClientes.map((cliente) => (
                  <TableRow
                    key={cliente.id}
                    hover
                    sx={{
                      cursor: "pointer",
                      "& td": { py: 0.75, px: 2 }
                    }}
                    onClick={() => navigate(`/clientes/${cliente.id}`)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ bgcolor: getAvatarColor(cliente.nombre), fontWeight: 900, width: 32, height: 32, fontSize: "0.85rem" }}>
                          {getInitials(cliente.nombre)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {cliente.nombre || "Sin nombre"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{cliente.identificacion || "Sin dato"}</TableCell>
                    <TableCell>
                      {cliente.telCelular ? (
                        <Typography
                          component="a"
                          href={`tel:${cliente.telCelular}`}
                          variant="caption"
                          onClick={(event) => event.stopPropagation()}
                          sx={{
                            color: "text.primary",
                            textDecoration: "none",
                            fontWeight: 800,
                            whiteSpace: "nowrap"
                          }}
                        >
                          {cliente.telCelular}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                          Sin celular
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {cliente.email ? (
                        <Typography
                          component="a"
                          href={`mailto:${cliente.email}`}
                          variant="caption"
                          onClick={(event) => event.stopPropagation()}
                          sx={{
                            color: "primary.main",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 180,
                            display: "inline-block"
                          }}
                        >
                          {cliente.email}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                          Sin email
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip icon={<FolderOpen />} size="small" label={cliente.casosActivos} sx={{ fontWeight: 900 }} />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={cliente.activo ? "Activo" : "Inactivo"} color={cliente.activo ? "success" : "default"} sx={{ fontWeight: 900 }} />
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {canEditar && (
                        <Tooltip title="Editar">
                          <IconButton size="small" color="primary" onClick={() => goToEdit(cliente.id)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEliminar && (
                        <Tooltip title="Eliminar">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(cliente)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredClientes.length}
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

      {isFetching && !isLoading && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
          Sincronizando clientes...
        </Typography>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420 } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: alpha("#EF4444", 0.12), color: "#EF4444" }}>
            <WarningAmber />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>Eliminar cliente</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Esta acción requiere confirmación</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
            ¿Seguro que querés eliminar a <Box component="span" sx={{ color: "text.primary", fontWeight: 900 }}>{deleteTarget?.nombre}</Box>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={() => deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
            {deleteMutation.isPending ? <CircularProgress size={20} color="inherit" /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
