'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ReactLenis } from 'lenis/react';
import { ArrowRight, Plane, Receipt, Map, PiggyBank } from 'lucide-react';
import Link from 'next/link';

// Extracted Palette Colors
const COLORS = {
  burgundy: '#791523',
  cream: '#eadecd',
  offWhite: '#fdfbfa',
  rose: '#d05461'
};

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  // Parallax Setup
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const heroY = useTransform(scrollYProgress, [0, 0.2], ["0%", "30%"]);
  const img1Y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const img2Y = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const img3Y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  // Faster movement for the glass cards to create depth
  const glass1Y = useTransform(scrollYProgress, [0, 1], ["0%", "-80%"]);
  const glass2Y = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <ReactLenis root>
      <main ref={containerRef} className="min-h-[200vh] overflow-x-hidden font-['Inter']" style={{ backgroundColor: COLORS.offWhite, color: COLORS.burgundy }}>
        
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md bg-[#fdfbfa]/70 border-b border-[#eadecd]/50 transition-all">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.burgundy }}>
              <Plane className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Tripfor</span>
          </div>
          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <Link href="/dashboard" className="px-5 py-2.5 rounded-full font-medium text-sm text-white transition-transform hover:scale-105" style={{ backgroundColor: COLORS.burgundy }}>
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="px-5 py-2.5 rounded-full hover:bg-black/5 transition-all font-medium text-sm" style={{ color: COLORS.burgundy }}>
                      Sign in
                    </Link>
                    <Link href="/login" className="px-5 py-2.5 rounded-full text-white font-medium text-sm transition-transform hover:scale-105 shadow-xl" style={{ backgroundColor: COLORS.rose }}>
                      Get Started
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-12 overflow-hidden">
          {/* Animated Blob Background */}
          <div className="absolute top-0 right-0 w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-40 mix-blend-multiply animate-pulse pointer-events-none" style={{ backgroundColor: COLORS.cream, animationDuration: '8s' }} />
          <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] rounded-full blur-[120px] opacity-20 mix-blend-multiply animate-pulse pointer-events-none" style={{ backgroundColor: COLORS.rose, animationDuration: '12s' }} />

          <motion.div style={{ y: heroY }} className="z-10 w-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            {/* Left Copy */}
            <div className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative overflow-hidden inline-flex items-center gap-3 px-4 py-2 rounded-full mb-6 self-start shadow-[0_0_20px_rgba(208,84,97,0.3)] backdrop-blur-md cursor-default border"
                style={{ backgroundColor: `${COLORS.rose}15`, borderColor: `${COLORS.rose}40` }}
              >
                {/* Sweeping Glossy Shine Animation */}
                <motion.div 
                  className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-[20deg]"
                  animate={{ left: ["-100%", "200%"] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1.5 }}
                />
                
                {/* Radar Pulse Dot */}
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: COLORS.rose }}></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 shadow-lg" style={{ backgroundColor: COLORS.rose }}></span>
                </span>
                
                {/* Badge Text */}
                <span className="relative text-xs font-black tracking-widest uppercase z-10" style={{ color: COLORS.rose }}>
                  Your Group Trip Accountant
                </span>
              </motion.div>

              {/* Kinetic Typography Masking */}
              <h1 className="text-5xl md:text-[5.5rem] font-black tracking-tighter leading-[1.05] mb-5 flex flex-col">
                <MaskedText text="Split" delay={0.1} />
                <MaskedText text="Expenses," delay={0.2} />
                <span style={{ color: COLORS.rose }}>
                  <MaskedText text="Not Vibes." delay={0.3} />
                </span>
              </h1>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                className="text-lg md:text-xl mb-8 max-w-xl font-medium opacity-80 leading-relaxed"
              >
                AI automatically reads your bank transactions and splits costs with friends. You just focus on the sunset.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
              >
                <MagneticButton>
                  <Link href="/login" className="group flex items-center justify-center px-8 py-4 text-base font-bold text-white rounded-full transition-transform hover:scale-105 shadow-2xl" style={{ backgroundColor: COLORS.burgundy }}>
                    <span className="flex items-center gap-2">
                      Start Planning <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </MagneticButton>
              </motion.div>
            </div>

            {/* Right Images (Parallax Collage + Glassmorphism) */}
            <div className="relative h-[600px] hidden lg:block">
              
              {/* Image 1 - Top Right */}
              <motion.div style={{ y: img1Y }} className="absolute top-0 right-0 z-20">
                <motion.img 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                  src="https://images.unsplash.com/photo-1527631746610-bca00a040d60?q=80&w=600&auto=format&fit=crop" 
                  alt="Friends on a trip" 
                  className="w-[280px] h-[380px] object-cover rounded-[2rem] shadow-2xl"
                />
                
                {/* Floating Glassmorphism Overlay 1 */}
                <motion.div 
                  style={{ y: glass1Y }}
                  className="absolute -bottom-8 -left-12 px-5 py-3 rounded-2xl backdrop-blur-md bg-white/40 border border-white/50 shadow-xl flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: COLORS.burgundy }}>₹</div>
                  <div>
                    <p className="text-sm font-bold">Pizza Dinner</p>
                    <p className="text-xs font-semibold" style={{ color: COLORS.rose }}>Prajwal paid ₹1,200</p>
                  </div>
                </motion.div>
              </motion.div>

              {/* Image 2 - Bottom Left */}
              <motion.div style={{ y: img2Y }} className="absolute bottom-10 left-0 z-30">
                <motion.img 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  src="https://images.unsplash.com/photo-1530789253388-582c481c54b0?q=80&w=600&auto=format&fit=crop" 
                  alt="Destination" 
                  className="w-[300px] h-[300px] object-cover rounded-full shadow-2xl border-8"
                  style={{ borderColor: COLORS.offWhite }}
                />
                
                {/* Floating Glassmorphism Overlay 2 */}
                <motion.div 
                  style={{ y: glass2Y }}
                  className="absolute top-4 -right-16 px-5 py-3 rounded-2xl backdrop-blur-md bg-white/40 border border-white/50 shadow-xl flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: COLORS.rose }}>
                    <Plane className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Flights Split</p>
                    <p className="text-xs font-semibold" style={{ color: COLORS.burgundy }}>Auto-calculated ✨</p>
                  </div>
                </motion.div>
              </motion.div>

              {/* Image 3 - Background Decor */}
              <motion.img 
                style={{ y: img3Y }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 1.5, delay: 0.7 }}
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop" 
                alt="Beach" 
                className="absolute top-1/3 left-20 w-[200px] h-[250px] object-cover rounded-3xl -z-10 blur-[2px]"
              />
            </div>
          </motion.div>
        </section>

        {/* Feature Section with Alternating Layouts */}
        <section className="py-32 px-6" style={{ backgroundColor: COLORS.cream }}>
          <div className="max-w-7xl mx-auto">
            
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-24"
            >
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Automated Group Travel.</h2>
              <p className="text-xl max-w-2xl mx-auto opacity-80">Stop doing math in group chats. Our intelligent ledger system tracks who owes what down to the last penny.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Receipt className="w-10 h-10" style={{ color: COLORS.rose }} />}
                title="AI Powered Ledgers"
                description="Our bank integrations automatically pull your Swiggy/Uber expenses and classify them for the trip instantly."
                delay={0}
              />
              <FeatureCard 
                icon={<PiggyBank className="w-10 h-10" style={{ color: COLORS.burgundy }} />}
                title="Simplified Debts"
                description="We run an algorithm to minimize transactions. No more 'A pays B, B pays C'. Just one clean settlement."
                delay={0.2}
              />
              <FeatureCard 
                icon={<Map className="w-10 h-10" style={{ color: COLORS.rose }} />}
                title="Itinerary Sync"
                description="Plan your daily destinations together. Expenses are automatically mapped to activities you attend."
                delay={0.4}
              />
            </div>

          </div>
        </section>

        {/* Big Image Divider Section */}
        <section className="relative h-[80vh] w-full overflow-hidden flex items-center justify-center">
          <motion.div 
            initial={{ scale: 1.2 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            viewport={{ once: true }}
            className="absolute inset-0 w-full h-full"
          >
            <img 
              src="https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=2000&auto=format&fit=crop" 
              alt="Beautiful Destination"
              className="w-full h-full object-cover"
            />
            {/* Color Overlay */}
            <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundColor: COLORS.burgundy }} />
          </motion.div>
          
          <motion.div
             initial={{ opacity: 0, y: 50 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.8, delay: 0.3 }}
             className="relative z-10 text-center text-white px-4"
          >
             <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-6">READY TO PACK?</h2>
             <Link href="/login" className="inline-flex px-10 py-5 text-xl font-bold rounded-full transition-transform hover:scale-105 shadow-2xl text-white" style={{ backgroundColor: COLORS.rose }}>
                Create a Trip Now
             </Link>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-8 text-center" style={{ backgroundColor: COLORS.burgundy, color: COLORS.cream }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Plane className="w-6 h-6" />
            <span className="text-2xl font-bold">Tripfor</span>
          </div>
          <p className="opacity-70">© 2026 Tripfor. Built for the modern traveler.</p>
        </footer>

      </main>
    </ReactLenis>
  );
}

// Helper: Staggered Text Masking (Kinetic Typography)
function MaskedText({ text, delay = 0 }: { text: string, delay?: number }) {
  return (
    <div className="overflow-hidden inline-block pb-2">
      <motion.div
        initial={{ y: "120%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
        className="inline-block"
      >
        {text}
      </motion.div>
    </div>
  );
}

// Helper: Magnetic Button
function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.15, y: middleY * 0.15 });
  };

  const reset = () => setPosition({ x: 0, y: 0 });

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({ title, description, icon, delay }: { title: string, description: string, icon: React.ReactNode, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className="p-10 rounded-[2rem] shadow-xl hover:-translate-y-2 transition-transform duration-500"
      style={{ backgroundColor: COLORS.offWhite }}
    >
      <div className="mb-6 p-4 rounded-2xl inline-block" style={{ backgroundColor: `${COLORS.cream}` }}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4" style={{ color: COLORS.burgundy }}>{title}</h3>
      <p className="text-lg leading-relaxed opacity-80" style={{ color: COLORS.burgundy }}>
        {description}
      </p>
    </motion.div>
  );
}
