import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { usePermisos } from "../auth/usePermissions";
import { useListState } from "../hooks/useListState";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Delete, Sync } from "@mui/icons-material";
import {
  createValorJus,
  deleteValorJus,
  getValoresJus,
  syncValoresJus,
} from "../api/valorjus.api";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const initialForm = {
  fecha: "",
  valor: "",
};

function getApiError(error, fallback) {
  return error?.response?.data?.error?.message ?? fallback;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ValoresJus() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canCrear, canEliminar } = usePermisos("VALORJUS");
  const [list, setList] = useListState(
    { page: 0, rowsPerPage: 10 },
    { debounceKeys: [] },
  );
  const { page, rowsPerPage } = list;
  const setPage = (page) => setList({ page });
  const setRowsPerPage = (rowsPerPage) => setList({ rowsPerPage });
  const [manualOpen, setManualOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  const valoresQuery = useQuery({
    queryKey: ["valorjus", page + 1, rowsPerPage],
    queryFn: () => getValoresJus({ page: page + 1, limit: rowsPerPage }),
    keepPreviousData: true,
    staleTime: 1000 * 60,
  });

  const valores = valoresQuery.data?.items ?? [];
  const meta = valoresQuery.data?.meta ?? {};
  const total = Number(meta.total ?? valores.length);

  function invalidateValoresJus() {
    queryClient.invalidateQueries({ queryKey: ["valorjus"] });
  }

  const syncMutation = useMutation({
    mutationFn: syncValoresJus,
    onSuccess: (result) => {
      enqueueSnackbar(result?.message ?? "Valores JUS sincronizados correctamente", { variant: "success" });
      invalidateValoresJus();
    },
    onError: (error) => {
      enqueueSnackbar(getApiError(error, "No se pudieron sincronizar los valores JUS"), { variant: "error" });
    },
  });

  const createMutation = useMutation({
    mutationFn: createValorJus,
    onSuccess: () => {
      enqueueSnackbar("Valor JUS cargado correctamente", { variant: "success" });
      setManualOpen(false);
      setForm(initialForm);
      setErrors({});
      setPage(0);
      invalidateValoresJus();
    },
    onError: (error) => {
      enqueueSnackbar(getApiError(error, "No se pudo cargar el valor JUS"), { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteValorJus,
    onSuccess: () => {
      enqueueSnackbar("Valor JUS eliminado", { variant: "success" });
      setDeleteTarget(null);
      invalidateValoresJus();
    },
    onError: (error) => {
      enqueueSnackbar(getApiError(error, "No se pudo eliminar el valor JUS"), { variant: "error" });
    },
  });

  const handleOpenManual = () => {
    setForm(initialForm);
    setErrors({});
    setManualOpen(true);
  };

  const handleCloseManual = () => {
    if (createMutation.isPending) return;
    setManualOpen(false);
    setErrors({});
  };

  const handleFormChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors = {};
    const value = Number(form.valor);
    const date = form.fecha ? new Date(form.fecha) : null;

    if (!form.fecha || !date || Number.isNaN(date.getTime())) {
      nextErrors.fecha = "Ingresá una fecha de vigencia válida";
    }

    if (!form.valor || Number.isNaN(value) || value <= 0) {
      nextErrors.valor = "Ingresá un valor en pesos mayor a cero";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveManual = () => {
    if (!validateForm()) return;

    createMutation.mutate({
      fecha: new Date(form.fecha).toISOString(),
      valor: Number(form.valor),
    });
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const isTableEmpty = !valoresQuery.isLoading && valores.length === 0;

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: 0 }}>
            Valores JUS (Santa Fe)
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, maxWidth: 760 }}>
            Estos valores determinan los cálculos dinámicos de los honorarios del estudio.
            {total > 0 ? ` ${total.toLocaleString("es-AR")} registros activos.` : ""}
          </Typography>
        </Box>
        {canCrear && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ flexShrink: 0 }}>
            <Button
              variant="contained"
              startIcon={syncMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <Sync />}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              sx={{ borderRadius: "10px", fontWeight: 900 }}
            >
              Actualizar JUS
            </Button>
            <Button
              variant="outlined"
              onClick={handleOpenManual}
              sx={{ borderRadius: "10px", fontWeight: 800 }}
            >
              Cargar manualmente
            </Button>
          </Stack>
        )}
      </Stack>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "10px", overflow: "hidden", bgcolor: "background.paper" }}>
        {valoresQuery.isError && (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {getApiError(valoresQuery.error, "No se pudo cargar el historial de valores JUS")}
          </Alert>
        )}

        <TableContainer>
          <Table
            size="small"
            sx={{
              minWidth: 720,
              "& .MuiTableCell-root": {
                px: 2,
                py: 1,
                fontSize: "0.9rem",
              },
              "& .MuiTableHead-root .MuiTableCell-root": {
                py: 1.15,
                bgcolor: "action.hover",
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 900 }}>Fecha de Vigencia</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Valor JUS ($)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {valoresQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : isTableEmpty ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Box sx={{ py: 6, textAlign: "center" }}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        No hay valores JUS cargados
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        Sincronizá el historial oficial o cargá un valor manualmente.
                      </Typography>
                      {canCrear && (
                        <Button variant="outlined" onClick={handleOpenManual} sx={{ mt: 2, borderRadius: "10px", fontWeight: 800 }}>
                          Cargar manualmente
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                valores.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{formatDate(item.fecha)}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{moneyFormatter.format(Number(item.valor))}</TableCell>
                    <TableCell align="right">
                      {canEliminar && (
                        <Tooltip title="Eliminar valor JUS">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(item)}
                            disabled={deleteMutation.isPending}
                            aria-label="Eliminar valor JUS"
                            sx={{ p: 0.5 }}
                          >
                            <Delete sx={{ fontSize: 19 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Filas:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          sx={{
            minHeight: 44,
            borderTop: "1px solid",
            borderColor: "divider",
            "& .MuiTablePagination-toolbar": {
              minHeight: 44,
              px: 1.5,
            },
            "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
              fontSize: "0.85rem",
            },
          }}
        />
      </Paper>

      {valoresQuery.isFetching && !valoresQuery.isLoading && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
          Actualizando historial JUS...
        </Typography>
      )}

      <Dialog open={manualOpen} onClose={handleCloseManual} PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 460 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Cargar Valor JUS</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Fecha de Vigencia"
              type="date"
              value={form.fecha}
              onChange={handleFormChange("fecha")}
              error={Boolean(errors.fecha)}
              helperText={errors.fecha}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Valor en Pesos"
              type="number"
              value={form.valor}
              onChange={handleFormChange("valor")}
              error={Boolean(errors.valor)}
              helperText={errors.valor}
              fullWidth
              inputProps={{ min: 0, step: "0.01" }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleCloseManual} disabled={createMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveManual}
            disabled={createMutation.isPending}
            startIcon={createMutation.isPending ? <CircularProgress size={18} color="inherit" /> : null}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteMutation.isPending && setDeleteTarget(null)}
        PaperProps={{ sx: { borderRadius: "16px", width: "100%", maxWidth: 420 } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Eliminar Valor JUS</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Se eliminará lógicamente el valor vigente desde {formatDate(deleteTarget?.fecha)}.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteMutation.mutate(deleteTarget.id)}
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : null}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
