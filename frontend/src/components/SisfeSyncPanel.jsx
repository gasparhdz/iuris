import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleOutline,
  CloudSyncOutlined,
  DeleteOutline,
  LinkOffOutlined,
  LoginOutlined,
  SyncOutlined,
} from "@mui/icons-material";
import {
  deleteSisfeSession,
  getSisfeStatus,
  getSisfeSyncStatus,
  postSisfeManualSession,
  startSisfeSync,
  cancelSisfeSync,
  startSisfeInteractiveLogin,
} from "../api/sisfe.api";
import { invalidateSisfeQueries } from "../utils/sisfeInvalidation";
import { openSisfeRemoteScreen } from "../utils/sisfeRemoteScreen";

const statusKey = ["sisfe", "status"];
const syncKey = ["sisfe", "sync-status"];

function formatLastSync(value) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statLabel(stats, key) {
  return Number(stats?.[key] ?? 0).toLocaleString("es-AR");
}

export default function SisfeSyncPanel() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [cookieInput, setCookieInput] = useState("");

  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: getSisfeStatus,
    refetchInterval: (query) => query.state.data?.syncStatus === "running" ? 2000 : false,
  });

  const syncQuery = useQuery({
    queryKey: syncKey,
    queryFn: getSisfeSyncStatus,
    enabled: statusQuery.data?.syncStatus === "running",
    refetchInterval: 2000,
  });

  const status = syncQuery.data ?? statusQuery.data ?? {};
  const syncStatus = status.syncStatus ?? "idle";
  const isRunning = syncStatus === "running";
  const conectado = Boolean(status.conectado);
  const stats = status.syncStats ?? {};

  useEffect(() => {
    if (syncQuery.data?.syncStatus === "done" || syncQuery.data?.syncStatus === "error") {
      queryClient.invalidateQueries({ queryKey: statusKey });
      invalidateSisfeQueries(queryClient);
    }
  }, [queryClient, syncQuery.data?.syncStatus]);

  const connectLabel = useMemo(() => {
    if (interactiveOpen) return "Navegador de SISFE abierto en tu computadora. Iniciá sesión allí...";
    if (!conectado) return "No estás conectado al portal SISFE";
    return "Conectado";
  }, [conectado, interactiveOpen]);

  const startMutation = useMutation({
    mutationFn: startSisfeSync,
    onSuccess: async () => {
      enqueueSnackbar("Sincronización SISFE iniciada", { variant: "success" });
      await queryClient.invalidateQueries({ queryKey: statusKey });
      await queryClient.invalidateQueries({ queryKey: syncKey });
    },
    onError: (error) => enqueueSnackbar(error.response?.data?.error?.message || "No se pudo iniciar la sincronización", { variant: "error" }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSisfeSync,
    onSuccess: () => {
      enqueueSnackbar("Sincronización SISFE cancelada", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: statusKey });
      queryClient.invalidateQueries({ queryKey: syncKey });
    },
    onError: (error) => enqueueSnackbar(error.response?.data?.error?.message || "No se pudo cancelar la sincronización", { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSisfeSession,
    onSuccess: () => {
      enqueueSnackbar("Sesión SISFE desconectada", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: statusKey });
    },
    onError: (error) => enqueueSnackbar(error.response?.data?.error?.message || "No se pudo desconectar SISFE", { variant: "error" }),
  });

  const manualMutation = useMutation({
    mutationFn: () => {
      let name = "JSESSIONID";
      let val = cookieInput.trim();

      // Si copiaron la cookie con su nombre (ej: JSESSIONID=abc123xyz), la parseamos
      if (val.includes("=")) {
        const index = val.indexOf("=");
        name = val.substring(0, index).trim();
        val = val.substring(index + 1).trim();
      }

      return postSisfeManualSession(name, val);
    },
    onSuccess: () => {
      enqueueSnackbar("Sesión SISFE guardada", { variant: "success" });
      setManualOpen(false);
      setCookieInput("");
      queryClient.invalidateQueries({ queryKey: statusKey });
    },
    onError: (error) => enqueueSnackbar(error.response?.data?.error?.message || "No se pudo verificar la cookie", { variant: "error" }),
  });

  const interactiveMutation = useMutation({
    mutationFn: startSisfeInteractiveLogin,
    onMutate: () => {
      setInteractiveOpen(true);
      openSisfeRemoteScreen();
    },
    onSuccess: () => {
      enqueueSnackbar("Conectado exitosamente con SISFE", { variant: "success" });
      setInteractiveOpen(false);
      queryClient.invalidateQueries({ queryKey: statusKey });
      startMutation.mutate(); // Arrancar sync automática
    },
    onError: (error) => {
      setInteractiveOpen(false);
      enqueueSnackbar(error.response?.data?.error?.message || "No se pudo abrir el navegador de SISFE", { variant: "error" });
    },
  });

  return (
    <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CloudSyncOutlined color="primary" />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 850 }}>Integración SISFE</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>{connectLabel}</Typography>
            </Box>
          </Stack>
          <Chip
            icon={conectado ? <CheckCircleOutline /> : <LinkOffOutlined />}
            label={conectado ? "Conectado" : "Desconectado"}
            color={conectado ? "success" : "default"}
            variant={conectado ? "filled" : "outlined"}
          />
        </Stack>

        {statusQuery.isLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">Cargando estado SISFE...</Typography>
          </Stack>
        ) : null}

        {!conectado && !interactiveOpen ? (
          <Stack spacing={1.5} alignItems="flex-start">
            <Button
              variant="contained"
              startIcon={<LoginOutlined />}
              disabled={interactiveMutation.isPending}
              onClick={() => interactiveMutation.mutate()}
            >
              Conectar con SISFE
            </Button>
            <Link component="button" type="button" variant="body2" onClick={() => setManualOpen(true)}>
              Ingresar cookie manualmente
            </Link>
          </Stack>
        ) : null}

        {interactiveOpen ? (
          <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ borderRadius: "8px" }}>
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>Se abrió una ventana de Chrome controlada para SISFE en tu computadora.</Typography>
              <Typography variant="body2">
                Completá tus credenciales y resolvé el reCAPTCHA allí. Al presionar "Ingresar", la ventana se cerrará sola y la conexión se completará automáticamente.
              </Typography>
            </Stack>
          </Alert>
        ) : null}

        {conectado && !isRunning ? (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Última sincronización: {formatLastSync(status.lastSyncAt)}
            </Typography>

            {syncStatus === "done" ? (
              <Alert severity="success" sx={{ borderRadius: "8px" }}>
                {status.syncMessage || "Sincronización completada."} Actualizados: {statLabel(stats, "actualizados")}. Movimientos nuevos: {statLabel(stats, "movimientosNuevos")}.
              </Alert>
            ) : null}

            {Number(stats?.noEncontradosEnSisfe ?? 0) > 0 ? (
              <Alert severity="info" sx={{ borderRadius: "8px" }}>
                {statLabel(stats, "noEncontradosEnSisfe")} expedientes cargados en Iuris no se encontraron en el portal SISFE.
              </Alert>
            ) : null}

            {Number(stats?.pdfsNoDescargados ?? 0) > 0 ? (
              <Alert severity="warning" sx={{ borderRadius: "8px" }}>
                {statLabel(stats, "pdfsNoDescargados")} expediente(s) digital(es) no se pudieron descargar (posible bloqueo de reCAPTCHA o demora del portal). Los movimientos sí se actualizaron.
              </Alert>
            ) : null}

            {syncStatus === "error" ? (
              <Alert severity="error" sx={{ borderRadius: "8px" }}>{status.syncMessage || "La sincronización falló."}</Alert>
            ) : null}

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="contained" startIcon={<SyncOutlined />} disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                Sincronizar ahora
              </Button>
              <Button variant="outlined" color="inherit" startIcon={<DeleteOutline />} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                Desconectar
              </Button>
            </Stack>
          </Stack>
        ) : null}

        {isRunning ? (
          <Stack spacing={1.5}>
            <LinearProgress variant="determinate" value={Number(status.syncProgress ?? 0)} />
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {status.syncMessage || "Sincronizando expedientes..."}
              </Typography>
              <Button 
                variant="outlined" 
                color="error" 
                size="small" 
                disabled={cancelMutation.isPending} 
                onClick={() => cancelMutation.mutate()}
              >
                Cancelar
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Stack>

      <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ingresar sesión de SISFE</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning" sx={{ borderRadius: "8px" }}>
              Usá este método ya que el reCAPTCHA está bloqueado al cargar SISFE a través del proxy local.
            </Alert>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Iniciá sesión en el portal real de SISFE (<Link href="https://sisfe.justiciasantafe.gov.ar/login-matriculado" target="_blank" rel="noopener">sisfe.justiciasantafe.gov.ar</Link>), copiá tu cookie de sesión <strong>JSESSIONID</strong> y pegala acá.
            </Typography>
            <TextField
              size="small"
              label="Cookie JSESSIONID (o cookie completa)"
              placeholder="Ej: JSESSIONID=0000XXXXXX... o solo el valor"
              value={cookieInput}
              onChange={(event) => setCookieInput(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!cookieInput.trim() || manualMutation.isPending}
            onClick={() => manualMutation.mutate()}
          >
            Verificar y conectar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
