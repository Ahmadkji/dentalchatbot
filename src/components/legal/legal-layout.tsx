import Link from "next/link";
import { Stethoscope, ArrowLeft } from "lucide-react";

export interface LegalSection {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
  children: React.ReactNode;
}

/**
 * Shared visual shell for legal pages (/privacy, /terms, /cookies).
 * Renders a sticky brand header, a title hero, a sticky table of contents
 * (desktop only), the document body, and a legal cross-link footer.
 */
export function LegalLayout({
  title,
  description,
  lastUpdated,
  sections,
  children,
}: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="DentalGPT Studio home"
          >
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">DentalGPT Studio</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </header>

      {/* Title hero */}
      <section className="border-b border-slate-100 bg-slate-50/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <p className="text-xs font-semibold text-emerald-600 tracking-[0.15em] uppercase mb-3">
            Legal
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          <p className="text-slate-500 mt-3 max-w-2xl">{description}</p>
          <p className="text-sm text-slate-400 mt-5">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Body with table of contents */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          {/* Sticky TOC — desktop only */}
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-20">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                On this page
              </p>
              <ul className="space-y-2 border-l border-slate-200">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block text-sm text-slate-500 hover:text-emerald-600 hover:border-emerald-500 -ml-px border-l border-transparent pl-4 py-0.5 transition-colors"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Document content */}
          <div className="prose-legal max-w-none mt-8 lg:mt-0">{children}</div>
        </div>
      </div>

      {/* Legal cross-link footer */}
      <footer className="border-t border-slate-100 bg-slate-50/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-slate-500">
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-slate-900 transition-colors">
                Terms of Service
              </Link>
              <Link href="/cookies" className="hover:text-slate-900 transition-colors">
                Cookie Policy
              </Link>
            </div>
            <p className="text-slate-400">
              &copy; 2026 DentalGPT Studio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
