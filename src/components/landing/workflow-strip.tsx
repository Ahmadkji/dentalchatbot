"use client";

import { useEffect, useRef, useState } from "react";
import {
  Globe,
  MessageSquare,
  Bot,
  CalendarCheck,
  Bell,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import FadeInSection from "./FadeInSection";

const milestones = [
  {
    num: 1,
    icon: Globe,
    title: "Patient visits your site",
    desc: "The AI widget loads automatically on your clinic's website.",
    stat: "Step 1",
    color: "#F59E0B",
    lightBg: "#FEF3C7",
    lightText: "#92400E",
  },
  {
    num: 2,
    icon: MessageSquare,
    title: "Patient starts chatting",
    desc: "Visitor asks a question — the AI responds instantly, 24/7.",
    stat: "Instant",
    color: "#3B82F6",
    lightBg: "#DBEAFE",
    lightText: "#1E40AF",
  },
  {
    num: 3,
    icon: Bot,
    title: "AI triages the inquiry",
    desc: "The bot understands intent: booking, pricing, emergency, or general.",
    stat: "Smart",
    color: "#06B6D4",
    lightBg: "#CFFAFE",
    lightText: "#155E75",
  },
  {
    num: 4,
    icon: CalendarCheck,
    title: "Appointment requested",
    desc: "Patient submits preferred date and time. Request appears in your dashboard.",
    stat: "Auto",
    color: "#10B981",
    lightBg: "#D1FAE5",
    lightText: "#065F46",
  },
  {
    num: 5,
    icon: Bell,
    title: "Staff confirms",
    desc: "Your team reviews and confirms the appointment in the dashboard.",
    stat: "One click",
    color: "#8B5CF6",
    lightBg: "#EDE9FE",
    lightText: "#5B21B6",
  },
  {
    num: 6,
    icon: Target,
    title: "Lead logged",
    desc: "Patient details captured in your dashboard. Full conversation history.",
    stat: "Tracked",
    color: "#EF4444",
    lightBg: "#FEE2E2",
    lightText: "#991B1B",
  },
];

/* Desktop: horizontal timeline */
function DesktopTimeline({ fillPercent }: { fillPercent: number }) {
  return (
    <div className="hidden lg:block relative">
      {/* horizontal track line */}
      <div className="absolute top-[52px] left-[8%] right-[8%] h-[2px] bg-[#F0F0F0]" />

      {/* horizontal animated fill line */}
      <div
        className="absolute top-[52px] left-[8%] h-[2px] transition-[width] duration-500 ease-out"
        style={{
          width: `${fillPercent * 84}%`,
          background:
            "linear-gradient(to right, #F59E0B, #3B82F6, #06B6D4, #10B981, #8B5CF6, #EF4444)",
        }}
      />

      {/* milestones row */}
      <div className="relative flex items-start justify-between px-[4%]">
        {milestones.map((m, i) => {
          const Icon = m.icon;
          const stepThreshold = i / (milestones.length - 1);
          const isLit = fillPercent >= stepThreshold;

          return (
            <div
              key={m.num}
              className="flex flex-col items-center"
              style={{ width: `${100 / milestones.length}%` }}
            >
              <FadeInSection delay={i * 0.08}>
                <div className="flex flex-col items-center">
                  {/* pulse ring */}
                  {isLit && (
                    <motion.div
                      className="absolute w-16 h-16 rounded-full"
                      style={{
                        backgroundColor: m.color + "20",
                        marginTop: -4,
                      }}
                      animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.3, 1.5] }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                    />
                  )}

                  {/* circle badge */}
                  <motion.div
                    className="relative z-10 w-[44px] h-[44px] rounded-full flex items-center justify-center shadow-md border-[3px] border-white"
                    style={{ backgroundColor: m.color }}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: i * 0.08,
                      type: "spring",
                      stiffness: 260,
                    }}
                    whileHover={{ scale: 1.15 }}
                  >
                    <Icon size={20} className="text-white" />
                  </motion.div>

                  {/* connector line to card */}
                  <div
                    className="w-[2px] h-5 mt-1"
                    style={{
                      backgroundColor: isLit ? m.color : "#E5E5E5",
                    }}
                  />

                  {/* card */}
                  <motion.div
                    className="mt-1 w-[150px] text-center group"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 + 0.15, duration: 0.4 }}
                  >
                    <span
                      className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-2"
                      style={{
                        backgroundColor: m.lightBg,
                        color: m.lightText,
                      }}
                    >
                      {m.stat}
                    </span>
                    <p className="text-[13px] font-semibold text-[#111111] leading-snug">
                      {m.title}
                    </p>
                    <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
                      {m.desc}
                    </p>
                  </motion.div>
                </div>
              </FadeInSection>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Tablet: vertical timeline */
function TabletTimeline({ fillPercent }: { fillPercent: number }) {
  return (
    <div className="hidden md:block lg:hidden relative">
      {/* vertical track */}
      <div className="absolute left-[28px] top-0 bottom-0 w-[2px] bg-[#F0F0F0]" />

      {/* vertical animated fill */}
      <div
        className="absolute left-[28px] top-0 w-[2px] transition-[height] duration-500 ease-out"
        style={{
          height: `${fillPercent * 100}%`,
          background:
            "linear-gradient(to bottom, #F59E0B, #3B82F6, #10B981, #EF4444)",
        }}
      />

      <div className="space-y-8 pl-14">
        {milestones.map((m, i) => {
          const Icon = m.icon;
          const stepThreshold = i / (milestones.length - 1);
          const isLit = fillPercent >= stepThreshold;

          return (
            <FadeInSection key={m.num} delay={i * 0.07}>
              <div className="flex items-start gap-4 group">
                {/* dot */}
                <div className="relative -ml-[44px] mt-0.5">
                  <motion.div
                    className="w-[58px] h-[58px] rounded-full flex items-center justify-center shadow-sm border-[3px] border-white"
                    style={{ backgroundColor: m.color }}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06, type: "spring" }}
                  >
                    <Icon size={22} className="text-white" />
                  </motion.div>
                </div>

                {/* card */}
                <div
                  className={`flex-1 bg-white border rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all ${
                    isLit ? "border-[#E0E0E0]" : "border-[#E5E5E5]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: m.lightBg,
                        color: m.lightText,
                      }}
                    >
                      {m.stat}
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: m.color }}
                    >
                      STEP {m.num}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold text-[#111111] mb-1">
                    {m.title}
                  </p>
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              </div>
            </FadeInSection>
          );
        })}
      </div>
    </div>
  );
}

/* Mobile: single column */
function MobileTimeline({ fillPercent }: { fillPercent: number }) {
  return (
    <div className="md:hidden relative">
      {/* track */}
      <div className="absolute left-[18px] top-0 bottom-0 w-[2px] bg-[#F0F0F0]" />

      {/* fill */}
      <div
        className="absolute left-[18px] top-0 w-[2px] transition-[height] duration-500 ease-out"
        style={{
          height: `${fillPercent * 100}%`,
          background:
            "linear-gradient(to bottom, #F59E0B, #3B82F6, #10B981, #EF4444)",
        }}
      />

      <div className="space-y-6 pl-10">
        {milestones.map((m, i) => {
          const Icon = m.icon;
          return (
            <FadeInSection key={m.num} delay={i * 0.06}>
              <div className="relative group">
                {/* dot */}
                <div className="absolute -left-10 top-0.5">
                  <div
                    className="w-[38px] h-[38px] rounded-full flex items-center justify-center shadow-sm border-2 border-white"
                    style={{ backgroundColor: m.color }}
                  >
                    <Icon size={16} className="text-white" />
                  </div>
                </div>

                {/* card */}
                <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 pl-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: m.lightBg,
                        color: m.lightText,
                      }}
                    >
                      {m.stat}
                    </span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: m.color }}
                    >
                      STEP {m.num}
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#111111] mb-0.5">
                    {m.title}
                  </p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              </div>
            </FadeInSection>
          );
        })}
      </div>
    </div>
  );
}

/* Main section */
export function WorkflowStrip() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [fillPercent, setFillPercent] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const wh = window.innerHeight;
      const start = wh * 0.8;
      const end = -rect.height * 0.15;
      const p = (start - rect.top) / (start - end);
      setFillPercent(Math.min(Math.max(p, 0), 1));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={sectionRef} className="w-full bg-white py-24 md:py-32">
      <div className="max-w-[1100px] mx-auto px-6">
        {/* Header */}
        <FadeInSection>
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-[#F7F7F7] text-[#6B7280] text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
              Patient Journey
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-[#111111]">
              From visitor to booked patient
            </h2>
            <p className="text-base text-gray-500 mt-3 max-w-[480px] mx-auto">
              Six steps. Zero manual work. One seamless AI-powered flow.
            </p>
          </div>
        </FadeInSection>

        <DesktopTimeline fillPercent={fillPercent} />
        <TabletTimeline fillPercent={fillPercent} />
        <MobileTimeline fillPercent={fillPercent} />
      </div>
    </section>
  );
}
