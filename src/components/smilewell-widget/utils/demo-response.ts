// Landing-page demo response mapping
export const DEMO_RESPONSES: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ['feature', 'what can', 'what do', 'can you', 'help', 'capabilities', 'what are'],
    response:
      "I can do a lot for your dental clinic! Here's what DentalGPT Studio offers:\n\n**24/7 AI Chat** — I answer patient questions around the clock, even after hours and on weekends.\n\n**Appointment Requests** — Patients request appointments directly through chat. Your staff reviews and confirms in the dashboard.\n\n**Lead Capture & Tracking** — Every patient inquiry becomes a trackable lead with name, phone number, and intent.\n\n**FAQ Builder** — You train me with your clinic's common questions. I learn your services, hours, and policies.\n\n**Website Widget Embed** — Install me on any website in minutes with one line of code.\n\n**Custom Branding** — Match your clinic's colors, logo, and tone so patients feel like they're talking to your team.\n\nWant to see how I handle a specific question? Just ask me about pricing, setup, appointments, or anything else!",
  },
  {
    keywords: ['price', 'cost', 'pricing', 'plan', 'free', 'how much', 'afford', 'cheap', 'expensive', 'money', 'save', 'roi', 'salary'],
    response:
      "Great question! DentalGPT Studio has two plans:\n\n**Starter Plan — Free forever**\n• AI conversations\n• Basic FAQ training\n• Website widget embed\n• Email support\n• No credit card required\n\n**Professional Plan — $49/month**\n• Unlimited conversations\n• Appointment request collection\n• Lead capture & tracking\n• After-hours coverage\n• Dashboard & insights\n• Priority support\n\n**Think about it this way:** The average front desk salary is $3,200/month. DentalGPT Studio Pro is just $49/month — that's a savings of over $3,150 every month, while capturing leads 24/7 that your front desk would miss.\n\nYou can start free and upgrade whenever you're ready. No hidden fees, no contracts.",
  },
  {
    keywords: ['setup', 'start', 'begin', 'how long', 'install', 'get started', 'sign up', 'onboard'],
    response:
      "Getting started is quick — most dental clinics are live in under 5 minutes!\n\n**Step 1: Sign up** using the Get Started button on this page\n**Step 2: Add your clinic** — Enter your clinic name, services, hours, and FAQs.\n**Step 3: Copy embed code** — One line of JavaScript onto your website. Works with WordPress, Squarespace, Wix, Webflow, and custom sites.\n**Step 4: You're live!** Your AI front desk starts answering patients immediately.\n\nNo developer needed. No credit card required for the free plan.\n\nWant to try it? Head to our **Get Started** button at the top of this page!",
  },
  {
    keywords: ['appointment', 'book', 'schedule', 'request', 'calendar'],
    response:
      "Yes, patients can request appointments directly through me! Here's how it works:\n\n1. The patient clicks **Book Appointment** or asks about scheduling\n2. I collect their name, phone number, preferred date, time, and reason for visit\n3. The request is logged in your dashboard\n4. Your staff reviews and confirms at their convenience\n\nThis means appointment requests come in 24/7 — even after hours, on weekends, and during holidays. No more missed opportunities because the front desk was busy or closed.\n\nOn the Professional plan, you also get after-hours lead capture so no request slips through.",
  },
  {
    keywords: ['website', 'wordpress', 'wix', 'squarespace', 'webflow', 'embed', 'install', 'code', 'integrat', 'platform', 'work with'],
    response:
      "DentalGPT Studio works with **any website platform** — WordPress, Squarespace, Wix, Webflow, custom HTML, and more.\n\nYou embed the chatbot widget with a **single line of JavaScript**. No developer needed. Just copy the code from your dashboard and paste it into your website.\n\nThe widget appears as a floating chat bubble in the corner of your site. Patients click it and start chatting instantly. You can customize the color, position, welcome message, and quick prompts to match your clinic's brand.\n\nSetup takes under 5 minutes from signup to live.",
  },
  {
    keywords: ['lead', 'capture', 'track', 'patient info', 'contact', 'name', 'phone', 'email'],
    response:
      "Every patient inquiry through the chatbot becomes a **trackable lead**. Here's what gets captured automatically:\n\n• **Patient name**\n• **Phone number**\n• **Email** (if provided)\n• **Their question or reason for inquiry**\n• **Source** (chatbot)\n\nAll leads appear in your **Dashboard** where you can view, follow up, and manage them. On the Professional plan, you also get lead tracking insights so you can see which questions bring in the most potential patients.\n\nThis means even at 11 PM on a Sunday, if someone visits your site and asks about teeth whitening, their details are captured and waiting for your staff Monday morning.",
  },
  {
    keywords: ['after hour', 'weekend', 'night', '24/7', 'closed', 'missed call', 'miss call'],
    response:
      "This is one of the biggest problems DentalGPT Studio solves!\n\nWhen your front desk is closed — after hours, during lunch, on weekends, or during procedures — patients still have questions. Without an AI chatbot, those inquiries go unanswered and those potential patients often move on to the next clinic.\n\n**DentalGPT Studio answers 24/7:**\n• Greets every visitor with a friendly welcome message\n• Answers their questions using your trained clinic data\n• Captures their contact details as leads\n• Collects appointment requests for your staff to confirm\n\nOn the Professional plan, you get full after-hours lead capture. Your AI never takes a day off.",
  },
  {
    keywords: ['faq', 'train', 'knowledge', 'learn', 'teach', 'data', 'upload', 'question'],
    response:
      "Training me is easy! You can teach me about your clinic in several ways:\n\n**FAQ Builder** — Add your clinic's common questions and answers. I learn your services, hours, insurance policies, and pricing.\n\n**Knowledge Sources** — Upload documents, paste text, or connect your website. I read and learn from your content.\n\n**Website Scrape** — Point me to your clinic's website and I'll import relevant content automatically.\n\nOnce trained, I answer questions using only your approved knowledge. I won't make up answers — if I'm not sure about something, I direct the patient to contact your clinic directly.\n\nYou can update and retrain anytime from the dashboard.",
  },
  {
    keywords: ['how', 'work', 'demo', 'show me', 'example', 'see', 'try', 'test'],
    response:
      "Here's how DentalGPT Studio works in practice:\n\n**Imagine this scenario:**\nA patient visits your clinic's website at 9 PM on a Saturday. They want to know if you offer Invisalign and how much it costs.\n\n1. The AI chatbot greets them: **\"Hi! How can I help you today?\"**\n2. The patient types: **\"Do you do Invisalign? How much is it?\"**\n3. The bot responds instantly using your trained knowledge: **\"Yes, we offer Invisalign starting at $3,000. Would you like to book a consultation?\"**\n4. The patient says yes → the bot collects their name, phone, and preferred date\n5. An appointment request appears in your dashboard\n6. Monday morning, your staff confirms the appointment\n\n**That lead would have been lost without the chatbot.** And this happens 24/7, for every patient question.\n\nThis demo you're using right now shows the exact chat experience your patients would get!",
  },
  {
    keywords: ['brand', 'color', 'custom', 'look', 'design', 'logo', 'style', 'tone', 'appear'],
    response:
      "Absolutely — you can fully customize the chatbot to match your clinic's brand:\n\n• **Primary color** — Match your clinic's brand colors\n• **Bot name** — Call it anything you want (e.g., \"SmileWell Assistant\")\n• **Welcome message** — Greet patients your way\n• **Quick prompts** — Add buttons for common questions\n• **Tone** — Friendly, professional, casual, or formal\n• **WhatsApp, Call, Location buttons** — Show or hide as needed\n\nPatients will feel like they're talking to your team, not a generic bot. The widget blends seamlessly into your website design.",
  },
  {
    keywords: ['dashboard', 'insight', 'manage', 'conversation', 'analytics', 'report', 'view', 'admin'],
    response:
      "Your **Dashboard** gives you full control and visibility:\n\n• **Conversations** — View every chat between patients and the AI\n• **Leads** — See all captured leads with contact details and intent\n• **Appointment Requests** — Review and confirm incoming requests\n• **Unanswered Questions** — See what the AI couldn't answer so you can train it\n• **Analytics** — Track message volume, lead sources, and response quality\n\nEverything is in one place. Your staff can manage leads and appointments without switching between tools.\n\nThe Dashboard is available on the Professional plan ($49/month).",
  },
  {
    keywords: ['support', 'help me', 'contact', 'talk', 'human', 'real person', 'staff', 'email'],
    response:
      "We're here to help!\n\n• **Starter plan**: Email support\n• **Professional plan**: Priority support with faster response times\n\nIf you're ready to set up your AI front desk, click **Get Started Free** at the top of this page. You can have the widget live on your website in under 5 minutes.\n\nHave a specific question I didn't answer? Just type it — I'm here to help you understand how DentalGPT Studio works for your clinic!",
  },
]

export const DEMO_FALLBACK_RESPONSE =
  "That's a great question! I'm a simulated demo of DentalGPT Studio — the AI front desk for dental clinics.\n\nWhen installed on your clinic's website, I would use AI to answer your patients' questions about services, hours, pricing, insurance, and more. I'd also capture leads and appointment requests 24/7.\n\n**Want to see specific examples?** Try asking me about:\n• **Pricing** — How much does it cost?\n• **Features** — What can the chatbot do?\n• **Setup** — How do I get started?\n• **Appointments** — Can patients book through the bot?\n• **Leads** — How does lead capture work?\n• **After hours** — What happens when the clinic is closed?\n\nOr click **Get Started Free** at the top of this page to try it for real!"

export function getDemoResponse(message: string): string {
  const lower = message.toLowerCase()
  for (const entry of DEMO_RESPONSES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.response
    }
  }
  return DEMO_FALLBACK_RESPONSE
}
