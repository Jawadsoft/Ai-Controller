/**
 * CRM Design System — shared Tailwind class constants
 * Primary accent: orange-600  |  Background: gray-50  |  Cards: white rounded-xl
 */

// ── Page shell ────────────────────────────────────────────────────────────────
export const PAGE_WRAPPER  = 'min-h-screen bg-gray-50 flex flex-col';
export const PAGE_BODY     = 'flex-1 overflow-y-auto';

// ── Page header bar (sits below TopNavigation) ────────────────────────────────
export const PAGE_HEADER   = 'bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between gap-3 flex-wrap';
export const PAGE_TITLE    = 'font-bold text-base text-gray-900';
export const PAGE_SUBTITLE = 'text-xs text-gray-500';

// ── Content area ──────────────────────────────────────────────────────────────
export const CONTENT_AREA  = 'p-5 space-y-5';

// ── Stat / KPI cards ─────────────────────────────────────────────────────────
export const STAT_CARD         = 'bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1';
export const STAT_LABEL        = 'text-xs font-semibold text-gray-500 uppercase tracking-wide';
export const STAT_VALUE        = 'text-2xl font-bold text-gray-900';
export const STAT_SUBTEXT      = 'text-xs text-gray-400';
export const STAT_ICON_WRAP    = 'h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0';
export const STAT_ICON         = 'h-4.5 w-4.5 text-orange-500';

// ── Panel / section card ──────────────────────────────────────────────────────
export const PANEL             = 'bg-white rounded-xl border shadow-sm overflow-hidden';
export const PANEL_HEADER      = 'px-4 py-3 border-b bg-white flex items-center justify-between';
export const PANEL_TITLE       = 'text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5';
export const PANEL_BODY        = 'p-4';

// ── Tables ────────────────────────────────────────────────────────────────────
export const TABLE_WRAP        = 'w-full text-sm';
export const TABLE_HEAD_ROW    = 'border-b border-gray-100 bg-gray-50';
export const TABLE_HEAD_CELL   = 'px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap';
export const TABLE_ROW         = 'border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer';
export const TABLE_CELL        = 'px-4 py-3 text-sm text-gray-700';
export const TABLE_CELL_BOLD   = 'px-4 py-3 text-sm font-semibold text-gray-900';
export const TABLE_EMPTY       = 'px-4 py-10 text-center text-sm text-gray-400';

// ── Search / filter bar ───────────────────────────────────────────────────────
export const FILTER_BAR        = 'flex items-center gap-2 flex-wrap';
export const SEARCH_INPUT      = 'h-8 pl-8 text-sm w-56 border-gray-200 focus:border-orange-400 focus:ring-orange-400';

// ── Buttons ───────────────────────────────────────────────────────────────────
export const BTN_PRIMARY       = 'bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-sm';
export const BTN_SECONDARY     = 'border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold';
export const BTN_GHOST         = 'text-gray-600 hover:bg-gray-100';
export const BTN_DANGER        = 'bg-red-500 hover:bg-red-600 text-white';

// ── Badges ────────────────────────────────────────────────────────────────────
export const BADGE_BASE        = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold';
export const BADGE_GREEN       = `${BADGE_BASE} bg-emerald-100 text-emerald-700`;
export const BADGE_ORANGE      = `${BADGE_BASE} bg-orange-100 text-orange-700`;
export const BADGE_BLUE        = `${BADGE_BASE} bg-blue-100 text-blue-700`;
export const BADGE_RED         = `${BADGE_BASE} bg-red-100 text-red-700`;
export const BADGE_GRAY        = `${BADGE_BASE} bg-gray-100 text-gray-600`;
export const BADGE_PURPLE      = `${BADGE_BASE} bg-violet-100 text-violet-700`;

// ── Form sections ─────────────────────────────────────────────────────────────
export const FORM_SECTION      = 'space-y-4';
export const FORM_LABEL        = 'text-xs text-gray-500 font-medium';
export const FORM_HINT         = 'text-[11px] text-gray-400 mt-1';

// ── Tabs (custom pill style) ──────────────────────────────────────────────────
export const TAB_LIST          = 'flex gap-1 bg-gray-100 rounded-lg p-1';
export const TAB_TRIGGER_ACTIVE  = 'bg-white text-orange-600 font-semibold shadow-sm rounded-md px-3 py-1.5 text-sm';
export const TAB_TRIGGER_IDLE    = 'text-gray-500 hover:text-gray-700 rounded-md px-3 py-1.5 text-sm font-medium';

// ── Section divider label ─────────────────────────────────────────────────────
export const SECTION_LABEL     = 'text-xs font-semibold text-gray-500 uppercase tracking-wide';

// ── Accent helpers ────────────────────────────────────────────────────────────
export const ACCENT_TEXT       = 'text-orange-600';
export const ACCENT_BG_LIGHT   = 'bg-orange-50';
export const ACCENT_BORDER     = 'border-orange-200';
export const ACCENT_RING       = 'focus:ring-orange-400 focus:border-orange-400';

// ── Status → badge class map ──────────────────────────────────────────────────
export function statusBadge(status: string): string {
  const s = status?.toLowerCase();
  if (['active', 'approved', 'signed', 'completed', 'sold', 'won'].includes(s))  return BADGE_GREEN;
  if (['pending', 'desking', 'fi', 'desk_approval', 'submitted'].includes(s))    return BADGE_ORANGE;
  if (['new', 'lead', 'open', 'in_progress'].includes(s))                         return BADGE_BLUE;
  if (['cancelled', 'declined', 'lost', 'rejected'].includes(s))                  return BADGE_RED;
  if (['hot'].includes(s))                                                          return BADGE_RED;
  if (['warm'].includes(s))                                                         return BADGE_ORANGE;
  if (['cold'].includes(s))                                                         return BADGE_BLUE;
  return BADGE_GRAY;
}
