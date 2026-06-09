import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How DentalGPT Studio uses cookies and similar technologies to operate, secure, and improve our services.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Cookie Policy | DentalGPT Studio",
    description:
      "How DentalGPT Studio uses cookies and similar technologies.",
    url: "/cookies",
  },
};

const sections: LegalSection[] = [
  { id: "what-are-cookies", title: "What Are Cookies?" },
  { id: "how-we-use", title: "How We Use Cookies" },
  { id: "types", title: "Types of Cookies We Use" },
  { id: "third-party", title: "Third-Party Cookies" },
  { id: "manage", title: "Managing & Disabling Cookies" },
  { id: "impact", title: "Impact of Disabling Cookies" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function CookiePolicyPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      description="This policy explains how DentalGPT Studio uses cookies and similar technologies."
      lastUpdated="June 7, 2026"
      sections={sections}
    >
      <h2 id="what-are-cookies">What Are Cookies?</h2>
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They are widely used to make websites work efficiently and to
        provide information to the site owners. &ldquo;Cookies&rdquo; in this
        policy also refers to similar technologies such as local storage, pixel
        tags, and web beacons.
      </p>

      <h2 id="how-we-use">How We Use Cookies</h2>
      <p>
        DentalGPT Studio uses cookies to:
      </p>
      <ul>
        <li>Keep you signed in and remember your preferences;</li>
        <li>Recognize your device when you return;</li>
        <li>Understand how visitors use our site so we can improve it;</li>
        <li>Detect and prevent fraud and abuse;</li>
        <li>Operate essential features of the Services.</li>
      </ul>
      <p>
        Our use of cookies is described in more detail in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2 id="types">Types of Cookies We Use</h2>
      <p>
        We group cookies into four categories:
      </p>
      <ul>
        <li>
          <strong>Strictly necessary cookies:</strong> required for the website
          to function. They enable core features such as security and
          authentication. These cannot be disabled in our systems.
        </li>
        <li>
          <strong>Preference cookies:</strong> remember your settings and
          choices, such as language or theme, to provide a more personalized
          experience.
        </li>
        <li>
          <strong>Analytics cookies:</strong> help us understand how visitors
          interact with the site by collecting aggregated, anonymous
          information. We use this data to improve performance and usability.
        </li>
        <li>
          <strong>Marketing cookies:</strong> may be used to make our outreach
          more relevant. These are only set with your consent, where applicable.
        </li>
      </ul>

      <h3>Duration</h3>
      <p>
        Some cookies are <strong>session cookies</strong>, which expire when you
        close your browser. Others are <strong>persistent cookies</strong>,
        which remain on your device until they expire or you delete them.
      </p>

      <h2 id="third-party">Third-Party Cookies</h2>
      <p>
        Some cookies are set by third-party services we use to operate and
        improve the Services, such as analytics, hosting, and authentication
        providers. These third parties may use cookies subject to their own
        privacy policies. We do not control these cookies and recommend reviewing
        the relevant provider&apos;s policy.
      </p>

      <h2 id="manage">Managing &amp; Disabling Cookies</h2>
      <p>
        You have the right to decide whether to accept cookies. Most browsers
        allow you to:
      </p>
      <ul>
        <li>Accept or decline cookies;</li>
        <li>Block third-party cookies;</li>
        <li>Clear cookies that are already stored on your device;</li>
        <li>Set preferences for specific websites.</li>
      </ul>
      <p>
        Controls are usually found in your browser&apos;s
        &ldquo;Settings,&rdquo; &ldquo;Preferences,&rdquo; or
        &ldquo;Options&rdquo; menu. The links below may help:
      </p>
      <ul>
        <li>
          <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
            Google Chrome
          </a>
        </li>
        <li>
          <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">
            Mozilla Firefox
          </a>
        </li>
        <li>
          <a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer">
            Safari
          </a>
        </li>
        <li>
          <a href="https://support.microsoft.com/help/17442" target="_blank" rel="noopener noreferrer">
            Microsoft Edge
          </a>
        </li>
      </ul>

      <h2 id="impact">Impact of Disabling Cookies</h2>
      <p>
        Strictly necessary cookies cannot be disabled, as the Services would not
        function without them. If you disable other cookies, some features may
        not work as intended &mdash; for example, you may need to sign in again
        each time you visit, or some personalization may be lost. Disabling
        cookies does not delete data we already hold about you in accordance with
        our Privacy Policy.
      </p>

      <h2 id="changes">Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time. When we do, we will
        revise the &ldquo;Last updated&rdquo; date above. We encourage you to
        review this page periodically.
      </p>

      <h2 id="contact">Contact Us</h2>
      <p>
        If you have questions about our use of cookies, please contact us at{" "}
        <a href="mailto:support@dentalgpt.studio">support@dentalgpt.studio</a>.
      </p>
    </LegalLayout>
  );
}
