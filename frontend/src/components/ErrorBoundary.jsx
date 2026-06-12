import { Component } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { ErrorOutline, Refresh } from "@mui/icons-material";

/**
 * Límite de error de React. Atrapa errores de render de su subárbol y muestra una UI de
 * recuperación en vez de dejar la pantalla en blanco. Acepta `onReset` (se llama al reintentar)
 * y `resetKey` (al cambiar, limpia el error automáticamente — útil para resetear al navegar).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary atrapó un error de render:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 320, p: 3 }}>
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 460, textAlign: "center" }}>
          <ErrorOutline sx={{ fontSize: 56, color: "error.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Algo salió mal en esta pantalla
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Ocurrió un error inesperado al mostrar este contenido. Podés reintentar o recargar la
            aplicación. Si el problema persiste, avisá al soporte.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button variant="contained" startIcon={<Refresh />} onClick={this.handleReset} sx={{ borderRadius: "10px", fontWeight: 800 }}>
              Reintentar
            </Button>
            <Button variant="outlined" onClick={() => window.location.reload()} sx={{ borderRadius: "10px", fontWeight: 800 }}>
              Recargar la app
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }
}
