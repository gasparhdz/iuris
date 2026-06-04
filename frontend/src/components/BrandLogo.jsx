import { Box } from "@mui/material";

const logoSrc = `${import.meta.env.BASE_URL}icons/logo.png`;

export default function BrandLogo({ alt = "Iuris", sx, ...props }) {
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
