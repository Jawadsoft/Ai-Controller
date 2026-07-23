import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CustomerSignaturePad from '@/components/CustomerSignaturePad';
import { CheckCircle2, Clock, FileText, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

interface SignatureRequest {
  id: string;
  deal_id: string;
  dealer_id: string;
  provider: string;
  status: string;
  signer_name: string;
  signer_email: string;
  document_name: string;
  document_url: string;
  signed_document_url?: string;
  request_message?: string;
  created_at: string;
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  expires_at?: string;
  signature_url?: string;
}

const SignatureDocument = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [signatureRequest, setSignatureRequest] = useState<SignatureRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadSignatureRequest();
    }
  }, [id]);

  const loadSignatureRequest = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use API_URL for direct backend connection, or relative path for proxied requests
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const isProxied = window.location.port === '5173'; // Vite dev server with proxy
      const url = isProxied ? `/api/signatures/public/${id}` : `${apiUrl}/api/signatures/public/${id}`;
      
      console.log('Fetching signature from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load signature request');
      }

      const data = await response.json();
      
      // Fix document URLs to point to backend if not proxied
      const signatureData = data.data;
      if (!isProxied && signatureData.document_url && !signatureData.document_url.startsWith('http')) {
        signatureData.document_url = `${apiUrl}${signatureData.document_url}`;
      }
      if (!isProxied && signatureData.signed_document_url && !signatureData.signed_document_url.startsWith('http')) {
        signatureData.signed_document_url = `${apiUrl}${signatureData.signed_document_url}`;
      }
      
      setSignatureRequest(signatureData);

      // Mark as viewed if not already
      if (signatureData.status === 'sent' || signatureData.status === 'delivered') {
        markAsViewed();
      }
    } catch (err: any) {
      console.error('Error loading signature request:', err);
      setError(err.message || 'Failed to load signature request');
    } finally {
      setLoading(false);
    }
  };

  const markAsViewed = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const isProxied = window.location.port === '5173';
      const url = isProxied ? `/api/signatures/public/${id}/viewed` : `${apiUrl}/api/signatures/public/${id}/viewed`;
      
      await fetch(url, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error marking as viewed:', err);
    }
  };

  const handleSignatureSave = async (signatureData: string) => {
    try {
      setSubmitting(true);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const isProxied = window.location.port === '5173';
      const url = isProxied ? `/api/signatures/public/${id}/sign` : `${apiUrl}/api/signatures/public/${id}/sign`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature_data: signatureData,
          signer_name: signatureRequest?.signer_name,
          signer_email: signatureRequest?.signer_email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit signature');
      }

      const data = await response.json();
      
      toast.success('Document signed successfully!');
      setSignatureRequest(data.data);
      setShowSignaturePad(false);
    } catch (err: any) {
      console.error('Error submitting signature:', err);
      toast.error(err.message || 'Failed to submit signature');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
      pending: { label: 'Pending', variant: 'secondary', icon: Clock },
      sent: { label: 'Sent', variant: 'default', icon: FileText },
      delivered: { label: 'Delivered', variant: 'default', icon: FileText },
      viewed: { label: 'Viewed', variant: 'default', icon: FileText },
      signed: { label: 'Signed', variant: 'default', icon: CheckCircle2 },
      completed: { label: 'Completed', variant: 'default', icon: CheckCircle2 },
      declined: { label: 'Declined', variant: 'destructive', icon: X },
      cancelled: { label: 'Cancelled', variant: 'secondary', icon: X },
      expired: { label: 'Expired', variant: 'secondary', icon: AlertCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const isExpired = () => {
    if (!signatureRequest?.expires_at) return false;
    return new Date(signatureRequest.expires_at) < new Date();
  };

  const canSign = () => {
    if (!signatureRequest) return false;
    if (isExpired()) return false;
    return ['pending', 'sent', 'delivered', 'viewed'].includes(signatureRequest.status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <p className="text-center text-muted-foreground">Loading signature request...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !signatureRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Signature request not found'}
              </AlertDescription>
            </Alert>
            <div className="mt-4 text-center">
              <Button onClick={() => navigate('/')} variant="outline">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signatureRequest.status === 'signed' || signatureRequest.status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Document Already Signed</CardTitle>
                <CardDescription className="mt-2">
                  This document has already been signed
                </CardDescription>
              </div>
              {getStatusBadge(signatureRequest.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Successfully Signed</p>
                  <p className="text-sm text-green-700 mt-1">
                    Signed on {new Date(signatureRequest.signed_at!).toLocaleDateString()} at{' '}
                    {new Date(signatureRequest.signed_at!).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {signatureRequest.signed_document_url && (
              <div className="mt-4">
                <Button
                  onClick={() => window.open(signatureRequest.signed_document_url, '_blank')}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Download Signed Document
                </Button>
              </div>
            )}

            <div className="mt-6 text-center">
              <Button onClick={() => navigate('/')} variant="outline">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Signature Request Expired</CardTitle>
                <CardDescription className="mt-2">
                  This signature request has expired
                </CardDescription>
              </div>
              {getStatusBadge('expired')}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This signature request expired on{' '}
                {new Date(signatureRequest.expires_at!).toLocaleDateString()}. Please contact the
                dealer for a new signature request.
              </AlertDescription>
            </Alert>

            <div className="mt-6 text-center">
              <Button onClick={() => navigate('/')} variant="outline">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Document Signature Request</CardTitle>
                <CardDescription className="mt-2">
                  Please review and sign the document below
                </CardDescription>
              </div>
              {getStatusBadge(signatureRequest.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Document Information */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h3 className="font-semibold text-primary mb-2">Document Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary/90">Document Name:</span>
                  <span className="font-medium text-primary">{signatureRequest.document_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary/90">Signer:</span>
                  <span className="font-medium text-primary">{signatureRequest.signer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary/90">Email:</span>
                  <span className="font-medium text-primary">{signatureRequest.signer_email}</span>
                </div>
                {signatureRequest.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-primary/90">Expires:</span>
                    <span className="font-medium text-primary">
                      {new Date(signatureRequest.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Message */}
            {signatureRequest.request_message && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Message from Dealer</h3>
                <p className="text-sm text-gray-700">{signatureRequest.request_message}</p>
              </div>
            )}

            {/* Document Preview */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Document Preview</h3>
                {signatureRequest.status === 'pending' && (
                  <Alert className="inline-flex items-center p-2 border-primary/20 bg-primary/10">
                    <AlertDescription className="text-xs text-primary/90">
                      📝 Review the document below, then sign using the form at the bottom
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              {signatureRequest.document_url ? (
                <div className="space-y-3">
                  {/* Debug info - remove in production */}
                  {import.meta.env.DEV && (
                    <div className="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded">
                      Debug: {signatureRequest.document_url}
                    </div>
                  )}
                  <iframe
                    src={signatureRequest.document_url}
                    className="w-full h-[600px] border rounded"
                    title="Document Preview"
                    onLoad={() => console.log('✅ PDF loaded:', signatureRequest.document_url)}
                    onError={(e) => {
                      console.error('❌ PDF load error:', e);
                      console.error('PDF URL:', signatureRequest.document_url);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(signatureRequest.document_url, '_blank')}
                      variant="outline"
                      className="flex-1"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                    <Button
                      onClick={() => window.location.href = signatureRequest.document_url}
                      variant="outline"
                      className="flex-1"
                    >
                      Download PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Document preview not available. Please contact the dealer.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Signature Section */}
            {canSign() && !showSignaturePad && (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    By signing this document, you acknowledge that you have read and agree to the
                    terms and conditions outlined in the document above.
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setShowSignaturePad(true)} className="w-full" size="lg">
                  <FileText className="h-5 w-5 mr-2" />
                  Proceed to Sign Document
                </Button>
              </div>
            )}

            {/* Signature Pad */}
            {showSignaturePad && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Sign Below</h3>
                <CustomerSignaturePad
                  onSave={handleSignatureSave}
                  onCancel={() => setShowSignaturePad(false)}
                  disabled={submitting}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignatureDocument;

