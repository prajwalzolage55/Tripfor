'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import {
  Menu,
  X,
  Plane,
  Clock,
  ShieldCheck,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  ArrowRight,
  Receipt,
  PiggyBank,
  Globe,
  Sparkles,
  CloudSun,
} from 'lucide-react';
import Link from 'next/link';

// Brand Color Palette Tokens
const COLORS = {
  burgundy: '#791523',
  darkBurgundy: '#4a071b',
  cream: '#eadecd',
  offWhite: '#fdfbfa',
  rose: '#d05461',
  surfaceGold: '#c59362',
};

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'group' | 'weekend'>('group');
  const [plannerSubmitted, setPlannerSubmitted] = useState(false);

  // Quick Trip Planning Form State
  const [tripDetails, setTripDetails] = useState({
    origin: 'Mumbai',
    destination: 'Goa',
    date: '2026-10-15',
    travelers: '4',
    tripType: 'Coastal Explorer',
  });

  const handlePlannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPlannerSubmitted(true);
    setTimeout(() => {
      setPlannerSubmitted(false);
      setPlannerModalOpen(false);
      if (user) {
        router.push('/hub');
      } else {
        router.push('/login');
      }
    }, 1800);
  };

  return (
    <ReactLenis root>
      <div
        className="min-h-screen font-['Inter',sans-serif] antialiased selection:bg-[#791523] selection:text-white"
        style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}
      >
        {/* ── HERO SECTION WITH FULLSCREEN BACKGROUND VIDEO MATCHING BRAND PALETTE ── */}
        <section className="relative h-screen overflow-hidden">
          {/* Background Video */}
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
            style={{
              filter: 'contrast(1.06) saturate(1.18) sepia(0.12) hue-rotate(-6deg)',
            }}
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_091828_e240eb17-6edc-4129-ad9d-98678e3fd238.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>

          {/* Color Palette Overlay 1: Warm Burgundy Tonal Grade Wash */}
          <div
            className="absolute inset-0 z-[1] mix-blend-color pointer-events-none opacity-40"
            style={{ backgroundColor: COLORS.burgundy }}
          />

          {/* Color Palette Overlay 2: Soft Gradient from Deep Wine to Warm Off-White Surface */}
          <div
            className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-b from-[#4a071b]/45 via-black/20 to-[#fdfbfa]"
          />

          {/* Foreground Content Wrapper */}
          <div className="relative z-10 h-full flex flex-col justify-between">
            {/* ── Top Navigation Bar ── */}
            <header className="w-full">
              <nav className="max-w-7xl mx-auto px-6 md:px-8 py-6 flex items-center justify-between">
                {/* Brand Logo */}
                <Link
                  href="/"
                  className="flex items-center gap-2.5 transition-transform hover:scale-105"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: COLORS.burgundy }}
                  >
                    <Plane className="w-4 h-4 text-white" />
                  </div>
                  <span
                    className="text-2xl font-black tracking-tight"
                    style={{ color: COLORS.burgundy }}
                  >
                    TriFork
                  </span>
                </Link>


                {/* Right CTA Actions */}
                <div className="hidden md:flex items-center space-x-4">
                  {!loading && (
                    <>
                      {user ? (
                        <Link
                          href="/hub"
                          className="px-5 py-2.5 rounded-full font-bold text-sm text-white transition-all hover:scale-105 shadow-md flex items-center gap-1.5"
                          style={{ backgroundColor: COLORS.burgundy }}
                        >
                          <span>Dashboard</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <>
                          <Link
                            href="/login"
                            className="px-4 py-2 rounded-full font-semibold text-sm transition-colors hover:bg-black/5"
                            style={{ color: COLORS.burgundy }}
                          >
                            Sign In
                          </Link>
                          <Link
                            href="/login"
                            className="px-5 py-2.5 rounded-full text-white font-bold text-sm transition-transform hover:scale-105 shadow-lg flex items-center gap-1.5"
                            style={{ backgroundColor: COLORS.burgundy }}
                          >
                            <span>Get Started</span>
                          </Link>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Mobile Menu Hamburger */}
                <div className="md:hidden">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-stone-900 focus:outline-none rounded-lg"
                    aria-label="Toggle Navigation Menu"
                  >
                    {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
                  </button>
                </div>
              </nav>

              {/* Mobile Menu Dropdown */}
              {mobileMenuOpen && (
                <div className="md:hidden px-6 pt-2 pb-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-stone-200 flex flex-col space-y-4">
                    {['Start', 'Features', 'Live Weather', 'Ledger', 'Story'].map(item => (
                      <a
                        key={item}
                        href={`#${item.toLowerCase().replace(/\s+/g, '')}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-stone-800 font-bold hover:text-[#791523] transition-colors py-2 px-3 rounded-lg hover:bg-stone-50"
                      >
                        {item}
                      </a>
                    ))}
                    <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
                      <Link
                        href={user ? '/hub' : '/login'}
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-3 rounded-full text-white font-bold text-center shadow-md"
                        style={{ backgroundColor: COLORS.burgundy }}
                      >
                        {user ? 'Go to Dashboard' : 'Start Planning'}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </header>

            {/* ── Main Hero Center Content (Overlapping Two-Line Heading) ── */}
            <main id="start" className="flex-1 flex items-center justify-center text-center px-4 -mt-16 md:-mt-24 lg:-mt-28">
              <div className="max-w-4xl mx-auto flex flex-col items-center">
                {/* Brand Badge */}
                <span
                  className="text-xs md:text-sm font-extrabold tracking-widest uppercase mb-4 px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md"
                  style={{
                    backgroundColor: `${COLORS.cream}80`,
                    borderColor: `${COLORS.surfaceGold}60`,
                    color: COLORS.burgundy,
                  }}
                >
                  SMART GROUP EXPEDITIONS
                </span>

                {/* Overlapping Two-Line Heading Styled with Brand Palette */}
                <div className="flex flex-col items-center justify-center mb-5 select-none">
                  <h1 className="text-6xl md:text-7xl lg:text-9xl font-light text-stone-500/90 leading-none tracking-tighter">
                    Split Expenses
                  </h1>
                  <h2
                    className="text-6xl md:text-7xl lg:text-9xl font-black leading-none tracking-tighter -mt-3 md:-mt-6 lg:-mt-8"
                    style={{ color: COLORS.burgundy }}
                  >
                    Not Vibes.
                  </h2>
                </div>

                {/* Subtitle */}
                <p className="text-base md:text-xl text-stone-700 mb-8 max-w-2xl font-medium leading-relaxed">
                  AI-driven financial ledgers, 3D Cesium travel globes, and live weather twins for your group journeys.
                </p>
              </div>
            </main>

            {/* Bottom Spacer / Arrow Indicator */}
            <div className="pb-8 flex justify-center">
              <div className="w-6 h-10 rounded-full border-2 border-stone-400/50 flex items-start justify-center p-1">
                <div className="w-1.5 h-3 rounded-full bg-stone-500 animate-bounce" />
              </div>
            </div>
          </div>
        </section>

        {/* ── INTERACTIVE QUICK FEATURES BAR ── */}
        <section id="features" className="bg-white py-16 border-b border-stone-200/70">
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-start space-x-4 p-5 rounded-2xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-200/60">
                <div
                  className="p-3.5 rounded-xl text-white shadow-md flex-shrink-0"
                  style={{ backgroundColor: COLORS.burgundy }}
                >
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">Automated Ledgers</h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    Zero manual arithmetic. Our ledger algorithm computes exact balances and eliminates debt cycles automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-5 rounded-2xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-200/60">
                <div
                  className="p-3.5 rounded-xl text-white shadow-md flex-shrink-0"
                  style={{ backgroundColor: COLORS.rose }}
                >
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">Cesium 3D Globe</h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    Interactive 3D geospatial itinerary planning. High-resolution terrain, 3D waypoint droplines, and glowing transit corridors.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-5 rounded-2xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-200/60">
                <div
                  className="p-3.5 rounded-xl text-white shadow-md flex-shrink-0"
                  style={{ backgroundColor: COLORS.darkBurgundy }}
                >
                  <CloudSun className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-lg mb-1">OpenWeather Digital Twin</h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    Live meteorological telemetries, Doppler radar tiles, and predictive cascade delay impacts for every destination stop.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── EXPEDITION ARCHITECTURE (FEATURE SHOWCASE) ── */}
        <section id="ledger" className="py-28 px-6" style={{ backgroundColor: COLORS.cream }}>
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              className="text-center mb-20"
            >
              <span
                className="text-xs font-black uppercase tracking-widest px-3.5 py-1 rounded-full border mb-4 inline-block shadow-sm"
                style={{
                  backgroundColor: COLORS.offWhite,
                  borderColor: `${COLORS.burgundy}30`,
                  color: COLORS.burgundy,
                }}
              >
                COLLABORATIVE PLATFORM
              </span>
              <h2
                className="text-4xl md:text-6xl font-black tracking-tight mb-5"
                style={{ color: COLORS.burgundy }}
              >
                Designed for Effortless Journeys.
              </h2>
              <p className="text-lg md:text-xl max-w-2xl mx-auto text-stone-700 font-medium">
                From spontaneous weekend road trips to global luxury flights, TriFork streamlines settlements, routing, and environmental resilience.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div
                className="p-8 rounded-[2rem] shadow-xl hover:-translate-y-2 transition-transform duration-500 border border-stone-200/70"
                style={{ backgroundColor: COLORS.offWhite }}
              >
                <div
                  className="mb-6 p-4 rounded-2xl inline-block"
                  style={{ backgroundColor: COLORS.cream }}
                >
                  <Receipt className="w-8 h-8" style={{ color: COLORS.rose }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: COLORS.burgundy }}>
                  Intelligent Splitting
                </h3>
                <p className="text-stone-600 leading-relaxed text-sm">
                  Shapley value allocations, itemized splits, and proportional consumption. Fair, crystal-clear, and verifiable.
                </p>
              </div>

              <div
                className="p-8 rounded-[2rem] shadow-xl hover:-translate-y-2 transition-transform duration-500 border border-stone-200/70"
                style={{ backgroundColor: COLORS.offWhite }}
              >
                <div
                  className="mb-6 p-4 rounded-2xl inline-block"
                  style={{ backgroundColor: COLORS.cream }}
                >
                  <PiggyBank className="w-8 h-8" style={{ color: COLORS.burgundy }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: COLORS.burgundy }}>
                  Minimal Settlements
                </h3>
                <p className="text-stone-600 leading-relaxed text-sm">
                  Graph optimization reduces 50 random peer-to-peer transfers down to just 3 clean settlements. One-click UPI settlement.
                </p>
              </div>

              <div
                id="weather"
                className="p-8 rounded-[2rem] shadow-xl hover:-translate-y-2 transition-transform duration-500 border border-stone-200/70"
                style={{ backgroundColor: COLORS.offWhite }}
              >
                <div
                  className="mb-6 p-4 rounded-2xl inline-block"
                  style={{ backgroundColor: COLORS.cream }}
                >
                  <Globe className="w-8 h-8" style={{ color: COLORS.surfaceGold }} />
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ color: COLORS.burgundy }}>
                  3D Spatial Itinerary
                </h3>
                <p className="text-stone-600 leading-relaxed text-sm">
                  Explore stops on a Cesium 3D Globe with OpenWeather live radar tiles, social signals, and transit buffers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CALL TO ACTION SECTION ── */}
        <section id="story" className="relative h-[70vh] w-full overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 w-full h-full">
            <img
              src="https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2000&auto=format&fit=crop"
              alt="Luxury Destination"
              className="w-full h-full object-cover"
            />
            {/* Palette Tonal Overlay */}
            <div
              className="absolute inset-0 opacity-70 mix-blend-multiply"
              style={{ backgroundColor: COLORS.burgundy }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative z-10 text-center text-white px-4 max-w-3xl mx-auto"
          >
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              READY TO EXPLORE?
            </h2>
            <p className="text-lg md:text-xl text-stone-200 mb-8 font-medium">
              Start planning your next group adventure today. Invite friends, map stops, and split expenses seamlessly.
            </p>
            <Link
              href={user ? '/hub' : '/login'}
              className="inline-flex items-center gap-2 px-9 py-4 text-lg font-bold rounded-full transition-transform hover:scale-105 shadow-2xl text-white"
              style={{ backgroundColor: COLORS.rose }}
            >
              <span>{user ? 'Go to My Trips' : 'Create Free Account'}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </section>

        {/* ── FOOTER ── */}
        <footer
          className="py-12 px-8 text-center border-t border-stone-200"
          style={{ backgroundColor: COLORS.burgundy, color: COLORS.cream }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <Plane className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">TriFork</span>
            </div>
            <p className="text-xs opacity-75">
              © 2026 TriFork. Built for the modern traveler. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-xs font-semibold">
              <Link href="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/hub" className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <a href="#features" className="hover:text-white transition-colors">
                Features
              </a>
            </div>
          </div>
        </footer>

        {/* ── INTERACTIVE TRIP PLANNER MODAL (PALETTE HARMONIZED) ── */}
        {plannerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden border border-stone-100">
              {/* Close Button */}
              <button
                onClick={() => setPlannerModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              {plannerSubmitted ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-2 animate-bounce"
                    style={{ backgroundColor: `${COLORS.rose}20`, color: COLORS.rose }}
                  >
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900">Trip Workspace Prepared!</h3>
                  <p className="text-stone-600 max-w-xs text-sm">
                    Connecting to your group ledger and 3D itinerary center...
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <span
                      className="text-xs font-bold uppercase tracking-wider block mb-1"
                      style={{ color: COLORS.rose }}
                    >
                      TriFork Expedition Planner
                    </span>
                    <h3 className="text-2xl font-black" style={{ color: COLORS.burgundy }}>
                      Start Your Journey
                    </h3>
                  </div>

                  {/* Tab Switcher */}
                  <div className="flex bg-stone-100 p-1 rounded-xl mb-6">
                    <button
                      onClick={() => setActiveTab('group')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'group'
                        ? 'bg-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                        }`}
                      style={{ color: activeTab === 'group' ? COLORS.burgundy : undefined }}
                    >
                      Group Trip
                    </button>
                    <button
                      onClick={() => setActiveTab('weekend')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'weekend'
                        ? 'bg-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-800'
                        }`}
                      style={{ color: activeTab === 'weekend' ? COLORS.burgundy : undefined }}
                    >
                      Weekend Getaway
                    </button>
                  </div>

                  {/* Quick Form */}
                  <form onSubmit={handlePlannerSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                          <MapPin size={12} /> Origin
                        </label>
                        <input
                          type="text"
                          value={tripDetails.origin}
                          onChange={e =>
                            setTripDetails({ ...tripDetails, origin: e.target.value })
                          }
                          className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#791523] transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                          <MapPin size={12} /> Destination
                        </label>
                        <input
                          type="text"
                          value={tripDetails.destination}
                          onChange={e =>
                            setTripDetails({ ...tripDetails, destination: e.target.value })
                          }
                          className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#791523] transition-colors"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                          <Calendar size={12} /> Start Date
                        </label>
                        <input
                          type="date"
                          value={tripDetails.date}
                          onChange={e =>
                            setTripDetails({ ...tripDetails, date: e.target.value })
                          }
                          className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#791523] transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                          <Users size={12} /> Group Size
                        </label>
                        <select
                          value={tripDetails.travelers}
                          onChange={e =>
                            setTripDetails({ ...tripDetails, travelers: e.target.value })
                          }
                          className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#791523] transition-colors"
                        >
                          {[2, 3, 4, 5, 6, 8, 10, 15, 20].map(num => (
                            <option key={num} value={num}>
                              {num} Travelers
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-1 flex items-center gap-1">
                        <Sparkles size={12} /> Trip Style
                      </label>
                      <select
                        value={tripDetails.tripType}
                        onChange={e =>
                          setTripDetails({ ...tripDetails, tripType: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:border-[#791523] transition-colors"
                      >
                        <option value="Coastal Explorer">Coastal Explorer (Beaches, Cafes & Watersports)</option>
                        <option value="Mountain Sanctuary">Mountain Sanctuary (Trekking & High Altitude Passes)</option>
                        <option value="Cultural Heritage">Cultural Heritage & Architecture</option>
                        <option value="Nightlife & Culinary">Nightlife, Fine Dining & Events</option>
                      </select>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full py-3.5 px-4 text-white rounded-full font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-102 flex items-center justify-center space-x-2 group"
                        style={{ backgroundColor: COLORS.burgundy }}
                      >
                        <span>Initialize Trip Workspace</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ReactLenis>
  );
}
