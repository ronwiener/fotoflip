import React from "react";

export default function LandingPage({ onEnter }) {
  return (
    // Add "flex flex-col items-center overflow-y-auto"
    <div className="w-full bg-gray-50 text-gray-900 font-sans overflow-y-auto flex flex-col items-center">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-extrabold tracking-tighter text-indigo-600 flex items-center gap-2">
          📸 PhotoFlip
        </div>
        <button
          onClick={onEnter}
          className="bg-indigo-600 text-white px-5 py-2 rounded-full font-medium hover:bg-indigo-700 transition"
        >
          Login / Register
        </button>
      </nav>

      {/* Hero Section */}
      <header className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl lg:text-6xl font-black leading-tight mb-6">
            Your photos have a story. <br />
            <span className="text-indigo-600 italic">
              Give them a backside.
            </span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-lg">
            Write notes, technical specs, or memories directly onto your digital
            images. Just flip the card to see what's behind the moment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={onEnter}
              className="bg-indigo-600 text-white text-lg px-8 py-4 rounded-xl font-bold hover:shadow-xl transform hover:-translate-y-1 transition"
            >
              Start My Gallery →
            </button>
          </div>
        </div>

        {/* CSS Animation for Flip Demo */}
        <div className="flex justify-center">
          <div className="group w-72 h-96 [perspective:1000px] cursor-pointer">
            <div className="relative h-full w-full rounded-2xl shadow-2xl transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              {/* Front */}
              <div className="absolute inset-0">
                <img
                  src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=500&q=80"
                  alt="Front"
                  className="h-full w-full rounded-2xl object-cover shadow-xl"
                />
                <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm px-3 py-1 rounded text-sm font-bold">
                  Hover to Flip 🔄
                </div>
              </div>
              {/* Back */}
              <div className="absolute inset-0 h-full w-full rounded-2xl bg-indigo-50 p-8 [transform:rotateY(180deg)] [backface-visibility:hidden] border-4 border-white flex flex-col justify-center">
                <p className="text-indigo-600 font-black uppercase text-xs mb-2 tracking-widest">
                  Memory Notes
                </p>
                <p className="text-gray-800 text-lg italic leading-relaxed">
                  "Summer Lake Trip 2024. The water was freezing but the sunset
                  made it worth it. Remember to bring the extra blankets next
                  time!"
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-10">
            <div className="p-6">
              <div className="text-3xl mb-4">🎨</div>
              <h3 className="text-xl font-bold mb-2">Built-in Editor</h3>
              <p className="text-gray-600 text-sm">
                Crop, filter, and adjust your photos natively before filing them
                away.
              </p>
            </div>
            <div className="p-6">
              <div className="text-3xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">Searchable Notes</h3>
              <p className="text-gray-600 text-sm">
                Can't remember a date? Search your notes, not just your
                filenames.
              </p>
            </div>
            <div className="p-6">
              <div className="text-3xl mb-4">📦</div>
              <h3 className="text-xl font-bold mb-2">Portable Exports</h3>
              <p className="text-gray-600 text-sm">
                Download your gallery as a ZIP with an interactive offline
                viewer included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Business Pitch */}
      <section className="bg-indigo-900 text-white py-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Perfect for B2B & Professionals
          </h2>
          <p className="text-indigo-200 mb-8 max-w-2xl mx-auto">
            Use PhotoFlip for site inspections, inventory logging, or real
            estate cataloging. Secure your data with private cloud storage and
            instant ZIP documentation.
          </p>
          <button
            onClick={onEnter}
            className="border-2 border-indigo-400 hover:border-white px-8 py-3 rounded-lg font-bold transition"
          >
            Enter App
          </button>
        </div>
      </section>

      <footer className="py-10 text-center text-gray-400 text-xs">
        © 2025 PhotoFlip • Organized Memories • Secure Data
      </footer>
    </div>
  );
}
