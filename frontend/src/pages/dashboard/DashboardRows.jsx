import { AnimatePresence, motion } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Balance,
  CalendarMonth,
  Check,
  ExpandLess,
  ExpandMore,
  Gavel,
  LocationOn,
  OpenInNew,
  WarningAmber,
} from "@mui/icons-material";
import dayjs from "dayjs";
import {
  CARD_TONES,
  eventDate,
  priorityColor,
  priorityLabel,
} from "./dashboardUtils";
import {
  casoLabel,
  checklistStats,
  clienteLabel,
  formatFriendlyDate,
  isOverdue,
} from "../tareasUtils";

function PriorityPill({ task }) {
  const tone = priorityColor(task?.prioridad || task?.prioridadNombre);
  return (
    <Chip
      size="small"
      label={priorityLabel(task)}
      sx={{
        height: 23,
        borderRadius: "999px",
        bgcolor: alpha(tone, 0.14),
        color: tone,
        border: `1px solid ${alpha(tone, 0.38)}`,
        fontWeight: 800,
        fontSize: "0.68rem",
      }}
    />
  );
}

export function AnimatedCheck({ checked, disabled, onClick }) {
  const theme = useTheme();
  return (
    <Tooltip title={checked ? "Marcar pendiente" : "Completar"}>
      <Box
        component={motion.button}
        type="button"
        disabled={disabled}
        onClick={onClick}
        whileTap={{ scale: 0.82 }}
        animate={{
          scale: checked ? 1 : 0.96,
          backgroundColor: checked ? CARD_TONES.green : alpha(theme.palette.background.paper, 0.55),
          borderColor: checked ? CARD_TONES.green : alpha(theme.palette.text.secondary, 0.32),
        }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          border: "1px solid",
          display: "grid",
          placeItems: "center",
          cursor: disabled ? "progress" : "pointer",
          padding: 0,
          flex: "0 0 auto",
        }}
      >
        <AnimatePresence>
          {checked && (
            <Box
              component={motion.span}
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              sx={{ color: "white", lineHeight: 0 }}
            >
              <Check fontSize="small" />
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </Tooltip>
  );
}

export function TaskRow({ task, expanded, onExpand, onToggle, onToggleSubtask, busy, navigate }) {
  const theme = useTheme();
  const stats = checklistStats(task);
  const overdue = isOverdue(task);
  const subtasks = Array.isArray(task.items) ? task.items : [];
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "14px",
        border: "1px solid",
        borderColor: "divider",
        borderLeft: `4px solid ${overdue ? CARD_TONES.red : alpha(priorityColor(task.prioridad), 0.75)}`,
        bgcolor: "background.paper",
        boxShadow: "none",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <AnimatedCheck checked={Boolean(task.completada)} disabled={busy} onClick={(e) => { e.stopPropagation(); onToggle(task); }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 800, color: task.completada ? "text.secondary" : "text.primary" }}>
              {task.titulo || "Tarea sin título"}
            </Typography>
            <PriorityPill task={task} />
            {overdue && (
              <Chip
                icon={<WarningAmber sx={{ fontSize: "14px !important" }} />}
                label="Atrasado"
                size="small"
                sx={{
                  height: 23,
                  bgcolor: alpha(CARD_TONES.red, 0.12),
                  color: CARD_TONES.red,
                  border: `1px solid ${alpha(CARD_TONES.red, 0.36)}`,
                  fontWeight: 800,
                }}
              />
            )}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
            {formatFriendlyDate(task.fechaLimite)} · {[clienteLabel(task.cliente), casoLabel(task.caso)].filter(Boolean).join(" · ") || "Sin vinculación"}
          </Typography>
          {stats.total > 0 && (
            <LinearProgress
              variant="determinate"
              value={stats.percent}
              sx={{
                mt: 1.2,
                height: 4,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.text.secondary, 0.12),
                "& .MuiLinearProgress-bar": { borderRadius: 999, bgcolor: CARD_TONES.cyan },
              }}
            />
          )}
        </Box>
        <IconButton size="small" onClick={onExpand} sx={{ mt: -0.4 }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <Box sx={{ pl: 5.3, pt: 1.4 }}>
              {task.descripcion && (
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.2 }}>
                  {task.descripcion}
                </Typography>
              )}
              {subtasks.length > 0 && (
                <Stack spacing={0.7} sx={{ mb: 1.2 }}>
                  {subtasks.map((item) => (
                    <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                      <AnimatedCheck
                        checked={Boolean(item.completada)}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubtask(task.id, item.id);
                        }}
                      />
                      <Typography variant="caption" sx={{ color: item.completada ? "text.disabled" : "text.secondary", fontWeight: 700 }}>
                        {item.titulo}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Button
                size="small"
                endIcon={<OpenInNew />}
                onClick={() => navigate(`/tareas/${task.id}`)}
                sx={{ borderRadius: "10px", fontWeight: 800 }}
              >
                Ver tarea
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

export function EventRow({ event, expanded, onExpand, navigate, checked, onToggle, busy, canToggle }) {
  const fecha = eventDate(event);
  const isAudiencia = /audiencia/i.test([event.titulo, event.tipo?.nombre, event.tipoEvento?.nombre].filter(Boolean).join(" "));
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "14px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        position: "relative",
        overflow: "hidden",
        "@keyframes pulseDot": {
          "0%": { transform: "scale(0.9)", opacity: 0.55 },
          "50%": { transform: "scale(1.35)", opacity: 1 },
          "100%": { transform: "scale(0.9)", opacity: 0.55 },
        },
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="flex-start">
        {canToggle && (
          <AnimatedCheck
            checked={checked}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(event);
            }}
          />
        )}
        <Box
          sx={{
            width: 44,
            minWidth: 44,
            borderRadius: "12px",
            py: 0.9,
            textAlign: "center",
            bgcolor: alpha(isAudiencia ? CARD_TONES.violet : CARD_TONES.blue, 0.12),
            color: isAudiencia ? CARD_TONES.violet : CARD_TONES.blue,
            border: `1px solid ${alpha(isAudiencia ? CARD_TONES.violet : CARD_TONES.blue, 0.22)}`,
          }}
        >
          <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, textTransform: "uppercase", lineHeight: 1 }}>
            {fecha ? dayjs(fecha).format("MMM") : "--"}
          </Typography>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.15 }}>
            {fecha ? dayjs(fecha).format("D") : "--"}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            {isAudiencia && (
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  bgcolor: CARD_TONES.violet,
                  animation: "pulseDot 1.8s ease-in-out infinite",
                }}
              />
            )}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 800,
                color: checked ? "text.secondary" : "text.primary",
                textDecoration: checked ? "line-through" : "none",
              }}
            >
              {event.titulo || event.nombre || "Evento"}
            </Typography>
            {isAudiencia && (
              <Chip
                size="small"
                icon={<Gavel sx={{ fontSize: "14px !important" }} />}
                label="Audiencia"
                sx={{
                  height: 23,
                  color: CARD_TONES.violet,
                  bgcolor: alpha(CARD_TONES.violet, 0.12),
                  border: `1px solid ${alpha(CARD_TONES.violet, 0.34)}`,
                  fontWeight: 800,
                }}
              />
            )}
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.45 }}>
            {fecha ? `${formatFriendlyDate(fecha)} hs` : "Sin fecha"}
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.55 }}>
            {(event.ubicacion || event.lugar) && (
              <Stack direction="row" spacing={0.45} alignItems="center">
                <LocationOn sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  {event.ubicacion || event.lugar}
                </Typography>
              </Stack>
            )}
            {(event.caso || event.expediente) && (
              <Stack direction="row" spacing={0.45} alignItems="center">
                <Balance sx={{ fontSize: 14, color: "text.disabled" }} />
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                  {casoLabel(event.caso || event.expediente)}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
        <IconButton size="small" onClick={onExpand} sx={{ mt: -0.4 }}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Stack>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <Box sx={{ pl: 7, pt: 1.2 }}>
              {event.descripcion && (
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.2 }}>
                  {event.descripcion}
                </Typography>
              )}
              <Button
                size="small"
                endIcon={<OpenInNew />}
                onClick={() => navigate(`/eventos/${event.id}`)}
                sx={{ borderRadius: "10px", fontWeight: 800 }}
              >
                Ver evento
              </Button>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
