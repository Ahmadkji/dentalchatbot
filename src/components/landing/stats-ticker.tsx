"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Scissors } from "lucide-react";

/* ── Animated counter ── */
function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const duration = 2200;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = value * eased;
      setDisplay(
        decimals > 0
          ? cur.toFixed(decimals)
          : Math.round(cur).toLocaleString()
      );
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, value, decimals]);

  return (
    <span ref={ref} className="font-mono-nums tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ── Receipt line items ── */
const lineItems = [
  { label: "Missed calls x3/day", amount: 135 },
  { label: "Empty appointment slots x2", amount: 320 },
  { label: "Patient hang-ups (hold >8 min)", amount: 180 },
  { label: "After-hours inquiries lost", amount: 200 },
  { label: "No-shows (no follow-up)", amount: 250 },
];

const dailyTotal = lineItems.reduce((sum, i) => sum + i.amount, 0);
const yearlyTotal = dailyTotal * 252; // working days

/* ── Receipt component ── */
function Receipt() {
  return (
    <div className="relative max-w-[380px] mx-auto">
      {/* Paper shadow layers */}
      <div className="absolute -bottom-2 left-2 right-2 h-4 bg-slate-200/50 rounded-b-lg" />
      <div className="absolute -bottom-1 left-1 right-1 h-2 bg-slate-100/80 rounded-b-lg" />

      <div className="relative bg-white border border-slate-200 rounded-t-lg overflow-hidden">
        {/* Zigzag top edge */}
        <div className="h-4 bg-slate-50" style={{
          background: `linear-gradient(135deg, #f8fafc 33.33%, transparent 33.33%) 0 0,
                       linear-gradient(225deg, #f8fafc 33.33%, transparent 33.33%) 0 0`,
          backgroundSize: "12px 100%",
        }} />

        <div className="px-8 pb-8">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
              Itemized Statement
            </p>
            <p className="text-[11px] text-slate-400">
              Average dental clinic — daily losses
            </p>
          </div>

          {/* Dashed separator */}
          <div className="border-t border-dashed border-slate-300 mb-5" />

          {/* Line items */}
          <div className="space-y-3 mb-5">
            {lineItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-[13px] text-slate-600 leading-snug">
                  {item.label}
                </span>
                <span className="border-b border-dotted border-slate-300 flex-1 min-w-[20px] mb-1" />
                <span className="text-[13px] font-semibold text-rose-500 tabular-nums shrink-0">
                  -${item.amount}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Dashed separator */}
          <div className="border-t border-dashed border-slate-300 mb-4" />

          {/* Daily total */}
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
              Daily Total
            </span>
            <span className="text-lg font-bold text-rose-500 tabular-nums">
              <CountUp value={dailyTotal} prefix="-$" />
            </span>
          </div>

          {/* Yearly projection */}
          <div className="bg-rose-50 rounded-lg p-3 text-center mt-4">
            <p className="text-[11px] text-rose-400 uppercase tracking-wider mb-1">
              Projected Annual Loss
            </p>
            <p className="text-2xl font-bold text-rose-500 tabular-nums">
              <CountUp value={yearlyTotal} prefix="$" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main section ── */
export function StatsTicker() {
  return (
    <section className="w-full bg-slate-50 py-20 md:py-28">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left: Text + stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-[12px] font-medium text-rose-500 mb-4 tracking-wide">
              THE COST OF DOING NOTHING
            </span>
            <h2 className="text-3xl md:text-[40px] font-bold text-slate-900 leading-tight mb-5">
              This is what losing
              <br />
              patients looks like
            </h2>
            <p className="text-base text-slate-500 mb-8 max-w-md">
              Every day without an AI front desk, your clinic loses patients,
              revenue, and time. Here&#39;s the itemized breakdown.
            </p>

            {/* Mini stats row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { value: 35, suffix: "%", label: "Calls missed" },
                { value: 12, suffix: " min", label: "Avg hold time" },
                { value: 94, suffix: "%", label: "Prefer texting" },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="text-2xl font-bold text-slate-800">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200"
            >
              Stop the losses
              <ArrowRight size={16} />
            </Link>
          </motion.div>

          {/* Right: Receipt */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Receipt />

            {/* Tear-off note below receipt */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
              className="mt-6 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Scissors size={14} className="text-slate-300 rotate-[-90deg]" />
                <div className="flex-1 border-t border-dashed border-slate-300" />
                <Scissors size={14} className="text-slate-300 rotate-90" />
              </div>
              <p className="text-sm text-slate-500">
                Or replace it all for{" "}
                <span className="font-bold text-emerald-600">$49/month</span>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
