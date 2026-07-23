import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Settings, 
  Mail, 
  MessageSquare, 
  Power,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Bell,
  Shield,
  Info,
  Zap,
  HelpCircle,
  BookOpen,
  Bot,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { buildApiUrl } from '../lib/config';

interface FollowUpSettings {
  system_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  messenger_enabled: boolean;
  push_notification_enabled: boolean;
  auto_enrollment_enabled: boolean;
  auto_enrollment_categories: string[];
  respect_quiet_hours: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  max_messages_per_day: number;
  min_delay_between_messages_hours: number;
  min_engagement_score: number;
  pause_on_low_engagement: boolean;
  email_use_env: boolean;
  sms_use_env: boolean;
}

interface SystemStatus {
  active_enrollments: number;
  messages_sent_today: number;
  pending_messages: number;
  scheduler_running: boolean;
  last_check: string | null;
}

const FollowUpSettingsPage: React.FC = () => {
  const { user, getDealerId } = useAuth();
  const [settings, setSettings] = useState<FollowUpSettings>({
    system_enabled: false, // STARTS DISABLED FOR SAFETY
    email_enabled: true,
    sms_enabled: true,
    whatsapp_enabled: false,
    messenger_enabled: false,
    push_notification_enabled: false,
    auto_enrollment_enabled: true,
    auto_enrollment_categories: ['lead_nurture'],
    respect_quiet_hours: true,
    quiet_hours_start: '21:00',
    quiet_hours_end: '08:00',
    timezone: 'America/New_York',
    max_messages_per_day: 5,
    min_delay_between_messages_hours: 4,
    min_engagement_score: 30,
    pause_on_low_engagement: true,
    email_use_env: true,
    sms_use_env: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const categories = [
    { value: 'lead_nurture', label: 'Lead Nurture', desc: 'New leads from conversations', icon: Users, color: 'blue' },
    { value: 'unsold_visit', label: 'Unsold Visit', desc: 'Visited but didn\'t purchase', icon: AlertCircle, color: 'orange' },
    { value: 'post_purchase', label: 'Post-Purchase', desc: 'After customer buys', icon: CheckCircle, color: 'green' },
    { value: 'service_customer', label: 'Service Customer', desc: 'Service reminders', icon: Settings, color: 'purple' },
    { value: 'at_risk', label: 'At-Risk', desc: 'Low engagement customers', icon: AlertCircle, color: 'red' },
    { value: 'churn_prevention', label: 'Churn Prevention', desc: 'Win-back sequences', icon: Shield, color: 'red' },
    { value: 'long_term_loyalty', label: 'Long-Term Loyalty', desc: 'Holiday & anniversary messages', icon: Users, color: 'indigo' }
  ];

  useEffect(() => {
    // Only load settings when user is available
    if (user) {
      loadSettings();
      loadSystemStatus();
      // Refresh status every 30 seconds
      const interval = setInterval(loadSystemStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const dealerId = getDealerId();
      
      if (!dealerId) {
        console.warn('No dealer ID available');
        setLoading(false);
        return;
      }
      
      const response = await fetch(
        buildApiUrl(`/followup-settings/${dealerId}`),
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load settings');
      }

      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load follow-up settings');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStatus = async () => {
    try {
      const response = await fetch(
        buildApiUrl('/followup-settings/status'),
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data.status);
      }
    } catch (error) {
      console.error('Error loading system status:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const dealerId = getDealerId();

      if (!dealerId) {
        toast.error('❌ No dealer ID found');
        return;
      }

      const response = await fetch(
        buildApiUrl(`/followup-settings/${dealerId}`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify(settings)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save settings');
      }

      toast.success('✅ Follow-up settings saved successfully!');
      loadSystemStatus(); // Refresh status
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(`❌ ${error.message || 'Failed to save settings'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      
      // Prompt for email address (with default suggestion)
      const testEmail = prompt('Enter email address to send test to:', user?.email || 'your-email@example.com');
      if (!testEmail) {
        setTestingEmail(false);
        return;
      }
      
      const response = await fetch(
        buildApiUrl('/followup-settings/test/email'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ 
            email: testEmail
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Email test failed');
      }

      toast.success(`✅ Test email sent to ${testEmail}! Check your inbox.`, {
        duration: 5000
      });
    } catch (error: any) {
      console.error('Error testing email:', error);
      toast.error(`❌ ${error.message}`, { duration: 5000 });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestSMS = async () => {
    try {
      setTestingSMS(true);
      
      const phoneNumber = prompt('Enter phone number to test (with country code, e.g., +1234567890):');
      if (!phoneNumber) return;

      const response = await fetch(
        buildApiUrl('/followup-settings/test/sms'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ 
            phone: phoneNumber
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'SMS test failed');
      }

      toast.success(`✅ Test SMS sent to ${phoneNumber}!`, { duration: 5000 });
    } catch (error: any) {
      console.error('Error testing SMS:', error);
      toast.error(`❌ ${error.message}`, { duration: 5000 });
    } finally {
      setTestingSMS(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSettings(prev => ({
      ...prev,
      auto_enrollment_categories: prev.auto_enrollment_categories.includes(category)
        ? prev.auto_enrollment_categories.filter(c => c !== category)
        : [...prev.auto_enrollment_categories, category]
    }));
  };

  // Help Dialog Component
  const HelpDialog = () => (
    <div className={`fixed inset-0 z-50 ${showHelp ? 'block' : 'hidden'}`}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowHelp(false)}
      />
      
      {/* Help Modal */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Card className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="sticky top-0 bg-white z-10 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <BookOpen className="h-6 w-6 text-primary" />
                  Follow-Up Automation Help Guide
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowHelp(false)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6 pt-6">
              {/* What is this? */}
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Info className="h-5 w-5 text-primary" />
                  What is the Follow-Up Automation System?
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  The Follow-Up Automation System automatically sends personalized messages to your customers 
                  at the right time in their journey. From the moment they show interest in a vehicle, through 
                  the purchase, and beyond - the system keeps them engaged without any manual effort from you.
                </p>
              </div>

              {/* Master Toggle */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Power className="h-5 w-5 text-green-500" />
                  Master ON/OFF Toggle
                </h3>
                <div className="space-y-2 text-gray-700">
                  <p><strong>🟢 When ENABLED:</strong> The system automatically enrolls customers in follow-up sequences and sends scheduled messages.</p>
                  <p><strong>⚪ When DISABLED:</strong> No automated messages are sent. Existing enrollments are paused.</p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                    <p className="text-sm text-yellow-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span><strong>Recommended:</strong> Test your email and SMS configuration before enabling the system for the first time.</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Channels Tab */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Channels Tab
                </h3>
                <div className="space-y-3 text-gray-700">
                  <div>
                    <p className="font-semibold">📧 Email</p>
                    <p className="text-sm">Sends professional branded emails. Best for detailed information, special offers, and longer messages. Credentials configured in .env file.</p>
                  </div>
                  <div>
                    <p className="font-semibold">📱 SMS</p>
                    <p className="text-sm">Sends text messages via Twilio. Best for quick reminders, appointment confirmations, and time-sensitive updates. Requires Twilio credentials in .env.</p>
                  </div>
                  <div>
                    <p className="font-semibold">💬 WhatsApp</p>
                    <p className="text-sm">Send messages via WhatsApp Business API. Requires WhatsApp Business account setup.</p>
                  </div>
                  <div>
                    <p className="font-semibold">🔔 Push Notifications</p>
                    <p className="text-sm">In-app notifications if customer has your mobile app installed.</p>
                  </div>
                </div>
              </div>

              {/* Auto-Enrollment Tab */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-primary" />
                  Auto-Enrollment Tab
                </h3>
                <p className="text-gray-700 mb-3">
                  Choose which customer journeys should automatically trigger follow-up sequences:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <p className="font-semibold text-primary">🆕 Lead Nurture</p>
                    <p className="text-primary/90">Triggered when DAIVE completes <strong>Step 1-2</strong> (Inquiry & Lead Capture). Sends vehicle info, availability, and test drive invites over 7 days.</p>
                    <p className="text-xs text-primary mt-1">
                      <strong>DAIVE Integration:</strong> Customer has shared vehicle interest and budget
                    </p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="font-semibold text-orange-900">🚗 Unsold Visit</p>
                    <p className="text-orange-700">Triggered when DAIVE completes <strong>Step 4</strong> (Test Drive) but no purchase in Step 7. Follows up with thank you, alternatives, and special incentives.</p>
                    <p className="text-xs text-orange-600 mt-1">
                      <strong>DAIVE Integration:</strong> Test drive scheduled/completed but no purchase commitment
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="font-semibold text-green-900">🎉 Post-Purchase</p>
                    <p className="text-green-700">Triggered when DAIVE completes <strong>Step 7</strong> (Purchase Commitment) through <strong>Step 10</strong> (Delivery). Sends welcome messages, satisfaction checks, and service reminders.</p>
                    <p className="text-xs text-green-600 mt-1">
                      <strong>DAIVE Integration:</strong> Purchase commitment made, paperwork completed, vehicle delivered
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="font-semibold text-purple-900">🔧 Service Customer</p>
                    <p className="text-purple-700">Regular service reminders every 90 days plus appointment confirmations.</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="font-semibold text-red-900">⚠️ At-Risk</p>
                    <p className="text-red-700">Customers with low engagement. Re-engagement attempts with special offers.</p>
                  </div>
                  <div className="bg-pink-50 p-3 rounded-lg">
                    <p className="font-semibold text-pink-900">💔 Churn Prevention</p>
                    <p className="text-pink-700">Lost customers. "We miss you" messages with win-back offers over 3 months.</p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <p className="font-semibold text-foreground">💎 Long-Term Loyalty</p>
                    <p className="text-foreground">Quarterly check-ins, holiday greetings, and purchase anniversary messages.</p>
                  </div>
                </div>
              </div>

              {/* DAIVE Integration Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Bot className="h-5 w-5 text-primary" />
                  DAIVE AI Integration
                </h3>
                <p className="text-gray-700 mb-3">
                  The Follow-Up System automatically integrates with DAIVE's 11-step customer journey:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="font-semibold text-gray-900">📋 Journey Steps Overview</p>
                    <ol className="text-gray-700 ml-4 mt-2 space-y-1">
                      <li><strong>Step 1-2:</strong> Inquiry & Lead Capture → Enrolls in <span className="text-primary font-semibold">Lead Nurture</span></li>
                      <li><strong>Step 3:</strong> Vehicle Selection → Updates enrollment with selected vehicle</li>
                      <li><strong>Step 4:</strong> Test Drive → If scheduled but no purchase → <span className="text-orange-600 font-semibold">Unsold Visit</span></li>
                      <li><strong>Step 5:</strong> Trade Evaluation (optional) → Trade-in follow-ups</li>
                      <li><strong>Step 6:</strong> 💰 <span className="font-bold text-purple-600">Qualification (Finance & Payment Terms)</span> → Finance-specific follow-ups</li>
                      <li><strong>Step 7:</strong> Purchase Commitment → If committed → <span className="text-green-600 font-semibold">Post-Purchase</span></li>
                      <li><strong>Step 8-9:</strong> Vehicle Prep & Finance Manager → Pre-delivery updates</li>
                      <li><strong>Step 10:</strong> Delivery → Welcome sequence begins</li>
                      <li><strong>Step 11:</strong> CSI & Follow-ups → <span className="text-primary font-semibold">Long-term Loyalty</span></li>
                    </ol>
                  </div>
                  
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="font-semibold text-purple-900 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Step 6: Qualification (Finance & Payment Terms)
                    </p>
                    <p className="text-purple-700 text-xs mt-1">
                      When customer reaches this step, DAIVE has collected:
                    </p>
                    <ul className="text-purple-700 text-xs ml-4 mt-1 space-y-0.5">
                      <li>• Financing needs (loan/lease/cash)</li>
                      <li>• Term months preference</li>
                      <li>• Credit score range</li>
                      <li>• Payment type (monthly/bi-weekly)</li>
                      <li>• Down payment amount</li>
                      <li>• Monthly payment range (min/max/preferred)</li>
                    </ul>
                    <p className="text-purple-700 text-xs mt-2">
                      <strong>Triggers:</strong> Finance-specific follow-up emails with payment calculators, pre-approval invitations, and financing options.
                    </p>
                  </div>

                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="font-semibold text-green-900 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Step 9: Finance Manager
                    </p>
                    <p className="text-green-700 text-xs mt-1">
                      When customer reaches this step, DAIVE handles:
                    </p>
                    <ul className="text-green-700 text-xs ml-4 mt-1 space-y-0.5">
                      <li>• Purchase agreement signing</li>
                      <li>• Financing contract execution</li>
                      <li>• Insurance verification</li>
                      <li>• Registration processing</li>
                      <li>• Warranty documentation</li>
                    </ul>
                    <p className="text-green-700 text-xs mt-2">
                      <strong>Triggers:</strong> Post-purchase welcome sequence, document reminders, and onboarding emails.
                    </p>
                  </div>
                </div>
                
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mt-3">
                  <p className="text-sm text-primary flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Automatic Enrollment:</strong> When DAIVE conversation progresses through these steps, the system automatically enrolls customers in the appropriate follow-up sequences based on their journey position.</span>
                  </p>
                </div>
              </div>

              {/* Timing Tab */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Timing Tab
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900">🌙 Quiet Hours</p>
                    <p className="text-sm text-gray-700">Messages won't be sent during these hours (e.g., 9 PM - 8 AM). Scheduled messages will wait until quiet hours end.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">🌍 Timezone</p>
                    <p className="text-sm text-gray-700">All timing is based on this timezone. Make sure it matches your dealership's location.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">📊 Max Messages Per Day</p>
                    <p className="text-sm text-gray-700">Prevents message fatigue. A customer will never receive more than this many messages in a 24-hour period.</p>
                    <p className="text-xs text-gray-500 mt-1">Recommended: 3-5 messages per day</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">⏰ Min Delay Between Messages</p>
                    <p className="text-sm text-gray-700">Minimum hours to wait between sending messages to the same customer.</p>
                    <p className="text-xs text-gray-500 mt-1">Recommended: 4-6 hours</p>
                  </div>
                </div>
              </div>

              {/* Credentials Tab */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-red-500" />
                  Credentials Tab
                </h3>
                <p className="text-gray-700 mb-3">
                  Email and SMS credentials are securely stored in your <code className="bg-gray-100 px-2 py-1 rounded">.env</code> file:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3 font-mono text-sm">
                  <div>
                    <p className="text-gray-500"># Email Configuration</p>
                    <p>SMTP_HOST=your.smtp.server</p>
                    <p>SMTP_USER=info@mitiesoft.com</p>
                    <p>SMTP_PASS=your_password</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-gray-500"># SMS Configuration (Twilio)</p>
                    <p>TWILIO_ACCOUNT_SID=your_sid</p>
                    <p>TWILIO_AUTH_TOKEN=your_token</p>
                    <p>TWILIO_PHONE_NUMBER=+1234567890</p>
                  </div>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  <p>Use the <strong>Test Email</strong> and <strong>Test SMS</strong> buttons in the Credentials tab to verify your configuration.</p>
                  <p className="text-xs text-gray-500 mt-2">Always test before enabling the system!</p>
                </div>
              </div>

              {/* Status Tab */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Status Tab
                </h3>
                <p className="text-gray-700 mb-3">Real-time monitoring of your follow-up system:</p>
                <div className="space-y-2 text-sm">
                  <p>• <strong>Active Enrollments:</strong> Number of customers currently in follow-up sequences</p>
                  <p>• <strong>Messages Sent Today:</strong> Total messages sent in the last 24 hours</p>
                  <p>• <strong>Pending Messages:</strong> Messages scheduled to send in the next hour</p>
                  <p>• <strong>Scheduler Status:</strong> Whether the background automation service is running</p>
                </div>
              </div>

              {/* Best Practices */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Best Practices
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-gray-700"><strong>Start Small:</strong> Enable 1-2 categories first (Lead Nurture + Post-Purchase), monitor results, then expand.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-gray-700"><strong>Test Everything:</strong> Send test emails and SMS to yourself before going live.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-gray-700"><strong>Set Conservative Limits:</strong> Start with max 3 messages/day and 6-hour delays. Increase gradually.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-gray-700"><strong>Respect Quiet Hours:</strong> Keep them enabled and set for your customers' timezone.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-gray-700"><strong>Monitor Daily:</strong> Check the Status tab to ensure messages are sending as expected.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-gray-700"><strong>Review Engagement:</strong> The system pauses low-engagement customers automatically to avoid spam complaints.</p>
                  </div>
                </div>
              </div>

              {/* Quick Start */}
              <div className="border-t pt-6 bg-gradient-to-r from-primary/5 to-purple-50 -mx-6 px-6 py-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  🚀 Quick Start Guide
                </h3>
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">1.</span>
                    <span><strong>Go to Credentials tab</strong> → Click "Test Email" and "Test SMS" to verify your setup</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">2.</span>
                    <span><strong>Go to Channels tab</strong> → Enable Email and SMS (at minimum)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">3.</span>
                    <span><strong>Go to Auto-Enrollment tab</strong> → Select "Lead Nurture" and "Post-Purchase" to start</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">4.</span>
                    <span><strong>Go to Timing tab</strong> → Set quiet hours and verify timezone is correct</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">5.</span>
                    <span><strong>Click "Save Settings"</strong> at the top right</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">6.</span>
                    <span><strong>Toggle the Master Switch to ON</strong> at the top of the page</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">7.</span>
                    <span><strong>Click "Save Settings" again</strong> to activate the system</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary flex-shrink-0">8.</span>
                    <span><strong>Monitor the Status tab</strong> daily to track performance</span>
                  </li>
                </ol>
              </div>

              {/* FAQ */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <HelpCircle className="h-5 w-5 text-gray-500" />
                  Frequently Asked Questions
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">Q: Will customers get overwhelmed with messages?</p>
                    <p className="text-gray-700">No. The system respects rate limits, quiet hours, and automatically pauses low-engagement customers.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Q: Can customers opt out?</p>
                    <p className="text-gray-700">Yes. All SMS messages include opt-out instructions, and emails have unsubscribe links.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Q: What happens if I turn off the system?</p>
                    <p className="text-gray-700">All scheduled messages are paused immediately. When you turn it back on, sequences resume from where they left off.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Q: Can I customize the message templates?</p>
                    <p className="text-gray-700">Yes, but it requires database access. Contact your administrator to customize message content.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Q: How often does the system check for messages to send?</p>
                    <p className="text-gray-700">Every 5 minutes. Messages are sent within 5 minutes of their scheduled time.</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t pt-6 text-center">
                <p className="text-sm text-gray-500">
                  Need more help? Check the documentation files in your project folder or contact support.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  // Check if user doesn't have a dealer profile
  const dealerId = getDealerId();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-600">Loading follow-up settings...</p>
        </div>
      </div>
    );
  }

  if (!dealerId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              No Dealer Profile Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Follow-up settings are only available for dealer accounts. 
              {user?.role === 'superadmin' && (
                <span className="block mt-2 text-sm text-gray-500">
                  As a super admin, you'll need to configure settings for a specific dealer.
                </span>
              )}
            </p>
            <Button 
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Help Dialog */}
      <HelpDialog />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Follow-Up Automation
          </h1>
          <p className="text-gray-600 mt-2">
            Automatically nurture leads and engage customers across their entire journey
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Help Button */}
          <Button 
            onClick={() => setShowHelp(true)} 
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            Help Guide
          </Button>

          {systemStatus && (
            <Badge variant={settings.system_enabled ? "default" : "secondary"} className="px-3 py-2">
              <Power className="h-3 w-3 mr-1" />
              {settings.system_enabled ? 'System Active' : 'System Paused'}
            </Badge>
          )}
          
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Master ON/OFF Toggle */}
      <Card className="mb-6 border-2 border-primary shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all ${
                settings.system_enabled 
                  ? 'bg-green-100 shadow-lg' 
                  : 'bg-gray-100'
              }`}>
                <Power className={`h-8 w-8 ${
                  settings.system_enabled ? 'text-green-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-bold">
                  {settings.system_enabled ? '🟢 Follow-Up System is ACTIVE' : '⚪ Follow-Up System is PAUSED'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {settings.system_enabled 
                    ? 'Automated follow-ups are being sent to your customers'
                    : 'No automated messages will be sent until you enable the system'
                  }
                </p>
                {!settings.system_enabled && (
                  <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Recommended: Test email/SMS before enabling
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Switch
                checked={settings.system_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, system_enabled: checked })}
                className="scale-150"
              />
              <span className="text-xs text-gray-500">
                {settings.system_enabled ? 'Click to pause' : 'Click to activate'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="channels" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="channels" className="py-3">
            <MessageSquare className="h-4 w-4 mr-2" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="enrollment" className="py-3">
            <Users className="h-4 w-4 mr-2" />
            Auto-Enroll
          </TabsTrigger>
          <TabsTrigger value="timing" className="py-3">
            <Clock className="h-4 w-4 mr-2" />
            Timing
          </TabsTrigger>
          <TabsTrigger value="credentials" className="py-3">
            <Shield className="h-4 w-4 mr-2" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="status" className="py-3">
            <Zap className="h-4 w-4 mr-2" />
            Status
          </TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels">
          <Card>
            <CardHeader>
              <CardTitle>Communication Channels</CardTitle>
              <p className="text-sm text-gray-600">Choose how to reach your customers</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between p-4 border-2 rounded-lg hover:border-primary/25 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/15 rounded-lg flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Email</h4>
                    <p className="text-sm text-gray-600">Send follow-ups via email</p>
                    <p className="text-xs text-gray-500 mt-1">Best for: Detailed information, links, attachments</p>
                  </div>
                </div>
                <Switch
                  checked={settings.email_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, email_enabled: checked })}
                  disabled={!settings.system_enabled}
                />
              </div>

              {/* SMS */}
              <div className="flex items-center justify-between p-4 border-2 rounded-lg hover:border-green-300 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">SMS Text</h4>
                    <p className="text-sm text-gray-600">Send follow-ups via text message</p>
                    <p className="text-xs text-gray-500 mt-1">Best for: Quick reminders, urgent updates</p>
                  </div>
                </div>
                <Switch
                  checked={settings.sms_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, sms_enabled: checked })}
                  disabled={!settings.system_enabled}
                />
              </div>

              {/* WhatsApp */}
              <div className="flex items-center justify-between p-4 border-2 rounded-lg opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg flex items-center gap-2">
                      WhatsApp
                      <Badge variant="secondary">Coming Soon</Badge>
                    </h4>
                    <p className="text-sm text-gray-600">Send via WhatsApp Business API</p>
                  </div>
                </div>
                <Switch checked={false} disabled={true} />
              </div>

              {/* Push Notifications */}
              <div className="flex items-center justify-between p-4 border-2 rounded-lg hover:border-purple-300 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Bell className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Push Notifications</h4>
                    <p className="text-sm text-gray-600">In-app notifications</p>
                    <p className="text-xs text-gray-500 mt-1">Best for: Instant alerts to logged-in users</p>
                  </div>
                </div>
                <Switch
                  checked={settings.push_notification_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, push_notification_enabled: checked })}
                  disabled={!settings.system_enabled}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Enrollment Tab */}
        <TabsContent value="enrollment">
          <Card>
            <CardHeader>
              <CardTitle>Automatic Enrollment</CardTitle>
              <p className="text-sm text-gray-600">Choose which customer types automatically enter follow-up sequences</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-primary/10 border-primary/20">
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-primary" />
                  <div>
                    <h4 className="font-semibold text-lg">Enable Auto-Enrollment</h4>
                    <p className="text-sm text-gray-600">
                      Automatically add customers to follow-up sequences based on their actions
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.auto_enrollment_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_enrollment_enabled: checked })}
                  disabled={!settings.system_enabled}
                />
              </div>

              <div>
                <Label className="text-base font-semibold mb-4 block">
                  Select Active Categories
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  {categories.map(category => {
                    const isActive = settings.auto_enrollment_categories.includes(category.value);
                    const IconComponent = category.icon;
                    
                    return (
                      <div
                        key={category.value}
                        className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          isActive
                            ? `border-${category.color}-300 bg-${category.color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        } ${!settings.auto_enrollment_enabled || !settings.system_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          if (settings.auto_enrollment_enabled && settings.system_enabled) {
                            toggleCategory(category.value);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isActive ? `bg-${category.color}-100` : 'bg-gray-100'
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              isActive ? `text-${category.color}-600` : 'text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <span className="font-semibold">{category.label}</span>
                            <p className="text-xs text-gray-600">{category.desc}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isActive}
                          disabled={!settings.system_enabled || !settings.auto_enrollment_enabled}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label>Minimum Engagement Score</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_engagement_score}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      min_engagement_score: parseInt(e.target.value) || 0 
                    })}
                    disabled={!settings.system_enabled}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Only enroll customers with score above this (0-100)
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Auto-Pause Low Engagement</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Pause sequences for unresponsive customers
                    </p>
                  </div>
                  <Switch
                    checked={settings.pause_on_low_engagement}
                    onCheckedChange={(checked) => setSettings({ 
                      ...settings, 
                      pause_on_low_engagement: checked 
                    })}
                    disabled={!settings.system_enabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timing Tab */}
        <TabsContent value="timing">
          <Card>
            <CardHeader>
              <CardTitle>Timing & Rate Limiting</CardTitle>
              <p className="text-sm text-gray-600">Control when and how often messages are sent</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-purple-50 border-purple-200">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-purple-600" />
                  <div>
                    <h4 className="font-semibold text-lg">Quiet Hours</h4>
                    <p className="text-sm text-gray-600">
                      Don't send messages during late night / early morning
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.respect_quiet_hours}
                  onCheckedChange={(checked) => setSettings({ ...settings, respect_quiet_hours: checked })}
                  disabled={!settings.system_enabled}
                />
              </div>

              {settings.respect_quiet_hours && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label>Quiet Hours Start</Label>
                    <Input
                      type="time"
                      value={settings.quiet_hours_start}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        quiet_hours_start: e.target.value 
                      })}
                      disabled={!settings.system_enabled}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">No messages after this time</p>
                  </div>

                  <div>
                    <Label>Quiet Hours End</Label>
                    <Input
                      type="time"
                      value={settings.quiet_hours_end}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        quiet_hours_end: e.target.value 
                      })}
                      disabled={!settings.system_enabled}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">Resume messages after this time</p>
                  </div>

                  <div>
                    <Label>Timezone</Label>
                    <select
                      className="w-full p-2 border rounded mt-2"
                      value={settings.timezone}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        timezone: e.target.value 
                      })}
                      disabled={!settings.system_enabled}
                    >
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Your dealership timezone</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <Label>Max Messages Per Day (Per Customer)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.max_messages_per_day}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      max_messages_per_day: parseInt(e.target.value) || 1 
                    })}
                    disabled={!settings.system_enabled}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Prevents spam - recommended: 3-5 messages
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <Label>Minimum Delay Between Messages (Hours)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={settings.min_delay_between_messages_hours}
                    onChange={(e) => setSettings({ 
                      ...settings, 
                      min_delay_between_messages_hours: parseInt(e.target.value) || 1 
                    })}
                    disabled={!settings.system_enabled}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Wait at least this long between messages
                  </p>
                </div>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-primary">Smart Timing</h4>
                    <p className="text-sm text-primary mt-1">
                      Messages scheduled during quiet hours will automatically be delayed until the next available time.
                      If daily limit is reached, remaining messages will be sent the next day.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials Tab */}
        <TabsContent value="credentials">
          <div className="space-y-6">
            {/* Email Credentials */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <h4 className="font-semibold">Using Environment Variables (.env)</h4>
                      <p className="text-sm text-gray-600">
                        Recommended: Credentials are securely stored in your .env file
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    Secure
                  </Badge>
                </div>

                <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
                  <p className="mb-2 text-gray-400"># Email Configuration (from .env)</p>
                  <div className="space-y-1">
                    <div>SMTP_HOST=<span className="text-white">Configured</span></div>
                    <div>SMTP_PORT=<span className="text-white">587</span></div>
                    <div>SMTP_USER=<span className="text-white">info@mitiesoft.com</span></div>
                    <div className="mt-2 text-green-600 font-semibold">✅ Using Existing SMTP Config</div>
                  </div>
                </div>

                <Button 
                  onClick={handleTestEmail} 
                  disabled={testingEmail || !settings.email_enabled}
                  variant="outline"
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {testingEmail ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Sending Test Email...
                    </>
                  ) : (
                    <>
                      <Mail className="h-5 w-5 mr-2" />
                      Send Test Email to {user?.email}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* SMS Credentials */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Credentials (Twilio)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <h4 className="font-semibold">Using Environment Variables (.env)</h4>
                      <p className="text-sm text-gray-600">
                        Recommended: Twilio credentials from .env file
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    Secure
                  </Badge>
                </div>

                <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
                  <p className="mb-2 text-gray-400"># SMS Configuration (from .env)</p>
                  <div className="space-y-1">
                    <div>FOLLOWUP_TWILIO_ACCOUNT_SID=<span className="text-white">***configured***</span></div>
                    <div>FOLLOWUP_TWILIO_AUTH_TOKEN=<span className="text-white">***configured***</span></div>
                    <div>FOLLOWUP_TWILIO_PHONE_NUMBER=<span className="text-white">***configured***</span></div>
                    <div className="mt-2 text-green-600 font-semibold">✅ Configured</div>
                  </div>
                </div>

                <Button 
                  onClick={handleTestSMS} 
                  disabled={testingSMS || !settings.sms_enabled}
                  variant="outline"
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {testingSMS ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Sending Test SMS...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Send Test SMS
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <p className="text-sm text-gray-600">Real-time overview of your follow-up automation</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {systemStatus ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary">
                            {systemStatus.active_enrollments}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">Active Enrollments</div>
                          <p className="text-xs text-gray-500 mt-1">
                            Customers in follow-up sequences
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-green-600">
                            {systemStatus.messages_sent_today}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">Messages Sent Today</div>
                          <p className="text-xs text-gray-500 mt-1">
                            Email + SMS combined
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-purple-600">
                            {systemStatus.pending_messages}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">Pending (Next Hour)</div>
                          <p className="text-xs text-gray-500 mt-1">
                            Scheduled to send soon
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="p-4 border-2 rounded-lg">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Scheduler Status
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant={systemStatus.scheduler_running ? "default" : "secondary"} className="px-3">
                          {systemStatus.scheduler_running ? '🟢 Running' : '⚪ Stopped'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Last Check:</span>
                        <span className="font-mono text-sm">
                          {systemStatus.last_check 
                            ? new Date(systemStatus.last_check).toLocaleTimeString()
                            : 'Never'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Check Interval:</span>
                        <span>Every 60 seconds</span>
                      </div>
                    </div>
                  </div>

                  {!settings.system_enabled && (
                    <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-orange-900">System is Paused</h4>
                          <p className="text-sm text-orange-800 mt-1">
                            Enable the system at the top of this page to start sending automated follow-ups.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
                  <p>Loading system status...</p>
                </div>
              )}

              <Button 
                onClick={loadSystemStatus}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save reminder */}
      <div className="mt-6 p-4 bg-primary/10 border-2 border-primary/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            <p className="text-sm text-primary font-medium">
              Don't forget to save your changes before leaving this page
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} variant="default">
            {saving ? 'Saving...' : 'Save Now'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FollowUpSettingsPage;

