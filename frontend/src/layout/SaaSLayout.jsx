import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { alpha, useTheme } from "@mui/material/styles";
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  Apartment,
  AccountCircle,
  BugReport,
  ChevronLeft,
  DarkModeOutlined,
  Dashboard,
  LightModeOutlined,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Payments,
  Settings,
  Shield,
} from "@mui/icons-material";
import { useAuth } from "../auth/useAuth";
import { useThemeMode } from "../theme/useThemeMode";
import BrandLogo from "../components/BrandLogo";

const drawerWidth = 240;
const collapsedDrawerWidth = 72;

const menuItems = [
  { text: "Inicio SaaS", icon: <Dashboard />, path: "/admin" },
  { text: "Estudios", icon: <Apartment />, path: "/admin/estudios" },
  { text: "Planes", icon: <Payments />, path: "/admin/planes" },
  { text: "Roles y Permisos", icon: <Shield />, path: "/admin/roles" },
  { text: "Parámetros Globales", icon: <Settings />, path: "/admin/parametros" },
  { text: "Errores del Sistema", icon: <BugReport />, path: "/admin/system-logs" },
];

export default function SaaSLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const themeMode = useThemeMode();
  const mode = themeMode.mode ?? theme.palette.mode;
  const toggleColorMode = themeMode.toggleColorMode ?? themeMode.toggle ?? (() => {});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const userName = [user?.nombre, user?.apellido].filter(Boolean).join(" ") || "Gaspar";
  const [open, setOpen] = useState(!isMobile);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  const toggleDrawer = () => {
    setOpen((current) => !current);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate("/login");
  };

  const isActivePath = (path) => {
    return location.pathname === path || (path !== "/admin" && location.pathname.startsWith(path));
  };

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
            <BrandLogo
              sx={{
                height: { xs: 38, sm: 44 },
                flexShrink: 0,
              }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
            <Chip
              icon={<Shield sx={{ fontSize: "15px !important" }} />}
              label="SuperAdmin"
              size="small"
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                bgcolor: alpha(theme.palette.warning.main, 0.14),
                color: "warning.main",
                border: "1px solid",
                borderColor: alpha(theme.palette.warning.main, 0.28),
                fontWeight: 800,
              }}
            />

            <Tooltip title={mode === "dark" ? "Modo claro" : "Modo oscuro"}>
              <IconButton onClick={toggleColorMode} size="small" sx={{ color: "text.secondary" }}>
                {mode === "dark" ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 1, display: { xs: "none", sm: "block" } }} />

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
                    bgcolor: (appTheme) => alpha(appTheme.palette.text.primary, 0.04),
                  },
                }}
              >
                <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", alignItems: "flex-end" }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
                    {userName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "warning.main", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1, mt: 0.25 }}>
                    Super Admin
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: "primary.main",
                    width: 34,
                    height: 34,
                    fontSize: "0.95rem",
                    fontWeight: 900,
                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.15)",
                  }}
                >
                  {user?.nombre?.[0]?.toUpperCase() || <AccountCircle fontSize="small" />}
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
                  {userName}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: "error.main", fontWeight: 700 }}>
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
          transition: (appTheme) =>
            appTheme.transitions.create("width", {
              easing: appTheme.transitions.easing.sharp,
              duration: open
                ? appTheme.transitions.duration.enteringScreen
                : appTheme.transitions.duration.leavingScreen,
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
            transition: (appTheme) =>
              appTheme.transitions.create("width", {
                easing: appTheme.transitions.easing.sharp,
                duration: open
                  ? appTheme.transitions.duration.enteringScreen
                  : appTheme.transitions.duration.leavingScreen,
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
              <ChevronLeft
                sx={{
                  transform: open ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </IconButton>
          )}
        </Toolbar>

        <Divider />

        <List sx={{ px: 1, py: 2 }}>
          {menuItems.map((item) => {
            const active = isActivePath(item.path);

            return (
              <ListItem key={item.text} disablePadding sx={{ display: "block", mb: 0.5 }}>
                <Tooltip title={!open && !isMobile ? item.text : ""} placement="right">
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                    end={item.path === "/admin"}
                    onClick={() => {
                      if (isMobile) setOpen(false);
                    }}
                    sx={{
                      minHeight: 48,
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
                        "& .MuiListItemIcon-root": {
                          color: "text.primary",
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: open || isMobile ? 2.5 : "auto",
                        justifyContent: "center",
                        color: active ? "primary.light" : "text.secondary",
                        transition: "color 0.2s ease, margin 0.2s ease",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      sx={{
                        opacity: open || isMobile ? 1 : 0,
                        transition: "opacity 0.16s ease",
                        "& .MuiTypography-root": {
                          fontWeight: active ? 800 : 600,
                          fontSize: "0.9rem",
                        },
                      }}
                    />
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
        <Box sx={{ width: "100%", minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
