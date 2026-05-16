"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Voicemail,
  Clock,
  AlertTriangle,
  UserX,
  MessageCircle,
  Calendar,
  Bell,
  Target,
} from "lucide-react";

const beforeSteps = [
  {
    icon: Voicemail,
    text: "Missed voicemail",
    desc: "Patient calls after 6 PM",
  },
  {
    icon: Clock,
    text: '"Let me check availability"',
    desc: "Patient waits on hold",
  },
  {
    icon: AlertTriangle,
    text: "No-show, lost revenue",
    desc: "Gap in schedule, revenue lost",
  },
  {
    icon: UserX,
    text: "Lost lead, no record",
    desc: "Walk-in inquiry forgotten",
  },
];

const afterSteps = [
  {
    icon: MessageCircle,
    text: "Instant AI response",
    desc: "Bot answers at 11 PM",
  },
  {
    icon: Calendar,
    text: "Real-time scheduling",
    desc: "Booked in under 30 seconds",
  },
  {
    icon: Bell,
    text: "Appointment request captured",
    desc: "Patient details logged for follow-up",
  },
  {
    icon: Target,
    text: "Every lead tracked",
    desc: "Full dashboard visibility",
  },
];

export function TrustTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const pathLength = useTransform(scrollYProgress, [0.1, 0.9], [0, 1]);

  return (
    <section
      ref={containerRef}
      className="py-24 bg-[#F8FAFC] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Before vs After DentalGPT
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            See how one AI assistant transforms your entire front desk
          </p>
        </motion.div>

        <div className="relative">
          {/* Central animated path */}
          <svg
            className="absolute left-1/2 top-0 h-full w-4 -translate-x-1/2 hidden lg:block"
            viewBox="0 0 16 800"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M8 0 Q8 100 8 200 Q8 300 8 400 Q8 500 8 600 Q8 700 8 800"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="2"
              strokeDasharray="8 4"
            />
            <motion.path
              d="M8 0 Q8 100 8 200 Q8 300 8 400 Q8 500 8 600 Q8 700 8 800"
              fill="none"
              stroke="#10B981"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ pathLength }}
            />
          </svg>

          <div className="space-y-10 sm:space-y-12 lg:space-y-0">
            {beforeSteps.map((before, index) => {
              const AfterIcon = afterSteps[index].icon;
              const BeforeIcon = before.icon;
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className={`relative lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center ${
                    index > 0 ? "lg:mt-16" : ""
                  }`}
                >
                  {/* Mobile: step number badge */}
                  <div className="flex items-center gap-2 mb-3 lg:hidden">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-400">
                      Step {index + 1}
                    </span>
                  </div>

                  {/* Before (left on even, right on odd) */}
                  <div
                    className={`${
                      isEven
                        ? "lg:text-right lg:pr-12"
                        : "lg:order-2 lg:pl-12"
                    }`}
                  >
                    <div
                      className={`inline-flex items-center gap-3 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm w-full ${
                        isEven ? "lg:flex-row-reverse" : ""
                      }`}
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BeforeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                      </div>
                      <div className={isEven ? "lg:text-right" : ""}>
                        <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">
                          Before
                        </div>
                        <div className="font-semibold text-slate-700 text-sm sm:text-base">
                          {before.text}
                        </div>
                        <div className="text-xs text-slate-400">
                          {before.desc}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile: arrow connector */}
                  <div className="flex justify-center my-2 lg:hidden">
                    <div className="w-px h-4 bg-emerald-300" />
                  </div>

                  {/* Center node (desktop) */}
                  <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        delay: index * 0.15 + 0.2,
                        type: "spring",
                      }}
                      className="w-8 h-8 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex items-center justify-center"
                    >
                      <span className="text-white text-xs font-bold">
                        {index + 1}
                      </span>
                    </motion.div>
                  </div>

                  {/* After */}
                  <div
                    className={`lg:mt-0 ${
                      isEven ? "lg:order-2 lg:pl-12" : "lg:pr-12"
                    }`}
                  >
                    <div
                      className={`inline-flex items-center gap-3 bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-md shadow-emerald-50 w-full ${
                        !isEven ? "lg:flex-row-reverse" : ""
                      }`}
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <AfterIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                      </div>
                      <div className={!isEven ? "lg:text-right" : ""}>
                        <div className="text-xs sm:text-sm font-bold text-emerald-600 uppercase tracking-wider">
                          After
                        </div>
                        <div className="font-semibold text-slate-900 text-sm sm:text-base">
                          {afterSteps[index].text}
                        </div>
                        <div className="text-xs text-slate-500">
                          {afterSteps[index].desc}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
