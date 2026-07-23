import { useState, useEffect, useCallback, useRef } from "react";
import superAdminAPI from "@/lib/superAdminAPI";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Activity, RefreshCw, Search, ChevronRight, MessageSquare, AlertTriangle,
  CheckCircle, XCircle, Bot, User, Loader2, Download, ZapOff, Zap,
  BarChart2, Clock, Building,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConvRow {
  id: string;
  session_id: string;
  dealer_id: string;
  dealer_name: string;
  customer_name: string;
  customer_email: string;
  lead_status: string;
  handoff_requested: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Gap {
  turn: number;
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  bot_said: string;
  should_have_said: string;
}

interface Analysis {
  summary: string;
  score: number | null;
  gaps: Gap[];
  tokens: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-blue-100 text-blue-700 border-blue-200",
};

const GAP_TYPE_LABEL: Record<string, string> = {
  fabrication:        "Fabrication",
  wrong_intent:       "Wrong Intent",
  missed_slot:        "Missed Slot",
  wrong_stage:        "Wrong Stage",
  stale_criteria:     "Stale Criteria",
  color_loop:         "Color Loop",
  payment_no_vehicle: "Payment w/o Vehicle",
  off_topic:          "Off-Topic",
  missing_cards:      "Missing Cards",
  repeated_question:  "Repeated Question",
};

function stageBadge(status: string) {
  const map: Record<string, string> = {
    new:          "bg-blue-100 text-blue-700",
    active:       "bg-indigo-100 text-indigo-700",
    qualified:    "bg-violet-100 text-violet-700",
    hot:          "bg-orange-100 text-orange-700",
    closed:       "bg-green-100 text-green-700",
    lost:         "bg-gray-100 text-gray-600",
    handoff:      "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

function scoreColor(score: number | null) {
  if (score === null) return "text-gray-400";
  if (score >= 85) return "text-green-600";
  if (score >= 65) return "text-amber-600";
  return "text-red-600";
}

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationMonitor() {
  // list state
  const [conversations, setConversations]   = useState<ConvRow[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(false);
  const [search, setSearch]                 = useState("");
  const [dealerFilter, setDealerFilter]     = useState("all");
  const [dealers, setDealers]               = useState<{ id: string; name: string }[]>([]);

  // detail state
  const [selected, setSelected]             = useState<ConvRow | null>(null);
  const [messages, setMessages]             = useState<ChatMessage[]>([]);
  const [context, setContext]               = useState<any>(null);
  const [loadingDetail, setLoadingDetail]   = useState(false);

  // analysis state
  const [analysis, setAnalysis]             = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing]           = useState(false);

  // auto-refresh
  const [autoRefresh, setAutoRefresh]       = useState(false);
  const refreshTimer                         = useRef<ReturnType<typeof setInterval> | null>(null);

  const LIMIT = 30;

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConversations = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const res = await superAdminAPI.getMonitorConversations({
        dealer_id: dealerFilter !== "all" ? dealerFilter : undefined,
        page: pg,
        limit: LIMIT,
      });
      setConversations(res.data || []);
      setTotal(res.total || 0);

      // Build dealer list from results (avoid a separate endpoint)
      const seen = new Set<string>();
      const dl: { id: string; name: string }[] = [];
      for (const c of (res.data || [])) {
        if (c.dealer_id && !seen.has(c.dealer_id)) {
          seen.add(c.dealer_id);
          dl.push({ id: c.dealer_id, name: c.dealer_name || c.dealer_id });
        }
      }
      if (dl.length) setDealers(prev => {
        const map = new Map(prev.map(d => [d.id, d]));
        dl.forEach(d => map.set(d.id, d));
        return [...map.values()];
      });
    } catch (e: any) {
      toast.error("Failed to load conversations: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [dealerFilter, page]);

  useEffect(() => { loadConversations(1); setPage(1); }, [dealerFilter]);
  useEffect(() => { loadConversations(page); }, [page]);

  // auto-refresh every 20s
  useEffect(() => {
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => loadConversations(page), 20000);
    } else {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [autoRefresh, page, loadConversations]);

  // ── Load detail ─────────────────────────────────────────────────────────────
  const loadDetail = async (conv: ConvRow) => {
    setSelected(conv);
    setAnalysis(null);
    setLoadingDetail(true);
    try {
      const res = await superAdminAPI.getMonitorMessages(conv.session_id);
      setMessages(res.messages || []);
      setContext(res.context || null);
    } catch (e: any) {
      toast.error("Failed to load messages: " + e.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Analyze ─────────────────────────────────────────────────────────────────
  const runAnalysis = async () => {
    if (!selected) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await superAdminAPI.analyzeConversation(selected.session_id);
      setAnalysis(res.analysis);
      toast.success("Analysis complete");
    } catch (e: any) {
      toast.error("Analysis failed: " + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Export analysis ─────────────────────────────────────────────────────────
  const exportAnalysis = () => {
    if (!analysis || !selected) return;
    const blob = new Blob([JSON.stringify({ session: selected.session_id, ...analysis }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `gap-analysis-${selected.session_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.customer_name  || "").toLowerCase().includes(q) ||
      (c.customer_email || "").toLowerCase().includes(q) ||
      (c.dealer_name    || "").toLowerCase().includes(q) ||
      (c.session_id     || "").toLowerCase().includes(q)
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[600px]">

      {/* ── Panel 1: Conversation List ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            onClick={() => setAutoRefresh(p => !p)}
          >
            {autoRefresh ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => loadConversations(page)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Dealer filter */}
        <Select value={dealerFilter} onValueChange={setDealerFilter}>
          <SelectTrigger className="h-9 text-sm">
            <Building className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Dealers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dealers</SelectItem>
            {dealers.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Count */}
        <p className="text-xs text-muted-foreground px-1">
          Showing {filtered.length} of {total} conversations
        </p>

        {/* List */}
        <ScrollArea className="flex-1 border rounded-lg">
          {loading && conversations.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No conversations found
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(conv => (
                <button
                  key={conv.id}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors ${selected?.id === conv.id ? "bg-muted" : ""}`}
                  onClick={() => loadDetail(conv)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium truncate leading-tight">
                      {conv.customer_name || "Anonymous"}
                    </p>
                    <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.dealer_name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stageBadge(conv.lead_status)}`}>
                      {conv.lead_status || "new"}
                    </span>
                    {conv.handoff_requested && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Handoff</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                      <MessageSquare className="h-2.5 w-2.5" />
                      {conv.message_count}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {relTime(conv.updated_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">Prev</Button>
            <span>Page {page} of {Math.ceil(total / LIMIT)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">Next</Button>
          </div>
        )}
      </div>

      {/* ── Panel 2: Conversation Thread ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border rounded-lg">
            <Activity className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Select a conversation to view the thread</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <Card className="flex-shrink-0">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm">{selected.customer_name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{selected.customer_email || "No email"} · {selected.dealer_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageBadge(selected.lead_status)}`}>
                      {selected.lead_status || "new"}
                    </span>
                    <span className="text-xs text-muted-foreground">{messages.length} messages</span>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={runAnalysis} disabled={analyzing || loadingDetail}>
                      {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart2 className="h-3 w-3" />}
                      {analyzing ? "Analyzing..." : "Analyze Gaps"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <ScrollArea className="flex-1 border rounded-lg px-3 py-3">
              {loadingDetail ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">No messages found</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-tr-sm"
                            : "bg-muted rounded-tl-sm"
                        }`}
                      >
                        {/* Highlight if gap exists for this turn */}
                        {analysis?.gaps?.some(g => g.turn === idx + 1) && (
                          <div className="flex items-center gap-1 mb-1 opacity-70">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-[10px] font-semibold">GAP DETECTED</span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-indigo-200" : "text-muted-foreground"}`}>
                          Turn {idx + 1} · {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                      {msg.role === "user" && (
                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-3.5 w-3.5 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Context strip */}
            {context && (
              <details className="border rounded-lg text-xs">
                <summary className="px-3 py-2 cursor-pointer text-muted-foreground font-medium select-none hover:bg-muted/40">
                  Daivesteps context (click to expand)
                </summary>
                <pre className="px-3 pb-3 overflow-auto max-h-48 text-[10px] leading-relaxed">
                  {JSON.stringify(context?.Daivesteps || context, null, 2)}
                </pre>
              </details>
            )}
          </>
        )}
      </div>

      {/* ── Panel 3: Gap Analysis ── */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Gap Analysis
          </h3>
          {analysis && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportAnalysis}>
              <Download className="h-3 w-3" /> Export
            </Button>
          )}
        </div>

        {!selected ? (
          <div className="flex-1 border rounded-lg flex items-center justify-center text-muted-foreground text-sm text-center p-4">
            Select a conversation and click "Analyze Gaps"
          </div>
        ) : analyzing ? (
          <div className="flex-1 border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-sm">Running AI analysis...</p>
            <p className="text-xs">This may take 5–10 seconds</p>
          </div>
        ) : !analysis ? (
          <div className="flex-1 border rounded-lg flex items-center justify-center text-muted-foreground text-sm text-center p-4">
            Click "Analyze Gaps" to run the quality check
          </div>
        ) : (
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-3 space-y-3">
              {/* Score */}
              <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground font-medium">Quality Score</span>
                <span className={`text-2xl font-bold ${scoreColor(analysis.score)}`}>
                  {analysis.score !== null ? `${analysis.score}/100` : "—"}
                </span>
              </div>

              {/* Summary */}
              <div className="bg-muted/30 rounded-lg px-3 py-2">
                <p className="text-xs leading-relaxed">{analysis.summary}</p>
              </div>

              {/* Tokens */}
              <p className="text-[10px] text-muted-foreground text-right">{analysis.tokens.toLocaleString()} tokens used</p>

              {/* Gaps */}
              {analysis.gaps.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-medium">No gaps detected — conversation looks clean!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{analysis.gaps.length} gap{analysis.gaps.length !== 1 ? "s" : ""} found</p>
                  {analysis.gaps.map((gap, i) => (
                    <div key={i} className={`border rounded-lg p-2.5 ${SEVERITY_COLOR[gap.severity] || "bg-gray-50"}`}>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          {GAP_TYPE_LABEL[gap.type] || gap.type}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold opacity-80 uppercase">{gap.severity}</span>
                          <span className="text-[10px] opacity-60">· Turn {gap.turn}</span>
                        </div>
                      </div>
                      <p className="text-xs leading-snug mb-2">{gap.description}</p>
                      {gap.bot_said && (
                        <div className="bg-white/60 rounded px-2 py-1 mb-1">
                          <p className="text-[10px] font-semibold text-gray-500 mb-0.5">Bot said:</p>
                          <p className="text-[10px] italic leading-snug">{gap.bot_said}</p>
                        </div>
                      )}
                      {gap.should_have_said && (
                        <div className="bg-white/60 rounded px-2 py-1">
                          <p className="text-[10px] font-semibold text-gray-500 mb-0.5">Should have said:</p>
                          <p className="text-[10px] italic leading-snug">{gap.should_have_said}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
