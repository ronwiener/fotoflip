import React, { useEffect, useState } from "react";

export default function LandingPage({ onEnter }) {
  // This state will trigger the animation 100ms after the page loads
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimated(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="landing-page-container">
      {/* 1. STICKY NAV */}
      <nav className="landing-nav">
        <div className="landing-logo">📸 PhotoFlip</div>
        <button onClick={onEnter} className="landing-login-btn">
          Sign In
        </button>
      </nav>

      <div className="landing-content">
        {/* 2. HERO SECTION */}
        <header className="landing-hero">
          <div className="hero-text">
            <span className="badge">Patent Pending Gesture UI</span>
            <h1>
              Photos with a <br />
              <span className="accent-text">Digital Backside.</span>
            </h1>
            <p>
              Stop losing the "Who, What, and Where." Flip your photos to write
              permanent memories, then drag them into custom folders.
            </p>
            <button onClick={onEnter} className="cta-button">
              Open My Gallery →
            </button>
          </div>

          <div className="demo-container">
            <div className="flip-card-group">
              <div className="flip-card-inner">
                <div className="flip-card-front">
                  <img
                    src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=500&q=80"
                    alt="Front"
                  />
                  <div className="touch-hint">Tap to Flip 🔄</div>
                </div>
                <div className="flip-card-back">
                  <div className="back-card-header">Memory Notes</div>
                  <p className="back-quote">
                    "Summer Lake Trip. The water was freezing but the sunset
                    made it worth it. Remember the extra blankets next time!"
                  </p>
                  <div className="back-card-footer">📍 Lake Tahoe, CA</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 3. THE "HOW TO" SECTION (With Trigger Logic) */}
        <section className="how-to-section">
          <h2>Master the Gestures</h2>
          <div className="how-to-grid">
            {/* The cards check the 'isAnimated' state to add the reveal class */}
            <div className={`how-to-card ${isAnimated ? "run-reveal" : ""}`}>
              <div className="gesture-icon">👆</div>
              <h3>Tap Front</h3>
              <p>Flip the photo to access your private notes and data.</p>
            </div>
            <div className={`how-to-card ${isAnimated ? "run-reveal" : ""}`}>
              <div className="gesture-icon">🤏</div>
              <h3>Long Press</h3>
              <p>Hold any photo for a split second to "lift" it for moving.</p>
            </div>
            <div className={`how-to-card ${isAnimated ? "run-reveal" : ""}`}>
              <div className="gesture-icon">📂</div>
              <h3>Drag & Drop</h3>
              <p>Move photos into folders or to the Trash with one motion.</p>
            </div>
          </div>
        </section>

        {/* 4. FEATURES SECTION */}
        <section className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">🎨</div>
            <h3>Pro Editor</h3>
            <p>Built-in filters and cropping tools for the perfect shot.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔍</div>
            <h3>Instant Search</h3>
            <p>Search your "back-of-photo" notes to find memories instantly.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🔒</div>
            <h3>Cloud Secure</h3>
            <p>Your gallery is synced to your private Supabase storage.</p>
          </div>
        </section>

        {/* 5. B2B / PRO SECTION */}
        <section className="business-pitch">
          <h2>Business Ready</h2>
          <p>
            Field inspections, real estate, and inventory. Snap, note, and
            export as a structured ZIP file for your records.
          </p>
          <button onClick={onEnter} className="outline-button">
            Get Started
          </button>
        </section>

        <footer className="landing-footer">
          <p>© 2026 PhotoFlip • Patent Pending Technology</p>
          <div className="footer-links">
            <span>Privacy Policy</span> • <span>Terms of Service</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
