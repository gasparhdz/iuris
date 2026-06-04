import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useThemeMode } from "../theme/ThemeModeProvider";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  IconButton,
  Tooltip,
  GlobalStyles,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  LightModeOutlined,
  DarkModeOutlined,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, toggle } = useThemeMode();
  const isDark = mode === "dark";

  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@lex.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "Admin1234!" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor completá todos los campos.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      const singleRole = user?.rol ? [user.rol] : [];
      const isPlatformAdmin = Number(user?.estudioId) === 1 && [...roles, ...singleRole].some(
        (role) => ["SUPERADMIN", "ADMIN"].includes(String(role).toUpperCase())
      );

      const defaultNext = isPlatformAdmin ? "/admin" : "/";
      const next = searchParams.get("next") === "/" ? defaultNext : (searchParams.get("next") || defaultNext);
      navigate(next, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Credenciales inválidas. Verificá tu correo y contraseña."
      );
    } finally {
      setLoading(false);
    }
  };

  // Color que pinta sobre el autofill del navegador — debe coincidir con el fondo de la card
  const autofillBg = isDark ? "#1A1D28" : "#FFFFFF";
  const autofillText = isDark ? "#F8FAFC" : "#0F172A";

  const autofillSx = {
    "& input:-webkit-autofill": {
      WebkitBoxShadow: `0 0 0 100px ${autofillBg} inset !important`,
      WebkitTextFillColor: `${autofillText} !important`,
      caretColor: autofillText,
      transition: "background-color 5000s ease-in-out 0s",
    },
    "& input:-webkit-autofill:hover": {
      WebkitBoxShadow: `0 0 0 100px ${autofillBg} inset !important`,
      WebkitTextFillColor: `${autofillText} !important`,
    },
    "& input:-webkit-autofill:focus": {
      WebkitBoxShadow: `0 0 0 100px ${autofillBg} inset !important`,
      WebkitTextFillColor: `${autofillText} !important`,
    },
  };

  return (
    <>
    <GlobalStyles styles={{ "html, body": { overflow: "hidden" } }} />
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isDark ? "#0F172A" : "#F6F7FA",
        px: 2,
        overflow: "hidden",
        transition: "background 0.35s ease",
        // Orbe superior-izquierdo
        "&::before": {
          content: '""',
          position: "absolute",
          width: { xs: "260px", md: "400px" },
          height: { xs: "260px", md: "400px" },
          background: isDark
            ? "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)",
          top: "5%",
          left: "5%",
          zIndex: 0,
          pointerEvents: "none",
        },
        // Orbe inferior-derecho
        "&::after": {
          content: '""',
          position: "absolute",
          width: { xs: "260px", md: "400px" },
          height: { xs: "260px", md: "400px" },
          background: isDark
            ? "radial-gradient(circle, rgba(20,184,166,0.14) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(20,184,166,0.07) 0%, transparent 70%)",
          bottom: "5%",
          right: "5%",
          zIndex: 0,
          pointerEvents: "none",
        },
      }}
    >
      {/* Botón de toggle claro/oscuro */}
      <Tooltip title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} placement="left">
        <IconButton
          onClick={toggle}
          size="small"
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: "10px",
            color: isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.50)",
            backgroundColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(99,102,241,0.07)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(99,102,241,0.15)",
            backdropFilter: "blur(8px)",
            transition: "all 0.25s ease",
            "&:hover": {
              color: isDark ? "#F8FAFC" : "#0F172A",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(99,102,241,0.13)",
              transform: "scale(1.08)",
            },
          }}
        >
          {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
        </IconButton>
      </Tooltip>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ zIndex: 1, width: "100%", maxWidth: "420px" }}
      >
        <Card
          elevation={0}
          sx={{
            // overflow hidden recorta la línea de gradiente superior en las esquinas
            overflow: "hidden",
            background: isDark
              ? "rgba(17,19,26,0.75)"
              : "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.07)"
              : "1px solid rgba(99,102,241,0.14)",
            borderRadius: "16px",
            boxShadow: isDark
              ? "0 24px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)"
              : "0 8px 40px rgba(99,102,241,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            position: "relative",
            transition: "background 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease",
            // Línea de gradiente superior — recortada limpiamente por overflow hidden
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background: "linear-gradient(90deg, #3B82F6 0%, #0EA5E9 100%)",
            },
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>

            {/* Cabecera de marca */}
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <BrandLogo
                sx={{
                  height: { xs: 68, sm: 80 },
                  mx: "auto",
                  mb: 1.5,
                }}
              />
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontWeight: 500, lineHeight: 1.55 }}
              >
                Inicia sesión para gestionar tu estudio jurídico
              </Typography>
            </Box>

            {/* Alerta de error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    borderRadius: "8px",
                    backgroundColor: isDark
                      ? "rgba(239,68,68,0.10)"
                      : "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    color: isDark ? "#FCA5A5" : "#B91C1C",
                    fontSize: "0.82rem",
                    "& .MuiAlert-icon": {
                      color: isDark ? "#FCA5A5" : "#DC2626",
                    },
                  }}
                >
                  {error}
                </Alert>
              </motion.div>
            )}

            {/* Formulario */}
            <Box
              component="form"
              onSubmit={handleSubmit}
              noValidate
              sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
            >
              <TextField
                label="Correo Electrónico"
                type="email"
                fullWidth
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                autoFocus={!import.meta.env.DEV}
                InputLabelProps={{ shrink: true }}
                sx={autofillSx}
              />

              <TextField
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                fullWidth
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                InputLabelProps={{ shrink: true }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          onClick={() => setShowPassword((v) => !v)}
                          edge="end"
                          size="small"
                          tabIndex={-1}
                          sx={{ color: "text.secondary" }}
                        >
                          {showPassword
                            ? <VisibilityOff fontSize="small" />
                            : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={autofillSx}
              />

              <Typography
                variant="body2"
                onClick={() => navigate("/forgot-password")}
                sx={{
                  color: "text.secondary",
                  cursor: "pointer",
                  alignSelf: "flex-end",
                  mt: -1,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                ¿Olvidaste tu contraseña?
              </Typography>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={loading}
                sx={{
                  mt: 0.5,
                  py: 1.5,
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  borderRadius: "8px",
                  background: loading
                    ? undefined
                    : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
                  boxShadow: loading ? "none" : "0 4px 14px rgba(29,78,216,0.35)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)",
                    boxShadow: "0 6px 20px rgba(29,78,216,0.45)",
                    transform: "translateY(-1px)",
                  },
                  "&:active": { transform: "translateY(0)" },
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {loading
                  ? <CircularProgress size={22} thickness={4} sx={{ color: "rgba(255,255,255,0.8)" }} />
                  : "Ingresar"}
              </Button>
            </Box>

          </CardContent>
        </Card>
      </motion.div>
    </Box>
    </>
  );
}
