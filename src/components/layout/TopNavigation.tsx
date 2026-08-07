import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotifications } from '@/hooks/useNotifications';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Car,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  LayoutDashboard,
  MessageSquare,
  Building2,
  Bot,
  Crown,
  CreditCard,
  Gift,
  Search,
  Bell,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Upload,
  Clock,
  Trash2,
  CheckCheck,
  X,
  Repeat,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/hooks/useAuth';

function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'User';
  const fromAccount = typeof user.name === 'string' ? user.name.trim() : '';
  if (fromAccount) return fromAccount;
  const profile = user.dealerProfile;
  const fromDealerContact =
    (typeof profile?.contactName === 'string' && profile.contactName.trim()) ||
    (typeof profile?.contact_name === 'string' && profile.contact_name.trim()) ||
    '';
  if (fromDealerContact) return fromDealerContact;
  const local = user.email?.split('@')[0]?.trim();
  return local || 'User';
}

function getUserInitials(user: User | null | undefined): string {
  if (!user) return 'U';
  const display = getUserDisplayName(user);
  if (display && display !== 'User') {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0].charAt(0);
      const b = parts[parts.length - 1].charAt(0);
      return (a + b).toUpperCase();
    }
    return display.slice(0, 2).toUpperCase();
  }
  return (user.email?.substring(0, 2) || 'U').toUpperCase();
}

const TopNavigation = () => {
  const { user, signOut } = useAuth();
  const { canAccessFeature, isSuperAdmin, isDealerAdmin } = usePermissions();
  const { notifications, unreadCount, messagesCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [vehiclesDropdownOpen, setVehiclesDropdownOpen] = useState(false);
  const [leadsDropdownOpen, setLeadsDropdownOpen] = useState(false);
  const [creditApplicationsDropdownOpen, setCreditApplicationsDropdownOpen] = useState(false);
  const [analyticsDropdownOpen, setAnalyticsDropdownOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMessagesOpen, setMobileMessagesOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const [isMobileHeaderPanels, setIsMobileHeaderPanels] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const { toast } = useToast();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobileHeaderPanels(mq.matches);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const runHeaderVehicleSearch = () => {
    const q = searchQuery.trim();
    if (!q) {
      toast({
        title: 'Enter a search term',
        description: 'Try a stock number, VIN, make, or model.',
      });
      return;
    }
    if (!canAccessFeature('vehicle_import')) {
      toast({
        variant: 'destructive',
        title: 'Search unavailable',
        description: 'You do not have access to vehicle inventory.',
      });
      return;
    }
    navigate(`/vehicles?search=${encodeURIComponent(q)}`);
    setMobileSearchOpen(false);
  };

  const ListItem = React.forwardRef<
    HTMLAnchorElement,
    React.ComponentPropsWithoutRef<"a"> & { icon?: React.ReactNode }
  >(({ className, title, children, icon, ...props }, ref) => {
    return (
      <li>
        <a
          ref={ref}
          className={cn(
            "group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-white focus:bg-accent focus:text-white cursor-pointer",
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-2">
            {icon && <div className="text-primary group-hover:text-white group-focus:text-white transition-colors">{icon}</div>}
            <div className="text-sm font-medium leading-none group-hover:text-white group-focus:text-white transition-colors">{title}</div>
          </div>
          {children && (
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground group-hover:text-white/80 group-focus:text-white/80 transition-colors">
              {children}
            </p>
          )}
        </a>
      </li>
    );
  });
  ListItem.displayName = "ListItem";

  const MobileNavItem = ({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) => (
    <button
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
      onClick={() => { handleNavigation(href); setMobileMenuOpen(false); }}
    >
      <span className="text-gray-500">{icon}</span>
      {label}
      <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
    </button>
  );

  const messagesTriggerIcon = (
    <>
      <MessageCircle className="h-5 w-5" />
      {messagesCount > 0 && (
        <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
          {messagesCount > 9 ? '9+' : messagesCount}
        </span>
      )}
    </>
  );

  const notificationsTriggerIcon = (
    <>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </>
  );

  const renderMessagesPanel = (scrollAreaClassName: string, onAfterNavigate?: () => void) => (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3 pr-10">
        <h4 className="text-sm font-semibold">Messages</h4>
        {messagesCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-primary hover:text-primary/90"
            onClick={markAllAsRead}
          >
            Mark all read
          </Button>
        )}
      </div>
      <ScrollArea className={scrollAreaClassName}>
        {notifications.filter(n => n.type === 'message').length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <MessageCircle className="mb-2 h-12 w-12 opacity-20" />
            <p className="text-sm">No messages</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications
              .filter(n => n.type === 'message')
              .slice(0, 10)
              .map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'cursor-pointer p-3 transition-colors hover:bg-gray-50',
                    !notification.read && 'bg-primary/10'
                  )}
                  onClick={() => {
                    markAsRead(notification.id);
                    navigate('/conversation-monitor');
                    onAfterNavigate?.();
                  }}
                >
                  <div className="mb-1 flex items-start justify-between">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 -mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">{notification.message}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>
    </>
  );

  const renderNotificationsPanel = (scrollAreaClassName: string, onAfterNavigate?: () => void) => (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3 pr-10">
        <h4 className="text-sm font-semibold">Notifications</h4>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-primary hover:text-primary/90"
            onClick={markAllAsRead}
          >
            Mark all read
          </Button>
        )}
      </div>
      <ScrollArea className={scrollAreaClassName}>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Bell className="mb-2 h-12 w-12 opacity-20" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'cursor-pointer p-3 transition-colors hover:bg-gray-50',
                  !notification.read && 'bg-primary/10'
                )}
                onClick={() => {
                  markAsRead(notification.id);
                  if (notification.type === 'new_lead') {
                    navigate('/leads');
                  } else if (notification.type === 'credit_application') {
                    navigate('/finance/applications');
                  } else if (notification.type === 'finance_deal') {
                    navigate('/finance');
                  } else if (notification.type === 'signature_request') {
                    navigate('/finance');
                  }
                  onAfterNavigate?.();
                }}
              >
                <div className="mb-1 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {notification.type === 'new_lead' && (
                      <Users className="h-4 w-4 text-primary" />
                    )}
                    {notification.type === 'credit_application' && (
                      <CreditCard className="h-4 w-4 text-green-600" />
                    )}
                    {notification.type === 'finance_deal' && (
                      <DollarSign className="h-4 w-4 text-purple-600" />
                    )}
                    {notification.type === 'signature_request' && (
                      <FileText className="h-4 w-4 text-orange-600" />
                    )}
                    <p className="text-sm font-medium">{notification.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 -mt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-gray-600">{notification.message}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                  {!notification.read && (
                    <span className="text-xs font-medium text-primary">New</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      {notifications.length > 0 && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              navigate('/notifications');
              onAfterNavigate?.();
            }}
          >
            View all notifications
          </Button>
        </div>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#4a5766] bg-[#5D6D7E] shadow-md overflow-x-hidden">
      <div className="flex h-16 items-center px-3 sm:px-4 md:px-6 max-w-[100vw]">
        {/* Mobile Hamburger */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-2 h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetHeader className="px-4 py-4 border-b">
              <SheetTitle asChild>
                <button
                  className="flex items-center gap-2"
                  onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/85">
                    <Car className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-lg font-semibold text-gray-800">DealerIQ</span>
                </button>
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="flex-1 px-3 py-3">
              <div className="space-y-1">
                <MobileNavItem icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" href="/dashboard" />

                {canAccessFeature('vehicle_import') && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicles</p>
                    </div>
                    <MobileNavItem icon={<Car className="h-4 w-4" />} label="Vehicle Inventory" href="/vehicles" />
                    {!(user?.staffRole === 'sales') && (
                      <MobileNavItem icon={<Upload className="h-4 w-4" />} label="Import Vehicles" href="/import" />
                    )}
                  </>
                )}

                {canAccessFeature('lead_management') && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Leads</p>
                    </div>
                    <MobileNavItem icon={<Users className="h-4 w-4" />} label="All Leads" href="/leads" />
                    <MobileNavItem icon={<MessageSquare className="h-4 w-4" />} label="Conversations" href="/conversation-monitor" />
                    {canAccessFeature('customer_management') && (
                      <MobileNavItem icon={<Users className="h-4 w-4" />} label="Customers" href="/customers" />
                    )}
                  </>
                )}

                {(canAccessFeature('finance_management') || canAccessFeature('rebate_management')) && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Finance</p>
                    </div>
                    {canAccessFeature('finance_management') && (
                      <>
                        <MobileNavItem icon={<CreditCard className="h-4 w-4" />} label="Credit Applications" href="/finance/applications" />
                        <MobileNavItem icon={<DollarSign className="h-4 w-4" />} label="Finance Deals" href="/finance" />
                        <MobileNavItem icon={<Building2 className="h-4 w-4" />} label="Lenders" href="/lenders" />
                      </>
                    )}
                    {canAccessFeature('rebate_management') && (
                      <MobileNavItem icon={<Gift className="h-4 w-4" />} label="Rebates" href="/rebates" />
                    )}
                  </>
                )}

                {canAccessFeature('analytics_dashboard') && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Analytics</p>
                    </div>
                    <MobileNavItem icon={<BarChart3 className="h-4 w-4" />} label="DAIVE Analytics" href="/daive/analytics" />
                    {canAccessFeature('finance_management') && (
                      <MobileNavItem icon={<DollarSign className="h-4 w-4" />} label="Finance Analytics" href="/finance/analytics" />
                    )}
                  </>
                )}

                {/* Marbalism AI - HIDDEN */}
                {/* {canAccessFeature('marbalism_ai') && (
                  <>
                    <Separator className="my-2" />
                    <MobileNavItem icon={<Bot className="h-4 w-4 text-purple-600" />} label="Marbalism AI" href="/marbalism-ai" />
                  </>
                )} */}

                {(isSuperAdmin() || isDealerAdmin() || canAccessFeature('staff_management') || canAccessFeature('daive_settings_management') || canAccessFeature('followup_settings_management')) && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
                    </div>
                    {(isSuperAdmin() || isDealerAdmin() || canAccessFeature('staff_management')) && (
                      <MobileNavItem icon={<Users className="h-4 w-4" />} label="Staff Management" href="/staff" />
                    )}
                    {canAccessFeature('staff_management') && (
                      <MobileNavItem icon={<Bot className="h-4 w-4" />} label="AI Agents" href="/crewai-agents" />
                    )}
                    {canAccessFeature('daive_settings_management') && (
                      <MobileNavItem icon={<Settings className="h-4 w-4" />} label="DAIVE Settings" href="/daive/settings" />
                    )}
                    {canAccessFeature('followup_settings_management') && (
                      <MobileNavItem icon={<Repeat className="h-4 w-4" />} label="Follow-Up Settings" href="/followup/settings" />
                    )}
                    {isSuperAdmin() && (
                      <MobileNavItem icon={<Crown className="h-4 w-4" />} label="Super Admin" href="/admin" />
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Mobile User Footer */}
            <div className="border-t px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{getUserDisplayName(user)}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.staffRole || 'User'}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo Section */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 mr-2 sm:mr-4 lg:mr-6 flex-shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 sm:gap-2 transition-opacity hover:opacity-80"
          >
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/85">
              <Car className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-semibold text-white whitespace-nowrap">DealerIQ</span>
          </button>
        </div>

        {/* Main Navigation */}
        <NavigationMenu className="hidden lg:flex flex-shrink min-w-0" delayDuration={0}>
          <NavigationMenuList className="gap-0.5 lg:gap-1">
            {/* Dashboard */}
            <NavigationMenuItem>
              <NavigationMenuLink
                className={cn(
                  navigationMenuTriggerStyle(),
                  'h-9 cursor-pointer bg-transparent px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white data-[active]:bg-white/15 data-[state=open]:bg-white/15'
                )}
                onClick={() => handleNavigation('/dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 mr-1 lg:mr-1.5" />
                Dashboard
              </NavigationMenuLink>
            </NavigationMenuItem>

            {/* Vehicles */}
            {canAccessFeature('vehicle_import') && (
              <li className="list-none">
                <DropdownMenu open={vehiclesDropdownOpen} onOpenChange={setVehiclesDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                      onMouseEnter={() => setVehiclesDropdownOpen(true)}
                      onMouseLeave={() => setVehiclesDropdownOpen(false)}
                    >
                      <Car className="h-4 w-4 mr-1 lg:mr-1.5" />
                      Vehicles
                      <ChevronDown className="ml-0.5 lg:ml-1 h-3 w-3 text-white/70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    sideOffset={4} 
                    className="w-[300px] p-0"
                    onMouseEnter={() => setVehiclesDropdownOpen(true)}
                    onMouseLeave={() => setVehiclesDropdownOpen(false)}
                  >
                    <ul className="grid w-[300px] gap-2 p-3">
                      <ListItem
                        title="Vehicle Inventory"
                        icon={<Car className="h-4 w-4" />}
                        onClick={() => handleNavigation('/vehicles')}
                      >
                        Manage vehicle inventory
                      </ListItem>
                      {!(user?.staffRole === 'sales') && (
                        <ListItem
                          title="Import Vehicles"
                          icon={<Upload className="h-4 w-4" />}
                          onClick={() => handleNavigation('/import')}
                        >
                          Import and ETL vehicle data
                        </ListItem>
                      )}
                    </ul>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )}

            {/* Leads */}
            {canAccessFeature('lead_management') && (
              <li className="list-none">
                <DropdownMenu open={leadsDropdownOpen} onOpenChange={setLeadsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                      onMouseEnter={() => setLeadsDropdownOpen(true)}
                      onMouseLeave={() => setLeadsDropdownOpen(false)}
                    >
                      <Users className="h-4 w-4 mr-1 lg:mr-1.5" />
                      Leads
                      <ChevronDown className="ml-0.5 lg:ml-1 h-3 w-3 text-white/70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    sideOffset={4} 
                    className="w-[300px] p-0"
                    onMouseEnter={() => setLeadsDropdownOpen(true)}
                    onMouseLeave={() => setLeadsDropdownOpen(false)}
                  >
                    <ul className="grid w-[300px] gap-2 p-3">
                      <ListItem
                        title="All Leads"
                        icon={<Users className="h-4 w-4" />}
                        onClick={() => handleNavigation('/leads')}
                      >
                        Track and manage leads
                      </ListItem>
                      <ListItem
                        title="Conversations"
                        icon={<MessageSquare className="h-4 w-4" />}
                        onClick={() => handleNavigation('/conversation-monitor')}
                      >
                        Monitor AI conversations
                      </ListItem>
                      {canAccessFeature('customer_management') && (
                      <ListItem
                        title="Customers"
                        icon={<Users className="h-4 w-4" />}
                        onClick={() => handleNavigation('/customers')}
                      >
                        Customer management
                      </ListItem>
                      )}
                    </ul>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )}

            {/* Finance & Rebates */}
            {(canAccessFeature('finance_management') || canAccessFeature('rebate_management')) && (
              <li className="list-none">
                <DropdownMenu open={creditApplicationsDropdownOpen} onOpenChange={setCreditApplicationsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                      onMouseEnter={() => setCreditApplicationsDropdownOpen(true)}
                      onMouseLeave={() => setCreditApplicationsDropdownOpen(false)}
                    >
                      <CreditCard className="h-4 w-4 mr-1 lg:mr-1.5" />
                      Finance
                      <ChevronDown className="ml-0.5 lg:ml-1 h-3 w-3 text-white/70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    sideOffset={4} 
                    className="w-[340px] p-0"
                    onMouseEnter={() => setCreditApplicationsDropdownOpen(true)}
                    onMouseLeave={() => setCreditApplicationsDropdownOpen(false)}
                  >
                    <ul className="grid w-[340px] gap-2 p-3">
                      {canAccessFeature('finance_management') && (
                        <>
                      <ListItem
                        title="Credit Applications"
                        icon={<CreditCard className="h-4 w-4" />}
                        onClick={() => handleNavigation('/finance/applications')}
                      >
                        View and manage credit applications
                      </ListItem>
                      <ListItem
                        title="Finance Deals"
                        icon={<DollarSign className="h-4 w-4" />}
                        onClick={() => handleNavigation('/finance')}
                      >
                        Manage finance & lease deals
                      </ListItem>
                      <ListItem
                        title="Lenders"
                        icon={<Building2 className="h-4 w-4" />}
                        onClick={() => handleNavigation('/lenders')}
                      >
                        Manage lender relationships
                      </ListItem>
                        </>
                      )}
                      {canAccessFeature('rebate_management') && (
                      <ListItem
                        title="Rebates"
                        icon={<Gift className="h-4 w-4" />}
                        onClick={() => handleNavigation('/rebates')}
                      >
                        Rebate management
                      </ListItem>
                      )}
                    </ul>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )}

            {/* Analytics */}
            {canAccessFeature('analytics_dashboard') && (
              <li className="list-none">
                <DropdownMenu open={analyticsDropdownOpen} onOpenChange={setAnalyticsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                      onMouseEnter={() => setAnalyticsDropdownOpen(true)}
                      onMouseLeave={() => setAnalyticsDropdownOpen(false)}
                    >
                      <BarChart3 className="h-4 w-4 mr-1 lg:mr-1.5" />
                      Analytics
                      <ChevronDown className="ml-0.5 lg:ml-1 h-3 w-3 text-white/70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    sideOffset={4} 
                    className="w-[300px] p-0"
                    onMouseEnter={() => setAnalyticsDropdownOpen(true)}
                    onMouseLeave={() => setAnalyticsDropdownOpen(false)}
                  >
                    <ul className="grid w-[300px] gap-2 p-3">
                      <ListItem
                        title="DAIVE Analytics"
                        icon={<BarChart3 className="h-4 w-4" />}
                        onClick={() => handleNavigation('/daive/analytics')}
                      >
                        AI-powered insights
                      </ListItem>
                      {canAccessFeature('finance_management') && (
                        <ListItem
                          title="Finance Analytics"
                          icon={<DollarSign className="h-4 w-4" />}
                          onClick={() => handleNavigation('/finance/analytics')}
                        >
                          Finance performance metrics
                        </ListItem>
                      )}
                    </ul>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )}

            {/* Marbalism AI - HIDDEN */}
            {/* {canAccessFeature('marbalism_ai') && (
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={cn(
                    navigationMenuTriggerStyle(),
                    'h-9 cursor-pointer bg-transparent px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white data-[active]:bg-white/15 data-[state=open]:bg-white/15'
                  )}
                  onClick={() => handleNavigation('/marbalism-ai')}
                >
                  <Bot className="h-4 w-4 mr-1 lg:mr-1.5 text-purple-200" />
                  Marbalism AI
                </NavigationMenuLink>
              </NavigationMenuItem>
            )} */}

            {/* Admin */}
            {((isSuperAdmin() || isDealerAdmin() || canAccessFeature('staff_management') || canAccessFeature('daive_settings_management') || canAccessFeature('followup_settings_management'))) && (
              <li className="list-none">
                <DropdownMenu open={adminDropdownOpen} onOpenChange={setAdminDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 px-2 lg:px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                      onMouseEnter={() => setAdminDropdownOpen(true)}
                      onMouseLeave={() => setAdminDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-1 lg:mr-1.5" />
                      Admin
                      <ChevronDown className="ml-0.5 lg:ml-1 h-3 w-3 text-white/70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    sideOffset={4} 
                    className="w-[300px] p-0"
                    onMouseEnter={() => setAdminDropdownOpen(true)}
                    onMouseLeave={() => setAdminDropdownOpen(false)}
                  >
                    <ul className="grid w-[300px] gap-2 p-3">
                      {(isSuperAdmin() || isDealerAdmin() || canAccessFeature('staff_management')) && (
                        <ListItem
                          title="Staff Management"
                          icon={<Users className="h-4 w-4" />}
                          onClick={() => handleNavigation('/staff')}
                        >
                          Manage staff members
                        </ListItem>
                      )}
                      {canAccessFeature('staff_management') && (
                          <ListItem
                            title="AI Agents"
                            icon={<Bot className="h-4 w-4" />}
                            onClick={() => handleNavigation('/crewai-agents')}
                          >
                            CrewAI agent management
                          </ListItem>
                      )}
                      {canAccessFeature('daive_settings_management') && (
                          <ListItem
                            title="DAIVE Settings"
                            icon={<Settings className="h-4 w-4" />}
                            onClick={() => handleNavigation('/daive/settings')}
                          >
                            Configure DAIVE AI
                          </ListItem>
                      )}
                      {canAccessFeature('followup_settings_management') && (
                          <ListItem
                            title="Follow-Up Settings"
                            icon={<Repeat className="h-4 w-4" />}
                            onClick={() => handleNavigation('/followup/settings')}
                          >
                            Automated follow-up system
                          </ListItem>
                      )}
                      {isSuperAdmin() && (
                        <ListItem
                          title="Super Admin"
                          icon={<Crown className="h-4 w-4" />}
                          onClick={() => handleNavigation('/admin')}
                        >
                          System administration
                        </ListItem>
                      )}
                    </ul>
                  </DropdownMenuContent>
              </DropdownMenu>
              </li>
            )}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right Section */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
          {/* Search Bar - hidden on mobile, visible md+ */}
          <div className="relative hidden md:block flex-shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <Input
              type="search"
              placeholder="Search now"
              className="h-9 w-[160px] lg:w-[220px] xl:w-[280px] border-white/25 bg-white/15 pl-9 pr-4 text-white placeholder:text-white/45 focus-visible:bg-white/20 focus-visible:ring-white/25"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runHeaderVehicleSearch();
                }
              }}
            />
          </div>
          {/* Mobile search — opens popover (icon alone had no handler before) */}
          <Popover open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                aria-label="Search vehicle inventory"
                aria-expanded={mobileSearchOpen}
              >
                <Search className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(calc(100vw-2rem),20rem)] p-3">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  runHeaderVehicleSearch();
                }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Stock, VIN, make, model…"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full">
                  Search inventory
                </Button>
              </form>
            </PopoverContent>
          </Popover>

          {/* Notification Icons — bottom sheets on mobile, popovers on md+ */}
          {/* Messages */}
          {isMobileHeaderPanels ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                aria-label="Messages"
                onClick={() => setMobileMessagesOpen(true)}
              >
                {messagesTriggerIcon}
              </Button>
              <Sheet open={mobileMessagesOpen} onOpenChange={setMobileMessagesOpen}>
                <SheetContent
                  side="bottom"
                  className="flex h-[min(85dvh,560px)] max-h-[90vh] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 border-t bg-background p-0"
                >
                  <SheetTitle className="sr-only">Messages</SheetTitle>
                  {renderMessagesPanel('min-h-0 flex-1', () => setMobileMessagesOpen(false))}
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                  aria-label="Messages"
                >
                  {messagesTriggerIcon}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end" sideOffset={8} collisionPadding={16}>
                {renderMessagesPanel('h-[400px]')}
              </PopoverContent>
            </Popover>
          )}

          {/* Notifications */}
          {isMobileHeaderPanels ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                aria-label="Notifications"
                onClick={() => setMobileNotificationsOpen(true)}
              >
                {notificationsTriggerIcon}
              </Button>
              <Sheet open={mobileNotificationsOpen} onOpenChange={setMobileNotificationsOpen}>
                <SheetContent
                  side="bottom"
                  className="flex h-[min(85dvh,560px)] max-h-[90vh] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 border-t bg-background p-0"
                >
                  <SheetTitle className="sr-only">Notifications</SheetTitle>
                  {renderNotificationsPanel('min-h-0 flex-1', () => setMobileNotificationsOpen(false))}
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
                  aria-label="Notifications"
                >
                  {notificationsTriggerIcon}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end" sideOffset={8} collisionPadding={16}>
                {renderNotificationsPanel('h-[400px]')}
              </PopoverContent>
            </Popover>
          )}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-9 items-center gap-0 px-1.5 sm:px-2 text-white/90 hover:bg-white/10 hover:text-white lg:gap-2"
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-[#FF6B2B] text-white text-xs font-semibold">
                    {getUserInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-white/95 lg:inline-block max-w-[120px] xl:max-w-none truncate">
                  {getUserDisplayName(user)}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{getUserDisplayName(user)}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user?.staffRole || 'User'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default TopNavigation;

