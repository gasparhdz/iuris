import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { ThemeModeProvider } from "./theme/ThemeModeProvider";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import RequireSuperAuth from "./auth/RequireSuperAuth";
import Layout from "./layout/Layout";
import SaaSLayout from "./layout/SaaSLayout";
import ErrorBoundary from "./components/ErrorBoundary";

// Estilos globales
import "./index.css";

// Pantallas
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Perfil from "./pages/Perfil";
import Agenda from "./pages/Agenda";
import EventoForm from "./pages/EventoForm";
import Eventos from "./pages/Eventos";
import EventoDetalle from "./pages/EventoDetalle";
import Clientes from "./pages/Clientes";
import ClienteForm from "./pages/ClienteForm";
import ClienteDetalle from "./pages/ClienteDetalle";
import Terceros from "./pages/Terceros";
import Expedientes from "./pages/Expedientes";
import ExpedienteForm from "./pages/ExpedienteForm";
import ExpedienteDetalle from "./pages/ExpedienteDetalle";
import Equipo from "./pages/Equipo";
import Tareas from "./pages/Tareas";
import TareaForm from "./pages/TareaForm";
import TareaDetalle from "./pages/TareaDetalle";
import Finanzas from "./pages/Finanzas";
import FinanzasForm from "./pages/FinanzasForm";
import Reportes from "./pages/Reportes";
import Auditoria from "./pages/Auditoria";
import ValoresJus from "./pages/ValoresJus";
import SaaSOverview from "./pages/admin/SaaSOverview";
import SaaSEstudios from "./pages/admin/SaaSEstudios";
import SaaSEstudioForm from "./pages/admin/SaaSEstudioForm";
import SaaSEstudioUsuarios from "./pages/admin/SaaSEstudioUsuarios";
import SaaSUsuarios from "./pages/admin/SaaSUsuarios";
import SaaSRoles from "./pages/admin/SaaSRoles";
import SaaSRolPermisos from "./pages/admin/SaaSRolPermisos";
import SaaSParametros from "./pages/admin/SaaSParametros";
import SaaSSystemLogs from "./pages/admin/SaaSSystemLogs";
import SaaSPlanesSuscripcion from "./pages/admin/SaaSPlanesSuscripcion";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // No reintentar errores 4xx (401/403/404): no se resuelven solos y reintentar
      // 3 veces con backoff es lo que dejaba la UI ~10s "cargando" antes de fallar.
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          if (!newWorker) {
            return;
          }

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("Nueva version de Iuris disponible.");
            }
          });
        });
      })
      .catch((error) => {
        console.error("No se pudo registrar el Service Worker de Iuris.", error);
      });
  });
}

document.addEventListener(
  "keydown",
  (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement
      && target.type === "number"
      && (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
    }
  },
  { capture: true },
);

document.addEventListener(
  "wheel",
  (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement
      && target.type === "number"
      && document.activeElement === target
    ) {
      event.preventDefault();
    }
  },
  { capture: true, passive: false },
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeModeProvider>
          <SnackbarProvider
            maxSnack={3}
            autoHideDuration={3000}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <BrowserRouter>
              <ScrollToTop />
              <ErrorBoundary>
              <Routes>
                {/* Rutas Públicas */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Rutas de Administración Global (SaaS SuperAdmin) */}
                <Route
                  path="admin"
                  element={
                    <RequireSuperAuth>
                      <SaaSLayout />
                    </RequireSuperAuth>
                  }
                >
                  <Route index element={<SaaSOverview />} />
                  <Route path="estudios" element={<SaaSEstudios />} />
                  <Route path="usuarios" element={<SaaSUsuarios />} />
                  <Route path="estudios/:id/usuarios" element={<SaaSEstudioUsuarios />} />
                  <Route path="planes" element={<SaaSPlanesSuscripcion />} />
                  <Route path="roles" element={<SaaSRoles />} />
                  <Route path="roles/:id/permisos" element={<SaaSRolPermisos />} />
                  <Route path="estudios/nuevo" element={<SaaSEstudioForm />} />
                  <Route path="estudios/editar/:id" element={<SaaSEstudioForm />} />
                  <Route path="parametros" element={<SaaSParametros />} />
                  <Route path="system-logs" element={<SaaSSystemLogs />} />
                </Route>

                {/* Rutas Protegidas */}
                <Route
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                <Route index element={<Dashboard />} />
                <Route path="perfil" element={<Perfil />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="eventos" element={<Eventos />} />
                <Route path="eventos/nuevo" element={<EventoForm />} />
                <Route path="eventos/editar/:id" element={<EventoForm />} />
                <Route path="eventos/:id" element={<EventoDetalle />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="contactos" element={<Terceros />} />
                <Route path="clientes/:id" element={<ClienteDetalle />} />
                <Route path="clientes/nuevo" element={<ClienteForm />} />
                <Route path="clientes/editar/:id" element={<ClienteForm />} />
                <Route path="expedientes" element={<Expedientes />} />
                <Route path="expedientes/nuevo" element={<ExpedienteForm />} />
                <Route path="expedientes/editar/:id" element={<ExpedienteForm />} />
                <Route path="expedientes/:id" element={<ExpedienteDetalle />} />
                <Route path="tareas" element={<Tareas />} />
                <Route path="tareas/nuevo" element={<TareaForm />} />
                <Route path="tareas/editar/:id" element={<TareaForm />} />
                <Route path="tareas/:id" element={<TareaDetalle />} />
                <Route path="finanzas/nuevo" element={<FinanzasForm />} />
                <Route path="finanzas/editar/:tipo/:id" element={<FinanzasForm />} />
                <Route path="finanzas" element={<Finanzas />} />
                <Route path="reportes" element={<Reportes />} />
                <Route path="equipo" element={<Equipo />} />
                <Route path="auditoria" element={<Auditoria />} />
                <Route path="valores-jus" element={<ValoresJus />} />
                  {/* Plantillas: página en pages/Plantillas.jsx; oculta hasta desarrollo. */}
                  <Route path="plantillas" element={<Navigate to="/" replace />} />
                </Route>

                {/* Redirección por defecto */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </ErrorBoundary>
            </BrowserRouter>
          </SnackbarProvider>
        </ThemeModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
