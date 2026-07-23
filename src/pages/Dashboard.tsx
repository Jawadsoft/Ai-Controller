import { useState, useEffect, useMemo, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Car,
  Users,
  TrendingUp,
  Brain,
  BarChart3,
  Bot,
  Database,
  QrCode,
  RefreshCw,
  MessageSquare,
  Calendar,
  LayoutDashboard,
  ArrowRight,
  Flame,
} from "lucide-react";
import { buildBackendAssetUrl } from "@/lib/config";
import { vehiclesAPI, leadsAPI, dealersAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import notificationService from "@/lib/notificationService";
import TopNavigation from "@/components/layout/TopNavigation";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent 
} from "@/components/ui/chart";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid,
} from "recharts";

const MS_DAY = 86_400_000;

/** Cohesive dashboard chart palette (slate / blue / violet / warmth) */
function leadsTrendYMax(rows: { leads?: number; new?: number; contacted?: number }[]): number {
  let max = 0;
  for (const r of rows) {
    max = Math.max(max, Number(r.leads) || 0, Number(r.new) || 0, Number(r.contacted) || 0);
  }
  if (max <= 1) return 4;
  return Math.max(max + 1, Math.ceil(max * 1.2));
}

function countYMax(values: number[], minCeiling = 4): number {
  const max = Math.max(0, ...values);
  if (max <= 1) return minCeiling;
  return Math.max(minCeiling, Math.ceil(max * 1.12));
}

function vehicleSliceColor(name: string, index: number): string {
  const key = name.toLowerCase();
  if (key.includes("available")) return "#10b981";
  if (key.includes("sold")) return "#f43f5e";
  if (key.includes("pending")) return "#f59e0b";
  if (key.includes("reserved")) return "#6366f1";
  if (key.includes("unknown")) return "#94a3b8";
  const fallback = ["#0ea5e9", "#a78bfa", "#f472b6", "#2dd4bf"];
  return fallback[index % fallback.length];
}

function interestBarColor(name: string): string {
  const key = name.toLowerCase();
  if (key.includes("high")) return "#10b981";
  if (key.includes("medium")) return "#f59e0b";
  if (key.includes("low")) return "#94a3b8";
  if (key.includes("unknown")) return "#cbd5e1";
  return "#3b82f6";
}

function financeSliceColor(name: string, index: number): string {
  const key = name.toLowerCase();
  if (key.includes("approved")) return "#10b981";
  if (key.includes("pending")) return "#f59e0b";
  if (key.includes("review")) return "#3b82f6";
  if (key.includes("reject")) return "#f43f5e";
  if (key.includes("unknown")) return "#94a3b8";
  const fallback = ["#6366f1", "#0ea5e9", "#a855f7", "#14b8a6"];
  return fallback[index % fallback.length];
}

function loginActivityYMax(rows: { logins?: number }[]): number {
  const max = Math.max(0, ...rows.map((r) => Number(r.logins) || 0));
  if (max <= 1) return 4;
  return Math.max(max + 1, Math.ceil(max * 1.15));
}

function financeMonthlyYMax(rows: { applications?: number }[]): number {
  return countYMax(rows.map((r) => Number(r.applications) || 0), 4);
}

function renderPiePercentLabel(props: Record<string, unknown>) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  };
  if (!percent || percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      className="fill-foreground text-[11px] font-semibold"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function computeLeadsTrend(leads: any[]) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split("T")[0];
  });

  return last7Days.map((date) => {
    const dayLeads = leads.filter((lead: any) => lead.created_at?.split("T")[0] === date);
    return {
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      leads: dayLeads.length,
      new: dayLeads.filter((l: any) => l.status === "new").length,
      contacted: dayLeads.filter((l: any) => l.status === "contacted").length,
    };
  });
}

function computeVehicleStatusData(vehicles: any[]) {
  const statusCounts = vehicles.reduce((acc: Record<string, number>, vehicle: any) => {
    const status = vehicle.inventory_status || vehicle.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count as number,
  }));
}

function computeLeadInterestData(leads: any[]) {
  const interestCounts = leads.reduce((acc: Record<string, number>, lead: any) => {
    const level = lead.interest_level || "unknown";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(interestCounts).map(([level, count]) => ({
    name: level.charAt(0).toUpperCase() + level.slice(1),
    leads: count as number,
  }));
}

function computeSalesTrendData(vehicles: any[]) {
  const soldVehicles = vehicles.filter(
    (v: any) => v.inventory_status === "sold" || v.status === "sold"
  );

  const monthlySales = soldVehicles.reduce((acc: Record<string, number>, vehicle: any) => {
    const date = new Date(vehicle.updated_at || vehicle.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    acc[monthKey] = (acc[monthKey] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(monthlySales)
    .map(([month, count]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      sales: count as number,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
}

interface DashboardStats {
  totalVehicles: number;
  availableVehicles: number;
  totalLeads: number;
  newLeads: number;
  soldVehicles: number;
  pipelineVehicles: number;
  newLeads24h: number;
  contactedLeads: number;
  hotLeads: number;
  staleNewLeads: number;
}

interface RecentVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  status: string;
  price?: number;
  qr_code_url?: string;
  vehicle_type?: string;
  created_at: string;
}

interface RecentLead {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  interest_level: string;
  created_at: string;
  follow_up_date?: string;
}

interface UpcomingFollowUpRow {
  id: string;
  lead_id: string;
  scheduled_date: string;
  status?: string;
  customer_name?: string;
  customer_email?: string;
  year?: number;
  make?: string;
  model?: string;
}

const emptyStats: DashboardStats = {
  totalVehicles: 0,
  availableVehicles: 0,
  totalLeads: 0,
  newLeads: 0,
  soldVehicles: 0,
  pipelineVehicles: 0,
  newLeads24h: 0,
  contactedLeads: 0,
  hotLeads: 0,
  staleNewLeads: 0,
};

const Dashboard = () => {
  const chartGradIdMain = useId().replace(/:/g, "");
  const chartGradIdMini = useId().replace(/:/g, "");
  const chartGradIdLogin = useId().replace(/:/g, "");
  const chartGradIdFinanceTrend = useId().replace(/:/g, "");
  const chartGradIdLoginSnap = useId().replace(/:/g, "");
  const { user, loading: authLoading, getDealerId } = useAuth();
  const { isSuperAdmin, isDealerAdmin, canAccessFeature, subscriptionPlan } = usePermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicle[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [cachedLeads, setCachedLeads] = useState<any[]>([]);
  const [cachedVehicles, setCachedVehicles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState<string | null>(null);
  const [leadsTrendData, setLeadsTrendData] = useState<any[]>([]);
  const [vehicleStatusData, setVehicleStatusData] = useState<any[]>([]);
  const [leadInterestData, setLeadInterestData] = useState<any[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<UpcomingFollowUpRow[]>([]);
  const [loginActivityData, setLoginActivityData] = useState<{ date: string; logins: number }[]>([]);
  const [financeStatusChartData, setFinanceStatusChartData] = useState<{ name: string; value: number }[]>([]);
  const [financeMonthlyData, setFinanceMonthlyData] = useState<{ month: string; applications: number }[]>([]);
  const { toast } = useToast();

  const showAdminOperations = useMemo(() => {
    if (!user) return false;
    if (isSuperAdmin() || isDealerAdmin()) return true;
    const role = String(user.staffRole || "");
    if (user.role === "dealer" && role !== "sales" && role !== "inventory") return true;
    return false;
  }, [user, isSuperAdmin, isDealerAdmin]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      void fetchDashboardData(false);
      console.log("Initializing desktop notifications...");
      console.log("Notification supported:", notificationService.isNotificationSupported());
      console.log("Notification permission:", notificationService.getNotificationPermission());
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (canAccessFeature("lead_management")) {
      setLeadsTrendData(computeLeadsTrend(cachedLeads));
      setLeadInterestData(computeLeadInterestData(cachedLeads));
    } else {
      setLeadsTrendData([]);
      setLeadInterestData([]);
    }

    if (canAccessFeature("vehicle_import")) {
      setVehicleStatusData(computeVehicleStatusData(cachedVehicles));
      setSalesTrendData(computeSalesTrendData(cachedVehicles));
    } else {
      setVehicleStatusData([]);
      setSalesTrendData([]);
    }
  }, [user, canAccessFeature, cachedLeads, cachedVehicles]);

  const fetchDashboardData = async (isManualRefresh: boolean) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const dealerId = getDealerId();
      const insightsPromise = dealerId
        ? dealersAPI.getDashboardInsights().catch(() => null)
        : Promise.resolve(null);

      const [vehicleResponse, leadData, insights] = await Promise.all([
        vehiclesAPI.getAll({ limit: 1000 }),
        leadsAPI.getAll(),
        insightsPromise,
      ]);

      if (dealerId && insights && typeof insights === "object" && (insights as { success?: boolean }).success) {
        const ins = insights as {
          loginActivity?: { date: string; logins: number }[];
          financeByStatus?: { name: string; value: number }[];
          financeMonthly?: { month: string; applications: number }[];
        };
        setLoginActivityData(Array.isArray(ins.loginActivity) ? ins.loginActivity : []);
        setFinanceStatusChartData(Array.isArray(ins.financeByStatus) ? ins.financeByStatus : []);
        setFinanceMonthlyData(Array.isArray(ins.financeMonthly) ? ins.financeMonthly : []);
      } else {
        setLoginActivityData([]);
        setFinanceStatusChartData([]);
        setFinanceMonthlyData([]);
      }

      const vehicleData = vehicleResponse.data || [];
      const now = Date.now();
      const dayAgo = now - MS_DAY;
      const threeDaysAgo = now - 3 * MS_DAY;

      const availableCount = vehicleData.filter((v: any) => v.inventory_status === "available").length;
      const soldCount = vehicleData.filter(
        (v: any) => (v.inventory_status || v.status || "").toLowerCase() === "sold"
      ).length;
      const pipelineCount = vehicleData.filter((v: any) => {
        const s = String(v.inventory_status || v.status || "").toLowerCase();
        return s && s !== "available" && s !== "sold";
      }).length;

      const dashboardStats: DashboardStats = {
        totalVehicles: availableCount,
        availableVehicles: availableCount,
        totalLeads: leadData.length,
        newLeads: leadData.filter((l: any) => l.status === "new").length,
        soldVehicles: soldCount,
        pipelineVehicles: pipelineCount,
        newLeads24h: leadData.filter((l: any) => {
          const t = l.created_at ? new Date(l.created_at).getTime() : 0;
          return t >= dayAgo;
        }).length,
        contactedLeads: leadData.filter((l: any) => l.status === "contacted").length,
        hotLeads: leadData.filter((l: any) => String(l.interest_level || "").toLowerCase() === "high").length,
        staleNewLeads: leadData.filter((l: any) => {
          if (String(l.status || "").toLowerCase() !== "new") return false;
          const t = l.created_at ? new Date(l.created_at).getTime() : 0;
          return t > 0 && t < threeDaysAgo;
        }).length,
      };

      setStats(dashboardStats);
      setCachedVehicles(vehicleData);
      setCachedLeads(leadData);

      const sortedVehicles = [...vehicleData].sort((a: any, b: any) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      setRecentVehicles(sortedVehicles.slice(0, 5));

      const sortedLeads = [...leadData].sort((a: any, b: any) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      setRecentLeads(sortedLeads.slice(0, 5));

      if (showAdminOperations && canAccessFeature("lead_management")) {
        try {
          const fuRes = await leadsAPI.getUpcomingFollowUps(14);
          const rows = fuRes?.followUps ?? fuRes?.data ?? [];
          setUpcomingFollowUps(Array.isArray(rows) ? rows : []);
        } catch {
          setUpcomingFollowUps([]);
        }
      } else {
        setUpcomingFollowUps([]);
      }
    } catch (error: unknown) {
      console.error("Error fetching dashboard data:", error);
      setError("Failed to load dashboard data. Please check your connection.");
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
      setStats(emptyStats);
      setCachedLeads([]);
      setCachedVehicles([]);
      setUpcomingFollowUps([]);
      setLoginActivityData([]);
      setFinanceStatusChartData([]);
      setFinanceMonthlyData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return "Price not set";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const clearCache = async () => {
    try {
      // Clear browser cache for images and files
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Clear localStorage if needed
      const keysToKeep = ['auth_token', 'user_preferences'];
      const keysToRemove = Object.keys(localStorage).filter(key => 
        !keysToKeep.includes(key) && (key.includes('cache') || key.includes('temp'))
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Force reload of images by adding timestamp
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src.includes('/uploads/')) {
          img.src = img.src + (img.src.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
      });

      toast({
        title: "Cache Cleared",
        description: "Browser cache and temporary files have been cleared",
      });

      await fetchDashboardData(false);
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Cache Clear Error",
        description: "Failed to clear cache completely",
        variant: "destructive",
      });
    }
  };

  const leadsChartConfig = {
    leads: { label: "Total leads", color: "#2563eb" },
    new: { label: "New", color: "#7c3aed" },
    contacted: { label: "Contacted", color: "#ea580c" },
  };

  const vehicleStatusConfig = {
    available: { label: "Available", color: "#10b981" },
    sold: { label: "Sold", color: "#f43f5e" },
    pending: { label: "Pending", color: "#f59e0b" },
    reserved: { label: "Reserved", color: "#6366f1" },
    unknown: { label: "Other", color: "#94a3b8" },
  };

  const interestChartConfig = {
    leads: { label: "Leads", color: "#3b82f6" },
  };

  const salesChartConfig = {
    sales: { label: "Units sold", color: "#059669" },
  };

  const leadsYAxisMax = useMemo(() => leadsTrendYMax(leadsTrendData), [leadsTrendData]);
  const interestYMax = useMemo(
    () => countYMax(leadInterestData.map((d: { leads: number }) => d.leads)),
    [leadInterestData]
  );
  const salesYAxisMax = useMemo(
    () => countYMax(salesTrendData.map((d: { sales: number }) => d.sales), 6),
    [salesTrendData]
  );

  const loginChartConfig = {
    logins: { label: "Sign-ins", color: "#2563eb" },
  };

  const financeMonthlyChartConfig = {
    applications: { label: "Applications", color: "#6366f1" },
  };

  const financePieChartConfig = {
    apps: { label: "Credit applications", color: "#6366f1" },
  };

  const loginYAxisMax = useMemo(() => loginActivityYMax(loginActivityData), [loginActivityData]);
  const financeMonthYAxisMax = useMemo(
    () => financeMonthlyYMax(financeMonthlyData),
    [financeMonthlyData]
  );

  const generateQRCode = async (vehicleId: string) => {
    try {
      setGeneratingQR(vehicleId);
      await vehiclesAPI.generateQRCode(vehicleId);
      
      // Update the vehicle in the local state
      setRecentVehicles(prev => prev.map(v => 
        v.id === vehicleId ? { ...v, qr_code_url: `/uploads/qr-codes/vehicle-${vehicleId}-qr.png` } : v
      ));
      
      toast({
        title: "QR Code Generated",
        description: "QR code has been generated successfully",
      });
    } catch (error: any) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setGeneratingQR(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/90 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50/95 to-slate-100/80">
      <TopNavigation />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {showAdminOperations
                ? "Dealership overview"
                : user.staffRole === "sales"
                  ? "Sales Agent Portal"
                  : user.staffRole === "inventory"
                    ? "Inventory Manager Portal"
                    : "Dashboard"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {showAdminOperations
                ? "Inventory, lead pipeline, and AI-assisted conversations in one place."
                : user.staffRole === "sales"
                  ? "Manage your leads, showcase vehicles, and engage with customers."
                  : user.staffRole === "inventory"
                    ? "Manage vehicle inventory, generate QR codes, and track vehicle status."
                    : "Manage your vehicle inventory and track customer interactions."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {user.staffRole === "sales" && (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-xs text-green-800">
                  Sales Agent
                </Badge>
              )}
              {user.staffRole === "inventory" && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-xs text-primary">
                  Inventory Manager
                </Badge>
              )}
              {showAdminOperations && (
                <Badge variant="outline" className="border-primary/25 bg-primary/5 text-xs text-primary">
                  Admin view
                </Badge>
              )}
              {subscriptionPlan && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-xs text-primary">
                  {subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)} Plan
                </Badge>
              )}
            </div>
          </div>
          {showAdminOperations && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 self-start sm:self-auto"
              onClick={() => void fetchDashboardData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh data
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm">
            <p className="text-sm text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchDashboardData(false)}>
              Retry
            </Button>
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Quick options</h3>
              <p className="text-xs text-muted-foreground">Fast access to your most used CRM workflows.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {canAccessFeature("vehicle_import") && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/vehicles")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Car className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Vehicles</p>
                    <p className="text-xs text-muted-foreground">{stats.totalVehicles} available</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("lead_management") && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/leads")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Leads</p>
                    <p className="text-xs text-muted-foreground">{stats.totalLeads} total</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("lead_management") && (user.staffRole === "sales" || showAdminOperations) && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/leads")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-orange-500/10 p-2 text-orange-600">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">New leads</p>
                    <p className="text-xs text-muted-foreground">{stats.newLeads} pending</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("lead_management") && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/daive/analytics")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-violet-500/10 p-2 text-violet-600">
                    <Brain className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">D.A.I.V.E. analytics</p>
                    <p className="text-xs text-muted-foreground">AI performance view</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("analytics_dashboard") && user.staffRole !== "sales" && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/daive/settings")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">AI settings</p>
                    <p className="text-xs text-muted-foreground">Configure D.A.I.V.E.</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("lead_management") && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/ai-bot")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-sky-500/10 p-2 text-sky-600">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">AI bot</p>
                    <p className="text-xs text-muted-foreground">Voice and text chat</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("vehicle_import") && user.staffRole !== "sales" && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/import")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-teal-500/10 p-2 text-teal-600">
                    <Database className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Import vehicles</p>
                    <p className="text-xs text-muted-foreground">Add inventory from files</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {canAccessFeature("lead_management") && showAdminOperations && (
              <button
                type="button"
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                onClick={() => navigate("/conversation-monitor")}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="rounded-lg bg-pink-500/10 p-2 text-pink-600">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Conversation monitor</p>
                    <p className="text-xs text-muted-foreground">Scenarios and flow</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </section>

        {showAdminOperations && (canAccessFeature("lead_management") || canAccessFeature("vehicle_import")) && (
          <section className="mb-8 space-y-4" aria-label="Admin operations">
            <div className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <LayoutDashboard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">Operations snapshot</h3>
                    <p className="text-sm text-muted-foreground">
                      Pipeline health, lead urgency, and scheduled follow-ups.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {canAccessFeature("vehicle_import") && (
                  <>
                    <div className="rounded-xl border border-border/60 bg-background/90 px-3 py-3">
                      <p className="text-xs font-medium text-muted-foreground">Sold units</p>
                      <p className="text-2xl font-bold tabular-nums">{stats.soldVehicles}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/90 px-3 py-3">
                      <p className="text-xs font-medium text-muted-foreground">Pipeline / other</p>
                      <p className="text-2xl font-bold tabular-nums">{stats.pipelineVehicles}</p>
                    </div>
                  </>
                )}
                {canAccessFeature("lead_management") && (
                  <>
                    <div className="rounded-xl border border-border/60 bg-background/90 px-3 py-3">
                      <p className="text-xs font-medium text-muted-foreground">Leads (24h)</p>
                      <p className="text-2xl font-bold tabular-nums text-emerald-600">{stats.newLeads24h}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/90 px-3 py-3">
                      <p className="text-xs font-medium text-muted-foreground">Hot interest</p>
                      <p className="text-2xl font-bold tabular-nums text-orange-600">{stats.hotLeads}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/90 px-3 py-3">
                      <p className="text-xs font-medium text-muted-foreground">Contacted</p>
                      <p className="text-2xl font-bold tabular-nums">{stats.contactedLeads}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-3">
                      <p className="text-xs font-medium text-amber-900/80">Stale new</p>
                      <p className="text-2xl font-bold tabular-nums text-amber-800">{stats.staleNewLeads}</p>
                      <p className="mt-0.5 text-[10px] text-amber-900/70">&gt; 3 days, still &quot;new&quot;</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">Analytics snapshot</h3>
                    <p className="text-xs text-muted-foreground">
                      Sign-ins · interest · finance status · sales pace
                    </p>
                  </div>
                </div>
                {(canAccessFeature("lead_management") || canAccessFeature("analytics_dashboard")) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => navigate("/daive/analytics")}
                  >
                    Full analytics
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {canAccessFeature("lead_management") && (
                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="space-y-0 p-3 pb-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        {getDealerId() ? "User sign-ins (7d)" : "Leads (7 days)"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                      {getDealerId() ? (
                        loginActivityData.length > 0 ? (
                          <ChartContainer config={loginChartConfig} className="aspect-auto h-[128px] w-full">
                            <AreaChart data={loginActivityData} margin={{ top: 10, right: 6, left: -4, bottom: 2 }}>
                              <defs>
                                <linearGradient id={chartGradIdLoginSnap} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/60" />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={6}
                              />
                              <YAxis
                                width={30}
                                domain={[0, loginYAxisMax]}
                                allowDecimals={false}
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                                tickCount={5}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Area
                                type="natural"
                                dataKey="logins"
                                stroke="#1d4ed8"
                                strokeWidth={2}
                                fill={`url(#${chartGradIdLoginSnap})`}
                                fillOpacity={1}
                                name="Sign-ins"
                              />
                            </AreaChart>
                          </ChartContainer>
                        ) : (
                          <div className="flex h-[120px] items-center justify-center px-2 text-center text-xs text-muted-foreground">
                            No sign-ins in range
                          </div>
                        )
                      ) : leadsTrendData.length > 0 ? (
                        <ChartContainer config={leadsChartConfig} className="aspect-auto h-[128px] w-full">
                          <LineChart data={leadsTrendData} margin={{ top: 10, right: 6, left: -4, bottom: 2 }}>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/60" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={6}
                            />
                            <YAxis
                              width={30}
                              domain={[0, leadsYAxisMax]}
                              allowDecimals={false}
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickCount={5}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "4 4" }} />
                            <Line
                              type="natural"
                              dataKey="leads"
                              stroke="var(--color-leads)"
                              strokeWidth={2.5}
                              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 5, strokeWidth: 0 }}
                              name="Total leads"
                            />
                          </LineChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
                          No lead volume in range
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {canAccessFeature("lead_management") && (
                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="space-y-0 p-3 pb-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Interest mix</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                      {leadInterestData.length > 0 ? (
                        <ChartContainer config={interestChartConfig} className="aspect-auto h-[128px] w-full">
                          <BarChart data={leadInterestData} margin={{ top: 10, right: 6, left: -4, bottom: 2 }} barCategoryGap="18%">
                            <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/60" />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={6}
                            />
                            <YAxis
                              width={28}
                              domain={[0, interestYMax]}
                              allowDecimals={false}
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickCount={5}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted) / 0.25)" }} />
                            <Bar dataKey="leads" radius={[8, 8, 4, 4]} maxBarSize={44}>
                              {leadInterestData.map((entry: { name: string }, index: number) => (
                                <Cell key={`mini-int-${entry.name}-${index}`} fill={interestBarColor(entry.name)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
                          No interest data
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {(getDealerId() || canAccessFeature("vehicle_import")) && (
                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="space-y-0 p-3 pb-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        {getDealerId() ? "Credit app status" : "Inventory status"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                      {getDealerId() ? (
                        financeStatusChartData.length > 0 ? (
                          <ChartContainer
                            config={financePieChartConfig}
                            className="mx-auto aspect-auto h-[148px] w-full min-w-0 max-w-full"
                          >
                            <PieChart margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Pie
                                data={financeStatusChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="42%"
                                innerRadius={34}
                                outerRadius={52}
                                paddingAngle={2.5}
                                cornerRadius={4}
                                stroke="hsl(var(--card))"
                                strokeWidth={2}
                                labelLine={false}
                                label={renderPiePercentLabel}
                              >
                                {financeStatusChartData.map((entry: { name: string }, index: number) => (
                                  <Cell key={`mini-fin-${index}`} fill={financeSliceColor(entry.name, index)} />
                                ))}
                              </Pie>
                              <ChartLegend
                                verticalAlign="bottom"
                                align="center"
                                content={() => (
                                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 pt-1">
                                    {financeStatusChartData.map((d: { name: string; value: number }, i: number) => (
                                      <span
                                        key={`${d.name}-${i}`}
                                        className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
                                      >
                                        <span
                                          className="h-2 w-2 shrink-0 rounded-full shadow-sm ring-1 ring-black/5"
                                          style={{ backgroundColor: financeSliceColor(d.name, i) }}
                                        />
                                        <span className="font-medium text-foreground">{d.name}</span>
                                        <span className="tabular-nums opacity-80">({d.value})</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              />
                            </PieChart>
                          </ChartContainer>
                        ) : (
                          <div className="flex h-[130px] items-center justify-center text-xs text-muted-foreground">
                            No finance apps
                          </div>
                        )
                      ) : vehicleStatusData.length > 0 ? (
                        <ChartContainer
                          config={vehicleStatusConfig}
                          className="mx-auto aspect-auto h-[148px] w-full min-w-0 max-w-full"
                        >
                          <PieChart margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={vehicleStatusData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="42%"
                              innerRadius={34}
                              outerRadius={52}
                              paddingAngle={2.5}
                              cornerRadius={4}
                              stroke="hsl(var(--card))"
                              strokeWidth={2}
                              labelLine={false}
                              label={renderPiePercentLabel}
                            >
                              {vehicleStatusData.map((entry: { name: string }, index: number) => (
                                <Cell key={`mini-cell-${index}`} fill={vehicleSliceColor(entry.name, index)} />
                              ))}
                            </Pie>
                            <ChartLegend
                              verticalAlign="bottom"
                              align="center"
                              content={() => (
                                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 pt-1">
                                  {vehicleStatusData.map((d: { name: string; value: number }, i: number) => (
                                    <span
                                      key={d.name}
                                      className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"
                                    >
                                      <span
                                        className="h-2 w-2 shrink-0 rounded-full shadow-sm ring-1 ring-black/5"
                                        style={{ backgroundColor: vehicleSliceColor(d.name, i) }}
                                      />
                                      <span className="font-medium text-foreground">{d.name}</span>
                                      <span className="tabular-nums opacity-80">({d.value})</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[130px] items-center justify-center text-xs text-muted-foreground">
                          No vehicles
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {canAccessFeature("vehicle_import") && (
                  <Card className="border-border/60 shadow-none">
                    <CardHeader className="space-y-0 p-3 pb-0">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Sales (by month)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                      {salesTrendData.length > 0 ? (
                        <ChartContainer config={salesChartConfig} className="aspect-auto h-[128px] w-full">
                          <AreaChart data={salesTrendData} margin={{ top: 10, right: 6, left: -4, bottom: 2 }}>
                            <defs>
                              <linearGradient id={chartGradIdMini} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/60" />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              interval={0}
                              tickMargin={6}
                            />
                            <YAxis
                              width={30}
                              domain={[0, salesYAxisMax]}
                              allowDecimals={false}
                              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickCount={5}
                            />
                            <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "4 4" }} />
                            <Area
                              type="natural"
                              dataKey="sales"
                              stroke="#059669"
                              strokeWidth={2}
                              fill={`url(#${chartGradIdMini})`}
                              fillOpacity={1}
                            />
                          </AreaChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
                          No sold units in range
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {canAccessFeature("lead_management") && (
                <Card className="rounded-2xl border border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Priority queues
                    </CardTitle>
                    <CardDescription>Open the leads board to work these cohorts.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:bg-muted/70"
                      onClick={() => navigate("/leads")}
                    >
                      <div>
                        <p className="text-sm font-medium">New leads</p>
                        <p className="text-xs text-muted-foreground">Awaiting first contact</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="tabular-nums">
                          {stats.newLeads}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                    <Separator />
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:bg-muted/70"
                      onClick={() => navigate("/leads")}
                    >
                      <div>
                        <p className="text-sm font-medium">High interest</p>
                        <p className="text-xs text-muted-foreground">Prioritize outreach</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="tabular-nums">
                          {stats.hotLeads}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                    <Separator />
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:bg-muted/70"
                      onClick={() => navigate("/leads")}
                    >
                      <div>
                        <p className="text-sm font-medium">Stale new leads</p>
                        <p className="text-xs text-muted-foreground">Created 3+ days ago, still new</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-amber-300/80 text-amber-900 tabular-nums">
                          {stats.staleNewLeads}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  </CardContent>
                </Card>
              )}

              {canAccessFeature("lead_management") && (
                <Card className="rounded-2xl border border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Calendar className="h-4 w-4 text-primary" />
                      Upcoming follow-ups
                    </CardTitle>
                    <CardDescription>Scheduled in the next 14 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingFollowUps.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No scheduled follow-ups in this window.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {upcomingFollowUps.slice(0, 7).map((fu) => (
                          <li key={fu.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                              onClick={() => navigate(`/leads/${fu.lead_id}`)}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{fu.customer_name || "Lead"}</p>
                                {(fu.year || fu.make || fu.model) && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {[fu.year, fu.make, fu.model].filter(Boolean).join(" ")}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs font-medium text-primary">
                                  {fu.scheduled_date
                                    ? new Date(fu.scheduled_date).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </p>
                                <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{user.staffRole === 'sales' ? 'Available Vehicles' : 
                       user.staffRole === 'inventory' ? 'Vehicle Inventory' : 'Recent Vehicles'}</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/vehicles")}>
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentVehicles.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Car className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">No vehicles yet</p>
                  {user.staffRole === 'sales' ? (
                    <p className="text-xs text-gray-400 mt-1">Contact your manager to add vehicles</p>
                  ) : user.staffRole === 'inventory' ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => navigate("/vehicles")}
                    >
                      Import Vehicle Inventory
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => navigate("/vehicles")}
                    >
                      Add Your First Vehicle
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVehicles.map((vehicle) => (
                    <div 
                      key={vehicle.id} 
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border/50 p-2 transition-colors hover:bg-muted/50"
                      onClick={() => navigate(`/vehicle/${vehicle.id}`)}
                    >
                      <div className="flex items-center space-x-3">
                        {/* QR Code Display - Important for sales agents */}
                        <div className="flex-shrink-0 relative">
                          {vehicle.qr_code_url ? (
                            <img 
                              crossOrigin="anonymous" // must be set before src
                              src={buildBackendAssetUrl(vehicle.qr_code_url)}
                              alt="QR Code"
                              className="w-12 h-12 border-2 border-green-200 rounded cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                              title="Click to view full size QR code"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(buildBackendAssetUrl(vehicle.qr_code_url), '_blank');
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                              <span className="text-xs text-gray-500 text-center">No QR</span>
                              {canAccessFeature('qr_code_generation') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="absolute -top-1 -right-1 h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateQRCode(vehicle.id);
                                  }}
                                  title="Generate QR Code"
                                  disabled={generatingQR === vehicle.id}
                                >
                                  {generatingQR === vehicle.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-600"></div>
                                  ) : (
                                    <QrCode className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Vehicle Info */}
                        <div>
                          <p className="font-medium text-sm">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatPrice(vehicle.price)}
                            {vehicle.vehicle_type && (
                              <span className="ml-2 text-primary">
                                • {vehicle.vehicle_type}
                              </span>
                            )}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge
                              variant={
                                String(vehicle.inventory_status || vehicle.status || "").toLowerCase() ===
                                "available"
                                  ? "default"
                                  : "outline"
                              }
                              className={`text-xs ${
                                String(vehicle.inventory_status || vehicle.status || "").toLowerCase() ===
                                "available"
                                  ? "bg-green-100 text-green-800"
                                  : ""
                              }`}
                            >
                              {vehicle.inventory_status || vehicle.status || "—"}
                            </Badge>
                            {vehicle.qr_code_url && (
                              <Badge variant="secondary" className="text-xs">
                                QR Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {new Date(vehicle.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{user.staffRole === 'sales' ? 'My Leads' : 
                       user.staffRole === 'inventory' ? 'Customer Leads' : 'Recent Leads'}</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/leads")}>
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLeads.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">No leads yet</p>
                  {user.staffRole === 'sales' && (
                    <p className="text-xs text-gray-400 mt-1">Start engaging with customers to see leads here</p>
                  )}
                  {user.staffRole === 'inventory' && (
                    <p className="text-xs text-gray-400 mt-1">Customer leads will appear here as they interact with vehicles</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div 
                      key={lead.id} 
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border/50 p-2 transition-colors hover:bg-muted/50"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{lead.customer_name}</p>
                        <p className="text-xs text-gray-600">{lead.customer_email}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge 
                            variant={lead.status === 'new' ? 'default' : 'outline'} 
                            className={`text-xs ${lead.status === 'new' ? 'bg-primary/15 text-primary' : ''}`}
                          >
                            {lead.status}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              lead.interest_level === 'high' ? 'bg-green-100 text-green-800' :
                              lead.interest_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {lead.interest_level} interest
                          </Badge>
                        </div>
                        {showAdminOperations && lead.follow_up_date && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Follow-up: {new Date(lead.follow_up_date).toLocaleDateString()}
                          </p>
                        )}
                        {user.staffRole === 'sales' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Click to manage this lead
                          </p>
                        )}
                        {user.staffRole === 'inventory' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Customer interested in vehicles
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts Section */}
        {(canAccessFeature("lead_management") ||
          canAccessFeature("vehicle_import") ||
          !!getDealerId()) && (
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {getDealerId() ? (
              <>
                <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/15 shadow-md ring-1 ring-border/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      Dealership user sign-ins
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Dealer owner and active staff: unique accounts with a login recorded each day (last 7 days).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {loginActivityData.length > 0 ? (
                      <ChartContainer
                        config={loginChartConfig}
                        className="aspect-auto h-[min(340px,52vw)] w-full min-h-[280px] max-w-full sm:h-[320px]"
                      >
                        <AreaChart data={loginActivityData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                          <defs>
                            <linearGradient id={chartGradIdLogin} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.42} />
                              <stop offset="55%" stopColor="#2563eb" stopOpacity={0.12} />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/70" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            domain={[0, loginYAxisMax]}
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            tickCount={6}
                          />
                          <ChartTooltip
                            content={<ChartTooltipContent />}
                            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "5 5" }}
                          />
                          <Area
                            type="natural"
                            dataKey="logins"
                            stroke="#1d4ed8"
                            strokeWidth={2.5}
                            fill={`url(#${chartGradIdLogin})`}
                            fillOpacity={1}
                            name="Sign-ins"
                          />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-[300px] flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted-foreground">
                        <p>No sign-in activity in this range yet.</p>
                        <p className="text-xs">Successful logins are recorded after the latest database migration.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/15 shadow-md ring-1 ring-border/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      Finance & credit applications
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Application status mix and monthly submission volume for your dealership.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pb-4">
                    {financeStatusChartData.length > 0 ? (
                      <ChartContainer
                        config={financePieChartConfig}
                        className="aspect-auto mx-auto h-[240px] w-full min-h-[220px] max-w-full sm:h-[260px]"
                      >
                        <PieChart margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Pie
                            data={financeStatusChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="44%"
                            innerRadius="38%"
                            outerRadius="62%"
                            paddingAngle={2.5}
                            cornerRadius={5}
                            stroke="hsl(var(--card))"
                            strokeWidth={2}
                            labelLine={false}
                            label={renderPiePercentLabel}
                          >
                            {financeStatusChartData.map((entry: { name: string }, index: number) => (
                              <Cell key={`fin-pie-${entry.name}-${index}`} fill={financeSliceColor(entry.name, index)} />
                            ))}
                          </Pie>
                          <ChartLegend
                            verticalAlign="bottom"
                            align="center"
                            content={() => (
                              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-3">
                                {financeStatusChartData.map((d: { name: string; value: number }, i: number) => (
                                  <span
                                    key={`${d.name}-${i}`}
                                    className="inline-flex items-center gap-2 text-xs text-muted-foreground sm:text-sm"
                                  >
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-1 ring-black/10"
                                      style={{ backgroundColor: financeSliceColor(d.name, i) }}
                                    />
                                    <span className="font-medium text-foreground">{d.name}</span>
                                    <span className="tabular-nums">({d.value})</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                        No credit applications found for this dealership.
                      </div>
                    )}

                    {financeMonthlyData.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Applications by month</p>
                          <ChartContainer
                            config={financeMonthlyChartConfig}
                            className="aspect-auto h-[200px] w-full"
                          >
                            <AreaChart data={financeMonthlyData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                              <defs>
                                <linearGradient id={chartGradIdFinanceTrend} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/60" />
                              <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                tickMargin={6}
                              />
                              <YAxis
                                domain={[0, financeMonthYAxisMax]}
                                allowDecimals={false}
                                width={36}
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickLine={false}
                                axisLine={false}
                                tickCount={5}
                              />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Area
                                type="natural"
                                dataKey="applications"
                                stroke="#4f46e5"
                                strokeWidth={2}
                                fill={`url(#${chartGradIdFinanceTrend})`}
                                fillOpacity={1}
                                name="Applications"
                              />
                            </AreaChart>
                          </ChartContainer>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {canAccessFeature("lead_management") && (
                  <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/15 shadow-md ring-1 ring-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold tracking-tight">Leads trend (last 7 days)</CardTitle>
                      <CardDescription className="text-xs">
                        Volume, new intake, and contacted for each day
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      {leadsTrendData.length > 0 ? (
                        <ChartContainer
                          config={leadsChartConfig}
                          className="aspect-auto h-[min(340px,52vw)] w-full min-h-[280px] max-w-full sm:h-[320px]"
                        >
                          <LineChart data={leadsTrendData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/70" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                            />
                            <YAxis
                              domain={[0, leadsYAxisMax]}
                              allowDecimals={false}
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              tickLine={false}
                              axisLine={false}
                              width={40}
                              tickCount={6}
                            />
                            <ChartTooltip
                              content={<ChartTooltipContent />}
                              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "5 5" }}
                            />
                            <ChartLegend
                              verticalAlign="top"
                              align="right"
                              wrapperStyle={{ paddingBottom: 8 }}
                              content={({ payload, verticalAlign }) => (
                                <ChartLegendContent
                                  payload={payload}
                                  verticalAlign={verticalAlign}
                                  className="justify-end gap-4 !pb-0 [&>div]:gap-2 [&>div]:text-xs [&>div]:font-medium"
                                />
                              )}
                            />
                            <Line
                              type="natural"
                              dataKey="leads"
                              stroke="var(--color-leads)"
                              strokeWidth={2.75}
                              dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                              name="Total leads"
                            />
                            <Line
                              type="natural"
                              dataKey="new"
                              stroke="var(--color-new)"
                              strokeWidth={2.25}
                              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 5, strokeWidth: 0 }}
                              name="New"
                            />
                            <Line
                              type="natural"
                              dataKey="contacted"
                              stroke="var(--color-contacted)"
                              strokeWidth={2.25}
                              strokeDasharray="6 4"
                              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 5, strokeWidth: 0 }}
                              name="Contacted"
                            />
                          </LineChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                          No data available yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {canAccessFeature("vehicle_import") && (
                  <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/15 shadow-md ring-1 ring-border/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold tracking-tight">Vehicle status mix</CardTitle>
                      <CardDescription className="text-xs">Share of inventory by status</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                      {vehicleStatusData.length > 0 ? (
                        <ChartContainer
                          config={vehicleStatusConfig}
                          className="aspect-auto mx-auto h-[min(340px,52vw)] w-full min-h-[280px] max-w-full sm:h-[320px]"
                        >
                          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={vehicleStatusData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="46%"
                              innerRadius="42%"
                              outerRadius="68%"
                              paddingAngle={2.5}
                              cornerRadius={6}
                              stroke="hsl(var(--card))"
                              strokeWidth={3}
                              labelLine={false}
                              label={renderPiePercentLabel}
                            >
                              {vehicleStatusData.map((entry: { name: string }, index: number) => (
                                <Cell key={`cell-${index}`} fill={vehicleSliceColor(entry.name, index)} />
                              ))}
                            </Pie>
                            <ChartLegend
                              verticalAlign="bottom"
                              align="center"
                              content={() => (
                                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4">
                                  {vehicleStatusData.map((d: { name: string; value: number }, i: number) => (
                                    <span
                                      key={d.name}
                                      className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                                    >
                                      <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-1 ring-black/10"
                                        style={{ backgroundColor: vehicleSliceColor(d.name, i) }}
                                      />
                                      <span className="font-medium text-foreground">{d.name}</span>
                                      <span className="tabular-nums text-muted-foreground">({d.value})</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            />
                          </PieChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                          No data available yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {canAccessFeature('lead_management') && (
              <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/15 shadow-md ring-1 ring-border/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold tracking-tight">Lead interest levels</CardTitle>
                  <CardDescription className="text-xs">Count of leads by interest bucket</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  {leadInterestData.length > 0 ? (
                    <ChartContainer config={interestChartConfig} className="aspect-auto h-[min(340px,52vw)] w-full min-h-[280px] max-w-full sm:h-[320px]">
                      <BarChart data={leadInterestData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }} barCategoryGap="22%">
                        <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/70" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                        />
                        <YAxis
                          domain={[0, interestYMax]}
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tickCount={6}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted) / 0.2)" }} />
                        <Bar dataKey="leads" radius={[12, 12, 6, 6]} maxBarSize={72}>
                          {leadInterestData.map((entry: { name: string }, index: number) => (
                            <Cell key={`int-bar-${entry.name}-${index}`} fill={interestBarColor(entry.name)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                      No data available yet
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canAccessFeature('vehicle_import') && (
              <Card className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/15 shadow-md ring-1 ring-border/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold tracking-tight">Monthly sales trend</CardTitle>
                  <CardDescription className="text-xs">Sold units recorded per month</CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  {salesTrendData.length > 0 ? (
                    <ChartContainer config={salesChartConfig} className="aspect-auto h-[min(340px,52vw)] w-full min-h-[280px] max-w-full sm:h-[320px]">
                      <AreaChart data={salesTrendData} margin={{ top: 16, right: 16, left: 4, bottom: 8 }}>
                        <defs>
                          <linearGradient id={chartGradIdMain} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                            <stop offset="55%" stopColor="#10b981" stopOpacity={0.12} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} className="stroke-border/70" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          tickMargin={8}
                        />
                        <YAxis
                          domain={[0, salesYAxisMax]}
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={44}
                          tickCount={6}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "5 5" }} />
                        <Area
                          type="natural"
                          dataKey="sales"
                          stroke="#059669"
                          strokeWidth={2.5}
                          fill={`url(#${chartGradIdMain})`}
                          fillOpacity={1}
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                      No data available yet
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;