import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Shield, User, Lock, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Listen for Chrome's native app install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); 
      setDeferredPrompt(e); 
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt(); 
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User installed the app');
        setDeferredPrompt(null); 
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { username, password });

      if (res.data && res.data.token) {
        login(res.data.user, res.data.token);

        if (res.data.user.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/guard/mark-attendance");
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid credentials. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 relative">
      <Card className="w-full max-w-md shadow-xl border-slate-200 relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-indigo-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4 shadow-md">
            <Shield className="text-white w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-extrabold text-slate-900">
            DSMS Portal
          </CardTitle>
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Username / ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                  placeholder="Enter username or Guard ID..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                  placeholder="Enter password..."
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-bold text-white shadow-md transition-all mt-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <span className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Verifying...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* PWA INSTALL BUTTON PROMPT */}
      {deferredPrompt && (
        <div className="w-full max-w-md mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm text-center transform transition-all duration-500 ease-out hover:shadow-md">
          <h3 className="text-indigo-900 font-bold text-sm mb-1">Get the Mobile App</h3>
          <p className="text-indigo-600 text-xs mb-3 font-medium">Install DSMS directly on your phone for faster access.</p>
          <Button 
            onClick={handleInstallClick}
            variant="outline"
            className="w-full bg-white text-indigo-700 hover:bg-indigo-600 hover:text-white border-indigo-200 font-bold h-11 transition-colors shadow-sm"
          >
            <Smartphone className="w-5 h-5 mr-2" />
            Install App Now
          </Button>
        </div>
      )}
    </div>
  );
}