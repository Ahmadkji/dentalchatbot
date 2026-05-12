"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield, Calendar, Zap, Headphones } from "lucide-react";
import Link from "next/link";

export function DentalHero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-[#F8FAFC]">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Built for dental clinics
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.08] mb-6">
              Stop losing patients to{" "}
              <span className="text-emerald-600">missed calls</span>{" "}
              and{" "}
              <span className="relative inline-block">
                after-hours gaps
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                  <path d="M2 6C50 2 150 2 198 6" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
              Your AI front desk answers patient questions 24/7, captures appointment requests,
              and tracks every lead — so you never miss a patient again.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4 mb-10">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5"
              >
                Get started free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center gap-2 bg-white text-slate-700 px-6 py-3.5 rounded-xl font-semibold border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
              >
                See pricing
              </Link>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-500" />
                <span>24/7 responses</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>Request capture</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span>5 min setup</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Live chatbot widget */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shadow-slate-200/50 bg-white">
              {/* Browser-style top bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-300" />
                  <div className="w-3 h-3 rounded-full bg-yellow-300" />
                  <div className="w-3 h-3 rounded-full bg-green-300" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white rounded-md px-3 py-1 text-[11px] text-slate-400 border border-slate-200 min-w-[200px] text-center">
                    yourdentalclinic.com
                  </div>
                </div>
                <div className="w-[52px]" />
              </div>

              {/* Live chatbot iframe */}
              <iframe
                src="/widget-frame?mode=embedded"
                title="Try our AI chatbot"
                className="w-full h-[540px] bg-white"
              />
            </div>

            {/* "Try it" hint badge */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-3 -right-3 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-200"
            >
              Try it live →
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
