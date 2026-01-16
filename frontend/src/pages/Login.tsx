import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Mail, Lock, Shield, Zap } from 'lucide-react';
import { Button, Input, Label } from '@/ui/design-system';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';

function Login({ setIsAuthenticated, isAuthenticated }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      if (email && password) {
        localStorage.setItem('authToken', 'mock-token-' + Date.now());
        setIsAuthenticated(true);
        navigate('/chat');
      } else {
        setError('Please fill in all fields');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground overflow-hidden">
      {/* Left Panel - Showcase */}
      <div className="hidden lg:flex flex-col w-1/2 relative bg-secondary/20 p-12 justify-between">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 text-white mb-12">
            <Brain className="w-8 h-8 text-primary" />
            <span className="text-xl font-heading font-bold">Anvik</span>
          </Link>

          <h1 className="text-5xl font-heading font-bold leading-tight mb-6">
            Intelligence without <br />
            <span className="text-gradient-primary">memory</span> is just <br />
            randomness.
          </h1>
          <p className="text-xl text-muted-foreground max-w-md">
            Give your AI agents a brain. Create unforgettable experiences with Anvik's self-healing memory graph.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4 mt-auto">
          <div className="glass-card p-4 rounded-xl">
            <Shield className="w-6 h-6 text-green-400 mb-2" />
            <h3 className="font-bold">Secure</h3>
            <p className="text-sm text-muted-foreground">Enterprise-grade encryption for all your data.</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <Zap className="w-6 h-6 text-yellow-400 mb-2" />
            <h3 className="font-bold">Fast</h3>
            <p className="text-sm text-muted-foreground">lt;300ms latency for real-time recall.</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 pointer-events-none lg:hidden">
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background opacity-50" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 relative z-10"
        >
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-6">
              <Brain className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-3xl font-heading font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to orchestrate your AI personal agent.</p>
          </div>

          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-12 bg-white text-black hover:bg-gray-100 border-none font-medium text-base relative"
              onClick={loginWithGoogle}
            >
              <FontAwesomeIcon icon={["fab", "google"]} className="mr-3 text-lg" />
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="pl-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="glow"
              className="w-full h-11 text-base"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Login;
