import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DealerProfileForm } from "@/components/dealer/DealerProfileForm";
import { DealerProfileSticker } from "@/components/dealer/DealerProfileSticker";
import { Building2, Edit, Phone, Mail, MapPin, Globe, Calendar, CreditCard, LogOut, ArrowLeft, QrCode, Bot, CheckCircle, Sparkles, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dealersAPI } from "@/lib/api";
import { buildApiUrl } from "@/lib/config";
import { usePermissions } from "@/hooks/usePermissions";

interface DealerProfile {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  website?: string;
  description?: string;
  license_number?: string;
  established_year?: number;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  marbalism_ai_enabled?: boolean;
  marbalism_ai_activated_at?: string;
  opening_hours?: Record<string, { open: string | null; close: string | null; closed: boolean }>;
}

const DealerProfile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { id, hash } = useParams();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [isPublicAccess, setIsPublicAccess] = useState(false);
  const [activatingMarbalism, setActivatingMarbalism] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshPermissions } = usePermissions();

  useEffect(() => {
    // Check if this is a public access route
    const isPublicRoute = id || hash;
    setIsPublicAccess(!!isPublicRoute);
    
    if (!isPublicRoute && !authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate, id, hash]);

  useEffect(() => {
    if (isPublicAccess) {
      fetchPublicDealerProfile();
    } else if (user) {
      fetchDealerProfile();
    }
  }, [user, isPublicAccess, id, hash]);

  const fetchDealerProfile = async () => {
    try {
      const data = await dealersAPI.getProfile();
      setDealer(data);
      
      // If no dealer profile exists, show the form
      if (!data) {
        setEditing(true);
      }
    } catch (error: any) {
      console.error("Error fetching dealer profile:", error);
      
      // If dealer profile doesn't exist (404), show edit form
      if (error.message.includes('404') || error.message.includes('not found')) {
        setEditing(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to load dealer profile",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicDealerProfile = async () => {
    try {
      setLoading(true);
      let endpoint;
      let isQRCodeRoute = false;
      
      if (hash) {
        // Check if hash is actually a UUID (contains hyphens) - if so, treat it as dealer ID
        if (hash.includes('-') && hash.length === 36) {
          console.log('🔍 Hash appears to be a UUID, treating as dealer ID:', hash);
          endpoint = buildApiUrl(`dealers/public/${hash}`);
        } else {
          console.log('🔍 Hash appears to be a QR hash, using QR endpoint:', hash);
          endpoint = buildApiUrl(`dealers/public/qr/${hash}`);
          isQRCodeRoute = true;
        }
      } else if (id) {
        endpoint = buildApiUrl(`dealers/public/${id}`);
      } else {
        throw new Error('No dealer identifier provided');
      }
      
      console.log('📡 Fetching dealer from:', endpoint);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 404) {
          if (isQRCodeRoute) {
            throw new Error('QR code is invalid or dealer not found. The QR code may be outdated.');
          } else {
            throw new Error('Dealer profile not found');
          }
        } else {
          throw new Error(`Server error: ${response.status}`);
        }
      }
      
      const data = await response.json();
      setDealer(data);
      
      // For QR code routes, redirect to AI Bot for customer assistance
      if (isQRCodeRoute) {
        toast({
          title: "Welcome to D.A.I.V.E",
          description: "Redirecting you to our AI assistant for personalized help",
        });
        
        // Redirect to optimized AI Bot with dealer context
        setTimeout(() => {
          navigate(`/optimized-aibot?dealer=${data.id}&dealerName=${encodeURIComponent(data.business_name)}&stock=${new URLSearchParams(window.location.search).get('stk') || ''}`);
        }, 1500);
        return;
      }
      
    } catch (error: any) {
      console.error("Error fetching public dealer profile:", error);
      toast({
        title: "Error",
        description: error.message || "Dealer profile not found or no longer available",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      });
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Sign out error",
        description: "Failed to sign out properly",
        variant: "destructive",
      });
    }
  };

  const handleProfileSave = (updatedDealer: DealerProfile) => {
    setDealer(updatedDealer);
    setEditing(false);
    toast({
      title: "Profile saved",
      description: "Your dealer profile has been updated successfully",
    });
  };

  const handleActivateMarbalism = async () => {
    try {
      setActivatingMarbalism(true);
      await dealersAPI.activateMarbalismAI();
      setDealer((prev) => prev ? { ...prev, marbalism_ai_enabled: true, marbalism_ai_activated_at: new Date().toISOString() } : prev);
      await refreshPermissions();
      toast({
        title: "Marbalism AI Activated",
        description: "Marbalism AI is now active. You'll find it in the top navigation.",
      });
    } catch (error: any) {
      toast({
        title: "Activation Failed",
        description: error.message || "Failed to activate Marbalism AI",
        variant: "destructive",
      });
    } finally {
      setActivatingMarbalism(false);
    }
  };

  const getInitials = (businessName: string) => {
    return businessName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back
            </Button>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold">DealerIQ</h1>
            <span className="text-muted-foreground text-sm">/ Profile</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-muted-foreground">
              {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {editing ? (
          // Edit Mode
          <DealerProfileForm
            dealer={dealer || undefined}
            onSave={handleProfileSave}
            showHeader={false}
          />
        ) : dealer ? (
          // View Mode
          <div className="space-y-6">
            {/* Profile Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={dealer.logo_url} alt="Business logo" />
                      <AvatarFallback className="text-lg">
                        {getInitials(dealer.business_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-2xl">{dealer.business_name}</CardTitle>
                      <p className="text-muted-foreground mt-1">
                        Contact: {dealer.contact_name}
                      </p>
                      {dealer.established_year && (
                        <div className="flex items-center mt-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>Established {dealer.established_year}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isPublicAccess && (
                    <Button onClick={() => setEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{dealer.phone}</p>
                        <p className="text-sm text-muted-foreground">Business Phone</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{dealer.email}</p>
                        <p className="text-sm text-muted-foreground">Email Address</p>
                      </div>
                    </div>

                    {dealer.website && (
                      <div className="flex items-center space-x-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <a 
                            href={dealer.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                          >
                            {dealer.website}
                          </a>
                          <p className="text-sm text-muted-foreground">Website</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        <p className="font-medium">{dealer.address}</p>
                        <p className="text-sm text-muted-foreground">
                          {dealer.city}, {dealer.state} {dealer.zip_code}
                        </p>
                      </div>
                    </div>

                    {dealer.license_number && (
                      <div className="flex items-center space-x-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{dealer.license_number}</p>
                          <p className="text-sm text-muted-foreground">License Number</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opening Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Opening Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dealer.opening_hours ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map((day) => {
                      const hours = dealer.opening_hours?.[day];
                      const label = day.charAt(0).toUpperCase() + day.slice(1);
                      const formatTime = (t: string | null | undefined) => {
                        if (!t) return '';
                        const [h, m] = t.split(':');
                        const hour = parseInt(h);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour % 12 || 12;
                        return `${displayHour}:${m} ${ampm}`;
                      };
                      return (
                        <div key={day} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <span className="text-sm font-medium w-28">{label}</span>
                          {hours?.closed ? (
                            <span className="text-sm text-muted-foreground">Closed</span>
                          ) : (
                            <span className="text-sm text-foreground">
                              {formatTime(hours?.open)} – {formatTime(hours?.close)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No opening hours set. Edit your profile to add hours.</p>
                )}
              </CardContent>
            </Card>

            {/* Business Description */}
            {dealer.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About Our Dealership</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {dealer.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Profile Sticker Generator - Only show for authenticated users */}
            {!isPublicAccess && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Profile Sticker Generator
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Create custom QR code stickers for your dealership that customers can scan to access your profile and D.A.I.V.E AI assistant.
                  </p>
                </CardHeader>
                <CardContent>
                  <DealerProfileSticker dealer={dealer} />
                </CardContent>
              </Card>
            )}

            {/* Marbalism AI Activation */}
            {!isPublicAccess && (
              <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-800">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-primary/80">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    Marbalism AI
                  </CardTitle>
                  <CardDescription>
                    Activate intelligent AI agents that connect directly to your CRM — qualifying leads, reading your inventory, and creating deals automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dealer?.marbalism_ai_enabled ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Marbalism AI is active</span>
                        <Badge variant="default" className="bg-green-100 text-green-700 ml-1">Live</Badge>
                      </div>
                      {dealer.marbalism_ai_activated_at && (
                        <p className="text-xs text-gray-400">
                          Activated on {new Date(dealer.marbalism_ai_activated_at).toLocaleDateString()}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/marbalism-ai')}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50"
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        Open Marbalism AI Dashboard
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ul className="text-sm text-gray-600 space-y-1">
                        {[
                          'AI agents qualify leads automatically',
                          'Reads your live vehicle inventory',
                          'Creates CRM leads without manual work',
                          'Full conversation history in your dashboard',
                        ].map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={handleActivateMarbalism}
                        disabled={activatingMarbalism}
                        className="bg-gradient-to-r from-purple-600 to-primary/80 hover:from-purple-700 hover:to-primary/80 text-white"
                      >
                        {activatingMarbalism ? (
                          <>
                            <Bot className="h-4 w-4 mr-2 animate-pulse" />
                            Activating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Activate Marbalism AI
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => navigate("/vehicles")}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Vehicles
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => navigate("/dashboard")}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => setEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default DealerProfile;