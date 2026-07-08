import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useThemeMode } from "../theme/useThemeMode";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  GlobalStyles,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DarkModeOutlined, EmailOutlined, LightModeOutlined } from "@mui/icons-material";
import { motion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";

const MotionDiv = motion.div;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { mode, toggle } = useThemeMode();
  const isDark = mode === "dark";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || "No pudimos enviar las instrucciones.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalStyles styles={{ "html, body": { overflow: "hidden" } }} />
      <Box sx={authPageSx(isDark)}>
        <Tooltip title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} placement="left">
          <IconButton onClick={toggle} size="small" sx={modeToggleSx(isDark)}>
            {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
          </IconButton>
        </Tooltip>

        <MotionDiv initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} style={{ zIndex: 1, width: "100%", maxWidth: "440px" }}>
          <Card elevation={0} sx={authCardSx(isDark)}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ textAlign: "center", mb: 3.5 }}>
                <BrandLogo sx={{ height: { xs: 64, sm: 74 }, mx: "auto", mb: 1.5 }} />
                <Typography variant="h5" component="h1" sx={{ fontWeight: 850, mb: 1 }}>
                  Recuperar Contraseña
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                  Ingresá tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.
                </Typography>
              </Box>

              {sent ? (
                <Box sx={{ textAlign: "center" }}>
                  <EmailOutlined color="primary" sx={{ fontSize: 42, mb: 1.5 }} />
                  <Alert severity="success" sx={{ mb: 3, borderRadius: "8px", textAlign: "left" }}>
                    Si el correo está registrado, recibirás un email con las instrucciones. Revisá también tu carpeta de spam.
                  </Alert>
                  <Button variant="outlined" onClick={() => navigate("/login")} fullWidth>
                    Volver al Login
                  </Button>
                </Box>
              ) : (
                <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {error && <Alert severity="error" sx={{ borderRadius: "8px" }}>{error}</Alert>}
                  <TextField label="Correo Electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth autoFocus autoComplete="email" />
                  <Button type="submit" variant="contained" size="large" disabled={loading} sx={primaryButtonSx}>
                    {loading ? <CircularProgress size={22} thickness={4} sx={{ color: "rgba(255,255,255,0.8)" }} /> : "Enviar Email"}
                  </Button>
                  <Button variant="text" onClick={() => navigate("/login")} sx={{ color: "text.secondary" }}>
                    Volver al Login
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </MotionDiv>
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
