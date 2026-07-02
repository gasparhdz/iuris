import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Gavel,
  Shield,
  NotificationsActive,
  DoneAll,
  OpenInNew,
  PictureAsPdf,
  Description,
  Article,
  Email,
  ReceiptLong,
  InsertDriveFile,
  EventAvailable,
  AssignmentTurnedIn,
  Event as EventIcon,
} from "@mui/icons-material";
import {
  getNovedades,
  marcarNovedadesLeidas,
} from "../api/notificaciones.api";
import { getSisfeStatus } from "../api/sisfe.api";
import AgendarDialog from "./AgendarDialog";
import SisfeSyncButton from "./SisfeSyncButton";

// Color del indicador de frescura según cuánto hace que no se sincroniza SISFE.
function frescuraSync(lastSyncAt) {
  if (!lastSyncAt) {
    return { tono: "#EF5350", texto: "Nunca sincronizado" };
  }
  const horas = dayjs().diff(dayjs(lastSyncAt), "hour");
  const texto = `Sincronizado ${formatDistanceToNow(new Date(lastSyncAt), { locale: es, addSuffix: true })}`;
  if (horas < 24) return { tono: "#2EBD85", texto };
  if (horas < 72) return { tono: "#FFA726", texto };
  return { tono: "#EF5350", texto };
}

// Ícono por tipo de movimiento judicial (similar a SISFE). El tooltip muestra el tipo crudo.
const TIPO_ICONS = [
  { match: /tramite|trámite/i, Icon: Shield },
  { match: /escrito/i, Icon: Description },
  { match: /despacho|provee|providencia/i, Icon: Article },
  { match: /cedula|cédula|notificacion|notificación/i, Icon: Email },
  { match: /oficio/i, Icon: ReceiptLong },
  { match: /resoluc|sentencia|auto/i, Icon: Gavel },
];

function iconForTipo(tipo) {
  const found = TIPO_ICONS.find((t) => t.match.test(tipo || ""));
  return found ? found.Icon : InsertDriveFile;
}

function tituloExpediente(n) {
  const detalle = n.descripcion || n.caratula || `Expediente #${n.casoId}`;
  return n.nroExpte ? `Expte: ${n.nroExpte} — ${detalle}` : detalle;
}

/**
 * Card de "Novedades de expedientes": muestra los movimientos judiciales nuevos
 * (origen SISFE) que el usuario todavía no leyó, sin tener que entrar a cada caso.
 * Se actualiza en vivo cuando termina una sincronización SISFE (canal SSE).
 */
export default function NovedadesExpedientesCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Menú "Agendar" (elegir tarea/evento) y el diálogo de carga rápida.
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuNovedad, setMenuNovedad] = useState(null);
  const [dialog, setDialog] = useState({ open: false, modo: "tarea", novedad: null });

  const { data, isLoading } = useQuery({
    queryKey: ["novedades-expedientes"],
    queryFn: getNovedades,
    refetchOnWindowFocus: true,
  });

  const novedades = data?.data?.novedades ?? [];
  const total = data?.data?.total ?? 0;

  // Estado de SISFE para el indicador de frescura (comparte caché con SisfeSyncButton).
  const { data: sisfeStatus } = useQuery({
    queryKey: ["sisfe", "status"],
    queryFn: getSisfeStatus,
    staleTime: 15_000,
  });
  const lastSyncAt = sisfeStatus?.lastSyncAt ?? null;
  const frescura = frescuraSync(lastSyncAt);

  const marcarTodo = useMutation({
    mutationFn: () => marcarNovedadesLeidas(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["novedades-expedientes"] }),
  });

  const marcarUno = useMutation({
    mutationFn: (id) => marcarNovedadesLeidas([id]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["novedades-expedientes"] }),
  });

  const irAlExpediente = (novedad) => {
    marcarUno.mutate(novedad.id);
    navigate(`/expedientes/${novedad.casoId}`);
  };

  const abrirExpedienteDigital = (novedad) => {
    marcarUno.mutate(novedad.id);
    navigate(`/expedientes/${novedad.casoId}?tab=expediente_digital`);
  };

  const abrirMenuAgendar = (e, novedad) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuNovedad(novedad);
  };

  const cerrarMenuAgendar = () => {
    setMenuAnchor(null);
    setMenuNovedad(null);
  };

  const elegirModo = (modo) => {
    setDialog({ open: true, modo, novedad: menuNovedad });
    cerrarMenuAgendar();
  };

  // Al crear la tarea/evento, la novedad se da por vista (actuaste sobre ella).
  const onAgendado = (novedad) => {
    if (novedad?.id) marcarUno.mutate(novedad.id);
  };

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
        sx={{ mb: 1, rowGap: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <NotificationsActive sx={{ color: "primary.main" }} fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Novedades de expedientes
          </Typography>
          <Chip size="small" color="primary" label={total} />
          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ ml: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: frescura.tono, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              {frescura.texto}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          {total > 0 && (
            <Button
              size="small"
              startIcon={<DoneAll fontSize="small" />}
              onClick={() => marcarTodo.mutate()}
              disabled={marcarTodo.isPending}
            >
              Marcar leído
            </Button>
          )}
          <SisfeSyncButton
            variant="outlined"
            size="small"
            lastSyncAt={lastSyncAt}
            sx={{ minWidth: { xs: 0, sm: 160 }, py: 0.4 }}
          />
        </Stack>
      </Stack>
      <Divider />

      <Box sx={{ maxHeight: 300, overflowY: "auto", mt: 0.5 }}>
        {isLoading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : total === 0 ? (
          <Typography variant="body2" sx={{ px: 1, py: 2.5, color: "text.secondary" }}>
            No hay movimientos nuevos sin leer.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {novedades.map((n) => {
              const TipoIcon = iconForTipo(n.tipo);
              return (
                <Stack
                  key={n.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{
                    py: 0.85,
                    px: 0.5,
                    borderRadius: 1.5,
                    cursor: "pointer",
                    "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
                  }}
                  onClick={() => irAlExpediente(n)}
                >
                  <Tooltip title={n.tipo || "Movimiento"} arrow>
                    <Box
                      sx={{
                        display: "grid",
                        placeItems: "center",
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        borderRadius: "50%",
                        color: "primary.main",
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                      }}
                    >
                      <TipoIcon fontSize="small" />
                    </Box>
                  </Tooltip>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {tituloExpediente(n)}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: "text.secondary", flexShrink: 0 }}>
                        {n.fecha ? dayjs(n.fecha).format("DD/MM/YYYY") : "Sin fecha"}
                      </Typography>
                      {n.novedad && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                          · {n.novedad}
                        </Typography>
                      )}
                    </Stack>
                  </Box>

                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Tooltip title="Agendar tarea o evento" arrow>
                      <IconButton
                        size="medium"
                        color="primary"
                        onClick={(e) => abrirMenuAgendar(e, n)}
                      >
                        <EventAvailable fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ver expediente" arrow>
                      <IconButton
                        size="medium"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          irAlExpediente(n);
                        }}
                      >
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Abrir expediente digital" arrow>
                      <IconButton
                        size="medium"
                        color="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirExpedienteDigital(n);
                        }}
                      >
                        <PictureAsPdf fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={cerrarMenuAgendar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => elegirModo("tarea")}>
          <ListItemIcon><AssignmentTurnedIn fontSize="small" /></ListItemIcon>
          <ListItemText>Crear tarea</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => elegirModo("evento")}>
          <ListItemIcon><EventIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Crear evento</ListItemText>
        </MenuItem>
      </Menu>

      <AgendarDialog
        open={dialog.open}
        modo={dialog.modo}
        novedad={dialog.novedad}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onCreated={onAgendado}
      />
    </Paper>
  );
}
