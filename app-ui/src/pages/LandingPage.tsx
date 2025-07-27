import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WaitlistForm from '../components/WaitlistForm';

// Helper component for animated feature cards
const FeatureCard = ({ icon, title, description, gradient, delay }: { icon: React.ReactNode, title: string, description: string, gradient: string, delay: string }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            cardRef.current?.classList.add('is-in-view');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="feature-card group backdrop-blur-xl bg-white/5 rounded-3xl p-8 text-center transform transition-all duration-500 shadow-2xl hover:shadow-3xl hover:scale-105 hover:bg-white/10 hover:-translate-y-2 cursor-pointer"
      style={{ transitionDelay: delay }}
    >
      <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg mb-6 transform transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-4">{title}</h3>
      <p className="text-gray-300 leading-relaxed">{description}</p>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const { isAuthenticated, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [isShootingStarsLoaded, setIsShootingStarsLoaded] = useState(false);
  const [starKey, setStarKey] = useState(0);

  // Create a new star every 5 seconds
  useEffect(() => {
    if (!isShootingStarsLoaded) return;

    const interval = setInterval(() => {
      setStarKey(prev => prev + 1);
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [isShootingStarsLoaded]);

  // Parallax effect for the background
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (parallaxRef.current) {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const x = (clientX / innerWidth - 0.5) * 30;
        const y = (clientY / innerHeight - 0.5) * 30;
        parallaxRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Memoize shooting stars so they don't re-render
  const shootingStars = useMemo(() => {
    if (!isShootingStarsLoaded) return null;
    
    return Array.from({ length: 1 }).map((_, i) => { // Just one star
      const style: React.CSSProperties = {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: '0s', // Start immediately
        animationDuration: `${Math.random() * 1 + 2}s`, // duration between 2s and 3s
      };
      return <div key={`star-${starKey}-${i}`} className="shooting-star" style={style} />;
    });
  }, [isShootingStarsLoaded, starKey]);

  // Load shooting stars after page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsShootingStarsLoaded(true);
    }, 2000); // Wait 2 seconds after page load

    return () => clearTimeout(timer);
  }, []);


  return (
    <div className="min-h-screen bg-[#0A071B] text-white overflow-x-hidden">
      {/* Background Masterpiece */}
      <div ref={parallaxRef} className="fixed inset-0 z-0 transition-transform duration-300 ease-out">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0A071B] via-[#1A103A] to-[#0A071B]"></div>
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-purple-900/80 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '15s' }}></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-teal-800/60 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '15s', animationDelay: '5s' }}></div>
        {/* Shooting Stars */}
        {shootingStars}
        <div id="stardust-container" className="absolute inset-0">
          {Array.from({ length: 100 }).map((_, i) => {
            const size = Math.random() * 2 + 1;
            const colors = ['bg-white/70', 'bg-blue-300/70', 'bg-purple-300/70', 'bg-teal-300/70'];
            return (
              <div
                key={i}
                className={`absolute rounded-full animate-pulse ${colors[Math.floor(Math.random() * colors.length)]}`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDuration: `${Math.random() * 8 + 8}s`,
                  animationDelay: `${Math.random() * 8}s`,
                }}
              />
            );
          })}
        </div>
      </div>
      
      {/* Main Content Wrapper */}
      <div className="relative z-10">
        {/* Glassmorphism Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50">
          <div className="container-responsive py-4">
            <div className="flex justify-between items-center bg-white/5 backdrop-blur-lg rounded-2xl px-6 py-3 shadow-2xl">
              <div className="text-2xl font-bold text-white">VishMaker</div>
              <div className="hidden sm:flex items-center space-x-6">
                {isAuthenticated && (
                  <Link to="/dashboard" className="text-gray-300 hover:text-white transition-colors font-medium">Dashboard</Link>
                )}
                {isAuthenticated ? (
                  <button 
                    onClick={signOut}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/20"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link to="/login" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/20">
                    Sign In
                  </Link>
                )}
              </div>
              <button className="sm:hidden text-white" onClick={() => setIsMobileMenuOpen(true)}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section: The Celebration */}
        <section className="min-h-[80vh] flex items-center justify-center text-center px-4 relative">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-white animate-gradient-x">
              Your wish, launched into reality.
            </h1>
            <p className="mt-6 text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.5s'}}>
              VishMaker is the celebration of creation, spinning every wish into a fully featured solution
            </p>
            <div className="mt-12 animate-fade-in-up" style={{animationDelay: '1s'}}>
              <WaitlistForm 
                className="mb-4"
                buttonText="Join Waitlist"
                placeholder="Enter your email to join the waitlist"
              />
            </div>
          </div>
        </section>

        {/* Video Section: Organic & Flowing */}
        <section className="py-12">
          <div className="container-responsive text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">See VishMaker in <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">Action</span></h2>
            <p className="text-lg text-gray-400 mb-12">Watch how ideas transform into reality in minutes.</p>
            <div className="relative group cursor-pointer aspect-video max-w-4xl mx-auto">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-teal-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
              <div className="relative bg-black rounded-3xl flex items-center justify-center border-2 border-purple-500/30 shadow-2xl h-full">
                <div className="text-center space-y-4">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transform transition-transform duration-300 group-hover:scale-110">
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section: Full of Life */}
        <section className="py-20">
          <div className="container-responsive text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">Productionalize</span></h2>
            <p className="text-lg text-gray-400 mb-16">From idea to deployment, VishMaker provides all the tools you need.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                title="Crystal-Clear Requirements → Bullet-proof Code"
                description="A visual canvas that chains User Flow → High-Level → Low-Level → Tests, so every feature ships with an audit-ready paper trail."
                gradient="from-blue-500 to-cyan-500"
                delay="0s"
              />
              <FeatureCard 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                title="Own Your Stack, Own Your Future"
                description="One-click IaC deploys VishMaker into your AWS, Azure, or GCP—no vendor lock-in, no data leaving your VPC."
                gradient="from-purple-500 to-pink-500"
                delay="0.2s"
              />
              <FeatureCard 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                title="Best-of-Breed LLM Orchestration"
                description="Routes planning to Gemini /OpenAI, coding to Codex (or any model you choose) for higher accuracy, lower cost, and zero single-point failure."
                gradient="from-emerald-500 to-teal-500"
                delay="0.4s"
              />
              <FeatureCard 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                title="Enterprise-Grade Governance & Audit"
                description="Built-in policy engine, role-based controls, and tamper-proof logs that keep compliance teams smiling."
                gradient="from-orange-500 to-red-500"
                delay="0.6s"
              />
              <FeatureCard 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2zm0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                title="Real-Time Cost & Performance Insight"
                description="See token spend, model latency, and cloud costs in one dashboard—optimize budgets before they bite."
                gradient="from-indigo-500 to-purple-500"
                delay="0.8s"
              />
              <FeatureCard 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                title="Unified Docs & Project Hub"
                description="Requirements, user stories, and progress live together—so business intent and code never drift apart."
                gradient="from-green-500 to-emerald-500"
                delay="1s"
              />
            </div>
          </div>
        </section>

        {/* CTA Section: The Grand Finale */}
        <section className="py-24">
          <div className="container-responsive">
            <div className="relative bg-gradient-to-br from-purple-800 via-indigo-900 to-blue-900 rounded-3xl p-12 text-center overflow-hidden">
              <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-teal-600 rounded-3xl blur opacity-20"></div>
              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6">Ready to fulfill your Wish?</h2>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">Join thousands of developers who are shipping faster with VishMaker.</p>
                <WaitlistForm 
                  buttonText="Join Waitlist"
                  placeholder="Enter your email"
                  className="max-w-lg mx-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="absolute top-0 right-0 w-64 h-full bg-gray-900/95 backdrop-blur-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <div className="text-xl font-bold text-white">Menu</div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-white hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                {isAuthenticated && (
                  <Link 
                    to="/dashboard" 
                    className="block text-gray-300 hover:text-white transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
                {isAuthenticated ? (
                  <button 
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-all duration-300 font-semibold"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link 
                    to="/login" 
                    className="block w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-xl transition-all duration-300 font-semibold text-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="py-16 border-t border-white/10">
          <div className="container-responsive text-center text-gray-400">
            <p>&copy; 2024 VishMaker. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage; 