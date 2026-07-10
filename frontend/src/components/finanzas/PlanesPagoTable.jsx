import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha, useTheme } from "@mui/material/styles";
import api from "../../api/axios";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { Delete, EventRepeat, KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import {
  clienteLabel,
  casoLabel,
  cuotaEstadoChip,
  cuotaMontoDisplay,
  cuotaTotalAPagar,
  denseTableSx,
  deudorNombreFromItem,
  findParamByCodigo,
  formatDateShort,
  formatMoneyAr,
  invalidateFinanzasQueries,
  isDeudorTercero,
  planMontoCuota,
  ellipsisSx,
  linkSx,
} from "../../pages/finanzasUtils";
import { getApiError } from "../../pages/tareasUtils";

function unwrapArray(data) {
  const raw = data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

function PlanCuotasPanel({ plan, invalidateKeys = [] }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const cuotasQuery = useQuery({
    queryKey: ["planes", plan.id, "cuotas"],
    queryFn: async () => {
      const { data } = await api.get(`/planes/${plan.id}/cuotas`);
      return unwrapArray(data);
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
      // Refrescar cuotas antes de cobrar para no partir de un saldo viejo.
      await queryClient.invalidateQueries({ queryKey: ["planes", plan.id, "cuotas"] });
      const freshCuotas = await queryClient.fetchQuery({
        queryKey: ["planes", plan.id, "cuotas"],
        queryFn: async () => {
          const { data } = await api.get(`/planes/${plan.id}/cuotas`);
          return unwrapArray(data);
        },
      });
      const fresh = (freshCuotas ?? []).find((c) => Number(c.id) === Number(cuota.id)) ?? cuota;
      const saldoFresh = Number(fresh.saldoPesos ?? fresh.saldo ?? 0);
      if (saldoFresh <= 0) {
        throw new Error("La cuota ya no tiene saldo pendiente");
      }
      const conceptoPagoHonorarios = findParamByCodigo(conceptoIngresoQuery.data ?? [], ["PAGO_DE_HONORARIOS"]);
      const payload = {
        cuotaIds: [fresh.id],
        monto: fresh.totalAPagarPesos ?? fresh.saldoPesos,
        clienteId: plan.clienteId,
        casoId: plan.casoId,
        descripcion: `Pago cuota ${fresh.numero}`,
        tipoId: conceptoPagoHonorarios?.id ?? null,
        fechaIngreso: new Date().toISOString(),
      };
      if (fresh.valorJusAlCobro != null) payload.valorJusAlCobro = fresh.valorJusAlCobro;
      const { data } = await api.post("/ingresos", payload);
      return data?.data ?? data;
    },
    onSuccess: () => {
      invalidateFinanzasQueries(queryClient, [["planes", plan.id, "cuotas"], ...invalidateKeys]);
      enqueueSnackbar("Cuota cobrada con éxito", { variant: "success" });
    },
    onError: (err) => {
      enqueueSnackbar(getApiError(err, "No se pudo cobrar la cuota"), { variant: "error" });
    },
  });

  if (cuotasQuery.isLoading) {
    return (
      <Stack spacing={1} sx={{ p: 2, bgcolor: "action.hover" }}>
        <Skeleton variant="rounded" height={34} />
        <Skeleton variant="rounded" height={34} />
      </Stack>
    );
  }

  if (cuotasQuery.isError) {
    return (
      <Box sx={{ p: 2, bgcolor: "action.hover" }}>
        <Typography variant="body2" color="error">
          {getApiError(cuotasQuery.error, "No se pudieron cargar las cuotas")}
        </Typography>
      </Box>
    );
  }

  const cuotas = cuotasQuery.data ?? [];

  return (
    <Box sx={{ p: 2, bgcolor: "action.hover" }}>
      {cuotas.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Este plan no tiene cuotas generadas.
        </Typography>
      ) : (
        <>
          {/* Desktop */}
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Table size="small" sx={denseTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Nro cuota</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Vencimiento</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Monto cuota</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Monto cobrado</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Saldo</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Interés</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 900, width: 110 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuotas.map((cuota) => {
                  const saldo = Number(cuota.saldoPesos ?? cuota.saldo ?? 0);
                  const totalAPagar = cuotaTotalAPagar(cuota);
                  const interesPesos = Number(cuota.interes?.pesos ?? 0);
                  const chip = cuotaEstadoChip(cuota);
                  return (
                    <TableRow key={cuota.id}>
                      <TableCell sx={{ fontWeight: 800 }}>{cuota.numero}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateShort(cuota.vencimiento)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 800 }}>{formatMoneyAr(cuotaMontoDisplay(cuota))}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatMoneyAr(cuota.montoCobrado)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 900 }}>
                        {cuota.interes?.aplica ? (
                          <Stack spacing={0.25}>
                            <Typography variant="body2" sx={{ fontWeight: 900 }}>Saldo: {formatMoneyAr(saldo)}</Typography>
                            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 900 }}>Total: {formatMoneyAr(totalAPagar)}</Typography>
                          </Stack>
                        ) : formatMoneyAr(saldo)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {cuota.interes?.aplica ? (
                          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 900 }}>+{formatMoneyAr(interesPesos)}</Typography>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} />
                      </TableCell>
                      <TableCell>
                        {saldo > 0 && (
                          <Button size="small" variant="contained" color="success" disabled={cobrarMutation.isPending} onClick={(e) => { e.stopPropagation(); cobrarMutation.mutate(cuota); }} sx={{ fontWeight: 900, borderRadius: "9px" }}>
                            {cobrarMutation.isPending ? <CircularProgress size={16} color="inherit" /> : "Cobrar"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          {/* Mobile */}
          <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
            {cuotas.map((cuota) => {
              const saldo = Number(cuota.saldoPesos ?? cuota.saldo ?? 0);
              const totalAPagar = cuotaTotalAPagar(cuota);
              const interesPesos = Number(cuota.interes?.pesos ?? 0);
              const chip = cuotaEstadoChip(cuota);
              return (
                <Paper key={cuota.id} elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: "10px" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>Cuota #{cuota.numero}</Typography>
                    <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 900 }} />
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: "block" }}>Vto</Typography>
                      <Typography variant="body2">{formatDateShort(cuota.vencimiento)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: "block" }}>Monto</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatMoneyAr(cuotaMontoDisplay(cuota))}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: "block" }}>Saldo</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>{cuota.interes?.aplica ? formatMoneyAr(totalAPagar) : formatMoneyAr(saldo)}</Typography>
                    </Box>
                    {cuota.interes?.aplica && (
                      <Box>
                        <Typography variant="caption" color="warning.main" sx={{ fontWeight: 800, display: "block" }}>Interés</Typography>
                        <Typography variant="body2" color="warning.main" sx={{ fontWeight: 900 }}>+{formatMoneyAr(interesPesos)}</Typography>
                      </Box>
                    )}
                  </Stack>
                  {saldo > 0 && (
                    <Button size="small" variant="contained" color="success" fullWidth disabled={cobrarMutation.isPending} onClick={(e) => { e.stopPropagation(); cobrarMutation.mutate(cuota); }} sx={{ fontWeight: 900, borderRadius: "9px", mt: 0.5 }}>
                      {cobrarMutation.isPending ? <CircularProgress size={16} color="inherit" /> : "Cobrar cuota"}
                    </Button>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </>
      )}
    </Box>
  );
}

export default function PlanesPagoTable({ planes, loading, error, empty, invalidateKeys = [] }) {
  const theme = useTheme();
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  if (loading) {
    return (
      <Stack spacing={1} sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={36} />
        <Skeleton variant="rounded" height={36} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error" sx={{ p: 2 }}>
        {getApiError(error, "No se pudieron cargar los planes")}
      </Typography>
    );
  }

  if (!planes.length) {
    return <Typography variant="body2" sx={{ color: "text.secondary", p: 2 }}>{empty}</Typography>;
  }

  return (
    <>
      {/* Desktop */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0, display: { xs: "none", md: "block" } }}>
        <Table size="small" sx={denseTableSx}>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.08) }}>
              <TableCell sx={{ width: 42 }} />
              <TableCell sx={{ fontWeight: 900 }}>Cliente</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Deudor</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Expediente</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Monto cuota</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Periodicidad</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Fecha de inicio</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {planes.map((plan) => {
              const expanded = expandedPlanId === plan.id;
              return (
                <Fragment key={plan.id}>
                  <TableRow hover onClick={() => setExpandedPlanId(expanded ? null : plan.id)} sx={{ cursor: "pointer" }}>
                    <TableCell>
                      <IconButton size="small" aria-label={expanded ? "Ocultar cuotas" : "Ver cuotas"}>
                        {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {plan.cliente ? (
                        <Tooltip title={clienteLabel(plan.cliente)}>
                          <Link component={RouterLink} to={`/clientes/${plan.cliente.id}`} variant="body2" sx={linkSx} onClick={(e) => e.stopPropagation()}>
                            <Box component="span" sx={ellipsisSx}>{clienteLabel(plan.cliente)}</Box>
                          </Link>
                        </Tooltip>
                      ) : "—"}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Tooltip title={deudorNombreFromItem(plan, plan.cliente)}>
                          <Typography variant="body2" sx={{ ...ellipsisSx, fontWeight: 800 }}>
                            {deudorNombreFromItem(plan, plan.cliente)}
                          </Typography>
                        </Tooltip>
                        {isDeudorTercero(plan) && (
                          <Chip size="small" label="Tercero" color="warning" variant="outlined" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800, flexShrink: 0 }} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>
                      {plan.caso ? (
                        <Tooltip title={casoLabel(plan.caso)}>
                          <Link component={RouterLink} to={`/expedientes/${plan.caso.id}`} variant="body2" sx={linkSx} onClick={(e) => e.stopPropagation()}>
                            <Box component="span" sx={ellipsisSx}>{casoLabel(plan.caso)}</Box>
                          </Link>
                        </Tooltip>
                      ) : "—"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatMoneyAr(planMontoCuota(plan))}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>Total: {formatMoneyAr(plan.totalHonorarioArs ?? planMontoCuota(plan))}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{plan.periodicidad?.nombre ?? "—"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateShort(plan.fechaInicio)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0, borderBottom: expanded ? "1px solid" : 0, borderColor: "divider" }}>
                      <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <PlanCuotasPanel plan={plan} invalidateKeys={invalidateKeys} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Mobile */}
      <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" }, p: 1.5 }}>
        {planes.map((plan) => {
          const expanded = expandedPlanId === plan.id;
          return (
            <Paper key={plan.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
              <Box sx={{ p: 2, cursor: "pointer" }} onClick={() => setExpandedPlanId(expanded ? null : plan.id)}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, display: "block" }} noWrap>
                      {plan.cliente ? clienteLabel(plan.cliente) : "Sin cliente"}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 800 }}>
                        Deudor: {deudorNombreFromItem(plan, plan.cliente)}
                      </Typography>
                      {isDeudorTercero(plan) && (
                        <Chip size="small" label="Tercero" color="warning" variant="outlined" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                      {plan.caso ? casoLabel(plan.caso) : "Sin expediente"}
                    </Typography>
                  </Box>
                  <IconButton size="small" aria-label={expanded ? "Ocultar cuotas" : "Ver cuotas"}>
                    {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                  </IconButton>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: "block" }}>Cuota</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatMoneyAr(planMontoCuota(plan))}</Typography>
                    <Typography variant="caption" color="text.secondary">Total: {formatMoneyAr(plan.totalHonorarioArs ?? planMontoCuota(plan))}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: "block" }}>Periodicidad</Typography>
                    <Typography variant="body2">{plan.periodicidad?.nombre ?? "—"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: "block" }}>Inicio</Typography>
                    <Typography variant="body2">{formatDateShort(plan.fechaInicio)}</Typography>
                  </Box>
                </Stack>
              </Box>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Divider />
                <PlanCuotasPanel plan={plan} invalidateKeys={invalidateKeys} />
              </Collapse>
            </Paper>
          );
        })}
      </Stack>
    </>
  );
}
