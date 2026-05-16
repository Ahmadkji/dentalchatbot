"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import FadeInSection from "./FadeInSection";

const faqs = [
  {
    question: "What is an AI front desk for dental clinics?",
    answer:
      "An AI front desk is a virtual assistant that lives on your dental clinic's website. It answers patient questions 24/7, collects appointment requests, and captures lead information — even after hours. DentalGPT Studio trains the AI on your specific clinic data so responses are accurate and personalized.",
  },
  {
    question: "How does DentalGPT Studio capture leads 24/7?",
    answer:
      "The AI chatbot is always active on your website. When a patient visits — at any hour — the bot greets them, answers their questions, and collects their name, phone number, and reason for inquiry. Every lead is logged in your dashboard for follow-up, so no patient inquiry slips through the cracks.",
  },
  {
    question: "Can the AI bot book appointments for my dental clinic?",
    answer:
      "Yes. Patients can request appointments directly through the chatbot. The bot collects their preferred date, time, and reason for visit, then logs the request in your dashboard. Your staff reviews and confirms appointments at their convenience.",
  },
  {
    question: "How long does it take to set up DentalGPT Studio?",
    answer:
      "Most dental clinics are up and running in under 5 minutes. You add your clinic name, services, hours, and FAQs. Then copy one line of code onto your website. The AI learns your clinic information and starts responding to patients immediately.",
  },
  {
    question: "Does DentalGPT Studio work with my existing dental website?",
    answer:
      "Yes. DentalGPT Studio works with any website platform — WordPress, Squarespace, Wix, Webflow, custom HTML, and more. You embed the chatbot widget with a single line of JavaScript. No developer needed.",
  },
  {
    question: "How much does DentalGPT Studio cost?",
    answer:
      "DentalGPT Studio offers a free Starter plan so you can try it with no credit card required. The Professional plan is $49/month and includes unlimited conversations, appointment request collection, lead capture, after-hours coverage, and a full dashboard with insights.",
  },
  {
    question: "What kind of questions can the dental AI chatbot answer?",
    answer:
      "The chatbot can answer any question it's trained on — office hours, accepted insurance plans, service descriptions and pricing, parking directions, new patient forms, and more. You upload your clinic's FAQs and policies, and the AI handles the rest.",
  },
  {
    question: "Is there a free trial for dental clinics?",
    answer:
      "Yes. The Starter plan is free forever with no credit card required. It includes AI conversations, basic FAQ training, and the website widget embed. You can upgrade to the Professional plan at any time for full lead capture, appointment requests, and dashboard access.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-24 bg-[#F8FAFC]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="text-center mb-14">
            <h2
              id="faq-heading"
              className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            >
              Frequently asked questions
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Everything dental clinics want to know about AI-powered front desk
              automation
            </p>
          </div>
        </FadeInSection>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <FadeInSection key={index} delay={index * 0.05}>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="text-base font-semibold text-slate-900 pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${index}`}
                        role="region"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                      >
                        <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
