import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { alpha } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AssignmentTurnedIn,
  CalendarMonth,
  FolderSpecial,
  Gavel,
  Payments,
  PersonAdd,
} from "@mui/icons-material";
import NovedadesExpedientesCard from "../../components/NovedadesExpedientesCard";
import { useAuth } from "../../auth/useAuth";
import DashboardViewToggle from "./DashboardViewToggle";
import { CARD_TONES, displayDate, eventDate, panelSx, readUserName } from "./dashboardUtils";
import { EventRow, TaskRow } from "./DashboardRows";
import { useDashboardData } from "./useDashboardData";

export default function DashboardClassic({ view, onSwitchView }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedTask, setExpandedTask] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);

  const {
    pendingTasks,
    upcomingEvents,
    realizadoEstadoId,
    toggleTaskMutation,
    toggleSubtaskMutation,
    toggleEventMutation,
    taskBusy,
    eventBusy,
  } = useDashboardData();

  const firstName = readUserName(user);

  return (
    <Box sx={{ position: "relative", pb: 4 }}>
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        sx={{ mb: 3.5 }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.4, lineHeight: 1.2 }}>
              {firstName ? `¡Hola de nuevo, ${firstName}!` : "¡Hola de nuevo!"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
              {displayDate()}
            </Typography>
          </Box>
          <DashboardViewToggle view={view} onSwitch={onSwitchView} />
        </Stack>
      </Box>

      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        sx={{ mb: 2.5 }}
      >
        <NovedadesExpedientesCard />
      </Box>

      <Paper elevation={0} sx={{ ...panelSx, p: 2, mb: 2.5 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} alignItems={{ xs: "flex-start", lg: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Acciones Rápidas
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
              Crea nuevos registros directamente en la plataforma
            </Typography>
          </Box>
          <Box sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(5, 1fr)" },
            gap: 1.5,
            width: { xs: "100%", lg: "auto" },
          }}>
            {[
              { label: "Nuevo Expte.", path: "/expedientes/nuevo", icon: <FolderSpecial />, tone: CARD_TONES.blue },
              { label: "Nuevo Cliente", path: "/clientes/nuevo", icon: <PersonAdd />, tone: CARD_TONES.orange },
              { label: "Nuevo Evento", path: "/eventos/nuevo", icon: <CalendarMonth />, tone: CARD_TONES.violet },
              { label: "Nueva Tarea", path: "/tareas/nuevo", icon: <AssignmentTurnedIn />, tone: CARD_TONES.cyan },
              { label: "Cargar Finanza", path: "/finanzas/nuevo", icon: <Payments />, tone: CARD_TONES.green },
            ].map((action) => (
              <Button
                key={action.label}
                variant="outlined"
                component={motion.button}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                startIcon={action.icon}
                onClick={() => navigate(action.path)}
                sx={{
                  borderRadius: "12px",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  px: 1.8,
                  py: 0.85,
                  width: "100%",
                  justifyContent: "flex-start",
                  borderColor: alpha(action.tone, 0.35),
                  color: action.tone,
                  bgcolor: alpha(action.tone, 0.04),
                  "&:hover": {
                    borderColor: action.tone,
                    bgcolor: alpha(action.tone, 0.08),
                  },
                }}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...panelSx, p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Tareas Pendientes
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  Próximos compromisos operativos
                </Typography>
              </Box>
              <Chip label={`${pendingTasks.length} pendientes`} size="small" sx={{ fontWeight: 800, borderRadius: "999px" }} />
            </Stack>
            <Stack spacing={1.1}>
              {pendingTasks.slice(0, 7).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  expanded={expandedTask === task.id}
                  onExpand={() => setExpandedTask((id) => (id === task.id ? null : task.id))}
                  onToggle={(target) => toggleTaskMutation.mutate(target)}
                  onToggleSubtask={(taskId, subtaskId) => toggleSubtaskMutation.mutate({ taskId, subtaskId })}
                  busy={taskBusy}
                  navigate={navigate}
                />
              ))}
              {!pendingTasks.length && (
                <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  <AssignmentTurnedIn sx={{ mb: 1, color: "success.main" }} />
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>No hay tareas pendientes.</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...panelSx, p: 2.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Eventos
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  Vencidos por cerrar y próximos
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: alpha(CARD_TONES.violet, 0.12), color: CARD_TONES.violet }}>
                <CalendarMonth />
              </Avatar>
            </Stack>
            <Stack spacing={1.1}>
              {upcomingEvents.slice(0, 6).map((event) => {
                const eventoPaso = new Date(eventDate(event)).getTime() < Date.now();
                return (
                  <EventRow
                    key={event.id}
                    event={event}
                    expanded={expandedEvent === event.id}
                    onExpand={() => setExpandedEvent((id) => (id === event.id ? null : event.id))}
                    navigate={navigate}
                    canToggle={realizadoEstadoId != null && eventoPaso}
                    checked={realizadoEstadoId != null && Number(event.estadoId) === realizadoEstadoId}
                    onToggle={(target) => toggleEventMutation.mutate(target)}
                    busy={eventBusy}
                  />
                );
              })}
              {!upcomingEvents.length && (
                <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                  <Gavel sx={{ mb: 1, color: "primary.main" }} />
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>No hay eventos pendientes.</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
