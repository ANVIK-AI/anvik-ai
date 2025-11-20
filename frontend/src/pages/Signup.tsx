import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, Mail, Lock, User } from "lucide-react";
import AuthShowcase from "../components/AuthShowcase";
import "../components/Auth.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAuth } from "@/context/AuthContext";
function Signup({ setIsAuthenticated }: any) {
  const {loginWithGoogle} =useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Simulate API call
    setTimeout(() => {
      if (name && email && password) {
        localStorage.setItem("authToken", "mock-token-" + Date.now());
        setIsAuthenticated(true);
        navigate("/chat");
      } else {
        setError("Please fill in all fields");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="auth-page" style={{ height: "100vh", overflowY: "auto" }}>
      <AuthShowcase />
      <div className="auth-card glass-panel">
        <div className="auth-card__header">
          <div className="auth-logo">
            <Brain size={28} />
            <span>Anvik</span>
          </div>
          <h2>Create your workspace</h2>
          <p>Provision the Anvik personal agent for your team in minutes.</p>
          <div className="auth-pill-row">
            <span>Memory Graph</span>
            <span>Realtime Recall</span>
            <span>Agentic Orchestration</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-input-group">
            <label>
              <User size={18} />
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

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
              placeholder="Create a password"
              required
            />
          </div>

          <div className="auth-input-group">
            <label>
              <Lock size={18} />
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
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
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Signup;
