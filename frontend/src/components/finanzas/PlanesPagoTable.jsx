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
import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import {
  clienteLabel,
  casoLabel,
  casoCaratulaLabel,
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

const compactCellSx = { py: 0.5, px: 1.25, fontSize: "0.8125rem" };
const compactHeadSx = {
  ...compactCellSx,
  fontWeight: 900,
  fontSize: "0.68rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "text.secondary",
  whiteSpace: "nowrap",
};
const cobrarBtnSx = {
  fontWeight: 800,
  borderRadius: "8px",
  minWidth: 0,
  px: 1.25,
  py: 0.25,
  fontSize: "0.75rem",
  lineHeight: 1.4,
};

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
      <Stack spacing={0.75} sx={{ p: 1.25, bgcolor: "action.hover" }}>
        <Skeleton variant="rounded" height={28} />
        <Skeleton variant="rounded" height={28} />
      </Stack>
    );
  }

  if (cuotasQuery.isError) {
    return (
      <Box sx={{ p: 1.25, bgcolor: "action.hover" }}>
        <Typography variant="body2" color="error" sx={{ fontSize: "0.8125rem" }}>
          {getApiError(cuotasQuery.error, "No se pudieron cargar las cuotas")}
        </Typography>
      </Box>
    );
  }

  const cuotas = cuotasQuery.data ?? [];

  return (
    <Box sx={{ px: 1.25, py: 1, bgcolor: "action.hover" }}>
      {cuotas.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
          Este plan no tiene cuotas generadas.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Table size="small" sx={denseTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={compactHeadSx}>Nro</TableCell>
                  <TableCell sx={compactHeadSx}>Vencimiento</TableCell>
                  <TableCell sx={compactHeadSx}>Monto</TableCell>
                  <TableCell sx={compactHeadSx}>Cobrado</TableCell>
                  <TableCell sx={compactHeadSx}>Saldo</TableCell>
                  <TableCell sx={compactHeadSx}>Interés</TableCell>
                  <TableCell sx={compactHeadSx}>Estado</TableCell>
                  <TableCell sx={{ ...compactHeadSx, width: 88 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cuotas.map((cuota) => {
                  const saldo = Number(cuota.saldoPesos ?? cuota.saldo ?? 0);
                  const totalAPagar = cuotaTotalAPagar(cuota);
                  const interesPesos = Number(cuota.interes?.pesos ?? 0);
                  const chip = cuotaEstadoChip(cuota);
                  const saldoLabel = formatMoneyAr(cuota.interes?.aplica ? totalAPagar : saldo);
                  const saldoTooltip = cuota.interes?.aplica
                    ? `Saldo ${formatMoneyAr(saldo)} · Total ${formatMoneyAr(totalAPagar)}`
                    : saldoLabel;
                  const pending = cobrarMutation.isPending
                    && Number(cobrarMutation.variables?.id) === Number(cuota.id);
                  return (
                    <TableRow key={cuota.id} hover>
                      <TableCell sx={{ ...compactCellSx, fontWeight: 800 }}>#{cuota.numero}</TableCell>
                      <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>{formatDateShort(cuota.vencimiento)}</TableCell>
                      <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap", fontWeight: 800 }}>
                        {formatMoneyAr(cuotaMontoDisplay(cuota))}
                      </TableCell>
                      <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>{formatMoneyAr(cuota.montoCobrado)}</TableCell>
                      <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap", fontWeight: 900 }}>
                        <Tooltip title={saldoTooltip}>
                          <Box component="span">{saldoLabel}</Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>
                        {cuota.interes?.aplica ? (
                          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 900, fontSize: "0.8125rem" }}>
                            +{formatMoneyAr(interesPesos)}
                          </Typography>
                        ) : "—"}
                      </TableCell>
                      <TableCell sx={compactCellSx}>
                        <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 800, height: 22, fontSize: "0.7rem" }} />
                      </TableCell>
                      <TableCell sx={compactCellSx}>
                        {saldo > 0 && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={cobrarMutation.isPending}
                            onClick={(e) => { e.stopPropagation(); cobrarMutation.mutate(cuota); }}
                            sx={cobrarBtnSx}
                          >
                            {pending ? <CircularProgress size={14} color="inherit" /> : "Cobrar"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>

          <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
            {cuotas.map((cuota) => {
              const saldo = Number(cuota.saldoPesos ?? cuota.saldo ?? 0);
              const totalAPagar = cuotaTotalAPagar(cuota);
              const interesPesos = Number(cuota.interes?.pesos ?? 0);
              const chip = cuotaEstadoChip(cuota);
              const pending = cobrarMutation.isPending
                && Number(cobrarMutation.variables?.id) === Number(cuota.id);
              return (
                <Paper key={cuota.id} elevation={0} sx={{ px: 1.25, py: 1, border: "1px solid", borderColor: "divider", borderRadius: "8px" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, fontSize: "0.8125rem" }}>Cuota #{cuota.numero}</Typography>
                    <Chip size="small" label={chip.label} color={chip.color} sx={{ fontWeight: 800, height: 20, fontSize: "0.65rem" }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75, lineHeight: 1.3 }}>
                    {formatDateShort(cuota.vencimiento)} · {formatMoneyAr(cuotaMontoDisplay(cuota))}
                    {cuota.interes?.aplica ? ` · Total ${formatMoneyAr(totalAPagar)} (+${formatMoneyAr(interesPesos)})` : ` · Saldo ${formatMoneyAr(saldo)}`}
                  </Typography>
                  {saldo > 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      fullWidth
                      disabled={cobrarMutation.isPending}
                      onClick={(e) => { e.stopPropagation(); cobrarMutation.mutate(cuota); }}
                      sx={cobrarBtnSx}
                    >
                      {pending ? <CircularProgress size={14} color="inherit" /> : "Cobrar"}
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
      <Stack spacing={1} sx={{ p: 1.5 }}>
        <Skeleton variant="rounded" height={32} />
        <Skeleton variant="rounded" height={32} />
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
      <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
        <Table size="small" sx={denseTableSx}>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.08) }}>
              <TableCell sx={{ ...compactHeadSx, width: 40 }} />
              <TableCell sx={compactHeadSx}>Expte / Cliente</TableCell>
              <TableCell sx={compactHeadSx}>Deudor</TableCell>
              <TableCell sx={compactHeadSx}>Cuota</TableCell>
              <TableCell sx={compactHeadSx}>Periodicidad</TableCell>
              <TableCell sx={compactHeadSx}>Inicio</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {planes.map((plan) => {
              const expanded = expandedPlanId === plan.id;
              const cuotaLabel = formatMoneyAr(planMontoCuota(plan));
              const totalLabel = formatMoneyAr(plan.totalHonorarioArs ?? planMontoCuota(plan));
              return (
                <Fragment key={plan.id}>
                  <TableRow
                    hover
                    onClick={() => setExpandedPlanId(expanded ? null : plan.id)}
                    sx={{ cursor: "pointer", "& > td": compactCellSx }}
                  >
                    <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap", width: 40 }}>
                      <IconButton size="small" aria-label={expanded ? "Ocultar cuotas" : "Ver cuotas"} sx={{ p: 0.25 }}>
                        {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ ...compactCellSx, maxWidth: 240, whiteSpace: "nowrap" }}>
                      {plan.caso ? (
                        <Tooltip title={casoLabel(plan.caso)}>
                          <Link component={RouterLink} to={`/expedientes/${plan.caso.id}`} variant="body2" sx={{ ...linkSx, fontSize: "0.8125rem" }} onClick={(e) => e.stopPropagation()}>
                            <Box component="span" sx={ellipsisSx}>{casoCaratulaLabel(plan.caso)}</Box>
                          </Link>
                        </Tooltip>
                      ) : plan.cliente ? (
                        <Tooltip title={clienteLabel(plan.cliente)}>
                          <Link component={RouterLink} to={`/clientes/${plan.cliente.id}`} variant="body2" sx={{ ...linkSx, fontSize: "0.8125rem" }} onClick={(e) => e.stopPropagation()}>
                            <Box component="span" sx={ellipsisSx}>{clienteLabel(plan.cliente)}</Box>
                          </Link>
                        </Tooltip>
                      ) : "—"}
                    </TableCell>
                    <TableCell sx={{ ...compactCellSx, maxWidth: 200, whiteSpace: "nowrap" }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Tooltip title={deudorNombreFromItem(plan, plan.cliente)}>
                          <Typography variant="body2" sx={{ ...ellipsisSx, fontWeight: 800, fontSize: "0.8125rem" }}>
                            {deudorNombreFromItem(plan, plan.cliente)}
                          </Typography>
                        </Tooltip>
                        {isDeudorTercero(plan) && (
                          <Chip size="small" label="Tercero" color="warning" variant="outlined" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 800, flexShrink: 0 }} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>
                      <Tooltip title={`Total: ${totalLabel}`}>
                        <Typography variant="body2" sx={{ fontWeight: 900, fontSize: "0.8125rem" }}>{cuotaLabel}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>{plan.periodicidad?.nombre ?? "—"}</TableCell>
                    <TableCell sx={{ ...compactCellSx, whiteSpace: "nowrap" }}>{formatDateShort(plan.fechaInicio)}</TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ p: 0, borderBottom: "1px solid", borderColor: "divider" }}>
                        <Collapse in={expanded} timeout="auto" unmountOnExit>
                          <PlanCuotasPanel plan={plan} invalidateKeys={invalidateKeys} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" }, p: 1 }}>
        {planes.map((plan) => {
          const expanded = expandedPlanId === plan.id;
          return (
            <Paper key={plan.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "10px", overflow: "hidden" }}>
              <Box sx={{ px: 1.5, py: 1.25, cursor: "pointer" }} onClick={() => setExpandedPlanId(expanded ? null : plan.id)}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, fontSize: "0.8125rem", display: "block" }} noWrap>
                      {plan.caso ? casoCaratulaLabel(plan.caso) : (plan.cliente ? clienteLabel(plan.cliente) : "Sin expte / cliente")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 700, display: "block", lineHeight: 1.3 }}>
                      {deudorNombreFromItem(plan, plan.cliente)}
                      {isDeudorTercero(plan) ? " · Tercero" : ""}
                      {" · "}{formatMoneyAr(planMontoCuota(plan))}
                      {" · "}{plan.periodicidad?.nombre ?? "—"}
                      {" · "}{formatDateShort(plan.fechaInicio)}
                    </Typography>
                  </Box>
                  <IconButton size="small" aria-label={expanded ? "Ocultar cuotas" : "Ver cuotas"} sx={{ p: 0.25, flexShrink: 0 }}>
                    {expanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                  </IconButton>
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
