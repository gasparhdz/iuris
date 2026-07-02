import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { alpha } from "@mui/material/styles";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  InputBase,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AccountCircle as AccountCircleIcon,
  BarChart as BarChartIcon,
  ChevronLeft as ChevronLeftIcon,
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  DarkModeOutlined,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  FolderSpecial as FolderIcon,
  Group as GroupIcon,
  Assignment as TaskIcon,
  LightModeOutlined,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  People as PeopleIcon,
  PersonOutline as PersonOutlineIcon,
  Search as SearchIcon,
  CalendarMonth as CalendarIcon,
  ContactMail,
  Event as EventIcon,
  ManageSearch as AuditoriaIcon,
  Paid as PaidIcon,
  RequestQuote as HonorariosIcon,
  Payments as GastosIcon,
  TrendingUp as IngresosIcon,
  EventRepeat as PlanesIcon,
  AccountBalanceWallet as CuentaCorrienteIcon,
  Shield as ShieldIcon,
} from "@mui/icons-material";
import { useThemeMode } from "../theme/ThemeModeProvider";
import { PaletteSelector } from "../theme/PaletteSelector";
import { FinanzasModalsProvider } from "../components/finanzas/FinanzasModalsProvider";
import { globalSearch } from "../api/search.api";
import BrandLogo from "../components/BrandLogo";
import ErrorBoundary from "../components/ErrorBoundary";
import { useSisfeLiveUpdates } from "../hooks/useSisfeLiveUpdates";

const drawerWidth = 240;
const collapsedDrawerWidth = 72;

// `modulo` => requiere ver ese modulo; `modulos` => requiere ver al menos uno (vistas
// agregadas como Agenda/Finanzas/Reportes); `roles` => gateado por rol. Sin nada => libre.
const allMenuItems = [
  { text: "Dashboard", icon: <DashboardIcon />, path: "/" },
  {
    text: "Personas",
    icon: <PeopleIcon />,
    children: [
      { text: "Clientes", icon: <PersonOutlineIcon />, path: "/clientes", modulo: "CLIENTES" },
      { text: "Terceros", icon: <ContactMail />, path: "/contactos", modulo: "TERCEROS" },
    ],
  },
  { text: "Expedientes", icon: <FolderIcon />, path: "/expedientes", modulo: "CASOS" },
  { text: "Agenda", icon: <CalendarIcon />, path: "/agenda", modulos: ["EVENTOS", "TAREAS"] },
  { text: "Tareas", icon: <TaskIcon />, path: "/tareas", modulo: "TAREAS" },
  { text: "Eventos", icon: <EventIcon />, path: "/eventos", modulo: "EVENTOS" },
  {
    text: "Finanzas",
    icon: <PaidIcon />,
    children: [
      { text: "Honorarios", icon: <HonorariosIcon />, path: "/finanzas", tab: "honorarios", modulo: "HONORARIOS" },
      { text: "Gastos", icon: <GastosIcon />, path: "/finanzas", tab: "gastos", modulo: "GASTOS" },
      { text: "Ingresos", icon: <IngresosIcon />, path: "/finanzas", tab: "ingresos", modulo: "INGRESOS" },
      { text: "Planes", icon: <PlanesIcon />, path: "/finanzas", tab: "planes", modulo: "PLANES" },
      { text: "Cuentas Corrientes", icon: <CuentaCorrienteIcon />, path: "/finanzas", tab: "cuentas_corrientes", modulos: ["INGRESOS", "HONORARIOS", "GASTOS"] },
    ],
  },
  { text: "Reportes", icon: <BarChartIcon />, path: "/reportes", modulos: ["HONORARIOS", "GASTOS", "INGRESOS"] },
  { text: "Mi Equipo", icon: <GroupIcon />, path: "/equipo", modulo: "EQUIPO" },
  { text: "Auditoría", icon: <AuditoriaIcon />, path: "/auditoria", roles: ["DIRECTOR"] },
  { text: "Plantillas", icon: <DescriptionIcon />, path: "/plantillas", modulo: "PLANTILLAS" },
];

const emptySearchResults = {
  expedientes: [],
  clientes: [],
  terceros: [],
  tareas: [],
  eventos: [],
};

const searchGroups = [
  { key: "expedientes", label: "Expedientes", icon: "📁" },
  { key: "clientes", label: "Clientes", icon: "👥" },
  { key: "terceros", label: "Contactos", icon: "📇" },
  { key: "tareas", label: "Tareas", icon: "📌" },
  { key: "eventos", label: "Eventos", icon: "📅" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  useSisfeLiveUpdates(Boolean(user));
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const themeMode = useThemeMode();
  const mode = themeMode.mode ?? theme.palette.mode;
  const toggleColorMode = themeMode.toggleColorMode ?? themeMode.toggle ?? (() => {});
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(!isMobile);
  const [openGroups, setOpenGroups] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(emptySearchResults);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchAnchorEl, setSearchAnchorEl] = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const singleRole = user?.rol ? [user.rol] : [];
  const canManageValoresJus = roles.includes("DIRECTOR") || user?.rol === "DIRECTOR";
  const puedeVerModulo = (modulo) =>
    (user?.permisos ?? []).some((p) => p.modulo === modulo && p.ver === true);
  const puedeVerItem = (item) => {
    if (item.roles) {
      const userRol = String(user?.rol ?? "").toUpperCase();
      const userRoles = roles.map((role) => String(role).toUpperCase());
      if (!item.roles.some((role) => role === userRol || userRoles.includes(role))) return false;
    }
    if (item.modulo && !puedeVerModulo(item.modulo)) return false;
    if (item.modulos && !item.modulos.some(puedeVerModulo)) return false;
    return true;
  };
  // Los items con `children` (ej: "Personas") se muestran si al menos un hijo es visible,
  // y se filtran sus hijos por permiso.
  const menuItems = allMenuItems
    .map((item) => {
      if (item.children) {
        const children = item.children.filter(puedeVerItem);
        return children.length ? { ...item, children } : null;
      }
      return puedeVerItem(item) ? item : null;
    })
    .filter(Boolean);
  const isPlatformAdmin = Number(user?.estudioId) === 1 && [...roles, ...singleRole].some(
    (role) => ["SUPERADMIN", "ADMIN"].includes(String(role).toUpperCase())
  );

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  // Auto-despliega un grupo (ej: "Personas") cuando la ruta actual es la de alguno de sus hijos.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of allMenuItems) {
        if (item.children?.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path))) {
          next[item.text] = true;
        }
      }
      return next;
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isMobile) {
          setMobileSearchOpen(true);
        } else {
          const input = document.getElementById("global-search-input");
          input?.focus();
        }
      }

      if (event.key === "Escape") {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults(emptySearchResults);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await globalSearch(trimmedQuery);
        if (active) {
          setSearchResults(result ?? emptySearchResults);
        }
      } catch {
        if (active) {
          setSearchResults(emptySearchResults);
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const toggleDrawer = () => {
    setOpen((current) => !current);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const closeSearch = () => {
    setSearchAnchorEl(null);
    setSearchFocused(false);
    setMobileSearchOpen(false);
  };

  const handleSearchFocus = (event) => {
    setSearchAnchorEl(event.currentTarget);
    setSearchFocused(true);
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    if (!searchAnchorEl) {
      setSearchAnchorEl(event.currentTarget);
    }
  };

  const getSearchTotal = () => {
    return searchGroups.reduce((total, group) => total + (searchResults[group.key]?.length ?? 0), 0);
  };

  const getPersonTitle = (item) => {
    return item.razonSocial || [item.nombre, item.apellido].filter(Boolean).join(" ") || "Sin nombre";
  };

  const formatSearchDate = (value) => {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getSearchResultMeta = (groupKey, item) => {
    if (groupKey === "expedientes") return [item.nroExpte, item.descripcion].filter(Boolean).join(" · ");
    if (groupKey === "clientes" || groupKey === "terceros") return [item.dni && `DNI ${item.dni}`, item.cuit && `CUIT ${item.cuit}`].filter(Boolean).join(" · ");
    if (groupKey === "tareas") return [item.descripcion, item.fechaLimite && `Vence ${formatSearchDate(item.fechaLimite)}`].filter(Boolean).join(" · ");
    if (groupKey === "eventos") return [item.observaciones, item.fechaInicio && formatSearchDate(item.fechaInicio)].filter(Boolean).join(" · ");
    return "";
  };

  const getSearchResultTitle = (groupKey, item) => {
    if (groupKey === "expedientes") return item.caratula || item.nroExpte || "Expediente sin carátula";
    if (groupKey === "clientes" || groupKey === "terceros") return getPersonTitle(item);
    if (groupKey === "tareas") return item.titulo || "Tarea sin título";
    if (groupKey === "eventos") return item.descripcion || "Evento sin descripción";
    return "Resultado";
  };

  const getSearchResultPath = (groupKey, item) => {
    if (groupKey === "expedientes") return `/expedientes/${item.id}`;
    if (groupKey === "clientes") return `/clientes/${item.id}`;
    if (groupKey === "terceros") return "/contactos";
    if (groupKey === "tareas") return `/tareas/${item.id}`;
    if (groupKey === "eventos") return `/eventos/${item.id}`;
    return "/";
  };

  const highlightMatch = (text) => {
    const value = String(text || "");
    const query = searchQuery.trim();
    if (!query) return value;

    const index = value.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return value;

    return (
      <>
        {value.slice(0, index)}
        <Box component="span" sx={{ color: "primary.main", fontWeight: 950 }}>
          {value.slice(index, index + query.length)}
        </Box>
        {value.slice(index + query.length)}
      </>
    );
  };

  const handleSearchResultClick = (groupKey, item) => {
    navigate(getSearchResultPath(groupKey, item));
    closeSearch();
    setSearchQuery("");
  };

  const renderSearchResults = () => {
    const total = getSearchTotal();
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      return (
        <Box sx={{ px: 2.25, py: 3 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Escribí al menos 2 caracteres para buscar en Iuris.
          </Typography>
        </Box>
      );
    }

    if (searchLoading) {
      return (
        <Box sx={{ px: 2, py: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (total === 0) {
      return (
        <Box sx={{ px: 2.25, py: 3 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No encontramos resultados para "{trimmedQuery}".
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ py: 1 }}>
        {searchGroups.map((group) => {
          const items = searchResults[group.key] ?? [];
          if (items.length === 0) return null;

          return (
            <Box key={group.key} sx={{ pb: 0.75 }}>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 2,
                  pt: 1,
                  pb: 0.75,
                  color: "text.secondary",
                  fontWeight: 900,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {group.icon} {group.label}
              </Typography>
              {items.map((item) => (
                <Box
                  key={`${group.key}-${item.id}`}
                  component="button"
                  type="button"
                  onClick={() => handleSearchResultClick(group.key, item)}
                  sx={{
                    width: "100%",
                    border: 0,
                    bgcolor: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    px: 2,
                    py: 1.15,
                    display: "block",
                    color: "text.primary",
                    font: "inherit",
                    "&:hover": {
                      bgcolor: (appTheme) => alpha(appTheme.palette.primary.main, appTheme.palette.mode === "dark" ? 0.16 : 0.08),
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1.3 }}>
                    {highlightMatch(getSearchResultTitle(group.key, item))}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      display: "block",
                      mt: 0.35,
                      lineHeight: 1.35,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getSearchResultMeta(group.key, item) || group.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>
    );
  };

  const searchInputSx = {
    width: "100%",
    color: "text.primary",
    fontWeight: 700,
    fontSize: "0.92rem",
    "& .MuiInputBase-input": {
      py: 1.1,
      px: 0,
      "&::placeholder": {
        color: "text.secondary",
        opacity: 0.86,
      },
    },
  };

  const handleLogoutClick = () => {
    handleClose();
    logout();
    navigate("/login");
  };

  const isActivePath = (path) => {
    return location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
  };

  // Estilos compartidos por los botones de navegación (leaf, padre de grupo e hijos).
  const navButtonSx = (active) => ({
    minHeight: 34,
    py: 0.5,
    justifyContent: open || isMobile ? "initial" : "center",
    px: 2.25,
    borderRadius: "10px",
    backgroundColor: active ? "rgba(99, 102, 241, 0.12)" : "transparent",
    border: "1px solid",
    borderColor: active ? "rgba(99, 102, 241, 0.28)" : "transparent",
    color: active ? "primary.light" : "text.secondary",
    transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
    "&:hover": {
      backgroundColor: "action.hover",
      color: "text.primary",
      "& .MuiListItemIcon-root": { color: "text.primary" },
    },
  });
  const navIconSx = (active) => ({
    minWidth: 0,
    mr: open || isMobile ? 2.5 : "auto",
    justifyContent: "center",
    color: active ? "primary.light" : "text.secondary",
    transition: "color 0.2s ease, margin 0.2s ease",
  });
  const navTextSx = (active) => ({
    opacity: open || isMobile ? 1 : 0,
    transition: "opacity 0.16s ease",
    "& .MuiTypography-root": { fontWeight: active ? 800 : 600, fontSize: "0.9rem" },
  });

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", backgroundColor: "background.default" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (appTheme) => appTheme.zIndex.drawer + 1,
          width: "100%",
          backgroundColor: (appTheme) =>
            appTheme.palette.mode === "dark"
              ? "rgba(17,19,26,0.86)"
              : "rgba(255,255,255,0.86)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid",
          borderColor: "divider",
          boxShadow: "none",
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ minHeight: 64, justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <IconButton
              color="inherit"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={toggleDrawer}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Box
              component={NavLink}
              to="/"
              end
              aria-label="Ir al inicio"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                lineHeight: 0,
                borderRadius: "10px",
                textDecoration: "none",
                color: "inherit",
                "&:hover": { opacity: 0.88 },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              <BrandLogo
                sx={{
                  height: { xs: 44, sm: 52 },
                  flexShrink: 0,
                }}
              />
            </Box>
          </Box>

          <Box
            sx={{
              position: { md: "absolute" },
              left: { md: "50%" },
              transform: { md: "translateX(-50%)" },
              flex: { xs: 1, md: "0 1 auto" },
              minWidth: 0,
              width: { xs: "auto", md: searchFocused ? 620 : 520, lg: searchFocused ? 720 : 560 },
              maxWidth: { xs: "100%", md: "calc(100vw - 560px)" },
              mx: { xs: 0, md: 0 },
              transition: "width 0.24s ease, max-width 0.24s ease",
              display: "flex",
              justifyContent: "center",
              zIndex: 0,
            }}
          >
            {isMobile ? (
              <Tooltip title="Buscar">
                <IconButton onClick={() => setMobileSearchOpen(true)} size="small" sx={{ color: "text.secondary" }}>
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Box
                onFocus={handleSearchFocus}
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                  borderRadius: "999px",
                  border: "1px solid",
                  borderColor: searchFocused ? "primary.main" : "divider",
                  bgcolor: (appTheme) =>
                    appTheme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.72)",
                  boxShadow: searchFocused
                    ? "0 16px 44px rgba(99, 102, 241, 0.18)"
                    : "0 8px 28px rgba(15,23,42,0.06)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
                  "&:hover": {
                    borderColor: "primary.light",
                    boxShadow: "0 14px 36px rgba(99, 102, 241, 0.14)",
                  },
                }}
              >
                <SearchIcon fontSize="small" sx={{ color: searchFocused ? "primary.main" : "text.secondary", mr: 1 }} />
                <InputBase
                  id="global-search-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  placeholder="Buscar expedientes, clientes, contactos, tareas o eventos..."
                  sx={searchInputSx}
                  endAdornment={
                    <InputAdornment position="end" sx={{ ml: 1 }}>
                      {searchLoading ? (
                        <CircularProgress size={18} />
                      ) : (
                        <Chip
                          label="Ctrl K"
                          size="small"
                          sx={{
                            height: 22,
                            display: { md: "inline-flex", lg: "inline-flex" },
                            bgcolor: "action.hover",
                            color: "text.secondary",
                            fontWeight: 800,
                            fontSize: "0.68rem",
                          }}
                        />
                      )}
                    </InputAdornment>
                  }
                />
              </Box>
            )}
          </Box>

          <Popover
            open={!isMobile && Boolean(searchAnchorEl) && (searchFocused || searchQuery.trim().length >= 2)}
            anchorEl={searchAnchorEl}
            onClose={closeSearch}
            disableAutoFocus
            disableEnforceFocus
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            transformOrigin={{ vertical: "top", horizontal: "center" }}
            PaperProps={{
              sx: {
                mt: 1.25,
                width: { md: searchFocused ? 620 : 520, lg: searchFocused ? 720 : 560 },
                maxWidth: "calc(100vw - 48px)",
                maxHeight: 520,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "14px",
                bgcolor: "background.paper",
                boxShadow: (appTheme) =>
                  appTheme.palette.mode === "dark"
                    ? "0 24px 70px rgba(0,0,0,0.58)"
                    : "0 24px 70px rgba(15,23,42,0.18)",
              },
            }}
          >
            <Box sx={{ maxHeight: 520, overflowY: "auto" }}>
              {renderSearchResults()}
            </Box>
          </Popover>

          <Dialog
            fullScreen
            open={mobileSearchOpen}
            onClose={closeSearch}
            PaperProps={{
              sx: {
                bgcolor: "background.default",
              },
            }}
          >
            <DialogContent sx={{ p: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    px: 1.5,
                    borderRadius: "14px",
                    border: "1px solid",
                    borderColor: "primary.main",
                    bgcolor: "background.paper",
                    boxShadow: "0 16px 44px rgba(99, 102, 241, 0.18)",
                  }}
                >
                  <SearchIcon fontSize="small" sx={{ color: "primary.main", mr: 1 }} />
                  <InputBase
                    autoFocus
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Buscar en Iuris..."
                    sx={searchInputSx}
                    endAdornment={
                      searchLoading ? (
                        <InputAdornment position="end">
                          <CircularProgress size={18} />
                        </InputAdornment>
                      ) : null
                    }
                  />
                </Box>
                <IconButton onClick={closeSearch} sx={{ color: "text.secondary" }}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <Box
                sx={{
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "14px",
                  overflow: "hidden",
                  boxShadow: (appTheme) =>
                    appTheme.palette.mode === "dark"
                      ? "0 20px 54px rgba(0,0,0,0.4)"
                      : "0 20px 54px rgba(15,23,42,0.12)",
                }}
              >
                {renderSearchResults()}
              </Box>
            </DialogContent>
          </Dialog>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
<Tooltip title={mode === "dark" ? "Modo claro" : "Modo oscuro"}>
              <IconButton onClick={toggleColorMode} size="small" sx={{ color: "text.secondary" }}>
                {mode === "dark" ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 1, display: { xs: "none", sm: "block" } }} />

            {/* Perfil de Usuario con Nombre y Rol en pantallas medianas/grandes */}
            <Tooltip title="Mi Perfil">
              <Box
                onClick={handleMenu}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  cursor: "pointer",
                  py: 0.5,
                  px: 1.25,
                  borderRadius: "20px",
                  transition: "background-color 0.2s ease",
                  "&:hover": {
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                  }
                }}
              >
                <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", alignItems: "flex-end" }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
                    {[user?.nombre, user?.apellido].filter(Boolean).join(" ") || "Usuario"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: isPlatformAdmin ? "warning.main" : "primary.light", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1, mt: 0.25 }}>
                    {isPlatformAdmin ? "Admin SaaS" : (() => {
                      if (!user?.roles || user.roles.length === 0) return "Miembro";
                      const role = user.roles[0];
                      const map = { DIRECTOR: "Director", ABOGADO: "Abogado", ASISTENTE: "Asistente" };
                      return map[role] || role;
                    })()}
                  </Typography>
                </Box>
                <Avatar 
                  sx={{ 
                    bgcolor: "primary.main", 
                    width: 34, 
                    height: 34, 
                    fontSize: "0.95rem", 
                    fontWeight: 900,
                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.15)"
                  }}
                >
                  {user?.nombre?.[0]?.toUpperCase() || <AccountCircleIcon fontSize="small" />}
                </Avatar>
              </Box>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  mt: 1.5,
                  minWidth: 180,
                  backgroundColor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "12px",
                  boxShadow: (appTheme) =>
                    appTheme.palette.mode === "dark"
                      ? "0 18px 48px rgba(0,0,0,0.45)"
                      : "0 18px 48px rgba(15,23,42,0.12)",
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                  {[user?.nombre, user?.apellido].filter(Boolean).join(" ") || "Usuario"}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { handleClose(); navigate("/perfil"); }} sx={{ fontWeight: 700 }}>
                <ListItemIcon>
                  <AccountCircleIcon fontSize="small" />
                </ListItemIcon>
                Mi Perfil
              </MenuItem>
              {canManageValoresJus && (
                <MenuItem onClick={() => { handleClose(); navigate("/valores-jus"); }} sx={{ fontWeight: 700 }}>
                  <ListItemIcon>
                    <PaidIcon fontSize="small" />
                  </ListItemIcon>
                  Valores JUS
                </MenuItem>
              )}
              <Divider />
              {isPlatformAdmin && (
                <>
                  <MenuItem onClick={() => { handleClose(); navigate("/admin"); }} sx={{ color: "warning.main", fontWeight: 700 }}>
                    <ListItemIcon sx={{ color: "warning.main" }}>
                      <ShieldIcon fontSize="small" />
                    </ListItemIcon>
                    Consola SaaS
                  </MenuItem>
                  <Divider />
                </>
              )}
              <MenuItem onClick={handleLogoutClick} sx={{ color: "error.main", fontWeight: 700 }}>
                <ListItemIcon sx={{ color: "error.main" }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Cerrar Sesión
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          width: isMobile ? 0 : (open ? drawerWidth : collapsedDrawerWidth),
          flexShrink: 0,
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: open
                ? theme.transitions.duration.enteringScreen
                : theme.transitions.duration.leavingScreen,
            }),
          "& .MuiDrawer-paper": {
            backgroundColor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
            width: drawerWidth,
            ...(!isMobile && {
              width: open ? drawerWidth : collapsedDrawerWidth,
            }),
            overflowX: "hidden",
            boxSizing: "border-box",
            transition: (theme) =>
              theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: open
                  ? theme.transitions.duration.enteringScreen
                  : theme.transitions.duration.leavingScreen,
              }),
          },
        }}
      >
        <Toolbar sx={{ minHeight: 64, justifyContent: open || isMobile ? "space-between" : "center", px: 2 }}>
          {(open || isMobile) && (
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "text.primary" }}>
              Navegación
            </Typography>
          )}
          {!isMobile && (
            <IconButton onClick={toggleDrawer} sx={{ color: "text.secondary" }}>
              <ChevronLeftIcon
                sx={{
                  transform: open ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </IconButton>
          )}
        </Toolbar>

        <Divider />

        <List sx={{ px: 1, py: 1.5 }}>
          {menuItems.map((item) => {
            // Grupo desplegable (ej: "Personas")
            if (item.children) {
              const collapsedSidebar = !open && !isMobile;
              const groupActive = item.children.some((child) => isActivePath(child.path));
              const groupOpen = Boolean(openGroups[item.text]);
              // Para hijos con `tab` (Finanzas comparten /finanzas): el resaltado mira el ?tab= actual.
              const currentTab = new URLSearchParams(location.search).get("tab");
              const effectiveTab = currentTab || item.children.find((c) => c.tab)?.tab;
              return (
                <Box key={item.text} sx={{ mb: 0.25 }}>
                  <Tooltip title={collapsedSidebar ? item.text : ""} placement="right">
                    <ListItemButton
                      onClick={() => {
                        // Barra colapsada: al clickear se expande la barra y se abre el grupo.
                        if (collapsedSidebar) {
                          setOpen(true);
                          setOpenGroups((prev) => ({ ...prev, [item.text]: true }));
                        } else {
                          setOpenGroups((prev) => ({ ...prev, [item.text]: !prev[item.text] }));
                        }
                      }}
                      sx={navButtonSx(groupActive)}
                    >
                      <ListItemIcon sx={navIconSx(groupActive)}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} sx={navTextSx(groupActive)} />
                      {(open || isMobile) && (
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 18,
                            color: "text.disabled",
                            transition: "transform 0.2s ease",
                            transform: groupOpen ? "none" : "rotate(-90deg)",
                          }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                  <Collapse in={groupOpen && (open || isMobile)} timeout="auto" unmountOnExit>
                    <List disablePadding sx={{ pl: 1.5 }}>
                      {item.children.map((child) => {
                        const childActive = child.tab
                          ? location.pathname === child.path && child.tab === effectiveTab
                          : isActivePath(child.path);
                        const childTo = child.tab ? `${child.path}?tab=${child.tab}` : child.path;
                        return (
                          <ListItem key={child.text} disablePadding sx={{ display: "block", mb: 0.25 }}>
                            <ListItemButton
                              component={NavLink}
                              to={childTo}
                              onClick={() => { if (isMobile) setOpen(false); }}
                              sx={navButtonSx(childActive)}
                            >
                              <ListItemIcon sx={navIconSx(childActive)}>{child.icon}</ListItemIcon>
                              <ListItemText primary={child.text} sx={navTextSx(childActive)} />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                </Box>
              );
            }

            // Item simple (leaf)
            const active = isActivePath(item.path);
            return (
              <ListItem key={item.text} disablePadding sx={{ display: "block", mb: 0.25 }}>
                <Tooltip title={!open && !isMobile ? item.text : ""} placement="right">
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => {
                      if (isMobile) setOpen(false);
                    }}
                    sx={navButtonSx(active)}
                  >
                    <ListItemIcon sx={navIconSx(active)}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} sx={navTextSx(active)} />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, sm: 3 },
          pt: { xs: 9, sm: 10 },
          backgroundColor: "background.default",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          marginLeft: {
            xs: 0,
            md: open ? `${drawerWidth}px` : `${collapsedDrawerWidth}px`,
          },
          width: {
            xs: "100%",
            md: `calc(100% - ${open ? drawerWidth : collapsedDrawerWidth}px)`,
          },
          transition: (appTheme) =>
            appTheme.transitions.create(["width", "margin-left"], {
              easing: appTheme.transitions.easing.sharp,
              duration: open
                ? appTheme.transitions.duration.enteringScreen
                : appTheme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Box sx={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
          <FinanzasModalsProvider>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{ width: "100%", minWidth: 0 }}
              >
                <ErrorBoundary resetKey={location.pathname}>
                  <Outlet />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </FinanzasModalsProvider>
        </Box>
      </Box>
    </Box>
  );
}
