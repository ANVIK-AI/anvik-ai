import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ArrowRight, Menu, X } from 'lucide-react';
import PortfolioBackground from '../ui/components/PortfolioBackground';
import LoadingScreen from '../ui/components/LoadingScreen';
import './PortfolioHome.css';
import { useAuth } from '@/context/AuthContext';

function PortfolioHome() {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLoadingComplete = () => {
    setLoading(false);
  };

  const menuItems = [
    { label: 'Product', href: '#product' },
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ];


  return (
    <>
      {loading && <LoadingScreen onComplete={handleLoadingComplete} />}
      <div className={`portfolio-home ${loading ? 'loading' : 'loaded'}`}>
        <PortfolioBackground />

        {/* Navigation */}
        <nav className="portfolio-nav">
          <div className="nav-logo">
            <Brain size={24} />
            <span>ANVIK</span>
          </div>
          <div className={`nav-menu ${menuOpen ? 'open' : ''}`}>
            {menuItems.map((item, index) => (
              <a
                key={index}
                href={item.href}
                className="nav-item"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            {
              !isAuthenticated &&  (
                <Link to="/login" className="nav-link">
              Sign In
            </Link>
              ) 
            }
            
            <Link to={ isAuthenticated ? '/chat': '/signin'} className="nav-button">
              Get Started
              <ArrowRight size={16} />
            </Link>
          </div>
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Main Content */}
        <main className="portfolio-main">
          <div className="hero-section">
            <div className="hero-number">01</div>
            <h1 className="hero-title">
              <span className="line">Your AI isn't</span>
              <span className="line">intelligent until</span>
              <span className="line highlight">it remembers</span>
            </h1>
            <p className="hero-description">
              Anvik is your intelligent personal assistant that remembers everything, connects to
              your tools, and orchestrates your entire workflow.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="cta-primary">
                Get Started
                <ArrowRight size={20} />
              </Link>
              <Link to="/login" className="cta-secondary">
                Sign In
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <section className="features-section" id="features">
            <div className="section-number">02</div>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-number">01</div>
                <h3 className="feature-title">AI-Powered</h3>
                <p className="feature-description">
                  Advanced AI that understands context and remembers your preferences.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-number">02</div>
                <h3 className="feature-title">Memory Graph</h3>
                <p className="feature-description">
                  Upload documents, chat history, and build a comprehensive knowledge base.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-number">03</div>
                <h3 className="feature-title">Tool Integration</h3>
                <p className="feature-description">
                  Connect with Calendar, Notion, and Email. Manage your entire workflow.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-number">04</div>
                <h3 className="feature-title">Secure & Private</h3>
                <p className="feature-description">
                  Enterprise-grade security with encrypted storage. Your data stays protected.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="cta-section">
            <div className="cta-content">
              <h2 className="cta-title">Ready to get started?</h2>
              <p className="cta-description">
                Join thousands of users who are already using Anvik to boost their productivity.
              </p>
              <Link to="/signup" className="cta-primary large">
                Create Your Account
                <ArrowRight size={20} />
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="portfolio-footer">
          <div className="footer-content">
            <div className="footer-logo">
              <Brain size={20} />
              <span>ANVIK</span>
            </div>
            <div className="footer-links">
              <a href="#product">Product</a>
              <a href="#features">Features</a>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="footer-copyright">
              © {new Date().getFullYear()} ANVIK. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default PortfolioHome;
