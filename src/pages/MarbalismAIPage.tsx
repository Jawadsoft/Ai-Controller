import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import TopNavigation from '@/components/layout/TopNavigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Bot,
  Users,
  Car,
  MessageSquare,
  TrendingUp,
  Zap,
  CheckCircle,
  ArrowRight,
  Activity,
  Target,
  Brain,
  RefreshCw,
  BarChart3,
  Clock,
  Sparkles,
  Phone,
  PenLine,
  Scale,
  Megaphone,
  CalendarCheck,
  ExternalLink,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface AgentStat {
  agent_type: string;
  total_conversations: number;
  leads_generated: number;
  avg_score: number;
}

interface RecentConversation {
  id: string;
  customer_name: string;
  lead_status: string;
  lead_qualification_score: number;
  created_at: string;
  vehicle_id: string | null;
}

/* ─── Marblism official agent roster (from marblism.com) ─────────────────── */
const MARBLISM_AGENTS = [
  {
    id: 'eva',
    name: 'EVA',
    role: 'Executive Assistant',
    tagline:
      'I craft email replies, filter out junk emails, manage your calendar and take meeting notes — so you look productive, even if you hit snooze three times.',
    icon: CalendarCheck,
    image: '/agents/eva.png',
    gradient: 'from-orange-400 to-pink-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-700',
    day: '7:00 AM',
    story: "Eva organizes your inbox and prepares replies before you've had your first coffee.",
    crmRole: 'Manages dealer communications & follow-up scheduling',
  },
  {
    id: 'sonny',
    name: 'SONNY',
    role: 'Community Manager',
    tagline:
      'I turn your social media into a lead-generating machine — without you having to dance on camera.',
    icon: Megaphone,
    image: '/agents/sonny.png',
    gradient: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badgeClass: 'bg-green-100 text-green-700',
    day: '11:00 AM',
    story: 'Your feeds are alive. A new carousel drops on Instagram — Sonny posted it an hour ago.',
    crmRole: 'Drives inbound leads through social engagement',
  },
  {
    id: 'penny',
    name: 'PENNY',
    role: 'SEO Blog Writer',
    tagline:
      "I write SEO-optimized blog posts that make Google happy, your audience obsessed, and your competitors deeply uncomfortable.",
    icon: PenLine,
    image: null,
    gradient: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-700',
    day: '5:00 PM',
    story: "Your site's climbing the ranks — Penny found the keywords, shaped the story, and timed the publish perfectly.",
    crmRole: 'Generates organic traffic that converts to vehicle inquiries',
  },
  {
    id: 'rachel',
    name: 'RACHEL',
    role: 'Receptionist',
    tagline:
      "I'll answer calls while you hide in the back pretending to be busy.",
    icon: Phone,
    image: '/agents/rachel.png',
    gradient: 'from-primary to-primary/80',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    badgeClass: 'bg-primary/15 text-primary/90',
    day: '7:00 PM',
    story: "You've left the office. Rachel picks up before the second tone — she knows your business by heart.",
    crmRole: 'Captures incoming calls as CRM leads automatically',
  },
  {
    id: 'linda',
    name: 'LINDA',
    role: 'Legal Assistant',
    tagline:
      "I answer your contract questions and clarify legal documents — so you can stop pretending you read them.",
    icon: Scale,
    image: '/agents/linda.png',
    gradient: 'from-pink-400 to-rose-500',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    badgeClass: 'bg-pink-100 text-pink-700',
    day: '11:00 PM',
    story: 'Just before bed, a contract arrives. Linda reviews it and flags the risky clauses while you wind down.',
    crmRole: 'Reviews finance & lease documents before deals are closed',
  },
  {
    id: 'stan',
    name: 'STAN',
    role: 'Lead Generation',
    tagline:
      "I find leads, send cold emails and follow-ups — turning 'not interested' into 'where do I sign?'",
    icon: Target,
    image: '/agents/stan.png',
    gradient: 'from-yellow-500 to-red-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    day: '2:00 PM',
    story: "While you're out with clients, Stan's filling your pipeline and booking calls.",
    crmRole: 'Feeds hot prospects directly into your Leads CRM table',
  },
];

/* ─── Internal agent stats labels ───────────────────────────────────────── */
const AGENT_LABELS: Record<string, string> = {
  marbalism_sales: 'Sales Advisor',
  marbalism_finance: 'Finance Advisor',
  marbalism_inventory: 'Inventory Specialist',
  marbalism_closer: 'Deal Closer',
};

const AGENT_ICONS: Record<string, React.ReactNode> = {
  marbalism_sales: <Users className="h-5 w-5 text-primary" />,
  marbalism_finance: <TrendingUp className="h-5 w-5 text-green-500" />,
  marbalism_inventory: <Car className="h-5 w-5 text-orange-500" />,
  marbalism_closer: <Target className="h-5 w-5 text-purple-500" />,
};

const getToken = () => localStorage.getItem('auth_token');

/* ─── Component ──────────────────────────────────────────────────────────── */
const MarbalismAIPage = () => {
  const { user, loading: authLoading } = useAuth();
  // TODO: re-enable permission check once marbalism_ai permission is stable
  // const { canAccessFeature, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AgentStat[]>([]);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [summary, setSummary] = useState({ total_leads: 0, total_conversations: 0, avg_qualification: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      };
      const [statsRes, convsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/marbalism/stats`, { headers }),
        fetch(`${API_BASE_URL}/marbalism/conversations?limit=10`, { headers }),
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.agents || []);
        setSummary(data.summary || { total_leads: 0, total_conversations: 0, avg_qualification: 0 });
      }
      if (convsRes.ok) {
        const data = await convsRes.json();
        setRecentConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch Marbalism data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'destructive';
      case 'warm': return 'default';
      case 'cold': return 'secondary';
      default: return 'outline';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading Marbalism AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />

      <main className="container mx-auto px-6 py-8 space-y-8">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-primary/80">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marbalism AI</h1>
              <p className="text-sm text-gray-500">AI-powered agents connected to your CRM</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/conversation-monitor')}>
              <MessageSquare className="h-4 w-4 mr-2" />
              View Conversations
            </Button>
          </div>
        </div>

        {/* ── Summary Stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Conversations</p>
                  <p className="text-2xl font-bold">{loading ? '—' : summary.total_conversations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Leads Generated</p>
                  <p className="text-2xl font-bold">{loading ? '—' : summary.total_leads}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Qualification Score</p>
                  <p className="text-2xl font-bold">
                    {loading ? '—' : `${Math.round(summary.avg_qualification)}%`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <Tabs defaultValue="team">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              Meet the Team
            </TabsTrigger>
            <TabsTrigger value="agents">
              <Bot className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="conversations">
              <MessageSquare className="h-4 w-4 mr-2" />
              Recent Leads
            </TabsTrigger>
            <TabsTrigger value="crm">
              <BarChart3 className="h-4 w-4 mr-2" />
              CRM Integration
            </TabsTrigger>
            {/* Direct link to Marblism login */}
            <a
              href="https://ai.marblism.com/login"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-primary/80 hover:from-purple-700 hover:to-primary/80 transition-all ml-auto"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open Marblism
              <ExternalLink className="h-3 w-3" />
            </a>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════════
              TAB 1 — MEET THE TEAM (Marblism official agents)
          ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="team" className="mt-6 space-y-6">

            {/* Hero banner */}
            <div className="rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-8 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-400 via-transparent to-primary/80" />
              <div className="relative space-y-3">
                <p className="text-xs font-semibold tracking-widest text-purple-300 uppercase">Powered by Marblism</p>
                <h2 className="text-3xl font-bold">AI Employees to Scale Your Business</h2>
                <p className="text-gray-300 max-w-xl mx-auto text-sm">
                  Get an AI Team that runs your inbox, socials, SEO, lead generation, calls, and support — 24/7, without breaks.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="text-sm text-gray-400">+20,000 happy businesses</span>
                  <span className="text-gray-600">·</span>
                  <a
                    href="https://www.marblism.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors"
                  >
                    Visit Marblism <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Agent cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {MARBLISM_AGENTS.map((agent) => {
                const IconComponent = agent.icon;
                const isActive = activeAgent === agent.id;

                return (
                  <div
                    key={agent.id}
                    className={`group relative rounded-2xl border-2 bg-white transition-all duration-300 cursor-pointer overflow-hidden
                      ${isActive ? `${agent.border} shadow-xl scale-[1.02]` : 'border-gray-100 hover:border-gray-200 hover:shadow-lg'}
                    `}
                    onClick={() => {
                      setActiveAgent(isActive ? null : agent.id);
                      window.open('https://ai.marblism.com/login', '_blank', 'noopener,noreferrer');
                    }}
                  >
                    {/* Agent photo or gradient strip */}
                    {agent.image ? (
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={agent.image}
                          alt={agent.name}
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-4">
                          <h3 className="text-2xl font-black tracking-widest text-white drop-shadow-lg">{agent.name}</h3>
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${agent.badgeClass}`}>
                            {agent.role}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`h-2 rounded-t-2xl bg-gradient-to-r ${agent.gradient}`} />
                        <div className="px-6 pt-5 flex items-center gap-4">
                          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${agent.gradient} shadow-md`}>
                            <IconComponent className="h-8 w-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black tracking-tight text-gray-900">{agent.name}</h3>
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${agent.badgeClass}`}>
                              {agent.role}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="p-6 space-y-4">
                      {/* Tagline */}
                      <p className="text-sm text-gray-600 italic leading-relaxed border-l-2 border-gray-200 pl-3">
                        "{agent.tagline}"
                      </p>

                      {/* Expanded detail */}
                      {isActive && (
                        <div className={`rounded-xl ${agent.bg} p-4 space-y-3 border ${agent.border}`}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500">{agent.day}</span>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed">{agent.story}</p>
                          <div className="pt-1 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-500 mb-1">CRM Role</p>
                            <p className="text-xs text-gray-700">{agent.crmRole}</p>
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-gray-400">Always on</span>
                        </div>
                        <a
                          href="https://ai.marblism.com/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
                        >
                          Activate <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom CTA */}
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-purple-900">Ready to put your AI team to work?</p>
                <p className="text-sm text-purple-600 mt-0.5">Sign in to Marblism and activate your AI employees.</p>
              </div>
              <a
                href="https://ai.marblism.com/login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-primary/80 hover:from-purple-700 hover:to-primary/80 transition-all shrink-0 shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                Get Started on Marblism
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════
              TAB 2 — PERFORMANCE
          ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="agents" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(AGENT_LABELS).map((agentType) => {
                const stat = stats.find((s) => s.agent_type === agentType);
                return (
                  <Card key={agentType} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {AGENT_ICONS[agentType]}
                          <CardTitle className="text-base">{AGENT_LABELS[agentType]}</CardTitle>
                        </div>
                        <Badge variant={stat ? 'default' : 'outline'} className="text-xs">
                          {stat ? 'Active' : 'Idle'}
                        </Badge>
                      </div>
                      <CardDescription>Marbalism {AGENT_LABELS[agentType]} agent</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg bg-gray-50 p-2">
                          <p className="text-lg font-bold">{stat?.total_conversations ?? 0}</p>
                          <p className="text-xs text-gray-500">Conversations</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2">
                          <p className="text-lg font-bold">{stat?.leads_generated ?? 0}</p>
                          <p className="text-xs text-gray-500">Leads</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-2">
                          <p className="text-lg font-bold">
                            {stat ? `${Math.round(stat.avg_score)}%` : '—'}
                          </p>
                          <p className="text-xs text-gray-500">Avg Score</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════
              TAB 3 — RECENT LEADS
          ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="conversations" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent AI-Generated Leads</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
                    ))}
                  </div>
                ) : recentConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">No conversations yet. Leads will appear here once customers interact with Marbalism AI.</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentConversations.map((conv) => (
                      <div key={conv.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                            <Users className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{conv.customer_name || 'Anonymous'}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(conv.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <p className="text-xs text-gray-500">Score</p>
                            <p className="text-sm font-semibold">{conv.lead_qualification_score ?? 0}%</p>
                          </div>
                          <Badge variant={statusColor(conv.lead_status) as any}>
                            {conv.lead_status || 'new'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════
              TAB 4 — CRM INTEGRATION
          ══════════════════════════════════════════════════════════════ */}
          <TabsContent value="crm" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Active CRM Connections
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Leads Table', description: 'Auto-creates leads on AI qualification', icon: <Users className="h-4 w-4 text-primary" /> },
                    { label: 'Vehicle Inventory', description: 'Reads live stock to answer customer queries', icon: <Car className="h-4 w-4 text-orange-500" /> },
                    { label: 'Conversations', description: 'Stores full AI chat history & scores', icon: <MessageSquare className="h-4 w-4 text-purple-500" /> },
                    { label: 'Agent Performance', description: 'Tracks per-agent metrics in real time', icon: <Activity className="h-4 w-4 text-green-500" /> },
                  ].map(({ label, description, icon }) => (
                    <div key={label} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="mt-0.5">{icon}</div>
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    How Marbalism AI Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4">
                    {[
                      { step: '1', text: 'Customer chats with the AI agent on your dealership page or QR code' },
                      { step: '2', text: 'Marbalism reads your live vehicle inventory to answer questions accurately' },
                      { step: '3', text: 'Agent qualifies the customer (0–100 score) based on intent and engagement' },
                      { step: '4', text: 'When score is high, a lead is automatically created in your CRM' },
                      { step: '5', text: 'Staff are notified and can view the full conversation in Leads & Conversations' },
                    ].map(({ step, text }) => (
                      <li key={step} className="flex gap-3 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                          {step}
                        </span>
                        <span className="text-gray-600">{text}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Button variant="outline" className="justify-start" onClick={() => navigate('/leads')}>
                      <Users className="h-4 w-4 mr-2 text-primary" />
                      View Leads
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => navigate('/conversation-monitor')}>
                      <MessageSquare className="h-4 w-4 mr-2 text-purple-500" />
                      Conversations
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => navigate('/crewai-agents')}>
                      <Bot className="h-4 w-4 mr-2 text-orange-500" />
                      Agent Setup
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => navigate('/daive/analytics')}>
                      <BarChart3 className="h-4 w-4 mr-2 text-green-500" />
                      Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MarbalismAIPage;
