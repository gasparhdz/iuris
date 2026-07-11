import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { Link as RouterLink } from "react-router-dom";
import { alpha, lighten, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";
import api from "../../api/axios";
import {
  casoLabel,
  clienteLabel,
  denseTableSx,
  deudorNombreFromItem,
  ellipsisSx,
  findParamByCodigo,
  formatDateShort,
  formatMoneyAr,
  invalidateFinanzasQueries,
  isDeudorTercero,
  linkSx,
  startOfDayArgentina,
} from "../../pages/finanzasUtils";
import { getApiError } from "../../pages/tareasUtils";

const compactCellSx = { py: 0.5, px: 1.25, fontSize: "0.8125rem" };
const compactHeadSx = { ...compactCellSx, fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" };

/** Tonos alineados con BANDEJA_TONES del dashboard. */
const SECTION_TONES = {
  vencidas: { tone: "#C13A33", dot: "#D64038" },
  porVencer: { tone: "#C47A16", dot: "#FFA726" },
};

function unwrapArray(data) {
  const raw = data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

function vencimientoTime(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

function matchesSearch(cuota, query) {
  if (!query) return true;
  const deudor = deudorNombreFromItem(cuota, cuota.cliente).toLowerCase();
  const caso = casoLabel(cuota.caso).toLowerCase();
  const cliente = clienteLabel(cuota.cliente).toLowerCase();
  return deudor.includes(query) || caso.includes(query) || cliente.includes(query);
}

function CuotaRowActions({ cuota, cobrarMutation }) {
  const saldo = Number(cuota.saldoPesos ?? 0);
  if (saldo <= 0) return null;
  const pending = cobrarMutation.isPending && Number(cobrarMutation.variables?.cuotaId) === Number(cuota.cuotaId);
  return (
    <Button
      size="small"
      variant="contained"
      color="success"
      disabled={cobrarMutation.isPending}
      onClick={(e) => {
        e.stopPropagation();
        cobrarMutation.mutate(cuota);
      }}
      sx={{ fontWeight: 800, borderRadius: "8px", minWidth: 0, px: 1.25, py: 0.25, fontSize: "0.75rem", lineHeight: 1.4 }}
    >
      {pending ? <CircularProgress size={14} color="inherit" /> : "Cobrar"}
    </Button>
  );
}

function DeudorCell({ cuota }) {
  const nombre = deudorNombreFromItem(cuota, cuota.cliente);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Tooltip title={nombre}>
        <Typography variant="body2" sx={{ ...ellipsisSx, fontWeight: 800, fontSize: "0.8125rem" }}>
          {nombre}
        </Typography>
      </Tooltip>
      {isDeudorTercero(cuota) && (
        <Chip
          size="small"
          label="Tercero"
          color="warning"
          variant="outlined"
          sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800, flexShrink: 0 }}
        />
      )}
    </Stack>
  );
}

function ExpedienteCell({ cuota }) {
  if (!cuota.caso?.id) return "—";
  return (
    <Tooltip title={casoLabel(cuota.caso)}>
      <Link
        component={RouterLink}
        to={`/expedientes/${cuota.caso.id}`}
        variant="body2"
        sx={{ ...linkSx, fontSize: "0.8125rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box component="span" sx={ellipsisSx}>{casoLabel(cuota.caso)}</Box>
      </Link>
    </Tooltip>
  );
}

function CuotasSection({
  title,
  tone,
  dot,
  rows,
  emptyLabel,
  cobrarMutation,
  defaultOpen = true,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [open, setOpen] = useState(defaultOpen);
  const pagedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const labelColor = isDark ? lighten(tone, 0.35) : tone;
  const dotColor = isDark ? lighten(dot, 0.12) : dot;
  const lineColor = alpha(tone, isDark ? 0.32 : 0.18);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.1}
        flexWrap="wrap"
        useFlexGap
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? `Ocultar ${title}` : `Mostrar ${title}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        sx={{ mb: 1.25, rowGap: 1, cursor: "pointer", userSelect: "none" }}
      >
        <ExpandMore
          sx={{
            fontSize: 18,
            color: "text.disabled",
            flexShrink: 0,
            transition: "transform 0.2s ease",
            transform: open ? "none" : "rotate(-90deg)",
          }}
        />
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: dotColor, flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: labelColor }}>
          {title}
        </Typography>
        <Typography sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.disabled" }}>
          {rows.length}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 48, height: 1, bgcolor: lineColor }} />
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Paper elevation={0} sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          {rows.length === 0 ? (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>{emptyLabel}</Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
                <Table size="small" sx={denseTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={compactHeadSx}>Deudor</TableCell>
                      <TableCell sx={compactHeadSx}>Expediente</TableCell>
                      <TableCell sx={compactHeadSx}>Cuota</TableCell>
                      <TableCell sx={compactHeadSx}>Vencimiento</TableCell>
                      <TableCell sx={compactHeadSx}>Saldo</TableCell>
                      <TableCell sx={{ ...compactHeadSx, width: 88 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedRows.map((cuota) => (
                      <TableRow key={cuota.cuotaId} hover>
                        <TableCell sx={{ ...compactCellSx, maxWidth: 180 }}><DeudorCell cuota={cuota} /></TableCell>
                        <TableCell sx={{ ...compactCellSx, maxWidth: 220 }}><ExpedienteCell cuota={cuota} /></TableCell>
                        <TableCell sx={{ ...compactCellSx, fontWeight: 800 }}>#{cuota.numero}</TableCell>
                        <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>{formatDateShort(cuota.vencimiento)}</TableCell>
                        <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap", fontWeight: 900 }}>
                          {formatMoneyAr(cuota.totalAPagarPesos ?? cuota.saldoPesos)}
                        </TableCell>
                        <TableCell sx={compactCellSx}>
                          <CuotaRowActions cuota={cuota} cobrarMutation={cobrarMutation} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" }, p: 1 }}>
                {pagedRows.map((cuota) => (
                  <Paper
                    key={cuota.cuotaId}
                    elevation={0}
                    sx={{
                      px: 1.25,
                      py: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      borderLeft: "3px solid",
                      borderLeftColor: tone,
                      borderRadius: "8px",
                      bgcolor: alpha(theme.palette.background.paper, 0.6),
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <DeudorCell cuota={cuota} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", lineHeight: 1.3 }}>
                          #{cuota.numero} · {formatDateShort(cuota.vencimiento)}
                          {cuota.caso ? ` · ${casoLabel(cuota.caso)}` : ""}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 900, fontSize: "0.8125rem" }}>
                          {formatMoneyAr(cuota.totalAPagarPesos ?? cuota.saldoPesos)}
                        </Typography>
                        <CuotaRowActions cuota={cuota} cobrarMutation={cobrarMutation} />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <TablePagination
                component="div"
                count={rows.length}
                page={page}
                onPageChange={onPageChange}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={onRowsPerPageChange}
                rowsPerPageOptions={[10, 25, 50]}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                sx={{
                  borderTop: "1px solid",
                  borderColor: "divider",
                  minHeight: 44,
                  "& .MuiTablePagination-toolbar": { minHeight: 44, px: 1 },
                  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem" },
                }}
              />
            </>
          )}
        </Paper>
      </Collapse>
    </Box>
  );
}

/**
 * Lista cuotas pendientes del estudio agrupadas en vencidas / por vencer.
 * Fuente: GET /planes/cuotas/proyeccion (misma que reportes y cron de recordatorios).
 */
export default function CobranzasTable({
  search = "",
  page = 0,
  pagePorVencer = 0,
  rowsPerPage = 10,
  onPageChange,
  onPagePorVencerChange,
  onRowsPerPageChange,
}) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const query = search.trim().toLowerCase();

  const proyeccionQuery = useQuery({
    queryKey: ["planes", "proyeccion-cobranzas"],
    queryFn: async () => {
      const { data } = await api.get("/planes/cuotas/proyeccion");
      return Array.isArray(data?.data) ? data.data : [];
    },
    staleTime: 60_000,
  });

  const conceptoIngresoQuery = useQuery({
    queryKey: ["catalogos", "parametros", "CONCEPTO_INGRESO"],
    queryFn: async () => {
      const { data } = await api.get("/catalogos/parametros", { params: { categoria: "CONCEPTO_INGRESO" } });
      const raw = data?.data ?? data;
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 300_000,
  });

  const cobrarMutation = useMutation({
    mutationFn: async (cuota) => {
      await queryClient.invalidateQueries({ queryKey: ["planes", cuota.planId, "cuotas"] });
      const freshCuotas = await queryClient.fetchQuery({
        queryKey: ["planes", cuota.planId, "cuotas"],
        queryFn: async () => {
          const { data } = await api.get(`/planes/${cuota.planId}/cuotas`);
          return unwrapArray(data);
        },
      });
      const fresh = (freshCuotas ?? []).find((c) => Number(c.id) === Number(cuota.cuotaId)) ?? null;
      if (!fresh) throw new Error("No se encontró la cuota actualizada");
      const saldoFresh = Number(fresh.saldoPesos ?? fresh.saldo ?? 0);
      if (saldoFresh <= 0) throw new Error("La cuota ya no tiene saldo pendiente");

      const conceptoPagoHonorarios = findParamByCodigo(conceptoIngresoQuery.data ?? [], ["PAGO_DE_HONORARIOS"]);
      const payload = {
        cuotaIds: [fresh.id],
        monto: fresh.totalAPagarPesos ?? fresh.saldoPesos,
        clienteId: cuota.clienteId,
        casoId: cuota.casoId,
        descripcion: `Pago cuota ${fresh.numero}`,
        tipoId: conceptoPagoHonorarios?.id ?? null,
        fechaIngreso: new Date().toISOString(),
      };
      if (fresh.valorJusAlCobro != null) payload.valorJusAlCobro = fresh.valorJusAlCobro;
      const { data } = await api.post("/ingresos", payload);
      return data?.data ?? data;
    },
    onSuccess: () => {
      invalidateFinanzasQueries(queryClient, [["planes", "proyeccion-cobranzas"]]);
      enqueueSnackbar("Cuota cobrada con éxito", { variant: "success" });
    },
    onError: (err) => {
      enqueueSnackbar(getApiError(err, "No se pudo cobrar la cuota"), { variant: "error" });
    },
  });

  const { vencidas, porVencer } = useMemo(() => {
    const hoy = startOfDayArgentina();
    const items = (proyeccionQuery.data ?? []).filter((cuota) => matchesSearch(cuota, query));
    const vencidasList = [];
    const porVencerList = [];
    for (const cuota of items) {
      const vto = cuota.vencimiento ? new Date(cuota.vencimiento) : null;
      if (vto && !Number.isNaN(vto.getTime()) && vto < hoy) {
        vencidasList.push(cuota);
      } else {
        porVencerList.push(cuota);
      }
    }
    vencidasList.sort((a, b) => vencimientoTime(a.vencimiento) - vencimientoTime(b.vencimiento));
    porVencerList.sort((a, b) => vencimientoTime(a.vencimiento) - vencimientoTime(b.vencimiento));
    return { vencidas: vencidasList, porVencer: porVencerList };
  }, [proyeccionQuery.data, query]);

  const handleRowsPerPage = (event) => {
    const next = parseInt(event.target.value, 10);
    onRowsPerPageChange?.(next);
  };

  if (proyeccionQuery.isLoading) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={48} sx={{ borderRadius: "12px" }} />
        <Skeleton variant="rounded" height={48} sx={{ borderRadius: "12px" }} />
      </Stack>
    );
  }

  if (proyeccionQuery.isError) {
    return (
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: "12px", border: "1px solid", borderColor: "divider" }}>
        <Typography variant="body2" color="error">
          {getApiError(proyeccionQuery.error, "No se pudieron cargar las cuotas pendientes")}
        </Typography>
      </Paper>
    );
  }

  const total = (proyeccionQuery.data ?? []).length;
  if (total === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: "12px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>
          No tenés cuotas pendientes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cuando haya cuotas de planes por cobrar van a aparecer acá agrupadas por vencimiento.
        </Typography>
      </Paper>
    );
  }

  if (vencidas.length === 0 && porVencer.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: "12px", border: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }}>
          Sin resultados
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ninguna cuota pendiente coincide con la búsqueda.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2.75}>
      <CuotasSection
        title="Vencidas"
        tone={SECTION_TONES.vencidas.tone}
        dot={SECTION_TONES.vencidas.dot}
        rows={vencidas}
        emptyLabel="No hay cuotas vencidas."
        cobrarMutation={cobrarMutation}
        defaultOpen={vencidas.length > 0}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, newPage) => onPageChange?.(newPage)}
        onRowsPerPageChange={handleRowsPerPage}
      />
      <CuotasSection
        title="Por vencer"
        tone={SECTION_TONES.porVencer.tone}
        dot={SECTION_TONES.porVencer.dot}
        rows={porVencer}
        emptyLabel="No hay cuotas por vencer."
        cobrarMutation={cobrarMutation}
        defaultOpen={porVencer.length > 0}
        page={pagePorVencer}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, newPage) => onPagePorVencerChange?.(newPage)}
        onRowsPerPageChange={handleRowsPerPage}
      />
    </Stack>
  );
}
