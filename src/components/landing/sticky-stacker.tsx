"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import FadeInSection from "./FadeInSection";
import {
  Bot,
  CalendarCheck,
  MessageSquare,
  Clock,
  BarChart3,
  TrendingUp,
} from "lucide-react";

interface Feature {
  id: string;
  step: number;
  title: string;
  description: string;
  detail: string;
  icon: typeof Bot;
  color: string;
}

const features: Feature[] = [
  {
    id: "learn",
    step: 1,
    title: "AI Learns Your Practice",
    description:
      "Upload your clinic's FAQs, services, and policies. The bot instantly understands how your office works.",
    detail:
      "Our AI parses your website, PDFs, and documents to build a complete knowledge base \u2014 hours, insurance info, and procedure details. All in under 5 minutes.",
    icon: Bot,
    color: "#3B82F6",
  },
  {
    id: "triage",
    step: 2,
    title: "Smart Patient Triage",
    description:
      "Every inquiry is understood and routed — appointment requests, emergencies, billing questions, and more.",
    detail:
      "The AI distinguishes between a routine cleaning inquiry and an urgent toothache, responding with the right urgency and routing high-priority cases to your team instantly.",
    icon: MessageSquare,
    color: "#F59E0B",
  },
  {
    id: "schedule",
    step: 3,
    title: "Auto-Schedule Bookings",
    description:
      "Patients submit appointment requests through the chat — your team reviews and confirms in the dashboard.",
    detail:
      "Patients pick a preferred date and time. Requests land in your dashboard for quick confirmation \u2014 reducing phone tag and back-and-forth.",
    icon: CalendarCheck,
    color: "#10B981",
  },
  {
    id: "engage",
    step: 4,
    title: "24/7 Patient Engagement",
    description:
      "Your AI front desk never sleeps — answering questions, collecting leads, and booking appointments around the clock.",
    detail:
      "After-hours visitors get the same quality experience as daytime callers. Every missed call becomes a chat opportunity, and every chat becomes a tracked lead.",
    icon: Clock,
    color: "#EF4444",
  },
  {
    id: "track",
    step: 5,
    title: "Patient Insights",
    description:
      "See every patient inquiry, lead status, and conversation volume in one clean dashboard.",
    detail:
      "Track how many conversations your bot handles, which services patients ask about most, and how many leads are captured. Simple, actionable data.",
    icon: BarChart3,
    color: "#8B5CF6",
  },
  {
    id: "grow",
    step: 6,
    title: "Grow Your Practice",
    description:
      "More bookings, fewer missed calls, and happier patients — the compound effect of an AI front desk.",
    detail:
      "More captured leads, fewer missed inquiries, and happier patients — the compound effect of always-on AI support for your dental practice.",
    icon: TrendingUp,
    color: "#0EA5E9",
  },
];

const DOT_SIZE = 24;
const DOT_GAP = 44;

export function StickyStackerSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const onScroll = () => {
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = window.innerHeight * 0.45;
        if (rect.top <= center && rect.bottom > center) {
          setActiveStep(i);
        }
      });

      const el = sectionRef.current;
      if (!el) return;
      const cards = el.querySelectorAll("[data-step-card]");
      if (cards.length < 2) return;
      const firstRect = cards[0].getBoundingClientRect();
      const lastRect = cards[cards.length - 1].getBoundingClientRect();
      const totalHeight = lastRect.top - firstRect.top;
      if (totalHeight <= 0) return;
      const scrolled = firstRect.top - window.innerHeight * 0.45;
      const raw = -scrolled / totalHeight;
      setScrollProgress(
        Math.min(Math.max(raw * (features.length - 1), 0), features.length - 1)
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const lineFill = (scrollProgress / (features.length - 1)) * 100;

  return (
    <section ref={sectionRef} className="w-full bg-white py-24 md:py-32">
      <div className="max-w-[900px] mx-auto px-6">
        <FadeInSection>
          <div className="text-center mb-14">
            <div className="inline-flex items-center bg-[#F7F7F7] text-[#6B7280] text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
              Platform Deep Dive
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-[#111111]">
              Six pillars of your AI front desk
            </h2>
            <p className="text-base text-gray-500 mt-3 max-w-[520px] mx-auto">
              Each capability builds on the last. Scroll to see the full
              DentalGPT Studio pipeline come together.
            </p>
          </div>
        </FadeInSection>

        <FadeInSection delay={0.1}>
          <div className="relative flex">
            {/* Sticky Side Indicator */}
            <div className="hidden md:flex flex-col items-center mr-10 shrink-0 sticky top-[45vh] self-start translate-y-[-50%]">
              <div
                className="relative flex flex-col justify-between items-center"
                style={{
                  height: `${(features.length - 1) * DOT_GAP + DOT_SIZE}px`,
                }}
              >
                {/* background line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-[12px] bottom-[12px] w-[2px] bg-[#F0F0F0] rounded-full" />

                {/* filled line */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-[16px] w-[2px] rounded-full transition-[height] duration-100 ease-linear"
                  style={{
                    height: `${(lineFill / 100) * (features.length - 1) * DOT_GAP}px`,
                    background:
                      activeStep < features.length
                        ? features[activeStep].color
                        : "#111111",
                  }}
                />

                {/* dots */}
                {features.map((f, i) => {
                  const state: "past" | "active" | "future" =
                    i < activeStep ? "past" : i === activeStep ? "active" : "future";

                  return (
                    <div
                      key={f.id}
                      className="relative z-10"
                      style={{
                        position: "absolute",
                        top: `${i * DOT_GAP}px`,
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {/* pulse ring for active */}
                      {state === "active" && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ border: `2px solid ${f.color}40` }}
                          animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            ease: "easeOut",
                          }}
                        />
                      )}

                      {/* glow ring for active */}
                      {state === "active" && (
                        <motion.div
                          className="absolute rounded-full"
                          style={{
                            inset: -3,
                            backgroundColor: f.color,
                            opacity: 0.12,
                          }}
                          animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.12, 0.06, 0.12],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2.5,
                            ease: "easeInOut",
                          }}
                        />
                      )}

                      {/* dot circle */}
                      <motion.div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold relative"
                        animate={{
                          backgroundColor:
                            state === "past"
                              ? "#111111"
                              : state === "active"
                              ? f.color
                              : "white",
                          borderColor:
                            state === "future" ? "#E5E5E5" : "transparent",
                          scale: state === "active" ? 1.1 : 1,
                          boxShadow:
                            state === "active"
                              ? `0 0 0 2px white, 0 0 0 4px ${f.color}40`
                              : state === "past"
                              ? "0 0 0 2px white, 0 0 0 4px #11111115"
                              : "none",
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        {state === "past" ? (
                          <svg viewBox="0 0 14 14" className="w-3 h-3">
                            <path
                              d="M2.5 7.5L5.5 10.5L11.5 3.5"
                              stroke="white"
                              strokeWidth="2"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <span
                            style={{
                              color:
                                state === "active" ? "white" : "#C0C0C0",
                            }}
                          >
                            {f.step}
                          </span>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 relative">
              <div className="space-y-8">
                {features.map((f, i) => {
                  const Icon = f.icon;
                  const isActive = i === activeStep;
                  const isPast = i < activeStep;

                  return (
                    <div
                      key={f.id}
                      ref={(el) => {
                        cardRefs.current[i] = el;
                      }}
                      data-step-card
                      className="relative"
                    >
                      <motion.div
                        className="bg-white border rounded-2xl p-6 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                        animate={{
                          borderColor: isActive
                            ? f.color + "60"
                            : isPast
                            ? "#F0F0F0"
                            : "#E5E5E5",
                          y: isActive ? 0 : isPast ? -4 : 0,
                          scale: isActive ? 1 : 0.97,
                          opacity: isPast ? 0.5 : 1,
                        }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      >
                        <div className="flex items-start gap-4 mb-4">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: f.color + "12" }}
                          >
                            <Icon size={22} style={{ color: f.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: f.color }}
                              >
                                STEP {f.step.toString().padStart(2, "0")}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-[#111111]">
                              {f.title}
                            </h3>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 leading-relaxed mb-3">
                          {f.description}
                        </p>

                        <motion.div
                          initial={false}
                          animate={{
                            height: isActive ? "auto" : 0,
                            opacity: isActive ? 1 : 0,
                          }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 border-t border-gray-100">
                            <p className="text-sm text-gray-400 leading-relaxed">
                              {f.detail}
                            </p>
                          </div>
                        </motion.div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
