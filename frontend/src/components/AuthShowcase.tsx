import { ArrowUpRight, Shield, Sparkles, Zap } from "lucide-react";

const navLinks = ["Product", "Use cases", "Pricing", "Docs", "Company"];

const metrics = [
  { value: "12k+", label: "Builders" },
  { value: "50M", label: "Tokens / user" },
  { value: " <300 ms", label: "Recall latency" },
];

const callouts = [
  "Self-healing memory graph",
  // "Cloudflare Durable Objects",
  "Semantic + keyword recall",
  "Postgres vector engine",
];

const partnerLogos = ["LDN", "YTQ", "SOLA", "QBIT", "ARC"];

function AuthShowcase({}: any) {
  return (
    <section className="hero-shell">
      <div className="hero-glow hero-glow--primary" />
      <div className="hero-glow hero-glow--secondary" />
      <header className="hero-nav">
        <div className="hero-logo">
          <span>Anvik</span>
          <small>AI Personal Agent</small>
        </div>
        <nav>
          {navLinks.map((link) => (
            <a key={link} href="#">
              {link}
            </a>
          ))}
        </nav>
        <button className="hero-nav__cta">
          Launch Console <ArrowUpRight size={16} />
        </button>
      </header>

      <div className="hero-body">
        {/* <p className="hero-eyebrow">Inspired by Buttermax</p> */}
        <h1>
          Intelligence without memory is randomness. Make it unforgettable.
        </h1>
        <p>
          AI systems lose context as user data evolves.Vector databases fail to
          track relationships.
        </p>
        <p>
          RAGs retrieve knowledge but can’t remember. Try Anvik AI's
          personalization memory API.
        </p>
        <div className="hero-cta-row">
          <button className="hero-primary">Get started</button>
          <button className="hero-secondary">
            Watch demo <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="hero-callouts">
          {callouts.map((copy) => (
            <span key={copy}>
              <Sparkles size={14} /> {copy}
            </span>
          ))}
        </div>
      </div>

      <div className="hero-panels">
        <div className="hero-panel glass-panel">
          <Shield size={32} />
          <p>
            Memories update, expire, and self-heal so your agents stay
            human-like.
          </p>
        </div>
        <div className="hero-panel glass-panel">
          <Zap size={32} />
          <p>
            Recall from chats, docs, and events with butter-smooth{" "}
            <strong>&lt;300ms</strong> latency.
          </p>
        </div>
      </div>

      <div className="hero-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="hero-metric glass-panel">
            <p className="metric-value">{metric.value}</p>
            <p className="metric-label">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="hero-logos glass-panel">
        {partnerLogos.map((logo) => (
          <span key={logo}>{logo}</span>
        ))}
      </div>
    </section>
  );
}

export default AuthShowcase;
