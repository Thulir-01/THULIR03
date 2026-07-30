import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  Microscope,
  ClipboardCheck,
  Shield,
  Users,
  Activity,
  TestTubes,
  FileText,
  Clock,
  BarChart3,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Building2,
  Award,
  Database,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 sm:h-20 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-teal-200/50 group-hover:shadow-teal-200/80 transition-shadow">
                <span>T</span>
                <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-gray-900 leading-tight -mb-0.5">
                  THULIR03
                </span>
                <span className="text-[10px] font-medium text-gray-400 tracking-widest uppercase">
                  Laboratory Information System
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-500 hover:text-teal-600 font-medium transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-gray-500 hover:text-teal-600 font-medium transition-colors">
                How it Works
              </a>
              <a href="#stats" className="text-sm text-gray-500 hover:text-teal-600 font-medium transition-colors">
                Impact
              </a>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-teal-600 px-4 py-2 rounded-lg hover:bg-teal-50 transition-all"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg shadow-teal-200/50 hover:shadow-teal-300/60 active:scale-[0.98]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-20">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />

        {/* Decorative Blobs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-teal-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-[30rem] h-[30rem] bg-cyan-200/20 rounded-full blur-3xl animate-float-delayed" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-teal-100/50 shadow-sm mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-sm font-medium text-teal-700">
                NABL / ISO 15189 Ready
              </span>
              <span className="w-px h-4 bg-teal-200 mx-1" />
              <span className="text-sm text-gray-400">Sprint 2 — Auth & RBAC</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in">
              <span className="text-gray-900">Modernize Your</span>
              <br />
              <span className="gradient-text-deep">Diagnostic Lab</span>
            </h1>

            {/* Subtext */}
            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-delayed">
              An intelligent, multi-tenant Laboratory Information Management System built for
              Indian diagnostic pathology labs. NABL-ready, ABDM-integrated, and designed
              to scale from a single lab to a nationwide franchise network.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-in-delayed-2">
              <Link
                to="/register"
                className="relative group inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-base font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-xl shadow-teal-200/40 hover:shadow-teal-300/60 active:scale-[0.98]"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-gray-200 bg-white/60 backdrop-blur-sm text-gray-700 text-base font-semibold hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-all active:scale-[0.98]"
              >
                <span>Explore Features</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="mt-16 flex flex-col items-center gap-6 animate-fade-in-delayed-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                Trusted by leading diagnostic laboratories
              </p>
              <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap opacity-60">
                {["NABL", "ISO 15189", "ABDM", "DPDP 2023", "HIPAA"].map((badge) => (
                  <div
                    key={badge}
                    className="flex items-center gap-2 text-gray-400 font-semibold text-sm"
                  >
                    <Shield className="w-4 h-4 text-teal-400" />
                    <span>{badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS BANNER ─── */}
      <StatsSection />

      {/* ─── FEATURES ─── */}
      <FeaturesSection />

      {/* ─── HOW IT WORKS ─── */}
      <HowItWorksSection />

      {/* ─── CTA ─── */}
      <CTASection />

      {/* ─── FOOTER ─── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                  T
                </div>
                <span className="font-bold text-lg text-white">THULIR03</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                A modern Laboratory Information Management System for Indian diagnostic pathology labs.
              </p>
            </div>
            {[
              {
                title: "Product",
                links: ["Features", "Security", "Compliance", "Pricing"],
              },
              {
                title: "Resources",
                links: ["Documentation", "API Reference", "Support", "Blog"],
              },
              {
                title: "Company",
                links: ["About", "Careers", "Contact", "Privacy Policy"],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-white text-sm mb-4">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm hover:text-teal-400 transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">
              &copy; {new Date().getFullYear()} THULIR03 LIMS. All rights reserved.
            </p>
            <p className="text-sm text-gray-500">
              Built for Indian Diagnostic Laboratories
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── STATS SECTION ─── */
function StatsSection() {
  const stats = useMemo(
    () => [
      { value: "10,000+", label: "Daily Tests", icon: TestTubes },
      { value: "500+", label: "Connected Labs", icon: Building2 },
      { value: "99.9%", label: "Uptime SLA", icon: Database },
      { value: "15+", label: "NABL Parameters", icon: Award },
    ],
    []
  );

  return (
    <section id="stats" className="relative -mt-16 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="group relative bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 text-center hover:shadow-xl hover:border-teal-100 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center group-hover:from-teal-100 group-hover:to-cyan-100 transition-colors">
                  <Icon className="w-6 h-6 text-teal-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 gradient-text-deep">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── FEATURES SECTION ─── */
function FeaturesSection() {
  const features = useMemo(
    () => [
      {
        icon: Microscope,
        title: "Test Management",
        description:
          "Comprehensive test catalog with customizable panels, profiles, and reflex testing rules. Support for biochemistry, hematology, microbiology, and more.",
      },
      {
        icon: Users,
        title: "Multi-Tenant Architecture",
        description:
          "Single instance serving multiple lab branches with complete data isolation. Perfect for franchise networks and diagnostic chains.",
      },
      {
        icon: ClipboardCheck,
        title: "NABL / ISO 15189 Ready",
        description:
          "Built-in quality control tracking, proficiency testing management, and audit trails for accreditation compliance.",
      },
      {
        icon: Activity,
        title: "Real-Time Dashboard",
        description:
          "Live monitoring of lab operations — sample status, TAT tracking, workload distribution, and bottleneck identification.",
      },
      {
        icon: Shield,
        title: "Enterprise Security",
        description:
          "Role-based access control, audit logging, data encryption, and full compliance with DPDP Act 2023 and HIPAA guidelines.",
      },
      {
        icon: FileText,
        title: "Smart Reporting",
        description:
          "Configurable report formats with AI-assisted interpretation. Digital signing, bulk generation, and instant patient portal publishing.",
      },
      {
        icon: BarChart3,
        title: "Analytics & Insights",
        description:
          "Deep business intelligence — revenue trends, test utilization, referral patterns, and operational KPIs with export capabilities.",
      },
      {
        icon: Clock,
        title: "TAT Optimization",
        description:
          "Automated turnaround time tracking with escalation workflows. Real-time alerts for delayed samples and bottleneck resolution.",
      },
    ],
    []
  );

  return (
    <section id="features" className="relative py-24 sm:py-32 bg-gradient-features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-100 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">
              Everything you need
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Purpose-built for{" "}
            <span className="gradient-text-deep">Diagnostic Labs</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            From sample collection to final report delivery — every feature designed
            to streamline your laboratory workflow and improve patient outcomes.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="feature-card group bg-white rounded-2xl border border-gray-100 p-6 hover:border-teal-100"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="feature-icon w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center mb-4 group-hover:from-teal-100 group-hover:to-cyan-100 transition-colors">
                  <Icon className="w-5.5 h-5.5 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-[15px]">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─── */
function HowItWorksSection() {
  const steps = useMemo(
    () => [
      {
        step: 1,
        title: "Create Your Lab Profile",
        description:
          "Register your laboratory, configure test panels, set up pricing, and define user roles — all in under 10 minutes.",
        icon: Building2,
      },
      {
        step: 2,
        title: "Connect & Collect",
        description:
          "Receive sample registrations from collection centers, connected clinics, or direct walk-ins. Barcode-based tracking from collection to report delivery.",
        icon: TestTubes,
      },
      {
        step: 3,
        title: "Run Tests & Validate",
        description:
          "Integrated workflow for technical validation and clinical authorization. Quality control checks at every stage with auto-verification rules.",
        icon: Microscope,
      },
      {
        step: 4,
        title: "Generate & Deliver Reports",
        description:
          "Auto-generated, customizable reports with digital signatures. Instant delivery via WhatsApp, email, patient portal, or ABDM Health Records.",
        icon: FileText,
      },
    ],
    []
  );

  return (
    <section id="how-it-works" className="relative py-24 sm:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-100 mb-4">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">
              Simple 4-step workflow
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            From Sample to Report in{" "}
            <span className="gradient-text-deep">4 Simple Steps</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            Streamlined laboratory workflow designed for Indian diagnostic labs
            with minimal training required.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="relative text-center">
                {/* Step number */}
                <div className="relative mx-auto mb-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-teal-600" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                    {step.step}
                  </div>
                </div>

                {/* Connector line (desktop) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[calc(100%+2rem)] h-px bg-gradient-to-r from-teal-200 to-transparent" />
                )}

                <h3 className="font-semibold text-gray-900 text-[15px] mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA SECTION ─── */
function CTASection() {
  const benefits = [
    "Free 14-day trial — no credit card required",
    "Dedicated onboarding specialist for your lab",
    "All features included — no hidden tiers",
    "Seamless migration from your existing LIS",
  ];

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-cta" />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.08]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60rem] h-[60rem] bg-white/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            <span className="text-sm font-medium text-white/90">
              Start your journey today
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your
            <br />
            Laboratory Operations?
          </h2>

          <p className="text-lg text-teal-100 max-w-xl mx-auto mb-10 leading-relaxed">
            Join hundreds of diagnostic labs across India that trust THULIR03
            to manage their daily operations with confidence and precision.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-10">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-300 shrink-0" />
                <span className="text-sm text-white/80">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white text-gray-900 text-base font-semibold hover:bg-teal-50 transition-all shadow-xl shadow-black/10 active:scale-[0.98]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="/api/docs"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-white/20 text-white text-base font-semibold hover:bg-white/10 hover:border-white/30 transition-all active:scale-[0.98]"
            >
              <span>View API Docs</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
