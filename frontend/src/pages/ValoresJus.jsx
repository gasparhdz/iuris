import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { usePermisos } from "../auth/usePermissions";
import { useListState } from "../hooks/useListState";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import { Sync } from "@mui/icons-material";
import { getValoresJus, syncValoresJus } from "../api/valorjus.api";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
  const { canCrear } = usePermisos("VALORJUS");
  const [list, setList] = useListState(
    { page: 0, rowsPerPage: 10 },
    { debounceKeys: [] },
  );
  const { page, rowsPerPage } = list;
  const setPage = (page) => setList({ page });
  const setRowsPerPage = (rowsPerPage) => setList({ rowsPerPage });

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
              </TableRow>
            </TableHead>
            <TableBody>
              {valoresQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress />
                    </Box>
                  </TableCell>
                </TableRow>
              ) : isTableEmpty ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Box sx={{ py: 6, textAlign: "center" }}>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        No hay valores JUS cargados
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        Usá "Actualizar JUS" para sincronizar el historial oficial.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                valores.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{formatDate(item.fecha)}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{moneyFormatter.format(Number(item.valor))}</TableCell>
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

    </Box>
  );
}
