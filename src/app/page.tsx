"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  Zap,
  Brain,
  Palette,
  Users,
  BookOpen,
  Target,
  Star,
  Play,
  ArrowRight,
  Rocket,
} from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState({});
  const [activeFeature, setActiveFeature] = useState(0);
  const [particles, setParticles] = useState([]);
  const canvasRef = useRef(null);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    const initParticles = () => {
      const newParticles = [];
      for (let i = 0; i < 40; i++) {
        newParticles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.3 + 0.2,
        });
      }
      setParticles(newParticles);
    };

    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 119, 51, ${particle.opacity})`;
        ctx.fill();

        // Connect nearby particles
        particles.slice(index + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 80) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(255, 119, 51, ${
              (0.08 * (80 - distance)) / 80
            })`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [particles]);

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="relative">
          <div className="w-20 h-20 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div
            className="absolute inset-2 w-16 h-16 border-2 border-white/20 border-b-transparent rounded-full animate-spin"
            style={{ animationDirection: "reverse", animationDuration: "1.8s" }}
          ></div>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Zap,
      title: "Interactive Learning",
      description:
        "Transform passive consumption into active engagement through hands-on experiments and real-world applications.",
      gradient: "from-orange-400 to-orange-600",
      stats: "Real-time engagement",
    },
    {
      icon: Brain,
      title: "Curiosity Engine",
      description:
        "AI-powered content that adapts to your interests, always presenting the next fascinating rabbit hole to explore.",
      gradient: "from-orange-500 to-orange-700",
      stats: "Adaptive learning paths",
    },
    {
      icon: Palette,
      title: "Create & Share",
      description:
        "Turn insights into projects, theories into prototypes, and ideas into innovations you can share with the world.",
      gradient: "from-orange-600 to-orange-800",
      stats: "Unlimited creation",
    },
  ];

  const stats = [
    { number: "50K+", label: "Active Learners", icon: Users },
    { number: "1M+", label: "Lessons Completed", icon: BookOpen },
    { number: "200+", label: "Topics Covered", icon: Target },
    { number: "95%", label: "Satisfaction Rate", icon: Star },
  ];

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated Background Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Dynamic cursor glow effect */}
      <div
        className="fixed pointer-events-none z-10 transition-all duration-300 ease-out"
        style={{
          left: mousePosition.x - 100,
          top: mousePosition.y - 100,
          width: "200px",
          height: "200px",
          background:
            "radial-gradient(circle, rgba(255, 119, 51, 0.12) 0%, rgba(255, 119, 51, 0.04) 40%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(30px)",
        }}
      />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-black/85 backdrop-blur-xl border-b border-orange-500/15">
        <div className="max-w-7xl mx-auto flex justify-between items-center py-5 px-6">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative">
              <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-300">
                <span className="text-black font-black text-lg">K</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
            </div>
            <div>
              <h1
                className="text-2xl font-bold text-white tracking-tight"
                style={{
                  fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
                }}
              >
                Knowledge Labs
              </h1>
              <p
                className="text-orange-200 text-xs font-medium tracking-wide"
                style={{
                  fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
                }}
              >
                LEARN • CREATE • TRANSFORM
              </p>
            </div>
          </div>

          <div>
            {session?.user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-white/8 backdrop-blur-md px-4 py-2 rounded-full border border-orange-500/25 hover:border-orange-400/40 transition-all duration-300">
                  <Image
                    src={session.user.image ?? "/default-avatar.png"}
                    alt={session.user.name ?? "User Avatar"}
                    width={28}
                    height={28}
                    className="rounded-full border-2 border-orange-400"
                  />
                  <span
                    className="text-white font-medium text-sm"
                    style={{
                      fontFamily:
                        "'Poppins', -apple-system, system-ui, sans-serif",
                    }}
                  >
                    {session.user.name}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="bg-white text-black px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-orange-50 transition-all duration-300 hover:scale-105"
                  style={{
                    fontFamily:
                      "'Poppins', -apple-system, system-ui, sans-serif",
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google", { callbackUrl: "/chat" })}
                className="relative group bg-gradient-to-r from-orange-500 to-orange-600 text-black px-6 py-3 rounded-full font-bold hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 transform hover:scale-105 overflow-hidden"
                style={{
                  fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
                }}
              >
                <span className="relative z-10 flex items-center gap-2 text-sm">
                  <span>Start Learning</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="max-w-6xl mx-auto text-center">
          {/* Animated Logo */}
          <div className="mb-12 relative">
            <div
              className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-orange-400/20 to-orange-600/20 rounded-3xl border border-orange-500/30 backdrop-blur-sm transition-all duration-500 hover:scale-110 cursor-pointer group"
              style={{
                transform: `translateY(${Math.sin(scrollY * 0.008) * 8}px)`,
              }}
            >
              <Rocket className="w-12 h-12 text-orange-400 group-hover:text-orange-300 transition-colors duration-300" />
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-orange-600/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </div>

          {/* Dynamic Headline */}
          <div className="mb-8 space-y-4">
            <h1
              className="text-6xl md:text-8xl lg:text-[10rem] font-black text-white leading-none tracking-tighter"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
                textShadow: "0 0 80px rgba(255, 119, 51, 0.25)",
              }}
            >
              KNOWLEDGE
            </h1>
            <h2
              className="text-3xl md:text-5xl lg:text-7xl font-black leading-none tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, #ff7733 0%, #ffffff 40%, #ff7733 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundSize: "250% 100%",
                animation: "gradient-shift 4s ease-in-out infinite",
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              TRANSFORMED
            </h2>
          </div>

          {/* Interactive Subtitle */}
          <div className="relative mb-12 max-w-4xl mx-auto">
            <p
              className="text-lg md:text-2xl text-white/85 leading-relaxed font-normal"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              Break free from passive learning. Turn static content into
              <span
                className="relative inline-block mx-2 px-3 py-1 bg-gradient-to-r from-orange-500/15 to-orange-600/15 rounded-full border border-orange-500/25 cursor-pointer hover:border-orange-400/40 transition-all duration-300 font-medium"
                onMouseEnter={(e) => {
                  e.target.style.transform = "scale(1.05)";
                  e.target.style.backgroundColor = "rgba(255, 119, 51, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "scale(1)";
                  e.target.style.backgroundColor = "rgba(255, 119, 51, 0.04)";
                }}
              >
                dynamic experiences
              </span>
              that spark curiosity, drive action, and fuel creation.
            </p>
          </div>

          {/* Interactive CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="group relative bg-gradient-to-r from-orange-500 to-orange-600 text-black px-10 py-4 rounded-full text-lg font-bold hover:shadow-xl hover:shadow-orange-500/40 transition-all duration-500 transform hover:scale-110 overflow-hidden"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              <span className="relative z-10 flex items-center gap-3">
                Start Your Journey
                <ArrowRight className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            <button
              className="group text-orange-400 hover:text-white px-8 py-4 rounded-full text-lg font-semibold border-2 border-orange-500/40 hover:border-orange-400 hover:bg-orange-500/8 transition-all duration-300 backdrop-blur-sm"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              <span className="flex items-center gap-3">
                Watch Demo
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
              </span>
            </button>
          </div>

          {/* Floating Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group p-6 bg-white/4 backdrop-blur-xl rounded-2xl border border-orange-500/15 hover:border-orange-400/30 transition-all duration-500 hover:scale-105 cursor-pointer"
                  style={{
                    animation: `float ${3 + index * 0.3}s ease-in-out infinite`,
                    animationDelay: `${index * 0.15}s`,
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = "rgba(255, 119, 51, 0.08)";
                    e.target.style.transform = "scale(1.08) rotateY(3deg)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor =
                      "rgba(255, 255, 255, 0.04)";
                    e.target.style.transform = "scale(1) rotateY(0deg)";
                  }}
                >
                  <div className="mb-3">
                    <IconComponent className="w-8 h-8 text-orange-400 group-hover:text-orange-300 group-hover:scale-110 transition-all duration-300 mx-auto" />
                  </div>
                  <div
                    className="text-2xl font-black text-orange-400 mb-2 group-hover:text-white transition-colors duration-300"
                    style={{
                      fontFamily:
                        "'Poppins', -apple-system, system-ui, sans-serif",
                    }}
                  >
                    {stat.number}
                  </div>
                  <div
                    className="text-white/70 font-medium text-sm group-hover:text-white transition-colors duration-300"
                    style={{
                      fontFamily:
                        "'Poppins', -apple-system, system-ui, sans-serif",
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive Features Section */}
      <section className="relative z-20 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h3
              className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              Why Knowledge <span className="text-orange-400">Labs?</span>
            </h3>
            <p
              className="text-xl text-white/75 max-w-3xl mx-auto font-normal"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              Learning reimagined for minds that refuse to stay static
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`group relative bg-black/30 backdrop-blur-xl border-2 rounded-3xl p-8 transition-all duration-700 cursor-pointer ${
                    activeFeature === index
                      ? "border-orange-500/60 bg-orange-500/8 scale-105"
                      : "border-white/8 hover:border-orange-400/30 hover:bg-white/4"
                  }`}
                  onClick={() => setActiveFeature(index)}
                  onMouseEnter={() => setActiveFeature(index)}
                  style={{
                    transform:
                      activeFeature === index ? "scale(1.05)" : "scale(1)",
                    boxShadow:
                      activeFeature === index
                        ? "0 0 60px rgba(255, 119, 51, 0.2)"
                        : "none",
                  }}
                >
                  <div className="relative z-10">
                    <div
                      className={`inline-flex items-center justify-center w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br ${feature.gradient} shadow-xl transition-all duration-500`}
                      style={{
                        transform:
                          activeFeature === index
                            ? "scale(1.1) rotate(8deg)"
                            : "scale(1)",
                        filter:
                          activeFeature === index
                            ? "brightness(1.15)"
                            : "brightness(1)",
                      }}
                    >
                      <IconComponent className="w-10 h-10 text-black" />
                    </div>
                    <h4
                      className="text-2xl font-bold text-white mb-4 transition-all duration-300"
                      style={{
                        fontFamily:
                          "'Poppins', -apple-system, system-ui, sans-serif",
                        color: activeFeature === index ? "#ff7733" : "white",
                      }}
                    >
                      {feature.title}
                    </h4>
                    <p
                      className="text-white/75 leading-relaxed mb-4 font-normal"
                      style={{
                        fontFamily:
                          "'Poppins', -apple-system, system-ui, sans-serif",
                      }}
                    >
                      {feature.description}
                    </p>
                    <div
                      className="text-orange-400 font-semibold text-sm tracking-wide"
                      style={{
                        fontFamily:
                          "'Poppins', -apple-system, system-ui, sans-serif",
                      }}
                    >
                      {feature.stats}
                    </div>
                  </div>

                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${
                      feature.gradient
                    } rounded-3xl transition-opacity duration-500 ${
                      activeFeature === index ? "opacity-5" : "opacity-0"
                    }`}
                  ></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-20 text-center py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <h3
            className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight"
            style={{
              fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
            }}
          >
            Ready to Transform
            <span className="block text-orange-400 mt-2">How You Learn?</span>
          </h3>
          <p
            className="text-xl text-white/75 mb-12 max-w-3xl mx-auto font-normal"
            style={{
              fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
            }}
          >
            Join thousands of curious minds already on their journey
          </p>

          {!session?.user && (
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="group relative bg-gradient-to-r from-orange-500 to-orange-600 text-black px-16 py-6 rounded-full text-2xl font-bold hover:shadow-xl transition-all duration-500 transform hover:scale-110 overflow-hidden"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
                boxShadow: "0 0 80px rgba(255, 119, 51, 0.3)",
              }}
            >
              <span className="relative z-10 flex items-center gap-4">
                Get Started Free
                <Rocket className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 bg-black/50 backdrop-blur-xl border-t border-orange-500/15 py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-black font-bold">K</span>
            </div>
            <span
              className="text-2xl font-bold text-white"
              style={{
                fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
              }}
            >
              Knowledge Labs
            </span>
          </div>
          <p
            className="text-orange-200 mb-8"
            style={{
              fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
            }}
          >
            Transforming minds, one curious question at a time.
          </p>
          <div className="flex justify-center gap-8 text-white/50 text-sm font-medium">
            <a
              href="#"
              className="hover:text-orange-400 transition-colors duration-300"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="hover:text-orange-400 transition-colors duration-300"
            >
              Terms of Service
            </a>
            <a
              href="#"
              className="hover:text-orange-400 transition-colors duration-300"
            >
              Contact
            </a>
          </div>
          <p
            className="text-white/30 text-sm mt-8"
            style={{
              fontFamily: "'Poppins', -apple-system, system-ui, sans-serif",
            }}
          >
            © 2025 Knowledge Labs. All rights reserved.
          </p>
        </div>
      </footer>

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap");

        @keyframes gradient-shift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}
