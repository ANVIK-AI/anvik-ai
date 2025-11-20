import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Mail, Lock } from 'lucide-react';
import AuthShowcase from '@/components/AuthShowcase';
import '../components/Auth.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '@/context/AuthContext';
function Login({ setIsAuthenticated, isAuthenticated }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const {loginWithGoogle} =useAuth()
  console.log(import.meta.env.VITE_PUBLIC_BACKEND_URL)
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
    <div className="auth-page">
      <AuthShowcase />
      <div className="auth-card glass-panel">
        <div className="auth-card__header">
          <div className="auth-logo">
            <Brain size={28} />
            <span>Anvik</span>
          </div>
          <h2>Welcome back</h2>
          <p>Sign in to orchestrate your AI personal agent.</p>
          <div className="auth-pill-row">
            <span>Agents</span>
            <span>Tools</span>
            <span>Dedicated humanlike memory</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-input-group">
            <label>
              <Mail size={18} />
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="auth-input-group">
            <label>
              <Lock size={18} />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="auth-button" onClick={()=>confirm(import.meta.env.VITE_PUBLIC_BACKEND_URL)} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div 
            onClick={loginWithGoogle}
          className="flex items-center justify-center space-x-3 mt-6" style={{ color: 'rgba(0, 0, 0, 0.87)' }}>
            <button className="bg-gray-100 rounded-full px-8 py-3 shadow-md hover:bg-gray-200">
              <FontAwesomeIcon icon={["fab", "google"]} className="text-gray-800 mr-3" />
              <span className="text-gray-800 text-sm font-medium">Sign up with Google</span>
            </button>
          </div>

          <div className="auth-footer">
            <p>
              Don&apos;t have an account? <Link to="/signup">Sign up</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
