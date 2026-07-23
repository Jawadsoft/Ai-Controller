import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCustomer } from '@/contexts/CustomerContext';
import { buildApiUrl } from '@/lib/config';
import { LogIn, Mail, Lock } from 'lucide-react';

/**
 * Customer sign-in before accessing protected flows (e.g. credit application from email link).
 */
const CustomerLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useCustomer();

  const redirectTo = searchParams.get('redirect') || '/apply';
  const dealerId = searchParams.get('dealer') || undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({
        title: 'Missing information',
        description: 'Enter your email and password.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl('customer-auth/login-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          dealer_id: dealerId || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          toast({
            title: 'Verify your email',
            description: data.message || data.error || 'Check your inbox for the verification link.',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(data.error || data.message || 'Login failed');
      }

      login({
        session: data.session,
        customer: data.customer,
      });

      toast({
        title: 'Signed in',
        description: 'You can continue your credit application.',
      });

      const target = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast({
        title: 'Sign in failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LogIn className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Sign in to continue</CardTitle>
          <CardDescription>
            Log in with the customer account you created (same email you used with the dealer). After signing in,
            you will return to your credit application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerLogin;
