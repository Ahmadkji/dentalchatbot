"use client";

import { motion } from "framer-motion";
import { MessageCircle, Shield, AlertCircle, BadgeCheck } from "lucide-react";

const conversations = [
  {
    id: 1,
    patient: "Sarah M.",
    inquiry: "Do you accept Delta Dental?",
    response:
      "Yes, we're in-network with Delta Dental PPO. I can check your specific plan coverage.",
    outcome: "Insurance verified",
    time: "2 min ago",
    statusColor: "text-emerald-600",
    statusBg: "bg-emerald-50",
  },
  {
    id: 2,
    patient: "James R.",
    inquiry: "I have a toothache. Can I come in today?",
    response:
      "I'm sorry to hear that! Dr. Park has an opening at 3:30 PM today. Shall I book it?",
    outcome: "Emergency booked",
    time: "15 min ago",
    statusColor: "text-amber-600",
    statusBg: "bg-amber-50",
  },
  {
    id: 3,
    patient: "Maria L.",
    inquiry: "What are your teeth whitening prices?",
    response:
      "Our in-office whitening starts at $350. We also have take-home kits for $200. Would you like to schedule a consultation?",
    outcome: "Lead captured",
    time: "1 hour ago",
    statusColor: "text-blue-600",
    statusBg: "bg-blue-50",
  },
];

export function ConversationShowcase() {
  return (
    <section className="py-24 bg-[#F8FAFC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-white text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4 shadow-sm">
            <MessageCircle className="w-4 h-4" />
            Real conversations
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            See how DentalGPT handles patients
          </h2>
          <p className="text-lg text-slate-500">
            Every inquiry gets an instant, accurate response
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
        >
          <div className="divide-y divide-slate-100">
            {conversations.map((conv, index) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {conv.patient}
                    </div>
                    <div className="text-sm text-slate-500 max-w-xs truncate">
                      {conv.inquiry}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 max-w-sm truncate">
                      AI: {conv.response}
                    </div>
                  </div>
                </div>

                <div className="text-right ml-4 flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${conv.statusColor} ${conv.statusBg}`}
                  >
                    <BadgeCheck className="w-3 h-3" />
                    {conv.outcome}
                  </span>
                  <div className="text-xs text-slate-400 mt-1.5">
                    {conv.time}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
            <span className="text-sm text-slate-500">
              All conversations are handled by your AI, trained on your
              clinic&apos;s information
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
