import type { Metadata } from "next";
import { LegalLayout, type LegalSection } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How DentalGPT Studio collects, uses, and protects information from dental clinics and their website visitors, including patient lead data and AI conversation content.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy Policy | DentalGPT Studio",
    description:
      "How DentalGPT Studio collects, uses, and protects information from dental clinics and their website visitors.",
    url: "/privacy",
  },
};

const sections: LegalSection[] = [
  { id: "overview", title: "Overview" },
  { id: "information-we-collect", title: "Information We Collect" },
  { id: "how-we-use", title: "How We Use Information" },
  { id: "legal-basis", title: "Legal Basis for Processing" },
  { id: "ai-processing", title: "AI & Conversation Processing" },
  { id: "sharing", title: "Information Sharing" },
  { id: "data-retention", title: "Data Retention" },
  { id: "security", title: "Data Security" },
  { id: "your-rights", title: "Your Privacy Rights" },
  { id: "cookies", title: "Cookies" },
  { id: "children", title: "Children's Privacy" },
  { id: "international", title: "International Transfers" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="This policy explains what information DentalGPT Studio collects, why we collect it, and the choices you have."
      lastUpdated="June 7, 2026"
      sections={sections}
    >
      <h2 id="overview">Overview</h2>
      <p>
        DentalGPT Studio (&ldquo;DentalGPT Studio,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates a software-as-a-service
        platform that provides an AI-powered front desk chatbot for dental
        clinics. This Privacy Policy describes how we collect, use, disclose, and
        safeguard information when you use our website, services, and embedded
        chatbot widget (collectively, the &ldquo;Services&rdquo;).
      </p>
      <p>
        In this policy, two groups of people are involved:
      </p>
      <ul>
        <li>
          <strong>Clinic Customers</strong> — the dental practices that create an
          account and use our Services to manage patient communications.
        </li>
        <li>
          <strong>End Users</strong> — visitors to a Clinic Customer&apos;s
          website who interact with the chatbot widget, including patients and
          prospective patients.
        </li>
      </ul>
      <p>
        By using the Services, you agree to the practices described in this
        Privacy Policy. Please read it carefully.
      </p>

      <h2 id="information-we-collect">Information We Collect</h2>

      <h3>Information from Clinic Customers</h3>
      <p>
        When you create an account and use our Services, we collect:
      </p>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, password
          (stored as a hashed value), and clinic profile details such as clinic
          name, address, phone number, and website URL.
        </li>
        <li>
          <strong>Configuration data:</strong> services and pricing, office
          hours, accepted insurance, FAQs, and knowledge-base content you upload
          to train the chatbot.
        </li>
        <li>
          <strong>Billing information:</strong> when you upgrade to a paid plan,
          we process payment through a third-party payment processor. We do not
          store full credit card numbers on our servers.
        </li>
        <li>
          <strong>Usage data:</strong> information about how you use the
          dashboard, feature preferences, and device/browser information.
        </li>
      </ul>

      <h3>Information from End Users</h3>
      <p>
        When a visitor interacts with the chatbot widget on a Clinic
        Customer&apos;s website, we collect:
      </p>
      <ul>
        <li>
          <strong>Conversation content:</strong> the messages exchanged between
          the visitor and the chatbot.
        </li>
        <li>
          <strong>Lead information:</strong> information the visitor voluntarily
          provides, such as their name, phone number, email address, and reason
          for inquiry.
        </li>
        <li>
          <strong>Appointment requests:</strong> preferred dates, times, and
          reason for visit submitted through the chatbot.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, and basic
          interaction events used to provide and improve the chatbot.
        </li>
      </ul>

      <h3>Information Collected Automatically</h3>
      <p>
        We automatically collect certain information using cookies and similar
        technologies, including log data, device information, and usage analytics.
        See the <a href="/cookies">Cookie Policy</a> for details.
      </p>

      <h2 id="how-we-use">How We Use Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, operate, and maintain the Services;</li>
        <li>
          Generate AI responses to patient questions based on the Clinic
          Customer&apos;s uploaded knowledge base;
        </li>
        <li>
          Capture, store, and display leads and appointment requests in the
          Clinic Customer&apos;s dashboard;
        </li>
        <li>Process payments and manage subscriptions;</li>
        <li>
          Communicate with you about your account, updates, security alerts, and
          support requests;
        </li>
        <li>
          Monitor, analyze, and improve the performance, safety, and quality of
          the Services;
        </li>
        <li>Detect, prevent, and address fraud, abuse, and security issues;</li>
        <li>Comply with our legal obligations.</li>
      </ul>

      <h2 id="legal-basis">Legal Basis for Processing</h2>
      <p>
        For individuals in the European Economic Area, the United Kingdom, and
        other regions with comprehensive privacy laws, we process personal data
        under the following lawful bases:
      </p>
      <ul>
        <li><strong>Performance of a contract:</strong> to deliver the Services you requested.</li>
        <li>
          <strong>Legitimate interests:</strong> to operate, secure, and improve
          our business, provided those interests are not overridden by your
          rights.
        </li>
        <li><strong>Consent:</strong> for activities such as analytics and marketing, where applicable.</li>
        <li><strong>Legal obligation:</strong> to comply with applicable laws.</li>
      </ul>

      <h2 id="ai-processing">AI &amp; Conversation Processing</h2>
      <p>
        Our Services use artificial intelligence and large language models to
        generate responses to patient questions. When an End User sends a
        message, the message is processed to produce a relevant answer based on
        the Clinic Customer&apos;s configured knowledge base.
      </p>
      <p>
        <strong>Important:</strong> DentalGPT Studio is a business tool provided
        to dental clinics. We are not a healthcare provider, and the chatbot is
        not intended to provide medical advice, diagnosis, or treatment. Clinic
        Customers are responsible for determining what information their patients
        submit and for complying with applicable healthcare privacy laws, such as
        HIPAA in the United States, that may apply to their practice.
      </p>
      <p>
        We process conversation data to operate the chatbot for the Clinic
        Customer. We do not sell conversation content or lead data to third
        parties.
      </p>

      <h2 id="sharing">Information Sharing</h2>
      <p>
        We do not sell your personal information. We share information only as
        described in this policy:
      </p>
      <ul>
        <li>
          <strong>With Clinic Customers:</strong> End User conversation content
          and lead data is shared with the Clinic Customer whose website the End
          User contacted. The Clinic Customer controls this data within their
          account.
        </li>
        <li>
          <strong>Service providers:</strong> We use trusted third parties to
          host infrastructure, deliver email, process payments, and provide AI
          inference. These providers are bound by confidentiality obligations and
          may only use data to provide services to us.
        </li>
        <li>
          <strong>Legal compliance:</strong> We may disclose information when
          required by law, court order, or to protect the rights, property, or
          safety of our users or the public.
        </li>
        <li>
          <strong>Business transfers:</strong> In connection with a merger,
          acquisition, or sale of assets, information may be transferred subject
          to the protections of this policy.
        </li>
      </ul>

      <h2 id="data-retention">Data Retention</h2>
      <p>
        We retain information for as long as your account is active or as needed
        to provide the Services. Conversation content, leads, and appointment
        requests remain available to the Clinic Customer within their account
        until they choose to delete them or close their account.
      </p>
      <p>
        When an account is closed, we delete or anonymize the associated data
        within a reasonable period, except where we are required to retain
        information for legal, accounting, or compliance purposes.
      </p>

      <h2 id="security">Data Security</h2>
      <p>
        We implement industry-standard administrative, technical, and physical
        safeguards designed to protect personal information. This includes
        encryption in transit, access controls, and database row-level security
        policies that isolate each clinic&apos;s data.
      </p>
      <p>
        However, no method of transmission over the internet or electronic
        storage is completely secure. We cannot guarantee absolute security, but
        we work to protect your information using reasonable measures.
      </p>

      <h2 id="your-rights">Your Privacy Rights</h2>
      <p>
        Depending on where you live, you may have the right to:
      </p>
      <ul>
        <li>Access the personal information we hold about you;</li>
        <li>Correct inaccurate or incomplete information;</li>
        <li>Request deletion of your personal information;</li>
        <li>Object to or restrict certain processing;</li>
        <li>Request a portable copy of your data;</li>
        <li>Withdraw consent at any time (without affecting prior processing);</li>
        <li>Opt out of the &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of personal information as defined under applicable law.</li>
      </ul>
      <p>
        Clinic Customers can manage data directly within their dashboard. End
        Users who wish to exercise these rights should contact the relevant
        Clinic Customer first, or reach out to us at{" "}
        <a href="mailto:support@dentalgpt.studio">support@dentalgpt.studio</a>{" "}
        and we will direct your request appropriately.
      </p>

      <h2 id="cookies">Cookies</h2>
      <p>
        We use cookies and similar technologies to operate and improve the
        Services. Details about the specific cookies we use and how to manage
        them are in our <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2 id="children">Children&apos;s Privacy</h2>
      <p>
        The Services are not directed to children under the age of 16, and we do
        not knowingly collect personal information from children. If you believe a
        child has provided us with personal information, please contact us so we
        can delete it.
      </p>

      <h2 id="international">International Transfers</h2>
      <p>
        Your information may be processed in countries other than your own. Where
        this occurs, we take steps designed to ensure your information is handled
        in accordance with this Privacy Policy and applicable data protection
        laws, including through appropriate transfer mechanisms.
      </p>

      <h2 id="changes">Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will
        revise the &ldquo;Last updated&rdquo; date at the top of this page. For
        material changes, we will provide a more prominent notice, such as within
        the Services or via email. We encourage you to review this page
        periodically.
      </p>

      <h2 id="contact">Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or our data practices,
        please contact us at{" "}
        <a href="mailto:support@dentalgpt.studio">support@dentalgpt.studio</a>.
      </p>
    </LegalLayout>
  );
}
