import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import DealerProfile from "./pages/DealerProfile";
import Leads from "./pages/Leads";
import SuperAdmin from "./pages/SuperAdmin";
import UserManagement from "./pages/UserManagement";
import VehicleDetail from "./pages/VehicleDetail";
import DAIVEAnalytics from "./pages/DAIVEAnalytics";
import DAIVESettings from "./pages/DAIVESettings";
import AIBotWrapper from "./components/AIBotWrapper";
import ETL from "./pages/ETL";
import Import from "./pages/Import";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/profile" element={<DealerProfile />} />
          <Route path="/admin" element={<SuperAdmin />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/vehicle/:id" element={<VehicleDetail />} />
          <Route path="/vehicle/vin/:vin" element={<VehicleDetail />} />
          <Route path="/vehicle/qr/:hash" element={<VehicleDetail />} />
          <Route path="/daive/analytics" element={<DAIVEAnalytics />} />
          <Route path="/daive/settings" element={<DAIVESettings />} />
          <Route path="/ai-bot" element={<AIBotWrapper />} />
          <Route path="/etl" element={<ETL />} />
          <Route path="/import" element={<Import />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
