"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, HelpCircle, CalendarX, FileCheck } from "lucide-react";

const painPoints = [
  {
    id: 1,
    icon: PhoneOff,
    title: "Missing patient calls?",
    description:
      "After hours, during lunch, or while you're in a procedure. Every missed call is a potential patient lost.",
    solution:
      "DentalGPT answers patient questions 24/7, captures details, and collects appointment requests even when your front desk is closed.",
    color: "from-red-50 to-orange-50",
    iconColor: "text-orange-500",
    dotColor: "bg-orange-500",
  },
  {
    id: 2,
    icon: HelpCircle,
    title: "Repeating the same questions?",
    description:
      "Hours, insurance, parking, pricing, services — your staff answers the same questions dozens of times a day.",
    solution:
      "Train the AI once with your clinic's FAQs. It handles routine questions instantly, freeing your team for in-person patients.",
    color: "from-amber-50 to-yellow-50",
    iconColor: "text-amber-500",
    dotColor: "bg-amber-500",
  },
  {
    id: 3,
    icon: CalendarX,
    title: "No-shows killing your schedule?",
    description:
      "Last-minute cancellations and no-shows leave expensive gaps that are impossible to fill on short notice.",
    solution:
      "The bot collects appointment requests and patient details around the clock — your staff can confirm and schedule at their convenience.",
    color: "from-emerald-50 to-teal-50",
    iconColor: "text-emerald-500",
    dotColor: "bg-emerald-500",
  },
];

export function PainPulseGrid() {
  const [activeId, setActiveId] = useState<number | null>(1);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Your front desk has a problem
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Three pain points every dental clinic knows too well
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-slate-100 -translate-y-1/2" />
          <div className="hidden lg:block absolute top-1/2 left-[16%] right-[16%] h-px">
            <motion.div
              className="h-full bg-emerald-400"
              initial={{ width: "0%" }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {painPoints.map((point, index) => {
              const Icon = point.icon;
              const isActive = activeId === point.id;

              return (
                <motion.div
                  key={point.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  onMouseEnter={() => setActiveId(point.id)}
                  onClick={() => setActiveId(isActive ? null : point.id)}
                  className={`relative bg-gradient-to-br ${point.color} rounded-2xl p-6 cursor-pointer transition-all duration-500 border border-transparent ${
                    isActive
                      ? "shadow-xl shadow-slate-200/50 scale-[1.02] border-slate-200"
                      : "hover:shadow-lg"
                  }`}
                >
                  {/* Dot on connecting line */}
                  <div className="hidden lg:flex absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <motion.div
                      animate={
                        isActive ? { scale: [1, 1.4, 1] } : {}
                      }
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`w-3 h-3 rounded-full ${point.dotColor} ring-4 ring-white`}
                    />
                  </div>

                  <div
                    className={`w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center mb-4 ${point.iconColor}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {point.title}
                  </h3>

                  <AnimatePresence mode="wait">
                    {isActive ? (
                      <motion.div
                        key="solution"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-start gap-2">
                          <FileCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {point.solution}
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="problem"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-slate-500 leading-relaxed"
                      >
                        {point.description}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
