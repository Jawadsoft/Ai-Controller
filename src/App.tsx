import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { CustomerProvider } from "./contexts/CustomerContext";
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
import FollowUpSettings from "./pages/FollowUpSettings";
import AIBotWrapper from "./components/AIBotWrapper";
import AIBotWrapperTest from "./components/AIBotWrapperTest";
import AIBotPage from "./pages/AIBotPage";
import OptimizedAIBotPage from "./pages/OptimizedAIBotPage";
import AIBotComparison from "./pages/AIBotComparison";
import AIBotNavigation from "./pages/AIBotNavigation";
import ConversationMonitorPage from "./pages/ConversationMonitorPage";
import ETL from "./pages/ETL";
import Import from "./pages/Import";
import StaffManagement from "./components/StaffManagement";
import SalespersonProfile from "./pages/SalespersonProfile";
import CrewAIAgentManagement from "./components/CrewAIAgentManagement";
import Finance from "./pages/Finance";
import DealDetail from "./pages/DealDetail";
import CreditApplications from "./pages/CreditApplications";
import FinanceAnalytics from "./pages/FinanceAnalytics";
import LendersManagement from "./pages/LendersManagement";
import CustomerCreditApplication from "./pages/CustomerCreditApplication";
import CustomerLogin from "./pages/CustomerLogin";
import CustomerManagement from "./pages/CustomerManagement";
import SignatureDocument from "./pages/SignatureDocument";
import RebateManagement from "./pages/RebateManagement";
import { EmailVerification } from "./pages/EmailVerification";
import MarbalismAIPage from "./pages/MarbalismAIPage";
// import NotFound from "./pages/NotFound";
import { Toaster as SonnerToaster } from "sonner";
import { Toaster as ShadToaster } from "./components/ui/toaster";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <CustomerProvider>
        <HashRouter>
          <SonnerToaster position="top-right" richColors />
          <ShadToaster />
          <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<Leads />} />
          <Route path="/profile" element={<DealerProfile />} />
          <Route path="/admin" element={<SuperAdmin />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/vehicle/:id" element={<VehicleDetail />} />
          <Route path="/vehicle/vin/:vin" element={<VehicleDetail />} />
          <Route path="/vehicle/qr/:hash" element={<VehicleDetail />} />
          <Route path="/dealer-profile/:id" element={<DealerProfile />} />
          <Route path="/dealer-profile/qr/:hash" element={<DealerProfile />} />
          <Route path="/aibot/dealer/qr/:hash" element={<AIBotPage />} />
          <Route path="/daive/analytics" element={<DAIVEAnalytics />} />
          <Route path="/daive/settings" element={<DAIVESettings />} />
          <Route path="/followup/settings" element={<FollowUpSettings />} />
          <Route path="/ai-bot" element={<AIBotWrapper />} />
          <Route path="/ai-bot-test" element={<AIBotWrapperTest />} />
          <Route path="/aibot-navigation" element={<AIBotNavigation />} />
          <Route path="/optimized-aibot" element={<OptimizedAIBotPage />} />
          <Route path="/aibot-comparison" element={<AIBotComparison />} />
          <Route path="/conversation-monitor" element={<ConversationMonitorPage />} />
          <Route path="/etl" element={<ETL />} />
          <Route path="/import" element={<Import />} />
          <Route path="/staff" element={<StaffManagement />} />
          <Route path="/salesperson/qr/:hash" element={<SalespersonProfile />} />
          <Route path="/crewai-agents" element={<CrewAIAgentManagement />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/finance/deal/:id" element={<DealDetail />} />
          <Route path="/finance/application/:id" element={<Finance />} />
          <Route path="/finance/applications" element={<CreditApplications />} />
          <Route path="/finance/analytics" element={<FinanceAnalytics />} />
          <Route path="/lenders" element={<LendersManagement />} />
          <Route path="/customers" element={<CustomerManagement />} />
          <Route path="/rebates" element={<RebateManagement />} />
          <Route path="/verify-email/:token" element={<EmailVerification />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          
          {/* Customer-facing routes */}
          <Route path="/customer-login" element={<CustomerLogin />} />
          <Route path="/apply" element={<CustomerCreditApplication />} />
          <Route path="/apply/:vehicleId" element={<CustomerCreditApplication />} />
          <Route path="/signature/:id" element={<SignatureDocument />} />
         
          <Route path="/marbalism-ai" element={<MarbalismAIPage />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          {/* <Route path="*" element={<NotFound />} /> */}
        </Routes>
        </HashRouter>
      </CustomerProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
