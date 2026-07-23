import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Login hero image: add your file at `public/images/login-hero.jpg` (or .png / .webp).
 * It is served as `/images/login-hero.jpg`. Change the path below if you use another name.
 */
const AUTH_HERO_IMAGE = "/images/login.jpg";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { isAuthenticated, loading } = useAuth();
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (isAuthenticated && !loading && !permissionsLoading) {
      if (isSuperAdmin()) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, loading, permissionsLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "login" || urlMode === "signup") {
      setMode(urlMode);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-white">
        <div className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16">
          <div className="mx-auto w-full max-w-md text-center text-dealer-navy">
            <div className="text-lg font-medium">Loading…</div>
          </div>
        </div>
        <div className="hidden min-h-0 flex-[1.15] lg:block lg:min-h-screen" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white lg:flex-row">
      {/* Form column */}
      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <AuthForm mode={mode} onModeChange={setMode} />
    
        </div>
      </div>

      {/* Visual column — desktop */}
      <div className="relative hidden min-h-0 flex-[1.15] lg:block lg:min-h-screen">
        <img
          src={AUTH_HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        {/* DealerIQ-style deep navy veil for contrast */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-dealer-navy/90 via-dealer-navy/55 to-dealer-navy/35"
          aria-hidden
        />
        <div className="absolute bottom-10 left-10 right-10 text-white/90">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            DealerIQ
          </p>
          <p className="mt-2 max-w-md text-lg font-semibold leading-snug">
            AI-driven tools for smarter showroom sales and lead capture.
          </p>
        </div>
      </div>

    </div>
  );
};

export default Auth;
