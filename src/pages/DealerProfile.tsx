import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DealerProfileForm } from "@/components/dealer/DealerProfileForm";
import { Building2, Edit, Phone, Mail, MapPin, Globe, Calendar, CreditCard, LogOut, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dealersAPI } from "@/lib/api";

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
}

const DealerProfile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDealerProfile();
    }
  }, [user]);

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
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
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