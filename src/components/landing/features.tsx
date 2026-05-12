"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  Calendar,
  HelpCircle,
  Target,
  Code,
  Palette,
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "24/7 AI Chat",
    description:
      "Answers patient questions around the clock. No more missed calls or long hold times.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Calendar,
    title: "Appointment Requests",
    description:
      "Patients request appointments directly through chat. Your staff reviews and confirms in the dashboard.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: HelpCircle,
    title: "FAQ Builder",
    description:
      "Train the bot with your clinic's common questions. It learns your services, hours, and policies.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Target,
    title: "Lead Capture",
    description:
      "Every patient inquiry becomes a trackable lead. Names, phones, and intent — all logged.",
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: Code,
    title: "Widget Embed",
    description:
      "Install on your website in minutes. Works with any site — WordPress, Squarespace, custom.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description:
      "Match your clinic's colors, logo, and tone. Patients feel like they're talking to your team.",
    color: "bg-cyan-50 text-cyan-600",
  },
];

export function FeaturesGrid() {
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
            Everything your front desk needs
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Purpose-built for dental clinics who want to automate patient
            communication without losing the personal touch
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="group bg-[#F8FAFC] rounded-2xl p-6 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 border border-transparent hover:border-slate-100"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
