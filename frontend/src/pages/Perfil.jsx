import { useEffect, useMemo, useState } from "react";
import { useSnackbar } from "notistack";
import api from "../api/axios";
import { disablePush, enablePush, getPushStatus } from "../api/push.api";
import { useAuth } from "../auth/useAuth";
import SisfeSyncPanel from "../components/SisfeSyncPanel";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  AccountCircle,
  BadgeOutlined,
  LockOutlined,
  NotificationsActiveOutlined,
  NotificationsOffOutlined,
  NotificationsOutlined,
  SaveOutlined,
  SecurityOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

export default function Perfil() {
  const { user, updateUser } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [profile, setProfile] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pushStatus, setPushStatus] = useState({
    supported: false,
    permission: "default",
    subscribed: false,
    loading: true,
  });
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPushStatus()
      .then((status) => {
        if (!cancelled) {
          setPushStatus({ ...status, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPushStatus((current) => ({ ...current, loading: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setProfile({
      nombre: user?.nombre ?? "",
      apellido: user?.apellido ?? "",
      telefono: user?.telefono ?? "",
    });
  }, [user]);

  const rolesLabel = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : user?.rol ? [user.rol] : [];
    if (roles.length === 0) return "Miembro";
    const map = { ADMIN: "Admin SaaS", DIRECTOR: "Director", ABOGADO: "Abogado", ASISTENTE: "Asistente", SUPERADMIN: "Super Admin" };
    return roles.map((role) => map[role] || role).join(", ");
  }, [user]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.put("/auth/profile", {
        nombre: profile.nombre.trim(),
        apellido: profile.apellido.trim(),
        telefono: profile.telefono.trim() || null,
      });
      updateUser(data);
      enqueueSnackbar("Perfil actualizado correctamente", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error?.message || "No se pudo actualizar el perfil", { variant: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      enqueueSnackbar("La nueva contraseña y la confirmación no coinciden", { variant: "error" });
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/auth/change-password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      enqueueSnackbar("Contraseña actualizada exitosamente", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error?.message || "No se pudo cambiar la contraseña", { variant: "error" });
    } finally {
      setSavingPassword(false);
    }
  };

  const togglePassword = (key) => {
    setShowPasswords((current) => ({ ...current, [key]: !current[key] }));
  };

  const refreshPushStatus = async () => {
    const status = await getPushStatus();
    setPushStatus({ ...status, loading: false });
  };

  const handlePushToggle = async () => {
    setPushBusy(true);
    try {
      if (pushStatus.subscribed) {
        await disablePush();
        await refreshPushStatus();
        enqueueSnackbar("Notificaciones push desactivadas", { variant: "success" });
        return;
      }

      await enablePush();
      await refreshPushStatus();
      enqueueSnackbar("Notificaciones push activadas", { variant: "success" });
    } catch (error) {
      const code = error?.message;
      if (code === "PUSH_NOT_SUPPORTED" || code === "PUSH_NO_SERVICE_WORKER") {
        enqueueSnackbar("Tu navegador no soporta notificaciones push o el service worker no está disponible", { variant: "warning" });
      } else if (code === "PUSH_PERMISSION_DENIED") {
        await refreshPushStatus();
        enqueueSnackbar("Permiso de notificaciones denegado. Habilitalo desde la configuración del navegador.", { variant: "warning" });
      } else if (code === "PUSH_SERVER_DISABLED") {
        enqueueSnackbar("Las notificaciones push no están habilitadas en el servidor", { variant: "info" });
      } else {
        enqueueSnackbar(error.response?.data?.error?.message || "No se pudieron actualizar las notificaciones push", { variant: "error" });
      }
    } finally {
      setPushBusy(false);
    }
  };

  const pushAlert = useMemo(() => {
    if (pushStatus.loading) return null;
    if (!pushStatus.supported) {
      return { severity: "warning", text: "Tu navegador no soporta notificaciones push en este dispositivo." };
    }
    if (pushStatus.permission === "denied") {
      return { severity: "warning", text: "Bloqueaste las notificaciones. Habilitalas desde la configuración del navegador para recibir recordatorios." };
    }
    if (pushStatus.subscribed) {
      return { severity: "success", text: "Recibirás recordatorios de tareas y eventos aunque la app esté cerrada." };
    }
    return { severity: "info", text: "Activá las notificaciones para recibir recordatorios de tareas y eventos en este dispositivo." };
  }, [pushStatus]);

  const passwordAdornment = (key, visible) => (
    <InputAdornment position="end">
      <Tooltip title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>
        <IconButton onClick={() => togglePassword(key)} edge="end" size="small">
          {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );

  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 900, letterSpacing: 0, mb: 0.75 }}>
            Mi Perfil
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Gestioná tus datos personales y la seguridad de tu cuenta.
          </Typography>
        </Box>

        <Grid container spacing={3} alignItems="stretch">
          <Grid size={{ xs: 12, md: 7 }} sx={{ display: "flex" }}>
            <Paper
              component="form"
              onSubmit={handleProfileSubmit}
              elevation={0}
              sx={{ width: "100%", height: "100%", p: { xs: 2.5, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}
            >
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <AccountCircle color="primary" />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 850 }}>
                      Datos Personales
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      El email queda protegido y no se puede modificar desde esta pantalla.
                    </Typography>
                  </Box>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField size="small" label="Nombre" value={profile.nombre} onChange={(e) => setProfile((v) => ({ ...v, nombre: e.target.value }))} fullWidth required />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField size="small" label="Apellido" value={profile.apellido} onChange={(e) => setProfile((v) => ({ ...v, apellido: e.target.value }))} fullWidth required />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField size="small" label="Teléfono" value={profile.telefono} onChange={(e) => setProfile((v) => ({ ...v, telefono: e.target.value }))} fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      size="small"
                      label="Email"
                      value={user?.email ?? ""}
                      fullWidth
                      disabled
                      helperText="El email no se puede modificar."
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlined fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>

                <Divider />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField size="small" label="Rol" value={rolesLabel} fullWidth disabled InputProps={{ startAdornment: <InputAdornment position="start"><BadgeOutlined fontSize="small" /></InputAdornment> }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField size="small" label="Estudio" value={user?.estudio?.nombre ?? "Estudio"} fullWidth disabled />
                  </Grid>
                </Grid>

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button type="submit" variant="contained" startIcon={savingProfile ? <CircularProgress size={18} /> : <SaveOutlined />} disabled={savingProfile}>
                    Guardar Cambios
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }} sx={{ display: "flex" }}>
            <Paper
              component="form"
              onSubmit={handlePasswordSubmit}
              elevation={0}
              sx={{ width: "100%", height: "100%", p: { xs: 2.5, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}
            >
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <SecurityOutlined color="secondary" />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 850 }}>
                      Seguridad
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Cambiar Contraseña
                    </Typography>
                  </Box>
                </Stack>

                <Alert severity="info" sx={{ borderRadius: "8px" }}>
                  Al cambiarla, se revocan las sesiones abiertas en otros dispositivos.
                </Alert>

                <TextField
                  size="small"
                  label="Contraseña Actual"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords((v) => ({ ...v, currentPassword: e.target.value }))}
                  fullWidth
                  required
                  InputProps={{ endAdornment: passwordAdornment("current", showPasswords.current) }}
                />
                <TextField
                  size="small"
                  label="Nueva Contraseña"
                  type={showPasswords.next ? "text" : "password"}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords((v) => ({ ...v, newPassword: e.target.value }))}
                  fullWidth
                  required
                  InputProps={{ endAdornment: passwordAdornment("next", showPasswords.next) }}
                />
                <TextField
                  size="small"
                  label="Confirmar Nueva Contraseña"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords((v) => ({ ...v, confirmPassword: e.target.value }))}
                  fullWidth
                  required
                  error={passwords.confirmPassword.length > 0 && passwords.newPassword !== passwords.confirmPassword}
                  helperText={passwords.confirmPassword.length > 0 && passwords.newPassword !== passwords.confirmPassword ? "Las contraseñas no coinciden" : " "}
                  InputProps={{ endAdornment: passwordAdornment("confirm", showPasswords.confirm) }}
                />

                <Button type="submit" variant="contained" color="secondary" disabled={savingPassword} startIcon={savingPassword ? <CircularProgress size={18} /> : <LockOutlined />}>
                  Cambiar Contraseña
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Paper
          elevation={0}
          sx={{ width: "100%", p: { xs: 2.5, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}
        >
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {pushStatus.subscribed ? <NotificationsActiveOutlined color="primary" /> : <NotificationsOutlined color="primary" />}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>
                  Notificaciones
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Recordatorios push de tareas y eventos en este dispositivo.
                </Typography>
              </Box>
            </Stack>

            {pushAlert ? (
              <Alert severity={pushAlert.severity} sx={{ borderRadius: "8px" }}>
                {pushAlert.text}
              </Alert>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                color={pushStatus.subscribed ? "inherit" : "primary"}
                disabled={pushBusy || pushStatus.loading || !pushStatus.supported || pushStatus.permission === "denied"}
                onClick={handlePushToggle}
                startIcon={
                  pushBusy
                    ? <CircularProgress size={18} />
                    : pushStatus.subscribed
                      ? <NotificationsOffOutlined />
                      : <NotificationsActiveOutlined />
                }
              >
                {pushStatus.subscribed ? "Desactivar" : "Activar"}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <SisfeSyncPanel />
      </Stack>
    </Box>
  );
}
