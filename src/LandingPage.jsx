import React, { useEffect, useState, useRef } from "react";
import heroImage from "../assets/hero-lake.jpg";

const LandingPage = ({ onEnter }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPrivacyOpen, setPrivacyOpen] = useState(false);

  // Audio Playback & Real-time Highlight States
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [progress, setProgress] = useState(0);

  const heroQuote =
    "Sam and Michael boating in the Canadian Rockies. June 2025";
  const words = heroQuote.split(" ");
  const utteranceRef = useRef(null);

  // Clean up speech synthesis if component unmounts
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-to-Speech Handler
  const handleTogglePlay = (e) => {
    e.stopPropagation(); // Prevents flipping the card when clicking the audio pill

    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setHighlightIndex(-1);
      setProgress(0);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(heroQuote);
    utteranceRef.current = utterance;
    utterance.rate = 0.95;

    // Real-time word boundary tracking for highlighting & progress bar
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        const charIndex = event.charIndex;
        let currentLength = 0;
        let wordIdx = 0;

        for (let i = 0; i < words.length; i++) {
          if (
            charIndex >= currentLength &&
            charIndex < currentLength + words[i].length + 1
          ) {
            wordIdx = i;
            break;
          }
          currentLength += words[i].length + 1; // +1 accounts for space separator
        }

        setHighlightIndex(wordIdx);
        setProgress(Math.round(((wordIdx + 1) / words.length) * 100));
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setHighlightIndex(-1);
      setProgress(0);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setHighlightIndex(-1);
      setProgress(0);
    };

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  // Stop playback when card flips
  const handleCardFlip = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setHighlightIndex(-1);
      setProgress(0);
    }
    setIsFlipped(!isFlipped);
  };

  // 1. Auto-open privacy modal if URL contains '#privacy' on load or hash change
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#privacy") {
        setPrivacyOpen(true);
      }
    };

    handleHashChange();
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

  // 3. Toggle function to sync state with URL hash
  const togglePrivacy = () => {
    if (!isPrivacyOpen) {
      window.location.hash = "privacy";
      setPrivacyOpen(true);
    } else {
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
                Flip any photo to write, dictate, and listen to notes that stay
                with your images forever.
              </p>
            </div>

            <div className="demo-container">
              <div
                className="flip-card-group"
                role="button"
                tabIndex="0"
                onClick={handleCardFlip}
              >
                <div
                  className={`flip-card-inner ${isFlipped ? "is-flipped" : ""}`}
                >
                  {/* FRONT SIDE (With Image and Audio Playback Pill Overlay) */}
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

                    {/* Playback Overlay Control on Card Front */}
                    <div
                      className="card-audio-container front-overlay"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`card-audio-pill ${
                          isPlaying ? "playing" : ""
                        }`}
                        onClick={handleTogglePlay}
                        aria-label={
                          isPlaying ? "Stop listening" : "Listen to note"
                        }
                      >
                        <span className="pill-icon">
                          {isPlaying ? "⏹" : "🔊"}
                        </span>
                        <span className="pill-text">
                          {isPlaying ? "Playing" : "Listen"}
                        </span>
                      </button>

                      {isPlaying && (
                        <div className="audio-progress-bar-bg">
                          <div
                            className="audio-progress-bar-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BACK SIDE (Text Note with Word Highlighting) */}
                  <div className="flip-card-back">
                    <p className="back-quote">
                      {words.map((word, index) => (
                        <span
                          key={index}
                          className={`quote-word ${
                            index === highlightIndex ? "highlighted-word" : ""
                          }`}
                        >
                          {word}{" "}
                        </span>
                      ))}
                    </p>

                    <div className="touch-hint">Tap anywhere to Flip Back</div>
                  </div>
                </div>

                {!isFlipped && (
                  <div className="touch-hint-external">
                    Tap Listen to play note or tap Image to Flip
                  </div>
                )}
                {isFlipped && (
                  <div className="touch-hint-external">
                    Everything you write or dictate is instantly searchable.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="how-to-section">
            <h2>Your photos organized, searchable, and note recordable</h2>
            <div className="how-to-grid">
              <div className="how-to-card">
                <div className="gesture-icon">🎙️</div>
                <h3>Note Writing or Voice Dictation</h3>
                <p>
                  Upload a photo, tap to flip for note writing or highlight it,
                  tap the microphone, and record your memories.
                </p>
              </div>

              <div className="how-to-card">
                <div className="gesture-icon">🔊</div>
                <h3>Audio Listen & Playback</h3>
                <p>
                  All notes are audible. Tap the play button and listen to your
                  memories.
                </p>
              </div>

              <div className="how-to-card">
                <div className="gesture-icon">🔍</div>
                <h3>Power Search</h3>
                <p>
                  No more scrolling through thousands of photos. Search for
                  names, dates, places, or any detail written on the flip side
                  of your photos.
                </p>
              </div>

              <div className="how-to-card">
                <span className="gesture-icon">📁</span>
                <h3>Smart Folders</h3>
                <p>
                  Create custom folders for vacations, events, or family
                  history. Easily drag and drop to organize your gallery.
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
                      <strong>Last Updated:</strong> September 24, 2026
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
                        your email address and name to manage your account.
                      </li>
                      <li>
                        <strong>User Content & Notes:</strong> We store the
                        photos you upload, written notes, and dictated
                        transcripts (the "flips") to ensure they are accessible
                        across your devices.
                      </li>
                      <li>
                        <strong>Voice & Speech Data:</strong> When you use voice
                        dictation, your speech is processed locally or via
                        standard on-device speech recognition. Audio recordings
                        are converted to text and are not stored as raw audio
                        files on our servers.
                      </li>
                      <li>
                        <strong>Usage Data:</strong> Minimal technical metrics
                        (e.g., device model, OS version) are used to fix bugs
                        and maintain performance.
                      </li>
                    </ul>

                    <h2>3. How We Use Your Data</h2>
                    <p>
                      We use your data solely to deliver Photo Flip services,
                      including:
                    </p>
                    <ul>
                      <li>Authenticating your user account.</li>
                      <li>
                        Storing and syncing your photo galleries and notes via
                        secure backend services (Supabase).
                      </li>
                      <li>
                        Providing voice transcription and playback capabilities.
                      </li>
                      <li>Responding to customer support inquiries.</li>
                    </ul>
                    <p>
                      <strong>
                        We do not sell your data, speech data, or photos to
                        third parties or advertisers.
                      </strong>
                    </p>

                    <h2>4. Data Storage and Security</h2>
                    <p>
                      Your data is stored securely using Supabase cloud
                      infrastructure. We employ industry-standard encryption to
                      safeguard your information. Your photos and notes remain
                      strictly your property.
                    </p>

                    <h2>5. Your Rights and Data Deletion</h2>
                    <p>
                      You retain full ownership and control of your personal
                      data.
                    </p>
                    <ul>
                      <li>
                        <strong>Account Deletion:</strong> You can delete your
                        account and all associated cards, notes, and photos in
                        App Settings or by contacting{" "}
                        <a href="mailto:photoflipsupport@gmail.com">
                          photoflipsupport@gmail.com
                        </a>
                        .
                      </li>
                      <li>
                        <strong>Apple Sign-In:</strong> Manage permissions
                        directly in your Apple ID settings.
                      </li>
                    </ul>

                    <h2>6. Contact Us</h2>
                    <div className="contact">
                      <p>For any privacy inquiries, reach out to us at:</p>
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
