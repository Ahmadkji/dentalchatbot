import type { Metadata } from "next";
import { DentalHero } from "@/components/landing/hero";
import { StatsTicker } from "@/components/landing/stats-ticker";
import { PainPulseGrid } from "@/components/landing/pain-points";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { TrustTimeline } from "@/components/landing/trust-timeline";
import { ConversationShowcase } from "@/components/landing/conversation-showcase";
import { DayInTheLifeSection } from "@/components/landing/day-in-the-life";
import { FeaturesGrid } from "@/components/landing/features";
import { StickyStackerSection } from "@/components/landing/sticky-stacker";
import { WorkflowStrip } from "@/components/landing/workflow-strip";
import { PricingSection } from "@/components/landing/pricing";
import { FAQSection } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";
import { ClientNav } from "@/components/landing/client-nav";

/* ── Page-specific metadata (overrides layout defaults) ── */
export const metadata: Metadata = {
  title: "DentalGPT Studio — AI Front Desk for Dental Clinics | 24/7 Patient Chatbot",
  description:
    "DentalGPT Studio is the #1 AI front desk for dental clinics. Answer patient questions 24/7, capture appointment requests, and track every lead automatically. Free to start, setup in 5 minutes.",
  alternates: {
    canonical: "/",
  },
};

/* ── FAQ data shared between visible component and JSON-LD ── */
const faqData = [
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

/* ── JSON-LD Structured Data ── */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://dentalgptstudio.com";

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DentalGPT Studio",
  url: siteUrl,
  logo: `${siteUrl}/logo.svg`,
  description:
    "AI-powered virtual front desk for dental clinics. Answer patient questions 24/7, capture appointment requests, and track every lead automatically.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    availableLanguage: "English",
  },
  sameAs: [],
};

const jsonLdWebSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DentalGPT Studio",
  url: siteUrl,
  description:
    "AI-powered virtual front desk for dental clinics — 24/7 patient communication, appointment requests, and lead capture.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const jsonLdSoftwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DentalGPT Studio",
  url: siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered virtual front desk for dental clinics. Answers patient questions 24/7, captures appointment requests, and tracks every lead automatically.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "USD",
      description: "Free forever — AI conversations, basic FAQ training, website widget embed.",
    },
    {
      "@type": "Offer",
      name: "Professional",
      price: "49",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description:
        "Unlimited conversations, appointment request collection, lead capture, after-hours coverage, dashboard & insights.",
    },
  ],
};

const jsonLdFAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqData.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const jsonLdBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
  ],
};

/* ── Page Component (Server Component) ── */
export default function HomePage() {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdOrganization).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdWebSite).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdSoftwareApp).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdFAQ).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdBreadcrumb).replace(/</g, "\\u003c"),
        }}
      />

      {/* Client-side nav + floating widget */}
      <ClientNav />

      {/* Landing sections with semantic anchor IDs */}
      <main className="min-h-screen pt-14">
        <DentalHero />
        <div id="stats">
          <StatsTicker />
        </div>
        <div id="pain-points">
          <PainPulseGrid />
        </div>
        <div id="how-it-works">
          <HowItWorksSection />
        </div>
        <div id="before-after">
          <TrustTimeline />
        </div>
        <div id="conversations">
          <ConversationShowcase />
        </div>
        <div id="day-in-the-life">
          <DayInTheLifeSection />
        </div>
        <div id="features">
          <FeaturesGrid />
        </div>
        <div id="platform">
          <StickyStackerSection />
        </div>
        <div id="patient-journey">
          <WorkflowStrip />
        </div>
        <div id="pricing">
          <PricingSection />
        </div>
        <FAQSection />
        <LandingFooter />
      </main>
    </>
  );
}
