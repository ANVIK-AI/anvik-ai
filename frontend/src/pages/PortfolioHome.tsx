import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ArrowRight, Menu, X, Zap, Shield, Database } from 'lucide-react';
import { Button } from '@/ui/design-system';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';

function PortfolioHome() {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { label: 'Product', href: '#product' },
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
  ];

  const features = [
    {
      icon: <Brain className="w-8 h-8 text-purple-400" />,
      title: "AI-Powered Intelligence",
      description: "Advanced cognitive models that understand context, nuance, and your personal preferences."
    },
    {
      icon: <Database className="w-8 h-8 text-pink-400" />,
      title: "Memory Graph",
      description: "A comprehensive knowledge base that grows with you, linking documents, chats, and ideas."
    },
    {
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      title: "Seamless Integration",
      description: "Connects effortlessly with your existing tools like Notion, Calendar, and Email."
    },
    {
      icon: <Shield className="w-8 h-8 text-green-400" />,
      title: "Enterprise Security",
      description: "Bank-grade encryption and privacy controls to keep your data safe and yours alone."
    }
  ];

  return (
    <div className="h-full bg-background text-foreground overflow-x-hidden overflow-y-auto selection:bg-primary/30 font-sans">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[128px] animate-pulse delay-1000" />
      </div>

      {/* Navigation */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${scrolled ? 'bg-background/80 backdrop-blur-md border-white/5 py-4' : 'bg-transparent border-transparent py-6'
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 blur-lg rounded-full" />
              <Brain className="w-8 h-8 text-white relative z-10" />
            </div>
            <span className="text-xl font-heading font-bold tracking-tight">ANVIK</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            {!isAuthenticated && (
              <Link to="/login">
                <Button variant="ghost" className="text-muted-foreground hover:text-white">Sign In</Button>
              </Link>
            )}
            <Link to={isAuthenticated ? '/chat' : '/signup'}>
              <Button variant="glow" className="rounded-full px-6">
                {isAuthenticated ? 'Launch App' : 'Get Started'}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-background/95 backdrop-blur-xl border-b border-white/10 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-4">
                {menuItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-lg font-medium text-white/80"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="h-px bg-white/10 my-2" />
                {!isAuthenticated && (
                  <Link to="/login" onClick={() => setMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Sign In</Button>
                  </Link>
                )}
                <Link to={isAuthenticated ? '/chat' : '/signup'} onClick={() => setMenuOpen(false)}>
                  <Button variant="glow" className="w-full">
                    {isAuthenticated ? 'Launch App' : 'Get Started'}
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-primary mb-8 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Introducing Anvik AI 2.0
            </div>

            <h1 className="text-5xl md:text-7xl font-heading font-bold leading-tight mb-8">
              Your AI isn't intelligent <br className="hidden md:block" />
              until it <span className="text-gradient-primary">remembers</span>.
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Anvik is the intelligent personal assistant that orchestrates your entire digital life.
              It connects your tools, remembers your context, and anticipates your needs.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" variant="glow" className="h-14 px-8 text-lg rounded-full w-full sm:w-auto">
                  Start for free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full w-full sm:w-auto border-white/10 hover:bg-white/5">
                  See how it works
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 relative bg-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">Unleash your potential</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to supercharge your productivity with AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="glass-card p-8 rounded-2xl hover:border-primary/30 transition-colors group"
              >
                <div className="mb-6 p-4 rounded-xl bg-white/5 w-fit group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="glass-panel p-12 md:p-20 rounded-3xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-50" />

            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
                Ready to transform your workflow?
              </h2>
              <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
                Join thousands of forward-thinking users who trust Anvik to organize their digital universe.
              </p>
              <Link to="/signup">
                <Button size="lg" variant="default" className="h-14 px-10 text-lg rounded-full shadow-[0_0_40px_rgba(124,58,237,0.5)]">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-white/50">
            <Brain className="w-5 h-5" />
            <span className="font-bold tracking-wider">ANVIK</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Anvik AI. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PortfolioHome;
