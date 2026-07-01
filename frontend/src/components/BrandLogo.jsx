import { Box, useTheme } from "@mui/material";

const base = import.meta.env.BASE_URL;
const logoLight = `${base}icons/iuris-horizontal.svg`;        // texto oscuro, para fondos claros
const logoDark = `${base}icons/iuris-horizontal-negativo.svg`; // texto blanco, para fondos oscuros

export default function BrandLogo({ alt = "Iuris", sx, ...props }) {
  const theme = useTheme();
  const logoSrc = theme.palette.mode === "dark" ? logoDark : logoLight;

  return (
    <Box
      component="img"
      src={logoSrc}
      alt={alt}
      sx={{
        display: "block",
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        ...sx,
      }}
      {...props}
    />
  );
}
