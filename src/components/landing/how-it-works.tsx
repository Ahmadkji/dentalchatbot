"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  MessageSquare,
  Code,
  TrendingUp,
} from "lucide-react";
import FadeInSection from "./FadeInSection";

const steps = [
  {
    num: "01",
    label: "STEP 01",
    color: "#3B82F6",
    colorLight: "bg-blue-50",
    colorBorder: "border-blue-300",
    colorText: "text-blue-500",
    colorRing: "ring-blue-100",
    icon: Settings,
    title: "Set up your bot",
    desc: "Add your clinic name, services, and hours. Takes under 5 minutes.",
  },
  {
    num: "02",
    label: "STEP 02",
    color: "#EF4444",
    colorLight: "bg-red-50",
    colorBorder: "border-red-300",
    colorText: "text-red-500",
    colorRing: "ring-red-100",
    icon: MessageSquare,
    title: "Train on your data",
    desc: "Upload FAQs, policies, and procedure details. The bot learns your practice.",
  },
  {
    num: "03",
    label: "STEP 03",
    color: "#F59E0B",
    colorLight: "bg-amber-50",
    colorBorder: "border-amber-300",
    colorText: "text-amber-500",
    colorRing: "ring-amber-100",
    icon: Code,
    title: "Embed the widget",
    desc: "One line of code on your site. Works with WordPress, Squarespace, any platform.",
  },
  {
    num: "04",
    label: "STEP 04",
    color: "#10B981",
    colorLight: "bg-emerald-50",
    colorBorder: "border-emerald-300",
    colorText: "text-emerald-500",
    colorRing: "ring-emerald-100",
    icon: TrendingUp,
    title: "Capture leads 24/7",
    desc: "Every patient inquiry becomes a tracked lead or an appointment request in your dashboard.",
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [fillPercent, setFillPercent] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const start = windowHeight * 0.6;
      const end = start + rect.height * 0.8;
      const progress = (start - rect.top) / (end - start);
      setFillPercent(Math.min(Math.max(progress, 0), 1));
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="w-full bg-white py-16 md:py-24">
      <div className="max-w-[960px] mx-auto px-6">
        {/* header */}
        <FadeInSection>
          <div className="text-center mb-14 md:mb-16">
            <span className="inline-block text-[12px] font-medium text-[#3B82F6] mb-4 tracking-wide">
              DENTALGPT STUDIO
            </span>
            <h2 className="text-3xl md:text-[48px] font-bold text-[#111827] leading-tight">
              How it works
            </h2>
          </div>
        </FadeInSection>

        {/* DESKTOP */}
        <div className="hidden md:block relative" ref={sectionRef}>
          {/* center vertical line track */}
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-px bg-[#F0F0F0]" />

          {/* center vertical line fill (scroll-animated) */}
          <div
            className="absolute left-1/2 top-0 w-[2px] -translate-x-px"
            style={{
              zIndex: 1,
              height: `${fillPercent * 100}%`,
              background: "linear-gradient(180deg, #3B82F6, #EF4444, #F59E0B, #10B981)",
              transition: "height 0.15s ease-out",
            }}
          />

          {/* step rows */}
          <div className="relative space-y-12" style={{ zIndex: 2 }}>
            {steps.map((step, i) => {
              const isLeft = i % 2 === 0;

              return (
                <FadeInSection key={step.num} delay={i * 0.1}>
                  <div className="flex items-center">
                    {/* left column */}
                    <div className="w-[calc(50%-28px)] shrink-0">
                      {isLeft && <StepCard step={step} align="right" />}
                    </div>

                    {/* center node */}
                    <div
                      className="flex items-center justify-center shrink-0 relative"
                      style={{ width: 56 }}
                    >
                      <motion.div
                        className={`absolute w-10 h-10 rounded-full ring-[6px] ${step.colorRing}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.1 }}
                      />
                      <div
                        className="relative w-7 h-7 rounded-full text-white flex items-center justify-center text-[11px] font-bold shadow-sm"
                        style={{ backgroundColor: step.color }}
                      >
                        {step.num}
                      </div>
                    </div>

                    {/* right column */}
                    <div className="w-[calc(50%-28px)] shrink-0">
                      {!isLeft && <StepCard step={step} align="left" />}
                    </div>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>

        {/* MOBILE */}
        <div className="md:hidden relative" ref={sectionRef}>
          {/* track */}
          <div className="absolute left-[14px] top-0 bottom-0 w-[2px] bg-[#F0F0F0]" />

          {/* fill */}
          <div
            className="absolute left-[14px] top-0 w-[2px]"
            style={{
              height: `${fillPercent * 100}%`,
              background: "linear-gradient(180deg, #3B82F6, #EF4444, #F59E0B, #10B981)",
              transition: "height 0.15s ease-out",
            }}
          />

          <div className="space-y-7 pl-10">
            {steps.map((step, i) => {
              const Icon = step.icon;

              return (
                <FadeInSection key={step.num} delay={i * 0.08}>
                  <div className="relative">
                    {/* colored dot on the line */}
                    <div
                      className="absolute -left-10 top-3 w-6 h-6 rounded-full ring-[3px] ring-white shadow-sm"
                      style={{ backgroundColor: step.color }}
                    />

                    {/* card */}
                    <div
                      className={`
                        bg-white rounded-xl border ${step.colorBorder}
                        p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`shrink-0 w-8 h-8 rounded-lg ${step.colorLight} ${step.colorText} flex items-center justify-center`}
                        >
                          <Icon size={15} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className="inline-block text-[9px] font-bold text-white px-1.5 py-[1px] rounded leading-none mb-1"
                            style={{ backgroundColor: step.color }}
                          >
                            {step.label}
                          </span>
                          <h3 className="text-[13px] font-semibold text-[#111827] leading-tight">
                            {step.title}
                          </h3>
                          <p className="text-[11px] text-[#6B7280] leading-snug mt-0.5">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* compact step card */
function StepCard({
  step,
  align,
}: {
  step: (typeof steps)[0];
  align: "left" | "right";
}) {
  const Icon = step.icon;
  return (
    <div
      className={`
        bg-white rounded-xl border ${step.colorBorder}
        p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        transition-shadow duration-200
        hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]
        ${align === "right" ? "ml-auto" : "mr-auto"}
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 w-9 h-9 rounded-lg ${step.colorLight} ${step.colorText} flex items-center justify-center`}
        >
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <span
            className="inline-block text-[10px] font-bold text-white px-2 py-[1px] rounded leading-none mb-1"
            style={{ backgroundColor: step.color }}
          >
            {step.label}
          </span>
          <h3 className="text-[15px] font-semibold text-[#111827]">
            {step.title}
          </h3>
          <p className="text-[13px] text-[#6B7280] leading-snug mt-0.5">
            {step.desc}
          </p>
        </div>
      </div>
    </div>
  );
}
