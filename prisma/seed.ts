import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.botSetting.deleteMany();
  await prisma.patient.deleteMany();

  // Create 12 Patients
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        name: 'Sarah Mitchell',
        email: 'sarah.mitchell@email.com',
        phone: '(555) 234-5678',
        dob: '1988-03-15',
        lastVisit: '2025-01-10',
        status: 'active',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'James Rodriguez',
        email: 'james.rodriguez@email.com',
        phone: '(555) 345-6789',
        dob: '1975-07-22',
        lastVisit: '2024-11-05',
        status: 'active',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Emily Chen',
        email: 'emily.chen@email.com',
        phone: '(555) 456-7890',
        dob: '1992-11-08',
        lastVisit: '2025-02-18',
        status: 'active',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Michael Thompson',
        email: 'michael.thompson@email.com',
        phone: '(555) 567-8901',
        dob: '1965-05-30',
        lastVisit: '2024-09-12',
        status: 'inactive',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Olivia Parker',
        email: 'olivia.parker@email.com',
        phone: '(555) 678-9012',
        dob: '1998-01-25',
        lastVisit: null,
        status: 'new',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'David Kim',
        email: 'david.kim@email.com',
        phone: '(555) 789-0123',
        dob: '1983-09-14',
        lastVisit: '2025-01-28',
        status: 'active',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Rachel Green',
        email: 'rachel.green@email.com',
        phone: '(555) 890-1234',
        dob: '1990-12-03',
        lastVisit: '2024-08-20',
        status: 'inactive',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Marcus Johnson',
        email: 'marcus.johnson@email.com',
        phone: '(555) 901-2345',
        dob: '1972-04-18',
        lastVisit: '2025-02-05',
        status: 'active',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Sophia Williams',
        email: 'sophia.williams@email.com',
        phone: '(555) 012-3456',
        dob: '1995-06-27',
        lastVisit: null,
        status: 'new',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Robert Davis',
        email: 'robert.davis@email.com',
        phone: '(555) 123-4567',
        dob: '1958-10-09',
        lastVisit: '2024-12-15',
        status: 'active',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Isabella Martinez',
        email: 'isabella.martinez@email.com',
        phone: '(555) 234-9876',
        dob: '2001-02-14',
        lastVisit: null,
        status: 'new',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Thomas Anderson',
        email: 'thomas.anderson@email.com',
        phone: '(555) 345-8765',
        dob: '1980-08-21',
        lastVisit: '2024-07-30',
        status: 'inactive',
      },
    }),
  ]);

  console.log(`Created ${patients.length} patients`);

  // Create 22 Conversations
  const conversationsData = [
    { patientId: patients[0].id, channel: 'web', status: 'active', subject: 'Tooth pain consultation', lastMessage: 'I have a sharp pain in my lower molar.' },
    { patientId: patients[0].id, channel: 'phone', status: 'closed', subject: 'Appointment rescheduling', lastMessage: 'Thank you, the new time works perfectly.' },
    { patientId: patients[1].id, channel: 'whatsapp', status: 'active', subject: 'Root canal inquiry', lastMessage: 'What does the root canal procedure involve?' },
    { patientId: patients[1].id, channel: 'web', status: 'closed', subject: 'Dental cleaning appointment', lastMessage: 'Confirmed for next Tuesday at 10am.' },
    { patientId: patients[2].id, channel: 'web', status: 'pending', subject: 'Teeth whitening options', lastMessage: 'What whitening treatments do you offer?' },
    { patientId: patients[2].id, channel: 'phone', status: 'active', subject: 'Insurance coverage question', lastMessage: 'Does my plan cover cosmetic procedures?' },
    { patientId: patients[3].id, channel: 'web', status: 'closed', subject: 'Denture fitting inquiry', lastMessage: 'I will call to schedule the fitting.' },
    { patientId: patients[4].id, channel: 'whatsapp', status: 'active', subject: 'First visit preparation', lastMessage: 'What should I bring to my first appointment?' },
    { patientId: patients[5].id, channel: 'web', status: 'active', subject: 'Cavity filling appointment', lastMessage: 'How long does a filling usually take?' },
    { patientId: patients[5].id, channel: 'web', status: 'closed', subject: 'Post-procedure care', lastMessage: 'The sensitivity has gone down, thank you!' },
    { patientId: patients[6].id, channel: 'phone', status: 'closed', subject: 'Orthodontic consultation', lastMessage: 'I will think about the Invisalign option.' },
    { patientId: patients[7].id, channel: 'whatsapp', status: 'active', subject: 'Crown replacement query', lastMessage: 'My crown feels loose, should I come in?' },
    { patientId: patients[7].id, channel: 'web', status: 'pending', subject: 'Payment plan options', lastMessage: 'Do you offer installment payment plans?' },
    { patientId: patients[8].id, channel: 'web', status: 'active', subject: 'New patient registration', lastMessage: 'I just moved to the area and need a dentist.' },
    { patientId: patients[9].id, channel: 'phone', status: 'closed', subject: 'Gum disease treatment', lastMessage: 'The deep cleaning went well, thanks.' },
    { patientId: patients[9].id, channel: 'web', status: 'active', subject: 'Implant consultation', lastMessage: 'Am I a good candidate for dental implants?' },
    { patientId: patients[10].id, channel: 'whatsapp', status: 'pending', subject: 'Wisdom tooth extraction', lastMessage: 'How much does wisdom tooth removal cost?' },
    { patientId: patients[10].id, channel: 'web', status: 'active', subject: 'Braces vs Invisalign', lastMessage: 'Which is better for gap closure?' },
    { patientId: patients[11].id, channel: 'web', status: 'closed', subject: 'Emergency toothache', lastMessage: 'The pain has subsided after the medication.' },
    { patientId: patients[3].id, channel: 'web', status: 'pending', subject: 'Dental bridge cost', lastMessage: 'Can you give me an estimate for a 3-unit bridge?' },
    { patientId: patients[6].id, channel: 'whatsapp', status: 'active', subject: 'Night guard fitting', lastMessage: 'I grind my teeth at night, can you help?' },
    { patientId: patients[1].id, channel: 'web', status: 'active', subject: 'Follow-up after root canal', lastMessage: 'Is some sensitivity normal after a week?' },
  ];

  const conversations = await Promise.all(
    conversationsData.map((conv, index) =>
      prisma.conversation.create({
        data: {
          ...conv,
          messageCount: 0,
        },
      })
    )
  );

  console.log(`Created ${conversations.length} conversations`);

  // Create 44 Messages across conversations
  const messagesData = [
    // Conversation 1: Sarah - Tooth pain
    { conversationId: conversations[0].id, role: 'user', content: 'Hi, I have a sharp pain in my lower molar when I eat something cold.' },
    { conversationId: conversations[0].id, role: 'assistant', content: 'I\'m sorry to hear about your pain, Sarah. Sensitivity to cold can indicate a cavity or nerve issue. I\'d recommend scheduling an examination as soon as possible. Would you like me to help you book an appointment?' },

    // Conversation 2: Sarah - Rescheduling
    { conversationId: conversations[1].id, role: 'user', content: 'I need to reschedule my appointment on Friday.' },
    { conversationId: conversations[1].id, role: 'assistant', content: 'Of course! I\'d be happy to help you reschedule. What day and time would work better for you?' },
    { conversationId: conversations[1].id, role: 'user', content: 'How about next Monday at 2pm?' },
    { conversationId: conversations[1].id, role: 'assistant', content: 'Monday at 2pm is available. I\'ve updated your appointment. Is there anything else I can help you with?' },

    // Conversation 3: James - Root canal
    { conversationId: conversations[2].id, role: 'user', content: 'My dentist mentioned I might need a root canal. What does the procedure involve?' },
    { conversationId: conversations[2].id, role: 'assistant', content: 'A root canal treatment involves removing the infected or damaged pulp from inside the tooth, cleaning and disinfecting the area, then filling and sealing it. The procedure is typically done under local anesthesia, so you shouldn\'t feel pain during it. It usually takes 1-2 visits. Would you like to schedule a consultation with our endodontist?' },

    // Conversation 4: James - Cleaning
    { conversationId: conversations[3].id, role: 'user', content: 'I\'d like to book a dental cleaning.' },
    { conversationId: conversations[3].id, role: 'assistant', content: 'Great choice! Regular cleanings are essential for maintaining oral health. We have availability next Tuesday at 10am or Thursday at 3pm. Which works better for you?' },
    { conversationId: conversations[3].id, role: 'user', content: 'Tuesday at 10am please.' },
    { conversationId: conversations[3].id, role: 'assistant', content: 'Confirmed! Your dental cleaning is scheduled for next Tuesday at 10am. Please arrive 10 minutes early to complete any paperwork. See you then!' },

    // Conversation 5: Emily - Whitening
    { conversationId: conversations[4].id, role: 'user', content: 'I\'m interested in teeth whitening. What options do you offer?' },
    { conversationId: conversations[4].id, role: 'assistant', content: 'We offer two main whitening options: in-office professional whitening using Zoom technology, which takes about an hour and can lighten teeth up to 8 shades, and custom take-home trays with professional-grade whitening gel. The in-office treatment provides faster results, while take-home trays offer more gradual whitening over 2-3 weeks. Would you like to know pricing or schedule a consultation?' },

    // Conversation 6: Emily - Insurance
    { conversationId: conversations[5].id, role: 'user', content: 'Does my insurance plan cover cosmetic procedures?' },
    { conversationId: conversations[5].id, role: 'assistant', content: 'Most dental insurance plans don\'t cover purely cosmetic procedures like whitening or veneers. However, some procedures that have both cosmetic and functional benefits, like crowns or bonding, may be partially covered. I recommend checking with your insurance provider for specific coverage details. If you can provide your insurance details, our billing team can verify your coverage for you.' },

    // Conversation 7: Michael - Dentures
    { conversationId: conversations[6].id, role: 'user', content: 'I need to get dentures. How does the process work?' },
    { conversationId: conversations[6].id, role: 'assistant', content: 'The denture process typically involves several appointments: first, we take impressions and measurements, then we create a wax model for you to try, and finally we fabricate and fit the final dentures. The entire process takes about 3-6 weeks. We offer both full and partial dentures. Would you like to schedule a consultation to discuss your options?' },

    // Conversation 8: Olivia - First visit
    { conversationId: conversations[7].id, role: 'user', content: 'This will be my first visit. What should I bring?' },
    { conversationId: conversations[7].id, role: 'assistant', content: 'Welcome to BrightSmile Dental! For your first visit, please bring: a valid photo ID, your insurance card, any previous dental records or X-rays if available, a list of current medications, and a completed new patient form (which you can fill out online or in the office). Also, please arrive 15 minutes early to complete the registration process. We look forward to meeting you!' },

    // Conversation 9: David - Cavity filling
    { conversationId: conversations[8].id, role: 'user', content: 'How long does a cavity filling usually take?' },
    { conversationId: conversations[8].id, role: 'assistant', content: 'A standard cavity filling typically takes about 30-60 minutes depending on the size and location of the cavity. The process includes numbing the area, removing the decay, and placing the filling material. We use tooth-colored composite fillings that blend naturally with your teeth. You\'ll be numb for a couple of hours after the procedure. Would you like to schedule an appointment?' },

    // Conversation 10: David - Post-procedure
    { conversationId: conversations[9].id, role: 'user', content: 'I had a filling done yesterday and it still feels sensitive. Is that normal?' },
    { conversationId: conversations[9].id, role: 'assistant', content: 'Yes, some sensitivity after a filling is completely normal and can last for a few days to a couple of weeks. It\'s especially common with cold or hot foods. Try to avoid extreme temperatures and chew on the other side if possible. If the sensitivity is severe, persists beyond two weeks, or you experience sharp pain when biting, please contact us right away as the filling may need adjustment.' },
    { conversationId: conversations[9].id, role: 'user', content: 'The sensitivity has gone down, thank you!' },
    { conversationId: conversations[9].id, role: 'assistant', content: 'That\'s great to hear! If you experience any further issues, don\'t hesitate to reach out. Take care of that smile!' },

    // Conversation 11: Rachel - Orthodontic
    { conversationId: conversations[10].id, role: 'user', content: 'I\'m considering Invisalign. How does it compare to traditional braces?' },
    { conversationId: conversations[10].id, role: 'assistant', content: 'Invisalign uses clear, removable aligners that are virtually invisible. Compared to traditional braces: they\'re more aesthetically pleasing, you can remove them to eat and clean, and they typically require fewer office visits. However, they require discipline to wear 20-22 hours daily, and may not be suitable for very complex cases. Treatment time is similar, averaging 12-18 months. Would you like a consultation to see if you\'re a candidate?' },

    // Conversation 12: Marcus - Crown
    { conversationId: conversations[11].id, role: 'user', content: 'My crown feels loose. Should I come in?' },
    { conversationId: conversations[11].id, role: 'assistant', content: 'Yes, a loose crown should be addressed promptly. If it comes off completely, keep it safe and avoid chewing on that side. A loose crown can allow bacteria to enter and cause decay under the crown. Please call our office to schedule an emergency visit, and we\'ll try to see you as soon as possible. In the meantime, avoid sticky or hard foods near that tooth.' },

    // Conversation 13: Marcus - Payment
    { conversationId: conversations[12].id, role: 'user', content: 'Do you offer payment plans for expensive procedures?' },
    { conversationId: conversations[12].id, role: 'assistant', content: 'Yes, we do offer payment options! We accept CareCredit financing which allows you to pay over time with promotional no-interest periods. We also offer an in-house payment plan for procedures over $500, where you can split the cost into monthly installments. Additionally, we provide a 5% discount for upfront payment on treatments over $1,000. Would you like more details on any of these options?' },

    // Conversation 14: Sophia - New patient
    { conversationId: conversations[13].id, role: 'user', content: 'Hi, I just moved to the area and I\'m looking for a new dentist.' },
    { conversationId: conversations[13].id, role: 'assistant', content: 'Welcome to the neighborhood! We\'d love to be your dental home. At BrightSmile Dental, we offer comprehensive dental care including preventive, restorative, and cosmetic services. New patients receive a complimentary initial consultation. Would you like to schedule your first visit? We have openings this week!' },

    // Conversation 15: Robert - Gum disease
    { conversationId: conversations[14].id, role: 'user', content: 'My gums have been bleeding when I brush. What should I do?' },
    { conversationId: conversations[14].id, role: 'assistant', content: 'Bleeding gums are often a sign of gingivitis or gum disease. It\'s important not to ignore this symptom. I recommend scheduling a periodontal evaluation where we can assess your gum health and recommend appropriate treatment, which may include a deep cleaning (scaling and root planing). In the meantime, continue gentle brushing and flossing, and consider using an antibacterial mouthwash.' },

    // Conversation 16: Robert - Implant
    { conversationId: conversations[15].id, role: 'user', content: 'Am I a good candidate for dental implants?' },
    { conversationId: conversations[15].id, role: 'assistant', content: 'Good candidates for dental implants generally have healthy gums, adequate bone density to support the implant, and good overall health. Factors like uncontrolled diabetes, smoking, or significant bone loss may affect eligibility. The best way to determine your candidacy is through a consultation with X-rays and a thorough examination. Our implant specialist can evaluate your specific situation. Would you like to schedule a consultation?' },

    // Conversation 17: Isabella - Wisdom tooth
    { conversationId: conversations[16].id, role: 'user', content: 'How much does wisdom tooth removal cost?' },
    { conversationId: conversations[16].id, role: 'assistant', content: 'The cost of wisdom tooth extraction varies based on complexity: a simple extraction ranges from $200-$400 per tooth, while impacted wisdom teeth requiring surgical removal can range from $400-$800 per tooth. Your actual cost will depend on the position of the teeth and type of anesthesia needed. We provide free consultations that include a panoramic X-ray. Insurance often covers a portion of the cost. Would you like to schedule a consultation?' },

    // Conversation 18: Isabella - Braces
    { conversationId: conversations[17].id, role: 'user', content: 'Which is better for closing gaps: braces or Invisalign?' },
    { conversationId: conversations[17].id, role: 'assistant', content: 'Both traditional braces and Invisalign can effectively close gaps. Traditional braces may be slightly more efficient for larger gaps or complex spacing issues, as they provide continuous force. Invisalign works well for mild to moderate gaps and offers the advantage of being nearly invisible and removable. For the best recommendation, our orthodontist would need to evaluate your specific case. Many patients are great candidates for either option!' },

    // Conversation 19: Thomas - Emergency
    { conversationId: conversations[18].id, role: 'user', content: 'I have a terrible toothache that started suddenly. This is an emergency!' },
    { conversationId: conversations[18].id, role: 'assistant', content: 'I\'m sorry you\'re in pain! A sudden severe toothache can indicate an infection or abscess, which needs prompt attention. Please call our office immediately for a same-day emergency appointment. In the meantime, you can take over-the-counter pain medication, apply a cold compress to the outside of your cheek, and avoid very hot or cold foods. If you experience facial swelling or fever, please go to the emergency room.' },

    // Conversation 20: Michael - Bridge
    { conversationId: conversations[19].id, role: 'user', content: 'Can you give me an estimate for a 3-unit dental bridge?' },
    { conversationId: conversations[19].id, role: 'assistant', content: 'A 3-unit dental bridge typically costs between $2,000-$5,000 depending on the materials used. Porcelain-fused-to-metal bridges are more affordable, while all-ceramic or zirconia bridges are at the higher end. The exact cost will depend on your specific case. We offer free consultations where we can provide a detailed treatment plan and cost estimate. Would you like to schedule one?' },

    // Conversation 21: Rachel - Night guard
    { conversationId: conversations[20].id, role: 'user', content: 'I grind my teeth at night. Can you help?' },
    { conversationId: conversations[20].id, role: 'assistant', content: 'Absolutely! Teeth grinding (bruxism) is very common and can cause tooth wear, jaw pain, and headaches. We can create a custom-fit night guard that protects your teeth while you sleep. The process involves taking impressions of your teeth, and the guard is typically ready within 1-2 weeks. Custom night guards are more comfortable and effective than over-the-counter options. Would you like to schedule an appointment for a fitting?' },

    // Conversation 22: James - Follow-up
    { conversationId: conversations[21].id, role: 'user', content: 'I had a root canal a week ago and the tooth still feels a bit sensitive. Is that normal?' },
    { conversationId: conversations[21].id, role: 'assistant', content: 'It\'s normal to experience some sensitivity for 1-2 weeks after a root canal, especially when chewing or applying pressure. The tissues around the tooth need time to heal. However, if you experience severe pain, swelling, or the sensitivity doesn\'t improve after two weeks, please contact us. Also, remember that you still need to get the permanent crown placed to fully protect the tooth. Have you scheduled your crown appointment yet?' },
  ];

  // Create all messages
  for (const msg of messagesData) {
    await prisma.message.create({ data: msg });
  }

  // Update message counts for conversations
  for (const conv of conversations) {
    const count = messagesData.filter((m) => m.conversationId === conv.id).length;
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { messageCount: count },
    });
  }

  console.log(`Created ${messagesData.length} messages`);

  // Create 16 Appointments
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const appointmentsData = [
    { patientId: patients[0].id, date: formatDate(today), time: '09:00', duration: 30, type: 'checkup', status: 'scheduled', notes: 'Follow-up on tooth pain complaint' },
    { patientId: patients[1].id, date: formatDate(today), time: '10:30', duration: 60, type: 'root-canal', status: 'scheduled', notes: 'Root canal treatment - lower molar' },
    { patientId: patients[2].id, date: formatDate(today), time: '14:00', duration: 30, type: 'consultation', status: 'scheduled', notes: 'Whitening consultation' },
    { patientId: patients[5].id, date: formatDate(today), time: '15:30', duration: 45, type: 'extraction', status: 'scheduled', notes: 'Cavity filling - upper premolar' },
    { patientId: patients[7].id, date: formatDate(today), time: '16:30', duration: 30, type: 'checkup', status: 'completed', notes: 'Crown assessment completed' },
    { patientId: patients[9].id, date: formatDate(today), time: '11:00', duration: 60, type: 'consultation', status: 'completed', notes: 'Implant consultation - good candidate' },
    { patientId: patients[4].id, date: formatDate(new Date(today.getTime() + 86400000)), time: '09:30', duration: 30, type: 'checkup', status: 'scheduled', notes: 'New patient initial exam' },
    { patientId: patients[8].id, date: formatDate(new Date(today.getTime() + 86400000)), time: '11:00', duration: 30, type: 'checkup', status: 'scheduled', notes: 'New patient registration and exam' },
    { patientId: patients[10].id, date: formatDate(new Date(today.getTime() + 86400000)), time: '13:00', duration: 60, type: 'extraction', status: 'scheduled', notes: 'Wisdom tooth evaluation' },
    { patientId: patients[3].id, date: formatDate(new Date(today.getTime() + 2 * 86400000)), time: '10:00', duration: 45, type: 'cleaning', status: 'scheduled', notes: 'Dental cleaning' },
    { patientId: patients[6].id, date: formatDate(new Date(today.getTime() + 2 * 86400000)), time: '14:30', duration: 30, type: 'consultation', status: 'scheduled', notes: 'Night guard fitting' },
    { patientId: patients[0].id, date: formatDate(new Date(today.getTime() - 7 * 86400000)), time: '09:00', duration: 30, type: 'cleaning', status: 'completed', notes: 'Routine cleaning completed' },
    { patientId: patients[1].id, date: formatDate(new Date(today.getTime() - 5 * 86400000)), time: '10:00', duration: 30, type: 'cleaning', status: 'completed', notes: 'Regular cleaning done' },
    { patientId: patients[5].id, date: formatDate(new Date(today.getTime() - 3 * 86400000)), time: '14:00', duration: 45, type: 'whitening', status: 'completed', notes: 'Zoom whitening - 6 shades lighter' },
    { patientId: patients[11].id, date: formatDate(new Date(today.getTime() - 2 * 86400000)), time: '09:30', duration: 60, type: 'root-canal', status: 'cancelled', notes: 'Patient cancelled due to feeling better' },
    { patientId: patients[9].id, date: formatDate(new Date(today.getTime() - 10 * 86400000)), time: '11:00', duration: 45, type: 'extraction', status: 'completed', notes: 'Tooth extraction - healed well' },
  ];

  const appointments = await Promise.all(
    appointmentsData.map((apt) => prisma.appointment.create({ data: apt }))
  );

  console.log(`Created ${appointments.length} appointments`);

  // Create 10 Bot Settings
  const settingsData = [
    { key: 'clinic_name', value: 'BrightSmile Dental Clinic', category: 'general', description: 'The display name of the dental clinic' },
    { key: 'clinic_hours', value: 'Mon-Fri: 8am-6pm, Sat: 9am-2pm', category: 'general', description: 'Operating hours of the clinic' },
    { key: 'clinic_phone', value: '(555) 100-2000', category: 'general', description: 'Main clinic phone number' },
    { key: 'appointment_buffer', value: '15', category: 'scheduling', description: 'Buffer time in minutes between appointments' },
    { key: 'max_advance_booking', value: '90', category: 'scheduling', description: 'Maximum days in advance for booking' },
    { key: 'cancellation_policy', value: 'Appointments must be cancelled at least 24 hours in advance to avoid a $50 cancellation fee.', category: 'scheduling', description: 'Cancellation policy text' },
    { key: 'greeting_message', value: 'Hello! Welcome to BrightSmile Dental Clinic. How can I assist you today?', category: 'responses', description: 'Default greeting message for new conversations' },
    { key: 'closing_message', value: 'Thank you for contacting BrightSmile Dental! If you have any more questions, feel free to reach out. Have a great day!', category: 'responses', description: 'Default closing message for conversations' },
    { key: 'emergency_response', value: 'If you are experiencing a dental emergency, please call our emergency line at (555) 100-2001 immediately.', category: 'responses', description: 'Response for dental emergencies' },
    { key: 'ai_personality', value: 'friendly_professional', category: 'general', description: 'AI assistant personality style' },
  ];

  const settings = await Promise.all(
    settingsData.map((setting) => prisma.botSetting.create({ data: setting }))
  );

  console.log(`Created ${settings.length} bot settings`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
