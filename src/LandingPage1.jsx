import React, { useEffect, useState } from "react";
import heroImage from "../assets/hero-lake.jpg";

const LandingPage = ({ onEnter }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPrivacyOpen, setPrivacyOpen] = useState(false);

  // 1. Auto-open privacy modal if URL contains '#privacy' on load or hash change
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#privacy") {
        setPrivacyOpen(true);
      }
    };

    // Check immediately on initial load
    handleHashChange();

    // Listen for hash changes if the user navigates back/forward
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // 2. Card reveal effect timer
  useEffect(() => {
    const timer = setTimeout(() => {
      const cards = document.querySelectorAll(".how-to-card");
      cards.forEach((card) => card.classList.add("run-reveal"));
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  // 3. Updated toggle function to sync state with URL hash
  const togglePrivacy = () => {
    if (!isPrivacyOpen) {
      window.location.hash = "privacy";
      setPrivacyOpen(true);
    } else {
      // Clear hash cleanly without triggering a full page reload
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search,
      );
      setPrivacyOpen(false);
    }
  };

  return (
    <div className="landing-page-container">
      <nav className="landing-nav">
        <div className="landing-logo">PhotoFlip</div>
        <button className="landing-login-btn" onClick={onEnter}>
          Get Started
        </button>
      </nav>

      <div className="landing-scroll-area">
        <div className="landing-content">
          <section className="landing-hero">
            <div className="hero-text">
              <h1>
                Your photos have a story. <br />
                <span className="accent-text">Give them a flip side.</span>
              </h1>
              <p>
                Flip any photo to write names, dates, and notes that stay with
                the image forever.
              </p>
            </div>

            <div className="demo-container">
              <div
                className="flip-card-group"
                role="button"
                tabIndex="0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(!isFlipped);
                }}
              >
                <div
                  className={`flip-card-inner ${isFlipped ? "is-flipped" : ""}`}
                >
                  <div className="flip-card-front">
                    <img
                      src={heroImage}
                      alt="Demo Front"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>

                  <div className="flip-card-back">
                    <p className="back-quote">
                      Sam and Michael boating in the Canadian Rockies. June 2025
                    </p>
                    <div className="touch-hint">Tap to Flip Back</div>
                  </div>
                </div>
                {!isFlipped && (
                  <div className="touch-hint-external">
                    Tap on Image to Flip
                  </div>
                )}
                {isFlipped && (
                  <div className="touch-hint-external">
                    Everything you write here is instantly searchable.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="how-to-section">
            <h2>Your photos organized and searchable</h2>
            <div className="how-to-grid">
              <div className="how-to-card">
                <div className="gesture-icon">🔍</div>
                <h3>Power Search</h3>
                <p>
                  No more scrolling through thousands of photos. You can now
                  search for names, dates, places or other details written on
                  the backside of your photos to find them quickly.
                </p>
              </div>
              <div className="how-to-card">
                <span className="gesture-icon">📁</span>
                <h3>Smart Folders</h3>
                <p>
                  Create custom folders for vacations, events, or family
                  history. Just drag and drop to clear the clutter from your
                  main gallery.
                </p>
              </div>

              <div className="how-to-card">
                <div className="gesture-icon">🪄</div>
                <h3>Editing Feature</h3>
                <p>
                  Forgot to edit a photo? Crop, filter, and fine-tune your
                  photos here before you archive them.
                </p>
              </div>
            </div>
          </section>

          <footer className="landing-footer">
            <p>&copy; 2026 PhotoFlip App. All rights reserved.</p>

            <div className="footer-links">
              <span>PATENT PENDING</span>
              <span className="footer-divider"> | </span>
              <button className="footer-link-btn" onClick={togglePrivacy}>
                Privacy Policy
              </button>
            </div>

            <div className="footer-contact">
              <a href="mailto:photoflipsupport@gmail.com?subject=Photo%20Flip%20Support">
                Contact Support
              </a>
            </div>
            <p className="version-text">v1.0.0</p>

            {isPrivacyOpen && (
              <div className="modal-overlay" onClick={togglePrivacy}>
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h2>Privacy Policy</h2>
                  </div>

                  <div className="modal-body">
                    <h1>Privacy Policy for Photo Flip</h1>
                    <div className="last-updated">
                      <strong>Last Updated:</strong> April 20, 2026
                    </div>

                    <h2>1. Introduction</h2>
                    <p>
                      Welcome to Photo Flip. We are committed to protecting your
                      personal information and your right to privacy. This
                      Privacy Policy explains how we collect, use, and safeguard
                      your data when you use our mobile application.
                    </p>

                    <h2>2. Data We Collect</h2>
                    <ul>
                      <li>
                        <strong>Account Information:</strong> When you create an
                        account via Email or "Sign in with Apple," we collect
                        your email address and name to create and manage your
                        account.
                      </li>
                      <li>
                        <strong>User Content:</strong> We store the photos you
                        upload and the notes you write (the "flips") to ensure
                        they are available to you across your devices.
                      </li>
                      <li>
                        <strong>Usage Data:</strong> We may collect minimal
                        technical data (e.g., device type and app version) to
                        help us troubleshoot bugs and improve performance.
                      </li>
                    </ul>

                    <h2>3. How We Use Your Data</h2>
                    <p>
                      We use your data solely to provide the core services of
                      Photo Flip, including:
                    </p>
                    <ul>
                      <li>Authenticating your identity.</li>
                      <li>
                        Storing and retrieving your personal photo gallery and
                        notes via our secure backend (Supabase).
                      </li>
                      <li>Providing customer support when requested.</li>
                    </ul>
                    <p>
                      <strong>
                        We do not sell your data to third parties or use your
                        photos for advertising.
                      </strong>
                    </p>

                    <h2>4. Data Storage and Security</h2>
                    <p>
                      Your data is stored securely using Supabase cloud
                      services. We implement industry-standard security measures
                      to protect your information. Your photos remain your
                      property, and we do not access them unless required for
                      technical support requested by you.
                    </p>

                    <h2>5. Your Rights and Data Deletion</h2>
                    <p>
                      You have the right to access, modify, or delete your
                      personal data.
                    </p>
                    <ul>
                      <li>
                        <strong>Account Deletion:</strong> You may delete your
                        account and all associated data (photos and notes)
                        directly within the App Settings or by contacting us at{" "}
                        <a href="mailto:photoflipsupport@gmail.com">
                          photoflipsupport@gmail.com
                        </a>
                        .
                      </li>
                      <li>
                        <strong>Apple Sign-In:</strong> You can manage or revoke
                        app access through your Apple ID settings.
                      </li>
                    </ul>

                    <h2>6. Contact Us</h2>
                    <div className="contact">
                      <p>
                        If you have any questions about this Privacy Policy,
                        please contact us at:
                      </p>
                      <p>
                        <strong>Email:</strong>{" "}
                        <a href="mailto:photoflipsupport@gmail.com">
                          photoflipsupport@gmail.com
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button className="confirm-btn" onClick={togglePrivacy}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
};
export default LandingPage;
