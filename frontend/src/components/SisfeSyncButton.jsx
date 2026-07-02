import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { Button, Tooltip, Typography, Box } from "@mui/material";
import { CloudSyncOutlined, LoginOutlined, CheckCircleOutline } from "@mui/icons-material";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import { getSisfeStatus, startSisfeSync, startSisfeInteractiveLogin } from "../api/sisfe.api";
import { invalidateSisfeQueries } from "../utils/sisfeInvalidation";

const MotionBox = motion.div;

function SyncIcon({ isRunning, isConnecting, isConnected }) {
  const shouldReduce = useReducedMotion();

  if (isRunning || isConnecting) {
    return (
      <MotionBox
        animate={shouldReduce ? {} : { rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", alignItems: "center" }}
      >
        <CloudSyncOutlined sx={{ fontSize: 18 }} />
      </MotionBox>
    );
  }

  if (!isConnected) return <LoginOutlined sx={{ fontSize: 18 }} />;
  return <CloudSyncOutlined sx={{ fontSize: 18 }} />;
}

export default function SisfeSyncButton({
  children = "Sincronizar SISFE",
  variant = "outlined",
  casoId,
  lastSyncAt,
  sx,
  ...props
}) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [syncKickoff, setSyncKickoff] = useState(false);

  const syncMutation = useMutation({
    mutationFn: startSisfeSync,
    onMutate: () => setSyncKickoff(true),
    onSuccess: async () => {
      enqueueSnackbar("Sincronización SISFE iniciada", { variant: "success" });
      await queryClient.invalidateQueries({ queryKey: ["sisfe"] });
      invalidateSisfeQueries(queryClient, { casoId });
    },
    onError: (error) => {
      setSyncKickoff(false);
      enqueueSnackbar(
        error.response?.data?.error?.message || "No se pudo iniciar la sincronización SISFE",
        { variant: "error" }
      );
    },
  });

  const statusQuery = useQuery({
    queryKey: ["sisfe", "status"],
    queryFn: getSisfeStatus,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = query.state.data?.syncStatus;
      return status === "running" || syncKickoff ? 2000 : false;
    },
  });

  useEffect(() => {
    const status = statusQuery.data?.syncStatus;
    if (!syncKickoff) return;
    if (status === "running" || status === "done" || status === "error") {
      setSyncKickoff(false);
    }
  }, [syncKickoff, statusQuery.data?.syncStatus]);

  const interactiveMutation = useMutation({
    mutationFn: startSisfeInteractiveLogin,
    onSuccess: () => {
      enqueueSnackbar("Conectado exitosamente con SISFE", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["sisfe"] });
      syncMutation.mutate(casoId);
    },
    onError: (error) => {
      enqueueSnackbar(
        error.response?.data?.error?.message || "No se pudo conectar a SISFE",
        { variant: "error" }
      );
    },
  });

  // Al detectar la transición running -> done/error, refrescar las listas para que
  // aparezcan los movimientos y documentos recién sincronizados sin recargar la página.
  const prevSyncStatus = useRef(statusQuery.data?.syncStatus);
  useEffect(() => {
    const current = statusQuery.data?.syncStatus;
    if (prevSyncStatus.current === "running" && (current === "done" || current === "error")) {
      invalidateSisfeQueries(queryClient, { casoId });
      if (current === "error" && statusQuery.data?.syncMessage) {
        enqueueSnackbar(statusQuery.data.syncMessage, { variant: "error" });
      }
    }
    prevSyncStatus.current = current;
  }, [queryClient, statusQuery.data?.syncStatus, statusQuery.data?.syncMessage, casoId, enqueueSnackbar]);

  const isRunning = statusQuery.data?.syncStatus === "running" || syncMutation.isPending || syncKickoff;
  const isConnecting = interactiveMutation.isPending;
  const isLoading   = statusQuery.isLoading;
  const isConnected = Boolean(statusQuery.data?.conectado);

  const handleClick = () => {
    if (!isConnected) {
      enqueueSnackbar(
        "Se abrió una ventana de Chrome controlada para SISFE en tu computadora. Completá tus credenciales y resolvé el reCAPTCHA allí.",
        { variant: "info", autoHideDuration: 10000 }
      );
      interactiveMutation.mutate();
      return;
    }
    syncMutation.mutate(casoId);
  };

  const label = isRunning    ? "Sincronizando..."
    : isConnecting           ? "Iniciando sesión..."
    : !isConnected           ? "Conectar y Sincronizar"
    : children;

  const relativeSync = lastSyncAt
    ? formatDistanceToNow(new Date(lastSyncAt), { locale: es, addSuffix: true })
    : null;

  const tooltipTitle = isRunning
    ? "Sincronización en curso"
    : relativeSync
      ? `Última sincronización ${relativeSync}`
      : "Sin sincronizaciones previas";

  return (
    <Tooltip title={tooltipTitle} placement="top">
      <span>
        <Button
          variant={variant}
          disabled={isRunning || isConnecting || isLoading}
          onClick={handleClick}
          sx={{
            borderRadius: "10px",
            fontWeight: 900,
            minWidth: 160,
            overflow: "hidden",
            position: "relative",
            ...sx,
          }}
          {...props}
        >
          {/* Barra de progreso indeterminada en la base del botón */}
          <AnimatePresence>
            {isRunning && (
              <MotionBox
                key="progress-bar"
                initial={{ scaleX: 0, transformOrigin: "left" }}
                animate={{ scaleX: [0, 1, 0], transformOrigin: ["0%", "0%", "100%"] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "currentColor",
                  opacity: 0.4,
                }}
              />
            )}
          </AnimatePresence>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SyncIcon isRunning={isRunning} isConnecting={isConnecting} isConnected={isConnected} />

            {/* Transición suave del texto del botón */}
            <AnimatePresence mode="wait">
              <MotionBox
                key={label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <Typography variant="inherit" fontWeight="inherit">
                  {label}
                </Typography>
              </MotionBox>
            </AnimatePresence>
          </Box>
        </Button>
      </span>
    </Tooltip>
  );
}
