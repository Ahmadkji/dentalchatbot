import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms and conditions that govern your use of DentalGPT Studio, the AI-powered front desk chatbot for dental clinics.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Terms of Service | DentalGPT Studio",
    description:
      "The terms and conditions that govern your use of DentalGPT Studio.",
    url: "/terms",
  },
};

const sections: LegalSection[] = [
  { id: "agreement", title: "Agreement to Terms" },
  { id: "definitions", title: "Definitions" },
  { id: "accounts", title: "Your Account" },
  { id: "license", title: "License to Use the Services" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "customer-responsibilities", title: "Customer Responsibilities" },
  { id: "end-users", title: "End Users & Widget" },
  { id: "ai-disclaimer", title: "AI Disclaimer" },
  { id: "plans-billing", title: "Plans & Billing" },
  { id: "fees", title: "Fees & Payment" },
  { id: "refunds", title: "Refunds" },
  { id: "intellectual-property", title: "Intellectual Property" },
  { id: "customer-content", title: "Customer Content" },
  { id: "privacy", title: "Privacy" },
  { id: "disclaimers", title: "Disclaimers" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "indemnification", title: "Indemnification" },
  { id: "termination", title: "Termination" },
  { id: "governing-law", title: "Governing Law" },
  { id: "changes", title: "Changes to These Terms" },
  { id: "contact", title: "Contact Us" },
];

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="These Terms of Service govern your access to and use of DentalGPT Studio."
      lastUpdated="June 7, 2026"
      sections={sections}
    >
      <h2 id="agreement">Agreement to Terms</h2>
      <p>
        These Terms of Service (&ldquo;Terms,&rdquo; &ldquo;Agreement&rdquo;)
        form a legally binding agreement between you (either an individual or an
        entity, &ldquo;you,&rdquo; &ldquo;Customer&rdquo;) and DentalGPT Studio
        (&ldquo;DentalGPT Studio,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
        &ldquo;our&rdquo;) governing your access to and use of our website,
        dashboard, AI chatbot widget, and related services (collectively, the
        &ldquo;Services&rdquo;).
      </p>
      <p>
        By creating an account or otherwise using the Services, you acknowledge
        that you have read, understood, and agree to be bound by these Terms and
        our <a href="/privacy">Privacy Policy</a>. If you do not agree, you may
        not access or use the Services. If you are entering into these Terms on
        behalf of an entity, you represent that you have the authority to bind
        that entity.
      </p>

      <h2 id="definitions">Definitions</h2>
      <ul>
        <li>
          <strong>&ldquo;Customer Content&rdquo;</strong> means all data,
          information, and materials you upload, configure, or generate through
          the Services, including FAQs, clinic information, conversation logs,
          and lead data.
        </li>
        <li>
          <strong>&ldquo;End User&rdquo;</strong> means any individual who
          interacts with the chatbot widget embedded on your website.
        </li>
        <li>
          <strong>&ldquo;Widget&rdquo;</strong> means the chatbot software
          provided by DentalGPT Studio that you embed on your website.
        </li>
      </ul>

      <h2 id="accounts">Your Account</h2>
      <p>
        To use most features, you must create an account. You agree to:
      </p>
      <ul>
        <li>Provide accurate, current, and complete information;</li>
        <li>Maintain the security of your password and account;</li>
        <li>Promptly update any information that becomes inaccurate;</li>
        <li>
          Accept responsibility for all activities that occur under your account
          or through your Widget.
        </li>
      </ul>
      <p>
        You must be at least 16 years old to create an account. If you use the
        Services in a professional capacity, you warrant that you are authorized
        to do so on behalf of your clinic.
      </p>

      <h2 id="license">License to Use the Services</h2>
      <p>
        Subject to your continued compliance with these Terms and any applicable
        fees, DentalGPT Studio grants you a limited, non-exclusive,
        non-transferable, revocable license to access and use the Services for
        your internal business operations during the term of this Agreement.
      </p>

      <h2 id="acceptable-use">Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Services for any unlawful purpose or in violation of any law;</li>
        <li>
          Upload content that infringes the intellectual property or privacy
          rights of others;
        </li>
        <li>
          Attempt to access, probe, or disrupt the Services&apos; infrastructure,
          security, or non-public APIs;
        </li>
        <li>
          Reverse engineer, decompile, or disassemble any part of the Services
          except as permitted by law;
        </li>
        <li>
          Use the Services to transmit malware, spam, or harmful code;
        </li>
        <li>
          Remove, alter, or obscure any proprietary notices, including the
          chatbot branding where applicable.
        </li>
      </ul>

      <h2 id="customer-responsibilities">Customer Responsibilities</h2>
      <p>
        You are solely responsible for:
      </p>
      <ul>
        <li>
          The accuracy and lawfulness of the Customer Content you upload,
          including clinic information, services, pricing, and FAQs;
        </li>
        <li>
          Complying with all laws applicable to your business, including
          consumer protection, advertising, telemarketing, and healthcare privacy
          laws (such as HIPAA in the United States) to the extent they apply to
          the data your patients submit through the Widget;
        </li>
        <li>
          Obtaining any consents required from End Users before collecting their
          information through the Widget;
        </li>
        <li>
          Maintaining the security of your account and promptly notifying us of
          any unauthorized use.
        </li>
      </ul>

      <h2 id="end-users">End Users &amp; Widget</h2>
      <p>
        You are responsible for the manner in which you deploy the Widget on your
        website. You must display a link to a privacy policy that accurately
        describes how you collect and use End User information through the
        Widget. We may provide default widget behavior and text, but you are
        responsible for ensuring compliance with laws applicable to your End
        Users.
      </p>

      <h2 id="ai-disclaimer">AI Disclaimer</h2>
      <p>
        The chatbot generates responses using artificial intelligence based on
        the Customer Content you provide. AI-generated content may be inaccurate,
        incomplete, or inappropriate. You are responsible for reviewing and
        validating the chatbot&apos;s training content and for monitoring its
        responses.
      </p>
      <p>
        The chatbot does not provide medical advice, diagnosis, or treatment. Do
        not rely on the chatbot for emergency or urgent medical matters. You are
        responsible for instructing your patients accordingly, and for ensuring
        the Widget clearly communicates that it is an automated assistant, not a
        licensed medical professional.
      </p>

      <h2 id="plans-billing">Plans &amp; Billing</h2>
      <p>
        We offer both free and paid plans. The features, limits, and current
        pricing for each plan are described on our{" "}
        <a href="/#pricing">pricing page</a>. We may change plan features or
        pricing upon reasonable advance notice. Changes to pricing will not apply
        to a then-current paid term until renewal.
      </p>

      <h2 id="fees">Fees &amp; Payment</h2>
      <p>
        Paid plans are billed in advance on a recurring monthly basis. By
        selecting a paid plan, you authorize us to charge the applicable fees to
        your designated payment method through our payment processor. Taxes, if
        any, are your responsibility. Fees are non-refundable except as expressly
        provided in these Terms.
      </p>
      <p>
        If a payment fails, we may suspend access to paid features until payment
        is resolved. We are not responsible for any fees charged by your
        financial institution.
      </p>

      <h2 id="refunds">Refunds</h2>
      <p>
        Unless required by law, subscription fees are non-refundable. If you
        believe you have been charged in error, contact us at{" "}
        <a href="mailto:support@dentalgpt.studio">support@dentalgpt.studio</a>{" "}
        within 30 days of the charge and we will review your request.
      </p>

      <h2 id="intellectual-property">Intellectual Property</h2>
      <p>
        The Services, including the software, design, features, and branding, are
        owned by DentalGPT Studio and its licensors and are protected by
        intellectual property laws. These Terms do not grant you any right to use
        our trademarks, logos, or trade dress.
      </p>

      <h2 id="customer-content">Customer Content</h2>
      <p>
        You retain all rights in your Customer Content. You grant DentalGPT
        Studio a worldwide, non-exclusive license to host, store, transmit,
        display, and process your Customer Content solely as necessary to provide
        and improve the Services.
      </p>
      <p>
        You represent and warrant that you have all necessary rights to your
        Customer Content and that it does not violate these Terms or any law.
      </p>

      <h2 id="privacy">Privacy</h2>
      <p>
        Our handling of personal data is described in our{" "}
        <a href="/privacy">Privacy Policy</a>, which is incorporated into these
        Terms by reference.
      </p>

      <h2 id="disclaimers">Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
        IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, DENTALGPT STUDIO
        DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE
        UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT AI-GENERATED RESPONSES WILL
        BE ACCURATE.
      </p>

      <h2 id="liability">Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL DENTALGPT STUDIO
        BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR BUSINESS, ARISING OUT
        OF OR RELATED TO THE SERVICES, WHETHER BASED ON WARRANTY, CONTRACT, TORT,
        OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO
        THE SERVICES WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU HAVE PAID
        TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) FIFTY U.S.
        DOLLARS ($50). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO
        SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.
      </p>

      <h2 id="indemnification">Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless DentalGPT Studio and its
        affiliates from any claims, damages, losses, and expenses (including
        reasonable legal fees) arising out of your Customer Content, your use of
        the Services, your violation of these Terms, or your violation of any law
        or third-party rights.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        You may cancel your account at any time through the dashboard. We may
        suspend or terminate your access to the Services if you breach these
        Terms or if we cease offering the Services. Upon termination, your right
        to use the Services ends immediately. Sections that by their nature
        should survive termination will remain in effect.
      </p>

      <h2 id="governing-law">Governing Law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which
        DentalGPT Studio is established, without regard to conflict-of-law
        principles. You agree to the exclusive jurisdiction of the competent
        courts located in that jurisdiction for any dispute arising from these
        Terms, except where prohibited by mandatory consumer-protection law.
      </p>

      <h2 id="changes">Changes to These Terms</h2>
      <p>
        We may modify these Terms from time to time. We will post the updated
        Terms and revise the &ldquo;Last updated&rdquo; date. Your continued use
        of the Services after changes take effect constitutes acceptance of the
        revised Terms. If you do not agree, you must stop using the Services.
      </p>

      <h2 id="contact">Contact Us</h2>
      <p>
        If you have questions about these Terms, please contact us at{" "}
        <a href="mailto:support@dentalgpt.studio">support@dentalgpt.studio</a>.
      </p>
    </LegalLayout>
  );
}
