import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField,
  Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Add, ArrowBack, Business, Delete, Edit, Person, Save, Search } from "@mui/icons-material";
import api from "../api/axios";
import { createTercero, deleteTercero, fetchTerceros, updateTercero } from "../api/terceros";
import { useDebounced } from "../hooks/useDebounced";
import { usePermisos } from "../auth/usePermissions";

const EMPTY = {
  tipo: "fisica",
  nombre: "",
  apellido: "",
  razonSocial: "",
  dni: "",
  cuit: "",
  email: "",
  telefono: "",
  dirCalle: "",
  dirNro: "",
  dirPiso: "",
  dirDepto: "",
  codigoPostal: "",
  provinciaId: "",
  localidadId: "",
  fechaNacimiento: "",
  observaciones: "",
};

function label(t) {
  return t?.razonSocial || [t?.nombre, t?.apellido].filter(Boolean).join(" ") || `Contacto #${t?.id}`;
}

const panelSx = {
  border: "1px solid",
  borderColor: "divider",
  backgroundColor: "background.paper",
  boxShadow: "none",
};

function apiError(error, fallback) {
  return error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;
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

export default function Terceros() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear, canEditar, canEliminar } = usePermisos("TERCEROS");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [orderBy, setOrderBy] = useState("contacto");
  const [order, setOrder] = useState("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const debouncedSearch = useDebounced(search);

  const listParams = useMemo(() => ({
    page: page + 1,
    limit: rowsPerPage,
    search: debouncedSearch.trim() || undefined,
  }), [page, rowsPerPage, debouncedSearch]);

  const tercerosQuery = useQuery({
    queryKey: ["terceros", "list", listParams],
    queryFn: () => fetchTerceros(listParams),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  const tipoPersonaQuery = useQuery({
    queryKey: ["catalogos", "parametros", "TIPO_PERSONA"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "TIPO_PERSONA" } });
      return data?.data ?? data ?? [];
    },
    staleTime: 300_000,
  });
  const provinciasQuery = useQuery({
    queryKey: ["catalogos", "provincias"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/provincias");
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 300_000,
  });
  const localidadesQuery = useQuery({
    queryKey: ["catalogos", "localidades", form.provinciaId || "all"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/localidades", {
        params: form.provinciaId ? { provinciaId: form.provinciaId } : {},
      });
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 300_000,
  });

  const tipoFisicaId = useMemo(() => (tipoPersonaQuery.data ?? []).find((p) => /FISICA|HUMANA/i.test(`${p.codigo} ${p.nombre}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))?.id ?? 1, [tipoPersonaQuery.data]);
  const tipoJuridicaId = useMemo(() => (tipoPersonaQuery.data ?? []).find((p) => /JURIDICA/i.test(`${p.codigo} ${p.nombre}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "")))?.id ?? 2, [tipoPersonaQuery.data]);

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm(EMPTY);
      return;
    }
    setForm({
      tipo: editing.razonSocial ? "juridica" : "fisica",
      nombre: editing.nombre ?? "",
      apellido: editing.apellido ?? "",
      razonSocial: editing.razonSocial ?? "",
      dni: editing.dni ?? "",
      cuit: editing.cuit ?? "",
      email: editing.email ?? "",
      telefono: editing.telefono ?? "",
      dirCalle: editing.dirCalle ?? "",
      dirNro: editing.dirNro ?? "",
      dirPiso: editing.dirPiso ?? "",
      dirDepto: editing.dirDepto ?? "",
      codigoPostal: editing.codigoPostal ?? "",
      provinciaId: editing.provinciaId ?? "",
      localidadId: editing.localidadId ?? "",
      fechaNacimiento: editing.fechaNacimiento ? editing.fechaNacimiento.split("T")[0] : "",
      observaciones: editing.observaciones ?? "",
    });
  }, [editing, open]);

  const terceros = tercerosQuery.data?.items ?? [];
  const totalCount = tercerosQuery.data?.meta?.total ?? 0;

  const sorted = useMemo(() => {
    const getValue = (item) => {
      if (orderBy === "contacto") return label(item);
      if (orderBy === "identificacion") return item.cuit || item.dni || "";
      if (orderBy === "email") return item.email || "";
      if (orderBy === "telefono") return item.telefono || "";
      if (orderBy === "observaciones") return item.observaciones || "";
      return "";
    };

    return [...terceros].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      const result = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
      return order === "desc" ? -result : result;
    });
  }, [terceros, order, orderBy]);

  const displayRows = sorted;

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
    setPage(0);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        tipoPersonaId: form.tipo === "juridica" ? tipoJuridicaId : tipoFisicaId,
        nombre: form.tipo === "fisica" ? nullableString(form.nombre) : null,
        apellido: form.tipo === "fisica" ? nullableString(form.apellido) : null,
        razonSocial: form.tipo === "juridica" ? nullableString(form.razonSocial) : null,
        dni: form.tipo === "fisica" ? nullableString(form.dni) : null,
        cuit: nullableString(form.cuit),
        fechaNacimiento: form.tipo === "fisica" ? (form.fechaNacimiento ? `${form.fechaNacimiento}T00:00:00.000Z` : null) : null,
        email: nullableString(form.email),
        telefono: nullableString(form.telefono),
        dirCalle: nullableString(form.dirCalle),
        dirNro: nullableString(form.dirNro),
        dirPiso: nullableString(form.dirPiso),
        dirDepto: nullableString(form.dirDepto),
        codigoPostal: nullableString(form.codigoPostal),
        provinciaId: nullableNumber(form.provinciaId),
        localidadId: nullableNumber(form.localidadId),
        observaciones: nullableString(form.observaciones),
      };
      return editing ? updateTercero(editing.id, payload) : createTercero(payload);
    },
    onSuccess: () => {
      enqueueSnackbar(editing ? "Tercero actualizado" : "Tercero registrado", { variant: "success" });
      setOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["terceros"] });
    },
    onError: (error) => enqueueSnackbar(apiError(error, "No se pudo guardar el tercero"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTercero(id),
    onSuccess: () => {
      enqueueSnackbar("Tercero eliminado", { variant: "success" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["terceros"] });
    },
  });

  const setField = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "provinciaId" ? { localidadId: "", codigoPostal: "" } : {}),
    }));
  };

  return (
    <Box>
      {open ? (
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => {
              setOpen(false);
              setEditing(null);
            }}
            sx={{ alignSelf: "flex-start", fontWeight: 800 }}
          >
            Volver a Terceros
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {editing ? "Editar Tercero" : "Registrar Tercero"}
          </Typography>
        </Stack>
      ) : (
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Directorio de Terceros</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>Terceros del estudio: jueces, peritos, mediadores, letrados y entidades vinculadas.</Typography>
          </Box>
          {canCrear && <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setOpen(true); }} sx={{ borderRadius: "10px", fontWeight: 800 }}>Registrar Tercero</Button>}
        </Stack>
      )}

      {open ? (
        <Paper elevation={0} sx={{ ...panelSx, borderRadius: "16px", p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mb: 1 }}>Información Básica</Typography>
          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Persona</InputLabel>
                <Select label="Tipo de Persona" value={form.tipo} onChange={setField("tipo")}>
                  <MenuItem value="fisica">Persona Física</MenuItem>
                  <MenuItem value="juridica">Persona Jurídica</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {form.tipo === "fisica" ? (
              <>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth size="small" label="Nombre" value={form.nombre} onChange={setField("nombre")} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth size="small" label="Apellido" value={form.apellido} onChange={setField("apellido")} /></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth size="small" type="date" label="Fecha de Nacimiento" value={form.fechaNacimiento || ""} onChange={setField("fechaNacimiento")} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth size="small" label="DNI" value={form.dni} onChange={setField("dni")} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth size="small" label="CUIL / CUIT" value={form.cuit} onChange={setField("cuit")} /></Grid>
              </>
            ) : (
              <>
                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth size="small" label="Razón Social" value={form.razonSocial} onChange={setField("razonSocial")} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth size="small" label="CUIT" value={form.cuit} onChange={setField("cuit")} /></Grid>
              </>
            )}
          </Grid>

          <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mt: 3, mb: 1 }}>Datos de Contacto</Typography>
          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth size="small" type="email" label="Correo Electrónico" value={form.email} onChange={setField("email")} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth size="small" label="Teléfono" value={form.telefono} onChange={setField("telefono")} /></Grid>
          </Grid>

          <Typography variant="subtitle1" sx={{ color: "primary.main", fontWeight: 900, mt: 3, mb: 1 }}>Domicilio y Otros</Typography>
          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth size="small" label="Calle" value={form.dirCalle} onChange={setField("dirCalle")} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth size="small" label="Altura / Nro" value={form.dirNro} onChange={setField("dirNro")} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth size="small" label="Piso" value={form.dirPiso} onChange={setField("dirPiso")} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth size="small" label="Depto / Oficina" value={form.dirDepto} onChange={setField("dirDepto")} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Provincia</InputLabel>
                <Select label="Provincia" value={form.provinciaId} onChange={setField("provinciaId")}>
                  <MenuItem value="">Sin provincia</MenuItem>
                  {(provinciasQuery.data ?? []).map((provincia) => (
                    <MenuItem key={provincia.id} value={provincia.id}>
                      {provincia.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small" disabled={!form.provinciaId}>
                <InputLabel>Localidad</InputLabel>
                <Select
                  label="Localidad"
                  value={form.localidadId}
                  onChange={(event) => {
                    const value = event.target.value;
                    const selected = (localidadesQuery.data ?? []).find((loc) => loc.id === value);
                    setForm((current) => ({
                      ...current,
                      localidadId: value,
                      codigoPostal: selected?.codigoPostal ?? "",
                    }));
                  }}
                >
                  <MenuItem value="">Sin localidad</MenuItem>
                  {(localidadesQuery.data ?? []).map((localidad) => (
                    <MenuItem key={localidad.id} value={localidad.id}>
                      {localidad.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth size="small" label="Código Postal" value={form.codigoPostal} InputProps={{ readOnly: true }} helperText="Se completa automáticamente según la localidad" /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={4} size="small" label="Observaciones" value={form.observaciones} onChange={setField("observaciones")} /></Grid>
          </Grid>

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" spacing={1.2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
              sx={{ borderRadius: "10px", fontWeight: 800 }}
            >
              Cancelar
            </Button>
            <Button variant="contained" startIcon={!saveMutation.isPending ? <Save /> : null} onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} sx={{ borderRadius: "10px", fontWeight: 900 }}>
              {saveMutation.isPending ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Tercero"}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <>
      <Paper elevation={0} sx={{ ...panelSx, p: 2, borderRadius: "16px", mb: 2.5 }}>
        <TextField fullWidth size="small" placeholder="Buscar por nombre, email o teléfono..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: "text.disabled" }} /> }} />
      </Paper>
      {totalCount === 0 && !tercerosQuery.isFetching ? (
        <Paper elevation={0} sx={{ ...panelSx, p: 5, borderRadius: "16px", textAlign: "center" }}>
          <Person sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            No hay terceros para mostrar
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Probá ajustar la búsqueda o registrá un nuevo tercero.
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {displayRows.map((t) => {
            const isJuridica = Boolean(t.razonSocial);
            const tone = isJuridica ? theme.palette.secondary.main : theme.palette.primary.main;
            return (
              <Paper key={t.id} elevation={0} sx={{ ...panelSx, borderRadius: "16px", p: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Avatar sx={{ bgcolor: alpha(tone, 0.12), color: tone }}>
                      {isJuridica ? <Business /> : <Person />}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
                        {label(t)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        {t.cuit || t.dni || "—"}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack spacing={0.4}>
                    {t.email && (
                      <Typography
                        component="a"
                        href={`mailto:${t.email}`}
                        variant="body2"
                        onClick={(event) => event.stopPropagation()}
                        sx={{ color: "primary.main", fontWeight: 700, textDecoration: "none" }}
                      >
                        {t.email}
                      </Typography>
                    )}
                    {t.telefono && (
                      <Typography
                        component="a"
                        href={`tel:${t.telefono}`}
                        variant="body2"
                        onClick={(event) => event.stopPropagation()}
                        sx={{ color: "text.secondary", fontWeight: 600, textDecoration: "none" }}
                      >
                        {t.telefono}
                      </Typography>
                    )}
                  </Stack>

                  <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                      Observaciones
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.35 }}>
                      {t.observaciones || "—"}
                    </Typography>
                  </Box>

                  {(canEditar || canEliminar) && (
                    <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                      {canEditar && <Tooltip title="Editar"><IconButton onClick={() => { setEditing(t); setOpen(true); }}><Edit /></IconButton></Tooltip>}
                      {canEliminar && <Tooltip title="Eliminar"><IconButton color="error" onClick={() => setDeleteTarget(t)}><Delete /></IconButton></Tooltip>}
                    </Stack>
                  )}
                </Stack>
              </Paper>
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
        <Paper elevation={0} sx={{ ...panelSx, borderRadius: "16px", overflow: "hidden" }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                  {[
                    { id: "contacto", label: "Nombre / Razón Social" },
                    { id: "identificacion", label: "Identificación" },
                    { id: "email", label: "Email" },
                    { id: "telefono", label: "Teléfono" },
                    { id: "observaciones", label: "Observaciones" },
                    { id: "acciones", label: "Acciones", align: "right" },
                  ].map((column) => {
                    const isSortable = column.id !== "acciones";
                    return (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        sortDirection={orderBy === column.id ? order : false}
                        sx={{
                          fontWeight: 800,
                          color: "text.secondary",
                          fontSize: "0.72rem",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {isSortable ? (
                          <TableSortLabel
                            active={orderBy === column.id}
                            direction={orderBy === column.id ? order : "asc"}
                            onClick={() => handleRequestSort(column.id)}
                            sx={{
                              "&.MuiTableSortLabel-active": { color: "text.primary" },
                              "& .MuiTableSortLabel-icon": { color: "text.secondary" },
                            }}
                          >
                            {column.label}
                          </TableSortLabel>
                        ) : column.label}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayRows.map((t) => {
                  const isJuridica = Boolean(t.razonSocial);
                  const tone = isJuridica ? theme.palette.secondary.main : theme.palette.primary.main;
                  return (
                    <TableRow key={t.id} hover sx={{ "& td": { py: 0.75, px: 2 } }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(tone, 0.12), color: tone }}>
                            {isJuridica ? <Business fontSize="small" /> : <Person fontSize="small" />}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{label(t)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{t.cuit || t.dni || "—"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.email || "Sin email"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{t.telefono || "Sin teléfono"}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}><Typography variant="body2" noWrap>{t.observaciones || "—"}</Typography></TableCell>
                      <TableCell align="right">
                        {canEditar && <Tooltip title="Editar"><IconButton size="small" onClick={() => { setEditing(t); setOpen(true); }}><Edit fontSize="small" /></IconButton></Tooltip>}
                        {canEliminar && <Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}><Delete fontSize="small" /></IconButton></Tooltip>}
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
            labelRowsPerPage="Filas:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </Paper>
      )}
        </>
      )}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420, boxShadow: "none" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Eliminar tercero</DialogTitle>
        <DialogContent><Typography variant="body2">¿Eliminar a {label(deleteTarget)} del directorio?</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: "10px", fontWeight: 800 }}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteTarget.id)} sx={{ borderRadius: "10px", fontWeight: 900 }}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

