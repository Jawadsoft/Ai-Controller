/**
 * Finance Analytics Dashboard
 * Comprehensive analytics and reporting for finance operations
 * Includes deal funnel, revenue metrics, trends, and forecasting
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { financeAPI, lendersAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import TopNavigation from '@/components/layout/TopNavigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  ArrowLeft,
  Calendar,
  TrendingDown,
  Target,
  Award,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface AnalyticsData {
  deals: any[];
  applications: any[];
  programs: any[];
  lenders: any[];
}

interface Metrics {
  totalRevenue: number;
  totalDeals: number;
  avgDealSize: number;
  avgAPR: number;
  conversionRate: number;
  avgProcessingTime: number;
  activeDeals: number;
  completedDeals: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  color: string;
}

const FinanceAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const { canAccessFeature } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [data, setData] = useState<AnalyticsData>({
    deals: [],
    applications: [],
    programs: [],
    lenders: [],
  });
  const [metrics, setMetrics] = useState<Metrics>({
    totalRevenue: 0,
    totalDeals: 0,
    avgDealSize: 0,
    avgAPR: 0,
    conversionRate: 0,
    avgProcessingTime: 0,
    activeDeals: 0,
    completedDeals: 0,
  });
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [lenderStats, setLenderStats] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Load all data
      const [dealsRes, appsRes, programsRes, lendersRes] = await Promise.all([
        financeAPI.getDeals({}),
        financeAPI.getCreditApplications({}),
        financeAPI.getPrograms({}),
        lendersAPI.getAll({}),
      ]);

      const deals = dealsRes.data || [];
      const applications = appsRes.data || [];
      const programs = programsRes.data || [];
      const lenders = lendersRes.data || [];

      // Filter by time range
      const filteredDeals = filterByTimeRange(deals, timeRange);
      const filteredApps = filterByTimeRange(applications, timeRange);

      setData({
        deals: filteredDeals,
        applications: filteredApps,
        programs,
        lenders,
      });

      // Calculate metrics
      calculateMetrics(filteredDeals, filteredApps);
      
      // Calculate funnel
      calculateFunnel(filteredApps, filteredDeals);
      
      // Calculate trends
      calculateTrends(filteredDeals);
      
      // Calculate lender stats
      calculateLenderStats(filteredDeals, lenders);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterByTimeRange = (data: any[], range: string) => {
    if (range === 'all') return data;

    const now = new Date();
    const cutoff = new Date();

    switch (range) {
      case '7d':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoff.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoff.setDate(now.getDate() - 90);
        break;
      case '1y':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
    }

    return data.filter((item) => {
      const date = new Date(item.created_at || item.submitted_at);
      return date >= cutoff;
    });
  };

  const calculateMetrics = (deals: any[], applications: any[]) => {
    // Total Revenue
    const totalRevenue = deals
      .filter((d) => d.status === 'completed')
      .reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0);

    // Total Deals
    const totalDeals = deals.length;

    // Average Deal Size
    const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

    // Average APR
    const dealsWithAPR = deals.filter((d) => d.apr);
    const avgAPR =
      dealsWithAPR.length > 0
        ? dealsWithAPR.reduce((sum, d) => sum + parseFloat(d.apr), 0) /
          dealsWithAPR.length
        : 0;

    // Conversion Rate (Apps to Deals)
    const conversionRate =
      applications.length > 0 ? (deals.length / applications.length) * 100 : 0;

    // Average Processing Time
    const completedDeals = deals.filter((d) => d.status === 'completed');
    const avgProcessingTime =
      completedDeals.length > 0
        ? completedDeals.reduce((sum, d) => {
            const start = new Date(d.created_at).getTime();
            const end = new Date(d.updated_at).getTime();
            return sum + (end - start);
          }, 0) /
          completedDeals.length /
          (1000 * 60 * 60 * 24)
        : 0;

    // Active vs Completed Deals
    const activeDeals = deals.filter(
      (d) => !['completed', 'cancelled', 'rejected'].includes(d.status)
    ).length;
    const completedDealsCount = deals.filter((d) => d.status === 'completed').length;

    setMetrics({
      totalRevenue,
      totalDeals,
      avgDealSize,
      avgAPR,
      conversionRate,
      avgProcessingTime,
      activeDeals,
      completedDeals: completedDealsCount,
    });
  };

  const calculateFunnel = (applications: any[], deals: any[]) => {
    const totalApps = applications.length;

    const stages: FunnelStage[] = [
      {
        stage: 'Applications',
        count: totalApps,
        percentage: 100,
        color: 'bg-primary',
      },
      {
        stage: 'Under Review',
        count: applications.filter((a) => a.application_status === 'reviewing').length,
        percentage: totalApps > 0 ? (applications.filter((a) => a.application_status === 'reviewing').length / totalApps) * 100 : 0,
        color: 'bg-yellow-500',
      },
      {
        stage: 'Approved',
        count: applications.filter((a) => a.application_status === 'approved').length,
        percentage: totalApps > 0 ? (applications.filter((a) => a.application_status === 'approved').length / totalApps) * 100 : 0,
        color: 'bg-green-500',
      },
      {
        stage: 'Deals Created',
        count: deals.length,
        percentage: totalApps > 0 ? (deals.length / totalApps) * 100 : 0,
        color: 'bg-purple-500',
      },
      {
        stage: 'Signed',
        count: deals.filter((d) => d.status === 'signed' || d.status === 'completed').length,
        percentage: totalApps > 0 ? (deals.filter((d) => d.status === 'signed' || d.status === 'completed').length / totalApps) * 100 : 0,
        color: 'bg-primary/100',
      },
      {
        stage: 'Completed',
        count: deals.filter((d) => d.status === 'completed').length,
        percentage: totalApps > 0 ? (deals.filter((d) => d.status === 'completed').length / totalApps) * 100 : 0,
        color: 'bg-emerald-500',
      },
    ];

    setFunnel(stages);
  };

  const calculateTrends = (deals: any[]) => {
    // Group deals by month
    const monthlyData: Record<string, { count: number; revenue: number }> = {};

    deals.forEach((deal) => {
      const date = new Date(deal.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, revenue: 0 };
      }

      monthlyData[monthKey].count++;
      monthlyData[monthKey].revenue += parseFloat(deal.total_amount) || 0;
    });

    const trendsArray = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, data]) => ({
        month,
        ...data,
      }));

    setTrends(trendsArray);
  };

  const calculateLenderStats = (deals: any[], lenders: any[]) => {
    const stats = lenders.map((lender) => {
      const lenderDeals = deals.filter(
        (d) => d.approved_lender_id === lender.id || d.preferred_lender_id === lender.id
      );

      const approved = lenderDeals.filter((d) => d.status === 'approved' || d.status === 'signed' || d.status === 'completed').length;
      const total = lenderDeals.length;
      const approvalRate = total > 0 ? (approved / total) * 100 : 0;

      const avgAPR = lenderDeals.length > 0 && lenderDeals.filter(d => d.apr).length > 0
        ? lenderDeals
            .filter((d) => d.apr)
            .reduce((sum, d) => sum + parseFloat(d.apr), 0) / lenderDeals.filter(d => d.apr).length
        : 0;

      return {
        id: lender.id,
        name: lender.lender_name,
        totalDeals: total,
        approvedDeals: approved,
        approvalRate,
        avgAPR,
      };
    });

    setLenderStats(stats.sort((a, b) => b.totalDeals - a.totalDeals));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      case '1y': return 'Last Year';
      case 'all': return 'All Time';
      default: return 'Last 30 Days';
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNavigation />

      {/* ── Page Header ── */}
      <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/finance')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="font-bold text-base text-gray-900">Finance Analytics</h1>
            <p className="text-xs text-gray-500">Comprehensive insights and performance metrics</p>
          </div>
        </div>
        <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
          <SelectTrigger className="h-8 w-40 text-xs border-gray-200">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-orange-500" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center"><DollarSign className="h-3.5 w-3.5 text-orange-500" /></div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{metrics.completedDeals} completed deals</p>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center"><FileText className="h-3.5 w-3.5 text-blue-500" /></div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Deals</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.totalDeals}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{metrics.activeDeals} active</p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Avg Deal Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(metrics.avgDealSize)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.avgAPR.toFixed(2)}% avg APR
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics.conversionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Apps to deals
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="funnel">
              <PieChart className="h-4 w-4 mr-2" />
              Deal Funnel
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="lenders">
              <Award className="h-4 w-4 mr-2" />
              Lender Performance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Key operational metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Avg Processing Time
                      </div>
                      <div className="text-2xl font-bold">
                        {metrics.avgProcessingTime.toFixed(1)} days
                      </div>
                    </div>
                    <Clock className="h-8 w-8 text-primary" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Active Deals
                      </div>
                      <div className="text-2xl font-bold text-orange-600">
                        {metrics.activeDeals}
                      </div>
                    </div>
                    <Zap className="h-8 w-8 text-orange-600" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Completed Deals
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {metrics.completedDeals}
                      </div>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              {/* Deal Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Deal Status Distribution</CardTitle>
                  <CardDescription>Current pipeline status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {['draft', 'pending', 'approved', 'signed', 'completed'].map((status) => {
                    const count = data.deals.filter((d) => d.status === status).length;
                    const percentage =
                      data.deals.length > 0 ? (count / data.deals.length) * 100 : 0;

                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium capitalize">{status}</span>
                          <span className="text-sm text-muted-foreground">
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <Progress value={percentage} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Recent Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Last 6 months performance</CardDescription>
              </CardHeader>
              <CardContent>
                {trends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No data available for selected time range
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trends.map((trend) => (
                      <div
                        key={trend.month}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {new Date(trend.month + '-01').toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {trend.count} deals
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {formatCurrency(trend.revenue)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(trend.revenue / trend.count)} avg
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deal Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Deal Funnel Visualization</CardTitle>
                <CardDescription>
                  Applications to completed deals conversion funnel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {funnel.map((stage, index) => (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{stage.stage}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {stage.count} ({stage.percentage.toFixed(1)}%)
                          </span>
                          {index > 0 && (
                            <Badge variant="outline">
                              -
                              {(
                                ((funnel[index - 1].count - stage.count) /
                                  funnel[index - 1].count) *
                                100
                              ).toFixed(0)}
                              % drop
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <div
                          className={`h-16 ${stage.color} rounded-lg transition-all`}
                          style={{ width: `${stage.percentage}%` }}
                        >
                          <div className="flex items-center justify-center h-full text-white font-bold">
                            {stage.count > 0 && stage.count}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Funnel Insights */}
                <div className="mt-8 p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Funnel Insights
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      • Overall conversion rate: {metrics.conversionRate.toFixed(1)}%
                      (Applications to Deals)
                    </li>
                    <li>
                      • {funnel[0]?.count || 0} applications started,{' '}
                      {funnel[funnel.length - 1]?.count || 0} completed
                    </li>
                    {funnel[1] && funnel[0] && (
                      <li>
                        • Biggest drop-off: {funnel[0].stage} to {funnel[1].stage} (
                        {(
                          ((funnel[0].count - funnel[1].count) / funnel[0].count) *
                          100
                        ).toFixed(0)}
                        %)
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Monthly Revenue Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue Trend</CardTitle>
                  <CardDescription>Revenue over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  {trends.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No data available
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trends.map((trend) => {
                        const maxRevenue = Math.max(...trends.map((t) => t.revenue));
                        const percentage = (trend.revenue / maxRevenue) * 100;

                        return (
                          <div key={trend.month}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {new Date(trend.month + '-01').toLocaleDateString('en-US', {
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="text-sm font-bold">
                                {formatCurrency(trend.revenue)}
                              </span>
                            </div>
                            <div className="h-8 bg-green-200 rounded-lg overflow-hidden">
                              <div
                                className="h-full bg-green-600 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Deal Count Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Deal Volume</CardTitle>
                  <CardDescription>Number of deals over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {trends.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No data available
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trends.map((trend) => {
                        const maxCount = Math.max(...trends.map((t) => t.count));
                        const percentage = (trend.count / maxCount) * 100;

                        return (
                          <div key={trend.month}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {new Date(trend.month + '-01').toLocaleDateString('en-US', {
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="text-sm font-bold">{trend.count} deals</span>
                            </div>
                            <div className="h-8 bg-primary/25 rounded-lg overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Forecast */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecast</CardTitle>
                <CardDescription>
                  Projected revenue based on current pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      Next Month (Projected)
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        trends.length > 0
                          ? trends[trends.length - 1].revenue * 1.05
                          : 0
                      )}
                    </div>
                    <Badge variant="default" className="mt-2">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +5% growth
                    </Badge>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      Pipeline Value
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        data.deals
                          .filter((d) => !['completed', 'cancelled'].includes(d.status))
                          .reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {metrics.activeDeals} active deals
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      Projected Quarter
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        trends.length > 0
                          ? trends.slice(-3).reduce((sum, t) => sum + t.revenue, 0) * 1.1
                          : 0
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Based on last 3 months
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lenders Tab */}
          <TabsContent value="lenders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lender Performance Comparison</CardTitle>
                <CardDescription>
                  Analyze lender approval rates and terms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lenderStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No lender data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lenderStats.map((lender) => (
                      <div
                        key={lender.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{lender.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {lender.totalDeals} total deals
                            </p>
                          </div>
                          <Badge
                            variant={
                              lender.approvalRate >= 70
                                ? 'default'
                                : lender.approvalRate >= 50
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {lender.approvalRate.toFixed(0)}% approval
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Total Deals
                            </div>
                            <div className="text-lg font-bold">
                              {lender.totalDeals}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Approved
                            </div>
                            <div className="text-lg font-bold text-green-600">
                              {lender.approvedDeals}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Avg APR</div>
                            <div className="text-lg font-bold">
                              {lender.avgAPR > 0 ? `${lender.avgAPR.toFixed(2)}%` : 'N/A'}
                            </div>
                          </div>
                        </div>

                        <Progress value={lender.approvalRate} className="mt-3" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>{/* end flex-1 */}
    </div>
  );
};

export default FinanceAnalytics;

