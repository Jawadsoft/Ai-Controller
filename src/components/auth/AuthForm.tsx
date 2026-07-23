import { useState } from "react";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Car } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const inputAuthClass =
  "rounded-none border-0 border-b-2 border-border bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

const labelAuthClass =
  "text-xs font-medium uppercase tracking-wide text-muted-foreground";

interface AuthFormProps {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
}

export const AuthForm = ({ mode, onModeChange }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  // Clear error message when inputs change
  const clearError = () => {
    if (errorMessage) setErrorMessage("");
  };

  // Reset form fields
  const resetForm = () => {
    setEmail("");
    setPassword("");
    setBusinessName("");
    setContactName("");
    setErrorMessage("");
    // Don't clear showVerificationMessage here - it should be preserved for signup success
  };

  // Reset form completely (including verification message)
  const resetFormCompletely = () => {
    setEmail("");
    setPassword("");
    setBusinessName("");
    setContactName("");
    setErrorMessage("");
    setShowVerificationMessage(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(""); // Clear any previous error messages

    try {
      if (mode === "signup") {
        const response = await authAPI.register({
          email,
          password,
          businessName,
          contactName,
        });

        if (response.requiresVerification) {
          toast({
            title: "Account created successfully!",
            description: "Please check your email to verify your account before logging in.",
          });
          
          // Show verification message instead of redirecting
          setShowVerificationMessage(true);
          setErrorMessage(""); // Clear any error messages
          resetForm(); // Clear form fields
        } else {
          toast({
            title: "Account created successfully!",
            description: "Your dealer profile has been created. You can update your business details in your profile.",
          });
          
          resetForm(); // Clear form fields
          navigate("/dashboard");
        }
      } else {
        const response = await authAPI.login({ email, password });

        // Refresh user data to get updated role information
        await refreshUser();

        // Check if user is super admin from the response or after refresh
        const userRole = response?.user?.role;
        const isAdmin = userRole === 'super_admin';

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        
        resetForm(); // Clear form fields
        
        // Redirect based on role
        if (isAdmin) {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      
      // Handle email verification requirement
      if (error.requiresVerification) {
        toast({
          title: "Email Verification Required",
          description: "Please check your email and verify your account before logging in.",
          variant: "destructive",
        });
        return;
      }
      
      // Handle specific error cases
      let errorTitle = "Authentication Error";
      let errorDescription = "An error occurred during authentication.";
      let showSwitchToLogin = false;
      
      if (error.message) {
        if (error.message.includes("User already exists") || error.message.includes("already exists")) {
          errorTitle = "Account Already Exists";
          errorDescription = "An account with this email address already exists. Please try logging in instead.";
          showSwitchToLogin = true;
          // Set error message for form display
          setErrorMessage("An account with this email address already exists. Please try logging in instead.");
        } else if (error.message.includes("Invalid credentials")) {
          errorTitle = "Invalid Credentials";
          errorDescription = "The email or password you entered is incorrect. Please try again.";
          setErrorMessage("The email or password you entered is incorrect. Please try again.");
        } else if (error.message.includes("Email not verified")) {
          errorTitle = "Email Not Verified";
          errorDescription = "Please check your email and verify your account before logging in.";
          setErrorMessage("Please check your email and verify your account before logging in.");
        } else {
          errorDescription = error.message;
          setErrorMessage(error.message);
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        action: showSwitchToLogin ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setErrorMessage("");
              onModeChange("login");
            }}
          >
            Switch to Login
          </Button>
        ) : undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md border-0 bg-transparent shadow-none">
      <CardHeader className="space-y-6 p-0 text-center sm:text-left">
        <div className="mx-auto flex flex-col items-center gap-3 sm:mx-0 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Car className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xl font-bold tracking-tight text-dealer-navy">
              <span className="text-primary">DEALER</span> IQ
            </p>
            <p className="text-xs font-medium text-muted-foreground">
              Selling cars just got smarter.
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-dealer-navy">
            {mode === "login" ? "Dealer login" : "Create dealer account"}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {mode === "login"
              ? "Sign in to your dealership workspace."
              : "Start managing inventory with AI-powered tools."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message Display */}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-red-700">{errorMessage}</p>
                  {errorMessage.includes("already exists") && mode === "signup" && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-red-700 underline p-0 h-auto mt-1"
                      onClick={() => {
                        setErrorMessage("");
                        onModeChange("login");
                      }}
                    >
                      Click here to login instead
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage("")}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="businessName" className={labelAuthClass}>
                  Business name
                </Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Your dealership name"
                  className={inputAuthClass}
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    clearError();
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName" className={labelAuthClass}>
                  Your name
                </Label>
                <Input
                  id="contactName"
                  type="text"
                  placeholder="John Doe"
                  className={inputAuthClass}
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                    clearError();
                  }}
                  required
                />
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className={labelAuthClass}>
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="dealer@example.com"
              className={inputAuthClass}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError();
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className={labelAuthClass}>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              className={inputAuthClass}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className={cn(
              "h-11 w-full rounded-md text-base font-semibold shadow-sm",
              "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {showVerificationMessage && (
          <div className="mt-6 rounded-lg border border-primary/25 bg-primary/10 p-4">
            <div className="text-center">
              <h3 className="mb-2 text-lg font-semibold text-primary">
                Check your email
              </h3>
              <p className="mb-4 text-sm text-dealer-navy/90">
                We've sent a verification email to <strong>{email}</strong>. 
                Please click the link in the email to verify your account.
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVerificationMessage(false)}
                  className="w-full"
                >
                  Back to Sign Up
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onModeChange("login")}
                  className="w-full"
                >
                  Go to Login
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4 border-t border-border pt-6 text-center sm:text-left">
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <Button
              variant="link"
              className="h-auto p-0 font-semibold text-primary"
              onClick={() => {
                onModeChange(mode === "login" ? "signup" : "login");
                resetFormCompletely();
              }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </Button>
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            By continuing, you agree to DealerIQ&apos;s terms of use and acknowledge our
            approach to handling business data in line with industry standards.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};