import React from "react";

export default function LandingPage({ onEnter }) {
  return (
    <div className="landing-page-container">
      <div className="landing-content">
        {/* Navigation */}
        <nav className="landing-nav">
          <div className="landing-logo">📸 PhotoFlip</div>
          <button onClick={onEnter} className="landing-login-btn">
            Login / Register
          </button>
        </nav>

        {/* Hero Section */}
        <header className="landing-hero">
          <div className="hero-text">
            <h1>
              Your photos have a story. <br />
              <span className="accent-text">Give them a flip side.</span>
            </h1>
            <p>
              Write notes, dates, locations or memories directly onto your
              digital images. Just flip the image to see what's behind the
              moment.
            </p>
            <button onClick={onEnter} className="cta-button">
              Start My Gallery →
            </button>
          </div>

          {/* Flip Demo */}
          <div className="demo-container">
            <div className="flip-card-group">
              <div className="flip-card-inner">
                {/* Front */}
                <div className="flip-card-front">
                  <img
                    src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=500&q=80"
                    alt="Front"
                  />
                  <div className="hover-hint">Hover to Flip 🔄</div>
                </div>
                {/* Back */}
                <div className="flip-card-back">
                  <p className="back-label">Memory Notes</p>
                  <p className="back-quote">
                    "Summer Lake Trip 2024. The water was freezing but the
                    sunset made it worth it. Remember the extra blankets next
                    time!"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">🎨</div>
            <h3>Built-in Editor</h3>
            <p>Crop, filter, and adjust photos before filing them.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔍</div>
            <h3>Searchable Notes</h3>
            <p>
              Search your notes directly to find specific memories or dates.
            </p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">📦</div>
            <h3>Portable Exports</h3>
            <p>
              Download your gallery as a ZIP file with an offline viewer
              included.
            </p>
          </div>
        </section>

        {/* Business Section */}
        <section className="business-pitch">
          <h2>Perfect for B2B & Professionals</h2>
          <p>
            Use PhotoFlip for site inspections, inventory logging, or real
            estate. Secure data with private cloud storage and instant ZIPs.
          </p>
          <button onClick={onEnter} className="outline-button">
            Enter App
          </button>
        </section>

        <footer className="landing-footer">
          © 2025 PhotoFlip • Organized Memories • Secure Data
        </footer>
      </div>
    </div>
  );
}
