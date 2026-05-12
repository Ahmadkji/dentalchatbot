"use client";

import {
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Clock,
  MessageSquare,
  CalendarCheck,
  UserPlus,
  BarChart3,
  CheckCircle2,
  PhoneOff,
  Mail,
  Bell,
} from "lucide-react";
import { motion } from "framer-motion";
import FadeInSection from "./FadeInSection";

const timelineBlocks = [
  {
    period: "Morning",
    time: "8:00 AM",
    icon: Sunrise,
    gradient: "from-amber-50 to-orange-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-100",
    tasks: [
      {
        icon: MessageSquare,
        label: "Bot greeted 12 overnight visitors on your website",
        duration: "Auto",
        done: true,
      },
      {
        icon: CalendarCheck,
        label: "3 appointment requests collected overnight",
        duration: "Auto",
        done: true,
      },
      {
        icon: UserPlus,
        label: "2 new patient leads captured with name & phone",
        duration: "Auto",
        done: true,
      },
    ],
  },
  {
    period: "Afternoon",
    time: "1:00 PM",
    icon: Sun,
    gradient: "from-sky-50 to-blue-50",
    border: "border-sky-200",
    iconColor: "text-sky-500",
    iconBg: "bg-sky-100",
    tasks: [
      {
        icon: PhoneOff,
        label: "Patient requested reschedule via chat — no phone tag",
        duration: "Instant",
        done: true,
      },
      {
        icon: MessageSquare,
        label: "Bot answered 8 insurance and pricing questions",
        duration: "Auto",
        done: true,
      },
      {
        icon: CalendarCheck,
        label: "Appointment request confirmed in dashboard",
        duration: "Auto",
        done: false,
      },
    ],
  },
  {
    period: "Evening",
    time: "7:00 PM",
    icon: Sunset,
    gradient: "from-purple-50 to-indigo-50",
    border: "border-purple-200",
    iconColor: "text-purple-500",
    iconBg: "bg-purple-100",
    tasks: [
      {
        icon: Moon,
        label: "Bot still live — handling after-hours patient inquiries",
        duration: "24/7",
        done: false,
      },
      {
        icon: Mail,
        label: "Daily conversation summary in your dashboard",
        duration: "Auto",
        done: false,
      },
      {
        icon: Bell,
        label: "Tomorrow's appointment requests ready for review",
        duration: "Auto",
        done: false,
      },
    ],
  },
];

export function DayInTheLifeSection() {
  return (
    <section className="w-full bg-white py-24 md:py-32">
      <div className="max-w-[1100px] mx-auto px-6">
        <FadeInSection>
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-[#F7F7F7] text-[#6B7280] text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
              A Day in the Life
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-[#111111]">
              Your front desk, on autopilot
            </h2>
            <p className="text-base text-gray-500 mt-3 max-w-[520px] mx-auto">
              See how DentalGPT Studio handles patient communication from
              morning to night — so your team can focus on care.
            </p>
          </div>
        </FadeInSection>

        <div className="space-y-6">
          {timelineBlocks.map((block, bi) => {
            const BlockIcon = block.icon;
            return (
              <FadeInSection key={block.period} delay={bi * 0.1}>
                <div
                  className={`relative bg-gradient-to-r ${block.gradient} border ${block.border} rounded-2xl overflow-hidden`}
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Time column */}
                    <div className="md:w-[200px] shrink-0 p-6 md:p-8 flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-2 border-b md:border-b-0 md:border-r border-white/40">
                      <div
                        className={`w-12 h-12 rounded-xl ${block.iconBg} ${block.iconColor} flex items-center justify-center`}
                      >
                        <BlockIcon size={24} />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-[#111111]">
                          {block.period}
                        </p>
                        <p className="text-sm text-gray-500">{block.time}</p>
                      </div>
                    </div>

                    {/* Tasks */}
                    <div className="flex-1 p-6 md:p-8">
                      <div className="space-y-4">
                        {block.tasks.map((task, ti) => {
                          const TaskIcon = task.icon;
                          return (
                            <motion.div
                              key={ti}
                              className="flex items-start gap-4 group"
                              initial={{ opacity: 0, x: -10 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{
                                delay: bi * 0.1 + ti * 0.08,
                                duration: 0.4,
                              }}
                            >
                              {/* status + icon */}
                              <div className="relative shrink-0 mt-0.5">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    task.done
                                      ? "bg-emerald-100 text-emerald-500"
                                      : "bg-white border border-gray-200 text-gray-400"
                                  }`}
                                >
                                  {task.done ? (
                                    <CheckCircle2 size={16} />
                                  ) : (
                                    <TaskIcon size={16} />
                                  )}
                                </div>
                              </div>

                              {/* content */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium leading-relaxed ${
                                    task.done
                                      ? "text-[#111111]"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {task.label}
                                  {task.done && (
                                    <span className="inline-flex items-center ml-2 text-[10px] text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                      Done
                                    </span>
                                  )}
                                </p>
                              </div>

                              {/* duration */}
                              <span className="text-[11px] text-gray-400 bg-white px-2.5 py-1 rounded-full border border-gray-100 shrink-0">
                                {task.duration}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInSection>
            );
          })}
        </div>

        {/* total time */}
        <FadeInSection delay={0.4}>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              Your AI front desk never takes a break —{" "}
              <span className="font-semibold text-[#111111]">
                24/7 coverage
              </span>{" "}
              with zero hold time, zero missed calls.
            </p>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
