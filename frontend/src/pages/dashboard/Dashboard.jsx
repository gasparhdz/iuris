import { useState } from "react";
import { Box } from "@mui/material";
import DashboardBandeja from "./DashboardBandeja";
import DashboardClassic from "./DashboardClassic";
import { readDashboardView, saveDashboardView } from "./dashboardUtils";

export default function Dashboard() {
  const [view, setView] = useState(readDashboardView);

  const switchView = (next) => {
    setView(next);
    saveDashboardView(next);
  };

  return (
    <Box sx={{ position: "relative" }}>
      {view === "bandeja" ? (
        <DashboardBandeja view={view} onSwitchView={switchView} />
      ) : (
        <DashboardClassic view={view} onSwitchView={switchView} />
      )}
    </Box>
  );
}
