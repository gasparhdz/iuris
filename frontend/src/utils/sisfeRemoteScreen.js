// En producción el login interactivo de SISFE corre en el servidor sobre una
// pantalla virtual (Xvfb) que se ve por noVNC. Esta función abre esa pantalla
// en una pestaña nueva. En dev el navegador se abre en la propia máquina, así
// que no hay nada que mostrar.
export function openSisfeRemoteScreen() {
  if (!import.meta.env.PROD) return null;
  return window.open(
    "/sisfe-vnc/vnc.html?autoconnect=1&resize=scale&path=sisfe-vnc/websockify",
    "sisfe-remote-screen",
    "noopener,width=1400,height=820",
  );
}

export const isRemoteScreenMode = import.meta.env.PROD;
