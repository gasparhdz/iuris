import { Box, Typography, Card, CardContent } from "@mui/material";
import { Description as DescriptionIcon } from "@mui/icons-material";

export default function Plantillas() {
  return (
    <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
      <Card sx={{ maxWidth: 600, width: "100%", border: "1px solid rgba(29, 78, 216, 0.1)" }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          <DescriptionIcon sx={{ fontSize: 60, color: "#3B82F6", mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Módulo de Plantillas de Documentos
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
            Aquí construiremos la sección de CRUD de plantillas de documentos con un editor visual limpio de texto enriquecido e inyección de variables para automatizaciones.
          </Typography>
          <Typography variant="caption" sx={{ color: "#0EA5E9", fontWeight: 600, display: "block" }}>
            Escribe un prompt describiendo cómo quieres esta pantalla para comenzar su construcción.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
