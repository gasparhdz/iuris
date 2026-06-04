import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useThemeMode } from "../theme/ThemeModeProvider";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  GlobalStyles,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DarkModeOutlined, LightModeOutlined, LockResetOutlined, Visibility, VisibilityOff } from "@mui/icons-material";
import { motion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, toggle } = useThemeMode();
  const isDark = mode === "dark";
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const missingParams = useMemo(() => !email || !token, [email, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { email, token, newPassword });
      setDone(true);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      setError(code === "INVALID_OR_EXPIRED_TOKEN" ? "El enlace es inválido o expiró." : err.response?.data?.error?.message || "No pudimos restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  const passwordAdornment = (visible, onClick) => (
    <InputAdornment position="end">
      <Tooltip title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>
        <IconButton onClick={onClick} edge="end" size="small">
          {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </Tooltip>
    </InputAdornment>
  );

  return (
    <>
      <GlobalStyles styles={{ "html, body": { overflow: "hidden" } }} />
      <Box sx={authPageSx(isDark)}>
        <Tooltip title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} placement="left">
          <IconButton onClick={toggle} size="small" sx={modeToggleSx(isDark)}>
            {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} style={{ zIndex: 1, width: "100%", maxWidth: "440px" }}>
          <Card elevation={0} sx={authCardSx(isDark)}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ textAlign: "center", mb: 3.5 }}>
                <BrandLogo sx={{ height: { xs: 64, sm: 74 }, mx: "auto", mb: 1.5 }} />
                <Typography variant="h5" component="h1" sx={{ fontWeight: 850, mb: 1 }}>
                  Nueva Contraseña
                </Typography>
              </Box>

              {done ? (
                <Box sx={{ textAlign: "center" }}>
                  <LockResetOutlined color="primary" sx={{ fontSize: 44, mb: 1.5 }} />
                  <Alert severity="success" sx={{ mb: 3, borderRadius: "8px", textAlign: "left" }}>
                    Contraseña restablecida exitosamente. Ya podés iniciar sesión con tu nueva contraseña.
                  </Alert>
                  <Button variant="contained" onClick={() => navigate("/login")} fullWidth sx={primaryButtonSx}>
                    Ir al Login
                  </Button>
                </Box>
              ) : (
                <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {(missingParams || error) && (
                    <Alert severity="error" sx={{ borderRadius: "8px" }}>
                      {missingParams ? "El enlace de recupero no es válido." : error}
                    </Alert>
                  )}
                  <TextField
                    label="Nueva Contraseña"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    fullWidth
                    disabled={missingParams}
                    InputProps={{ endAdornment: passwordAdornment(showNewPassword, () => setShowNewPassword((v) => !v)) }}
                  />
                  <TextField
                    label="Confirmar Contraseña"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    fullWidth
                    disabled={missingParams}
                    error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                    helperText={confirmPassword.length > 0 && newPassword !== confirmPassword ? "Las contraseñas no coinciden" : " "}
                    InputProps={{ endAdornment: passwordAdornment(showConfirmPassword, () => setShowConfirmPassword((v) => !v)) }}
                  />
                  <Button type="submit" variant="contained" size="large" disabled={loading || missingParams} sx={primaryButtonSx}>
                    {loading ? <CircularProgress size={22} thickness={4} sx={{ color: "rgba(255,255,255,0.8)" }} /> : "Restablecer Contraseña"}
                  </Button>
                  {(missingParams || error) && (
                    <Button variant="text" onClick={() => navigate("/forgot-password")} sx={{ color: "text.secondary" }}>
                      Solicitar nuevo enlace
                    </Button>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </>
  );
}

const primaryButtonSx = {
  py: 1.5,
  fontSize: "0.95rem",
  fontWeight: 700,
  borderRadius: "8px",
  background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
  boxShadow: "0 4px 14px rgba(29,78,216,0.35)",
};

function authPageSx(isDark) {
  return {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isDark ? "#0F172A" : "#F6F7FA",
    px: 2,
    overflow: "hidden",
  };
}

function authCardSx(isDark) {
  return {
    overflow: "hidden",
    background: isDark ? "rgba(17,19,26,0.75)" : "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(29,78,216,0.14)",
    borderRadius: "16px",
    boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.55)" : "0 8px 40px rgba(29,78,216,0.10)",
    position: "relative",
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "2px",
      background: "linear-gradient(90deg, #3B82F6 0%, #0EA5E9 100%)",
    },
  };
}

function modeToggleSx(isDark) {
  return {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: "10px",
    color: isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.50)",
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.07)",
    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(99,102,241,0.15)",
    backdropFilter: "blur(8px)",
  };
}
