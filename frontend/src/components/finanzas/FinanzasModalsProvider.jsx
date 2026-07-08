import { useCallback, useMemo, useState } from "react";
import { FinanzasModalsContext } from "./finanzasModalsContext";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { alpha } from "@mui/material/styles";
import api from "../../api/axios";
import {
  Avatar,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { WarningAmber } from "@mui/icons-material";
import { finanzasDialogPaperSx, invalidateFinanzasQueries } from "../../pages/finanzasUtils";
import { getApiError } from "../../pages/tareasUtils";

export function FinanzasModalsProvider({ children }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openDelete = useCallback((target) => setDeleteTarget(target), []);

  const value = useMemo(() => ({ openDelete }), [openDelete]);

  return (
    <FinanzasModalsContext.Provider value={value}>
      {children}
      <DeleteConfirmDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onSuccess={(msg) => {
          setDeleteTarget(null);
          invalidateFinanzasQueries(queryClient);
          enqueueSnackbar(msg, { variant: "success" });
        }}
        onError={(err) =>
          enqueueSnackbar(getApiError(err, "No se pudo eliminar"), { variant: "error" })
        }
      />
    </FinanzasModalsContext.Provider>
  );
}

function DeleteConfirmDialog({ target, onClose, onSuccess, onError }) {
  const [submitting, setSubmitting] = useState(false);
  if (!target) return null;

  const labels = {
    honorario: "honorario",
    gasto: "gasto",
    ingreso: "cobro",
    plan: "plan de pagos",
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const paths = { honorario: "honorarios", gasto: "gastos", ingreso: "ingresos", plan: "planes" };
      await api.delete(`/${paths[target.type]}/${target.item.id}`);
      onSuccess(`${labels[target.type]} eliminado con éxito`);
    } catch (err) {
      onError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: finanzasDialogPaperSx }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: alpha("#EF4444", 0.12), color: "error.main" }}><WarningAmber /></Avatar>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Confirmar eliminación</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          ¿Eliminar este {labels[target.type]}? Esta acción no se puede deshacer.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={handleDelete} disabled={submitting} sx={{ fontWeight: 900 }}>
          {submitting ? <CircularProgress size={20} color="inherit" /> : "Eliminar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
