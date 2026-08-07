import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Mail, MapPin, Globe, User, Clock, Star, MessageCircle, QrCode, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, buildBackendAssetUrl } from '@/lib/config';
import QuickAuthModal from '@/components/customer/QuickAuthModal';

const getStaffPhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;
  return buildBackendAssetUrl(photoUrl);
};

interface SalespersonPublicProfile {
  id: string;
  dealer_id: string;
  name: string;
  staff_role: string;
  availability_status: string;
  photo_url?: string;
  phone?: string;
  extension_number?: string;
  department?: string;
  location?: string;
  languages?: string[];
  specialties?: string[];
  years_with_company?: number;
  employee_id?: string;
  dealer_name: string;
  dealer_logo?: string;
}

const availabilityColors: Record<string, string> = {
  available: 'bg-orange-500',
  busy: 'bg-yellow-500',
  away: 'bg-gray-400',
};

const SalespersonProfile = () => {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<SalespersonPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Generate or retrieve a persistent session ID for this browser
  const getSessionId = (): string => {
    let sid = localStorage.getItem('daive_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('daive_session_id', sid);
    }
    return sid;
  };

  useEffect(() => {
    if (!hash) return;

    // Check if customer is already authenticated
    const customerToken = localStorage.getItem('customerToken');
    const customerSession = localStorage.getItem('customerSession');
    const authenticated = !!(customerToken && customerSession);
    setIsAuthenticated(authenticated);

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/staff/public/qr/${hash}`);
        if (!res.ok) {
          throw new Error('Salesperson not found');
        }
        const data = await res.json();
        setProfile(data);

        // Auto-claim on load
        claimSalesperson(data.id, hash);
        
        // Automatically show auth modal if not authenticated
        if (!authenticated) {
          setShowAuthModal(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [hash]);

  const claimSalesperson = async (staffId: string, qrHash: string) => {
    try {
      setClaiming(true);
      const sessionId = getSessionId();
      const res = await fetch(`${API_BASE_URL}/staff/public/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, staff_qr_hash: qrHash }),
      });

      const data = await res.json();

      if (res.ok) {
        setClaimed(true);
        // Store staff assignment so D.A.I.V.E. picks it up
        localStorage.setItem('assigned_staff_id', staffId);
        localStorage.setItem('assigned_staff_qr_hash', qrHash);
      } else if (res.status === 409) {
        // Already claimed by someone else — just show info, don't block the customer
        toast({
          title: 'Already Connected',
          description: data.message || 'This session is already connected to a salesperson.',
        });
      }
    } catch {
      // Silent — claim is best-effort
    } finally {
      setClaiming(false);
    }
  };

  const handleStartChat = () => {
    if (!profile) return;
    
    // Check if customer is authenticated
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Navigate to D.A.I.V.E. with staff context
    navigate(`/ai-bot?dealerId=${encodeURIComponent(profile.dealer_id)}`, {
      state: {
        dealerId: profile.dealer_id,
        assignedStaffId: profile.id,
        staffQrHash: hash,
        staffName: profile.name,
      },
    });
  };

  const handleAuthSuccess = (sessionData: any) => {
    setIsAuthenticated(true);
    setShowAuthModal(false);
    
    toast({
      title: "Authentication Successful",
      description: "You can now start chatting with D.A.I.V.E.",
    });
    
    // Automatically proceed to chat after successful auth
    if (profile) {
      navigate(`/ai-bot?dealerId=${encodeURIComponent(profile.dealer_id)}`, {
        state: {
          dealerId: profile.dealer_id,
          assignedStaffId: profile.id,
          staffQrHash: hash,
          staffName: profile.name,
        },
      });
    }
  };

  const handleCall = () => {
    if (profile?.phone) window.location.href = `tel:${profile.phone}`;
  };

  const handleEmail = () => {
    // Opens the D.A.I.V.E. chat which handles contact collection
    handleStartChat();
  };

  const handleSaveContact = () => {
    if (!profile) return;
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${profile.name}`,
      `ORG:${profile.dealer_name}`,
      profile.staff_role ? `TITLE:${profile.staff_role.charAt(0).toUpperCase() + profile.staff_role.slice(1)}` : '',
      profile.phone ? `TEL;TYPE=WORK:${profile.phone}` : '',
      profile.extension_number ? `X-EXTENSION:${profile.extension_number}` : '',
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, '_')}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 text-sm">
            This QR code is invalid or has expired. Please ask your salesperson for a new QR code.
          </p>
        </div>
      </div>
    );
  }

  const roleLabel =
    profile.staff_role.charAt(0).toUpperCase() + profile.staff_role.slice(1).replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Hero photo */}
      <div className="relative h-56 bg-gray-100 overflow-hidden">
        {profile.photo_url ? (
          <img
            src={getStaffPhotoUrl(profile.photo_url)}
            alt={profile.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <User className="h-24 w-24 text-gray-400" />
          </div>
        )}
        {/* Dealer logo overlay */}
        {profile.dealer_logo && (
          <img
            src={profile.dealer_logo}
            alt={profile.dealer_name}
            className="absolute top-3 left-3 h-8 object-contain bg-white rounded px-1 py-0.5 shadow-sm"
          />
        )}
      </div>

      {/* Card body */}
      <div className="px-5 pt-4 pb-6">
        {/* Name + availability */}
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
          <Badge
            className={`text-white text-xs px-2 py-0.5 ${
              availabilityColors[profile.availability_status] || 'bg-gray-400'
            }`}
          >
            {profile.availability_status || 'available'}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mb-1">{roleLabel}</p>

        {/* Employee ID */}
        {profile.employee_id && (
          <p className="text-xs font-medium text-yellow-600 bg-yellow-50 inline-block px-2 py-0.5 rounded mb-3">
            Employee ID: {profile.employee_id}
          </p>
        )}

        {/* Contact details table */}
        <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 mb-4">
          {profile.phone && (
            <Row icon={<Phone className="h-4 w-4 text-gray-400" />} label="Phone" value={profile.phone} />
          )}
          {profile.extension_number && (
            <Row icon={<Phone className="h-4 w-4 text-gray-400" />} label="Extension" value={profile.extension_number} />
          )}
          {profile.department && (
            <Row icon={<Star className="h-4 w-4 text-gray-400" />} label="Department" value={profile.department} />
          )}
          {profile.location && (
            <Row icon={<MapPin className="h-4 w-4 text-gray-400" />} label="Location" value={profile.location} />
          )}
          {profile.languages && profile.languages.length > 0 && (
            <Row icon={<Globe className="h-4 w-4 text-gray-400" />} label="Languages" value={profile.languages.join(', ')} />
          )}
          {profile.years_with_company !== undefined && profile.years_with_company > 0 && (
            <Row
              icon={<Clock className="h-4 w-4 text-gray-400" />}
              label="Years with Company"
              value={`${profile.years_with_company} ${profile.years_with_company === 1 ? 'year' : 'years'}`}
            />
          )}
        </div>

        {/* Specialties */}
        {profile.specialties && profile.specialties.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {profile.specialties.map((s) => (
                <span
                  key={s}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Connection status */}
        {claimed && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-xs text-green-700 font-medium">
              You're connected to {profile.name}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 py-3 h-auto text-xs"
            onClick={handleCall}
            disabled={!profile.phone}
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 py-3 h-auto text-xs"
            onClick={handleEmail}
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-1 py-3 h-auto text-xs"
            onClick={handleSaveContact}
          >
            <Download className="h-4 w-4" />
            Save
          </Button>
        </div>

        {/* Chat with D.A.I.V.E. CTA */}
        <Button
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          onClick={handleStartChat}
        >
          <MessageCircle className="h-5 w-5" />
          {isAuthenticated ? 'Chat with D.A.I.V.E. AI' : 'Sign In to Chat with D.A.I.V.E.'}
        </Button>

        <p className="text-center text-xs text-gray-400 mt-3">
          {profile.dealer_name}
        </p>
      </div>

      {/* Authentication Modal */}
      <QuickAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        dealerData={{
          id: profile.dealer_id,
          business_name: profile.dealer_name,
          contact_name: profile.name,
        }}
        qrHash={hash}
      />
    </div>
  );
};

// Small row component for the contact table
const Row = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-3 px-4 py-3">
    {icon}
    <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
    <span className="text-sm text-gray-800 font-medium">{value}</span>
  </div>
);

export default SalespersonProfile;
