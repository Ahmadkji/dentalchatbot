"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ArrowRight,
  MessageSquare,
  CalendarCheck,
  UserPlus,
  Clock,
  BarChart3,
  Sparkles,
  PhoneOff,
  Zap,
} from "lucide-react";
import Link from "next/link";
import FadeInSection from "./FadeInSection";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    period: "forever",
    desc: "Try it out — no credit card needed",
    cta: "Get Started Free",
    ctaStyle:
      "border-2 border-white/20 text-white hover:bg-white/10",
    features: [
      { icon: MessageSquare, label: "AI conversations" },
      { icon: Sparkles, label: "Basic FAQ training" },
      { icon: Zap, label: "Website widget embed" },
      { icon: Clock, label: "Email support" },
    ],
  },
  {
    id: "pro",
    name: "Professional",
    price: "$49",
    period: "/month",
    desc: "Everything you need to capture more patients",
    cta: "Get Started",
    ctaStyle:
      "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25",
    features: [
      { icon: MessageSquare, label: "Unlimited conversations" },
      { icon: CalendarCheck, label: "Appointment request collection" },
      { icon: UserPlus, label: "Lead capture & tracking" },
      { icon: PhoneOff, label: "After-hours lead capture" },
      { icon: BarChart3, label: "Dashboard & insights" },
      { icon: Clock, label: "Priority support" },
    ],
    highlight: true,
  },
];

const roiItems = [
  {
    label: "Avg. front desk salary",
    value: "$3,200",
    strike: true,
  },
  {
    label: "DentalGPT Studio Pro",
    value: "$49",
    highlight: true,
  },
  {
    label: "Your monthly savings",
    value: "$3,151",
    accent: true,
  },
];

const comparisonRows = [
  { feature: "AI Conversations", starter: "✓", pro: "✓" },
  { feature: "Appointment Requests", starter: "—", pro: "✓" },
  { feature: "Lead Capture", starter: "—", pro: "✓" },
  { feature: "Custom Branding", starter: "—", pro: "✓" },
  { feature: "After-Hours Capture", starter: "—", pro: "✓" },
  { feature: "Dashboard & Insights", starter: "—", pro: "✓" },
  { feature: "Support", starter: "Email", pro: "Priority" },
];

export function PricingSection() {
  const [active, setActive] = useState<"starter" | "pro">("pro");
  const plan = plans.find((p) => p.id === active)!;

  return (
    <section id="pricing" className="w-full py-24 md:py-32 bg-[#0F1117]">
      <div className="max-w-[1080px] mx-auto px-6">
        {/* Header */}
        <FadeInSection>
          <div className="text-center mb-14">
            <span className="inline-block text-[12px] font-medium text-emerald-400 mb-4 tracking-wide">
              PRICING
            </span>
            <h2 className="text-3xl md:text-[44px] font-bold text-white leading-tight mb-4">
              One plan. Everything included.
            </h2>
            <p className="text-base text-white/50 max-w-md mx-auto">
              Start free, upgrade when you&#39;re ready. No hidden fees, no
              contracts.
            </p>
          </div>
        </FadeInSection>

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          {/* Left: Plan card */}
          <FadeInSection delay={0.1} className="flex-1">
            <div className="relative h-full">
              {/* Gradient border glow */}
              <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-500/50 via-blue-500/30 to-purple-500/50 opacity-60 blur-[1px]" />

              <div className="relative h-full rounded-2xl bg-[#181B25] p-8 md:p-10">
                {/* Toggle */}
                <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 mb-8 w-fit mx-auto">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActive(p.id as "starter" | "pro")}
                      className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active === p.id
                          ? "text-white"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      {active === p.id && (
                        <motion.div
                          layoutId="plan-toggle"
                          className="absolute inset-0 bg-white/10 rounded-lg"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <span className="relative z-10">{p.name}</span>
                      {p.highlight && (
                        <span className="ml-2 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold relative z-10">
                          POPULAR
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Price */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="text-center mb-2"
                  >
                    <span className="text-5xl md:text-6xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-white/40 text-lg ml-1">
                      {plan.period}
                    </span>
                  </motion.div>
                </AnimatePresence>

                <p className="text-center text-white/40 text-sm mb-8">
                  {plan.desc}
                </p>

                {/* Features grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={plan.id + "-features"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="contents"
                    >
                        {plan.features.map((f) => {
                          const Icon = f.icon;
                          return (
                            <div
                              key={f.label}
                              className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3"
                            >
                              <div className="shrink-0 w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                                <Icon size={14} />
                              </div>
                              <span className="text-sm text-white/70">
                                {f.label}
                              </span>
                            </div>
                          );
                        })}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* CTA */}
                <Link
                  href="/login"
                  className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${plan.ctaStyle}`}
                >
                  {plan.cta}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </FadeInSection>

          {/* Right: ROI + Comparison */}
          <div className="flex-1 flex flex-col gap-6">
            {/* ROI card */}
            <FadeInSection delay={0.2}>
              <div className="rounded-2xl bg-[#181B25] border border-white/5 p-8">
                <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-6">
                  Cost vs. Value
                </h3>
                <div className="space-y-4">
                  {roiItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between"
                    >
                      <span
                        className={`text-sm ${
                          item.accent ? "text-white font-medium" : "text-white/50"
                        }`}
                      >
                        {item.label}
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          item.strike
                            ? "text-white/30 line-through decoration-white/20"
                            : item.highlight
                            ? "text-emerald-400"
                            : "text-emerald-300"
                        }`}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <TrendingUpIcon />
                    </div>
                    <div>
                      <p className="text-sm text-white/70 font-medium">
                        A fraction of the cost of adding front desk hours
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        Compare to hiring or overtime for after-hours coverage
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>

            {/* Comparison table */}
            <FadeInSection delay={0.3}>
              <div className="rounded-2xl bg-[#181B25] border border-white/5 overflow-hidden flex-1">
                <div className="grid grid-cols-3 gap-4 px-6 py-3 border-b border-white/5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  <div>Feature</div>
                  <div className="text-center">Starter</div>
                  <div className="text-center text-emerald-400">Pro</div>
                </div>
                {comparisonRows.map((row, i) => (
                  <div
                    key={row.feature}
                    className={`grid grid-cols-3 gap-4 px-6 py-2.5 text-sm ${
                      i % 2 === 0 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <div className="text-white/50">{row.feature}</div>
                    <div className="text-center text-white/25">{row.starter}</div>
                    <div className="text-center text-white/60 font-medium">
                      {row.pro}
                    </div>
                  </div>
                ))}
              </div>
            </FadeInSection>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendingUpIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-400"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
