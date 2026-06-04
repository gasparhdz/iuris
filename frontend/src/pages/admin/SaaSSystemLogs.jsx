import { useEffect, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { BugReport, CheckCircle, ExpandLess, ExpandMore } from "@mui/icons-material";
import { fetchSystemErrorLogs } from "../../api/admin";

const emptyFilters = { nivel: "", statusCode: "", desde: "", hasta: "" };
const statusOptions = ["400", "403", "404", "405", "409", "500"];

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function truncate(value, maxLength) {
  const text = value || "Sin mensaje";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function formatJson(value) {
  if (!value) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function SystemLogRow({ item }) {
  const [open, setOpen] = useState(false);
  const isError = item.nivel === "ERROR";

  return (
    <>
      <TableRow hover sx={{ cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
        <TableCell sx={{ width: 48, py: 0.75, px: 2 }}>
          <IconButton size="small" aria-label={open ? "Contraer detalle" : "Expandir detalle"}>
            {open ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 800, py: 0.75, px: 2 }}>{formatDateTime(item.createdAt)}</TableCell>
        <TableCell sx={{ py: 0.75, px: 2 }}>
          <Chip size="small" color={isError ? "error" : "warning"} label={item.nivel} sx={{ fontWeight: 900, minWidth: 74 }} />
        </TableCell>
        <TableCell sx={{ py: 0.75, px: 2, fontWeight: 800 }}>{item.statusCode}</TableCell>
        <TableCell sx={{ py: 0.75, px: 2, minWidth: 280, wordBreak: "break-word" }}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 900 }}>{item.metodo || "HTTP"}</Typography>{" "}
          <Typography component="span" variant="body2" color="text.secondary">{item.ruta || "Sin ruta"}</Typography>
        </TableCell>
        <TableCell sx={{ py: 0.75, px: 2, minWidth: 320, wordBreak: "break-word" }}>{truncate(item.mensaje, 120)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? "1px solid" : 0, borderColor: "divider" }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2.5, bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.035) }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>Stack trace</Typography>
                  <Box component="pre" sx={codeBlockSx}>{item.stackTrace || "Sin stack trace disponible"}</Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>Contexto</Typography>
                  <Box component="pre" sx={codeBlockSx}>{formatJson(item.contexto)}</Box>
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

const codeBlockSx = {
  m: 0,
  p: 2,
  maxHeight: 320,
  overflow: "auto",
  bgcolor: "#111827",
  color: "#e5e7eb",
  borderRadius: "8px",
  fontFamily: "monospace",
  fontSize: "12px",
  whiteSpace: "pre-wrap",
};

export default function SaaSSystemLogs() {
  const theme = useTheme();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchSystemErrorLogs({
          page,
          limit: 50,
          nivel: appliedFilters.nivel || undefined,
          statusCode: appliedFilters.statusCode || undefined,
          desde: appliedFilters.desde || undefined,
          hasta: appliedFilters.hasta || undefined,
        });

        if (active) {
          setLogs(data?.items ?? []);
          setMeta(data?.meta ?? { total: 0, page, limit: 50 });
        }
      } catch (err) {
        if (active) {
          setLogs([]);
          setMeta({ total: 0, page, limit: 50 });
          setError(err?.response?.data?.error?.message ?? "No se pudieron cargar los errores del sistema.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>Errores del Sistema</Typography>
          <Typography variant="body2" color="text.secondary">Registro operacional de errores HTTP relevantes en la plataforma SaaS.</Typography>
        </Box>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2.5, border: "1px solid", borderColor: "divider", borderRadius: "16px" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 2.2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Nivel</InputLabel>
              <Select label="Nivel" value={filters.nivel} onChange={(event) => setFilters((current) => ({ ...current, nivel: event.target.value }))}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="ERROR">ERROR</MenuItem>
                <MenuItem value="WARN">WARN</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2.2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filters.statusCode} onChange={(event) => setFilters((current) => ({ ...current, statusCode: event.target.value }))}>
                <MenuItem value="">Todos</MenuItem>
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Desde" value={filters.desde} onChange={(event) => setFilters((current) => ({ ...current, desde: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Hasta" value={filters.hasta} onChange={(event) => setFilters((current) => ({ ...current, hasta: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
          </Grid>
          <Grid size={{ xs: 12, md: 3.6 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
              <Button variant="contained" onClick={applyFilters} sx={{ fontWeight: 900 }}>Filtrar</Button>
              <Button variant="outlined" onClick={clearFilters} sx={{ fontWeight: 900 }}>Limpiar</Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px", overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
            <BugReport sx={{ fontSize: 52, color: "text.disabled", mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>No se pudo cargar el registro</Typography>
            <Typography variant="body2" color="text.secondary">{error}</Typography>
          </Box>
        ) : logs.length === 0 ? (
          <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
            <CheckCircle sx={{ fontSize: 52, color: "success.main", mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>No se registraron errores en el periodo seleccionado.</Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
                    {["", "Fecha/Hora", "Nivel", "Status", "Ruta", "Mensaje"].map((label) => (
                      <TableCell
                        key={label || "expand"}
                        sx={{
                          fontWeight: 900,
                          color: "text.secondary",
                          fontSize: "0.72rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((item) => <SystemLogRow key={item.id} item={item} />)}
                </TableBody>
              </Table>
            </TableContainer>
            <Divider />
            <TablePagination
              component="div"
              count={meta.total || 0}
              page={page - 1}
              onPageChange={(_, value) => setPage(value + 1)}
              rowsPerPage={meta.limit || 50}
              rowsPerPageOptions={[50]}
              labelRowsPerPage="Filas por pagina"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
