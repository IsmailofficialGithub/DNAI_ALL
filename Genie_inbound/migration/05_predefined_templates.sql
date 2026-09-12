-- Create predefined_email_templates table in inbound schema
CREATE TABLE IF NOT EXISTS inbound.predefined_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    description TEXT,
    trigger TEXT,
    design_style VARCHAR(50) DEFAULT 'modern',
    accent_color VARCHAR(50) DEFAULT '#4F46E5',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE inbound.predefined_email_templates ENABLE ROW LEVEL SECURITY;

-- Allow SELECT policy for everyone
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON inbound.predefined_email_templates;
CREATE POLICY "Allow select for all authenticated users" ON inbound.predefined_email_templates
    FOR SELECT TO public USING (true);

-- Allow ALL operations for admin
DROP POLICY IF EXISTS "Allow all for authenticated users" ON inbound.predefined_email_templates;
CREATE POLICY "Allow all for authenticated users" ON inbound.predefined_email_templates
    FOR ALL TO authenticated USING (true);

-- Clear existing predefined templates to prevent duplicate seeding
TRUNCATE inbound.predefined_email_templates CASCADE;

-- Seed predefined templates
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Booking Confirmation Email', 'Your Booking Is Confirmed', 'Hi [Guest Name],

Thank you for choosing [Hotel/Business Name].

Your booking has been confirmed. Please find your reservation details
below:

Guest Name: [Guest Name]
Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Number of Guests: [Number of Guests]
Booking Reference: [Booking Reference]

Our team looks forward to welcoming you. If you need to update your
booking or have any questions, please contact us at [Phone Number] or
reply to this email.

Best regards,
[Hotel/Business Name]', 'Sent when a guest''s booking is successfully confirmed.', 'Call summary shows reservation confirmed.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Tentative Reservation Email', 'Your Tentative Reservation Details', 'Hi [Guest Name],

Thank you for contacting [Hotel/Business Name].

We have placed a tentative reservation for you based on your request.
Please review the details below:

Guest Name: [Guest Name]
Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Number of Guests: [Number of Guests]
Tentative Hold Until: [Hold Expiry Date/Time]

Please confirm your reservation before [Hold Expiry Date/Time] to
secure your booking. If we do not receive confirmation within this time,
the room may be released for other guests.

To confirm, please reply to this email or contact us at [Phone
Number].

Best regards,
[Hotel/Business Name]', 'Sent when a booking is held temporarily but not fully', 'Call summary shows reservation is tentative or awaiting');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Reservation Request Received Email', 'We Received Your Reservation Request', 'Hi [Guest Name],

Thank you for reaching out to [Hotel/Business Name].

We have received your reservation request with the following details:

Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Number of Guests: [Number of Guests]
Special Request: [Special Request]

Our team will review availability and get back to you shortly with
confirmation or suitable options.

If any detail above is incorrect, please reply to this email or contact
us at [Phone Number].

Best regards,
[Hotel/Business Name]', 'Sent when a guest has requested a reservation, but', 'Call summary shows booking request received.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Room Availability Confirmation Email', 'Room Availability Confirmed', 'Hi [Guest Name],

Thank you for your interest in staying with [Hotel/Business Name].

We are pleased to confirm that we have availability for your requested
dates:

Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Available Room Type: [Room Type]
Number of Guests: [Number of Guests]
Estimated Price: [Price]

To proceed with the booking, please reply to this email or contact us at
[Phone Number].

Availability may change, so we recommend confirming your reservation as
soon as possible.

Best regards,
[Hotel/Business Name]', 'Sent when the requested room or reservation option is', 'Call summary shows requested room/date is available.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Booking Pending Confirmation Email', 'Your Booking Is Pending Confirmation', 'Hi [Guest Name],

Thank you for booking with [Hotel/Business Name].

Your reservation request is currently pending confirmation. Here are the
details we have received:

Guest Name: [Guest Name]
Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Number of Guests: [Number of Guests]

Our team is reviewing your request and will confirm your booking
shortly.

Please note that your reservation is not fully confirmed until you
receive a booking confirmation email from us.

Best regards,
[Hotel/Business Name]', 'Sent when the booking is in process and waiting for', 'Call summary shows booking pending.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Booking Declined / Unavailable Email', 'Update on Your Reservation Request', 'Hi [Guest Name],

Thank you for considering [Hotel/Business Name].

Unfortunately, we are unable to confirm your reservation for the
requested details below:

Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Number of Guests: [Number of Guests]

This may be due to limited availability, room unavailability, or booking
restrictions for the selected dates.

If you would like, our team can help you check alternative dates or
available room options. Please reply to this email or contact us at
[Phone Number].

Best regards,
[Hotel/Business Name]', 'Sent when the requested dates, room type, or reservation', 'Call summary shows booking unavailable or declined.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Booking Modification Confirmation Email', 'Your Booking Has Been Updated', 'Hi [Guest Name],

Your booking with [Hotel/Business Name] has been successfully updated.

Updated reservation details:

Guest Name: [Guest Name]
New Check-in Date: [Updated Check-in Date]
New Check-out Date: [Updated Check-out Date]
Room Type: [Updated Room Type]
Number of Guests: [Updated Number of Guests]
Booking Reference: [Booking Reference]

If you did not request this change or need further assistance, please
reply to this email or contact us at [Phone Number].

Best regards,
[Hotel/Business Name]', 'Sent when a guest changes reservation details.', 'Call summary shows booking modified successfully.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Pre-Arrival Reminder Email', 'Your Stay Is Coming Up Soon', 'Hi [Guest Name],

We look forward to welcoming you to [Hotel/Business Name].

Here is a quick reminder of your upcoming stay:

Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Number of Guests: [Number of Guests]
Booking Reference: [Booking Reference]
Check-in Time: [Check-in Time]

Please bring a valid ID at the time of check-in. If you have any special
requests before arrival, feel free to reply to this email or contact us
at [Phone Number].

We look forward to hosting you.

Best regards,
[Hotel/Business Name]', 'Sent before the guest''s arrival date.', 'Scheduled reminder before check-in.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'Post-Stay Follow-up Email', 'Thank You for Staying With Us', 'Hi [Guest Name],

Thank you for staying with [Hotel/Business Name].

We hope you had a comfortable and pleasant experience with us. Your
feedback helps us improve our service and provide a better experience
for future guests.

If you would like to share your feedback, please reply to this email or
leave us a review here:

[Review Link]

We would be happy to welcome you again soon.

Best regards,
[Hotel/Business Name]', 'Sent after the guest''s stay is completed.', 'Scheduled after check-out date.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Booking & Reservation', 'No-Show Follow-up Email', 'Follow-up Regarding Your Reservation', 'Hi [Guest Name],

We noticed that you were unable to check in for your reservation at
[Hotel/Business Name].

Reservation details:

Check-in Date: [Check-in Date]
Check-out Date: [Check-out Date]
Room Type: [Room Type]
Booking Reference: [Booking Reference]

If you would still like to stay with us or need help making a new
reservation, please reply to this email or contact us at [Phone
Number].

Our team will be happy to assist you.

Best regards,
[Hotel/Business Name]


\*For **doctors, salons, lawyers, consultants**, and any
appointment-based business.', 'Sent when a guest does not arrive for a confirmed', 'Call/booking status shows no-show.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Confirmation Email', 'Your Appointment Is Confirmed', 'Hi [Customer Name],

Thank you for speaking with us.

Your appointment with [Company Name] has been confirmed.

**Appointment Details
** Service: [Service Name]
Date: [Appointment Date]
Time: [Appointment Time]
Location/Meeting Link: [Location or Meeting Link]

Please make sure to arrive on time or join the meeting a few minutes
early.

If you need to make any changes, you can contact us at [Phone Number]
or reply to this email.

Best regards,
[Company Name]', 'Sent when GENIE successfully books an appointment during', 'Call summary confirms appointment booked.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Request Received Email', 'We Received Your Appointment Request', 'Hi [Customer Name],

Thank you for contacting [Company Name].

We have received your appointment request for [Service Name].

Our team will review the available schedule and confirm your appointment
shortly.

**Requested Details
** Preferred Date: [Preferred Date]
Preferred Time: [Preferred Time]
Service: [Service Name]

If any details need to be updated, please reply to this email or contact
us at [Phone Number].

Best regards,
[Company Name]', 'Sent when the caller requests an appointment, but', 'Call summary shows appointment request received.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Pending Approval Email', 'Your Appointment Is Pending Confirmation', 'Hi [Customer Name],

Thank you for requesting an appointment with [Company Name].

Your appointment request has been received and is currently pending
confirmation from our team.

**Requested Appointment Details
** Service: [Service Name]
Date: [Appointment Date]
Time: [Appointment Time]

We will contact you once your appointment is confirmed.

Please note that your appointment is not finalized until you receive a
confirmation email.

Best regards,
[Company Name]', 'Sent when the appointment needs approval from the business', 'Call summary shows appointment requested but pending');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Reminder Email', 'Reminder: Your Appointment Is Coming Up', 'Hi [Customer Name],

This is a friendly reminder about your upcoming appointment with
[Company Name].

**Appointment Details
** Service: [Service Name]
Date: [Appointment Date]
Time: [Appointment Time]
Location/Meeting Link: [Location or Meeting Link]

Please arrive on time or join the meeting a few minutes early.

If you need to reschedule or cancel, please contact us at [Phone
Number] as soon as possible.

Best regards,
[Company Name]', 'Sent before the appointment to remind the customer.', 'Scheduled reminder before appointment date/time.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Same-Day Appointment Reminder Email', 'Your Appointment Is Today', 'Hi [Customer Name],

This is a reminder that your appointment with [Company Name] is
scheduled for today.

**Appointment Details
** Service: [Service Name]
Time: [Appointment Time]
Location/Meeting Link: [Location or Meeting Link]

Please arrive on time or join the meeting a few minutes before your
scheduled time.

For any urgent changes, please contact us at [Phone Number].

Best regards,
[Company Name]', 'Sent on the same day of the appointment.', 'Appointment scheduled for today.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Reschedule Confirmation Email', 'Your Appointment Has Been Rescheduled', 'Hi [Customer Name],

Your appointment with [Company Name] has been successfully
rescheduled.

**Updated Appointment Details
** Service: [Service Name]
New Date: [New Appointment Date]
New Time: [New Appointment Time]
Location/Meeting Link: [Location or Meeting Link]

Your previous appointment time has been replaced with the updated
schedule above.

If you have any questions or need another change, please contact us at
[Phone Number] or reply to this email.

Best regards,
[Company Name]', 'Sent when an appointment has been rescheduled.', 'Call summary shows appointment rescheduled.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Cancellation Confirmation Email', 'Your Appointment Has Been Cancelled', 'Hi [Customer Name],

This email confirms that your appointment with [Company Name] has been
cancelled.

**Cancelled Appointment Details
** Service: [Service Name]
Date: [Appointment Date]
Time: [Appointment Time]

If you would like to book a new appointment, please contact us at
[Phone Number] or reply to this email.

We will be happy to assist you again.

Best regards,
[Company Name]', 'Sent when the customer cancels an appointment.', 'Call summary shows appointment cancelled.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Missed Appointment Follow-Up Email', 'We Missed You at Your Appointment', 'Hi [Customer Name],

We noticed that you were unable to attend your appointment with
[Company Name].

**Missed Appointment Details
** Service: [Service Name]
Date: [Appointment Date]
Time: [Appointment Time]

If you would like to reschedule, please contact us at [Phone Number]
or reply to this email.

We understand that plans can change, and we will be happy to help you
find another suitable time.

Best regards,
[Company Name]', 'Sent when the customer does not attend the appointment.', 'Appointment status marked as missed/no-show.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Appointment Completed Follow-Up Email', 'Thank You for Visiting [Company Name]', 'Hi [Customer Name],

Thank you for attending your appointment with [Company Name].

We hope your experience was helpful and smooth.

If you have any follow-up questions, need additional support, or would
like to book another appointment, please contact us at [Phone Number]
or reply to this email.

We appreciate your time and look forward to assisting you again.

Best regards,
[Company Name]', 'Sent after the appointment is completed.', 'Appointment status marked as completed.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Appointment', 'Next Appointment Recommendation Email', 'Schedule Your Next Appointment', 'Hi [Customer Name],

Thank you for choosing [Company Name].

Based on your recent appointment for [Service Name], we recommend
scheduling your next appointment to continue your service, consultation,
or follow-up process.

You can contact us at [Phone Number] or reply to this email to choose
a suitable date and time.

Our team will be happy to assist you with the next available slot.

Best regards,
[Company Name]', 'Sent when the customer may need another appointment based', 'Call summary or appointment history shows follow-up');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Callback Reminder Email', 'Reminder: Your Callback Is Scheduled', 'Hi [Customer Name],

This is a quick reminder that your callback with [Company Name] is
scheduled for [Date] at [Time].

Our team will follow up with you regarding [Service/Inquiry Topic].

If you need to update the callback time, please reply to this email or
contact us at [Phone Number].

Best regards,
[Company Name]', 'Sent when a callback date/time was agreed during the', 'Call summary shows caller requested or agreed to a');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Callback Request Received Email', 'We''ve Received Your Callback Request', 'Hi [Customer Name],

Thank you for contacting [Company Name].

We''ve received your request for a callback regarding [Service/Inquiry
Topic]. Our team will reach out to you on [Date] at [Time], or as
soon as possible within our working hours.

If you would like to share any additional details before the callback,
you can reply directly to this email.

Best regards,
[Company Name]', 'Sent when a caller asks to be contacted later.', 'Call summary shows customer requested a callback but no');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Unanswered Call', 'Sorry We Missed You', 'Hi [Customer Name],

We noticed that your call with [Company Name] could not be completed.

We''re sorry we missed the chance to assist you. If you still need help
with [Service/Inquiry Topic], please reply to this email or contact us
at [Phone Number].

Our team will be happy to assist you.

Best regards,
[Company Name]', 'Sent when the customer''s call could not be completed or', 'Call summary shows unanswered, missed, or disconnected');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Interested Lead Call', 'Thank You for Your Interest in [Company Name]', 'Hi [Customer Name],

Thank you for speaking with us about [Service/Product Name].

Based on our conversation, we understand that you''re interested in
[Specific Requirement/Need]. Our team would be happy to guide you
through the next steps and answer any further questions.

You can reply to this email or contact us at [Phone Number] to
continue the conversation.

Best regards,
[Company Name]', 'Sent when a caller showed clear interest in a', 'Call summary shows interested lead, service discussion, or');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Not-Interested Lead Call', 'Thank You for Your Time', 'Hi [Customer Name],

Thank you for taking the time to speak with [Company Name].

We understand that [Service/Product Name] may not be the right fit for
you at the moment. If your needs change in the future, we''ll be happy to
help.

You can always reach us at [Phone Number] or reply to this email
whenever you''re ready.

Best regards,
[Company Name]', 'Sent politely when the caller was not interested at the', 'Call summary shows lead is not interested, not ready, or');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Price Inquiry', 'Pricing Information for [Service/Product Name]', 'Hi [Customer Name],

Thank you for reaching out to [Company Name].

As discussed, you were interested in pricing details for
[Service/Product Name]. Our pricing may depend on [Package/Service
Type/Requirements], so our team can guide you with the most suitable
option.

Please reply to this email or contact us at [Phone Number] if you
would like a detailed quote or package recommendation.

Best regards,
[Company Name]', 'Sent when the caller asked about pricing, packages, fees,', 'Call summary shows pricing inquiry.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Service Inquiry', 'More Information About [Service Name]', 'Hi [Customer Name],

Thank you for contacting [Company Name].

You asked about [Service Name], and we''d be happy to help you
understand how it works.

Our team can guide you through the service details, availability,
process, and next steps based on your requirements.

Please reply to this email or contact us at [Phone Number] if you
would like to continue.

Best regards,
[Company Name]', 'Sent when a caller asks about a specific service.', 'Call summary shows service-related inquiry.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Incomplete Conversation', 'Let''s Complete Your Request', 'Hi [Customer Name],

It looks like our conversation ended before we could complete your
request.

We''d still be happy to assist you with [Service/Inquiry Topic]. To
help us move forward, please reply with any missing details or contact
us at [Phone Number].

Once we have the required information, our team can guide you on the
next step.

Best regards,
[Company Name]', 'Sent when the call ended before the full information was', 'Call summary shows incomplete call, caller disconnected, or');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Agent Transferred Query', 'Your Request Has Been Shared With Our Team', 'Hi [Customer Name],

Thank you for contacting [Company Name].

Your request regarding [Service/Inquiry Topic] has been shared with
the appropriate team for review. Someone from our team will get back to
you with the right information as soon as possible.

If you would like to add more details, you can reply directly to this
email.

Best regards,
[Company Name]', 'Sent when GENIE records that the query needs human team', 'Call summary shows query transferred, escalated, or');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Callback & Follow-up', 'Follow-up After Customer Asked for More Details', 'Here Are the Details You Requested', 'Hi [Customer Name],

Thank you for speaking with [Company Name].

As requested, we''re sharing more details about [Service/Product Name].
Our team can provide information about the process, pricing,
availability, and next steps based on your needs.

Please reply to this email if you have any specific questions or would
like our team to assist you further.

Best regards,
[Company Name]', 'Sent when the caller asked to receive additional', 'Call summary shows customer requested more details.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'New Lead Acknowledgment Email', 'Thank You for Reaching Out to [Company Name]', 'Hi [Customer Name],

Thank you for contacting [Company Name]. We''ve received your inquiry
and our team has noted your details.

One of our representatives will review your request and get back to you
with the most relevant information shortly.

Here''s what we received:

Name: [Customer Name]
Phone: [Phone Number]
Email: [Customer Email]
Inquiry Type: [Inquiry Type]

Thank you for your interest in [Company Name].

Best regards,
[Company Name]', NULL, 'Sent when GENIE captures a new lead from a call.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Service Inquiry Response Email', 'Information About Our [Service Name] Service', 'Hi [Customer Name],

Thank you for your interest in our [Service Name] service.

Based on your conversation with our assistant, we understand that you''re
looking for more information about how this service works and whether it
fits your needs.

Our team offers [brief service description]. This service is designed
to help with [main benefit or problem solved].

A team member will contact you soon with more details and guide you
through the next steps.

Best regards,
[Company Name]', NULL, 'Sent when the caller asks about a specific service.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Pricing Inquiry Response Email', 'Pricing Details for [Service/Product Name]', 'Hi [Customer Name],

Thank you for asking about pricing for [Service/Product Name].

We''ve received your request and our team will share the most suitable
pricing details based on your needs. Since pricing may depend on
requirements, package type, service level, or customization, we want to
make sure you receive the most accurate information.

A representative from [Company Name] will get back to you shortly.

Best regards,
[Company Name]', NULL, 'Sent when the caller asks about pricing, packages, rates,');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Product Information Email', 'More Information About [Product Name]', 'Hi [Customer Name],

Thank you for your interest in [Product Name].

Here''s a quick overview:

Product: [Product Name]
Main Use: [Product Use]
Key Benefit: [Main Benefit]
Best For: [Target Customer Type]

Our team will follow up with more details and help answer any specific
questions you may have.

Thank you for considering [Company Name].

Best regards,
[Company Name]', NULL, 'Sent when the caller asks about a product, feature, plan,');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Consultation Request Received Email', 'Your Consultation Request Has Been Received', 'Hi [Customer Name],

Thank you for requesting a consultation with [Company Name].

We''ve received your request and our team will contact you soon to
discuss your needs in more detail.

Consultation Topic: [Consultation Topic]
Preferred Date/Time: [Preferred Date/Time]
Contact Number: [Phone Number]

We look forward to speaking with you.

Best regards,
[Company Name]', NULL, 'Sent when the caller asks for a consultation or wants to');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Qualification Follow-Up Email', 'Thank You for Sharing Your Details', 'Hi [Customer Name],

Thank you for speaking with us and sharing your requirements.

Our team has received your details and will review them to better
understand how we can help you.

Here''s a quick summary of what we received:

Requirement: [Requirement Summary]
Budget/Timeline: [Budget or Timeline]
Service Interest: [Service Name]

A representative will follow up with the next steps shortly.

Best regards,
[Company Name]', NULL, 'Sent when GENIE collects lead qualification details but the');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Documents/Details Request Email', 'Additional Details Needed for Your Request', 'Hi [Customer Name],

Thank you for contacting [Company Name].

To help us move forward with your request, please share the following
details:

[Required Detail 1]
[Required Detail 2]
[Required Detail 3]

Once we receive this information, our team will review it and guide you
on the next steps.

Best regards,
[Company Name]', NULL, 'Sent when more information or documents are needed before');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Business Inquiry Received Email', 'Your Business Inquiry Has Been Received', 'Hi [Customer Name],

Thank you for reaching out to [Company Name].

We''ve received your business inquiry and our team will review it
carefully. If your request requires a specific department or specialist,
we''ll make sure it is forwarded to the right person.

Inquiry Type: [Inquiry Type]
Company Name: [Customer Company Name]
Message Summary: [Inquiry Summary]

We appreciate your interest and will respond as soon as possible.

Best regards,
[Company Name]', NULL, 'Sent when a caller makes a business-related inquiry,');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'General FAQ Response Email', 'Answer to Your Question About [Topic]', 'Hi [Customer Name],

Thank you for contacting [Company Name].

Based on your inquiry, here is the information related to your question:

Question Topic: [Topic]
Answer: [FAQ Answer]

If you need more help, you can reply to this email or contact us at
[Phone Number].

Best regards,
[Company Name]', NULL, 'Sent when the caller asks a common question and GENIE');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Warm Lead Nurturing Email', 'Here''s More Information to Help You Decide', 'Hi [Customer Name],

Thank you for speaking with us.

We understand that you''re interested in [Service/Product Name] and may
need some time before making a decision.

At [Company Name], we help customers with [main problem/service
benefit]. If you have questions, need more details, or would like to
compare options, our team will be happy to guide you.

You can reply to this email whenever you''re ready.

Best regards,
[Company Name]', NULL, 'Sent when the caller shows interest but is not ready to');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Follow-Up After Service Inquiry', 'Following Up on Your Interest in [Service Name]', 'Hi [Customer Name],

Thank you for asking about our [Service Name] service.

We wanted to follow up and see if you need any additional details before
moving forward. Our team can help explain the process, pricing,
availability, or any specific requirements related to this service.

If you''d like to continue, simply reply to this email and our team will
assist you.

Best regards,
[Company Name]', NULL, 'Sent after a caller asks about a service but does not book');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Follow-Up After Incomplete Conversation', 'We Couldn''t Complete Your Request', 'Hi [Customer Name],

Thank you for contacting [Company Name].

It looks like your conversation ended before we could collect all the
details needed to complete your request.

To continue, please reply with the following information:

[Missing Detail 1]
[Missing Detail 2]
[Missing Detail 3]

Once we receive your details, our team will follow up with you.

Best regards,
[Company Name]', NULL, 'Sent when the call ends before GENIE collects all required');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Follow-Up After Agent Transferred Query', 'Your Request Has Been Forwarded to Our Team', 'Hi [Customer Name],

Thank you for speaking with us.

Your request requires further assistance, so it has been forwarded to
the right team member at [Company Name].

Inquiry Summary: [Inquiry Summary]
Department/Team: [Department Name]

Someone from our team will review your request and contact you soon.

Best regards,
[Company Name]', NULL, 'Sent when GENIE identifies that the caller''s query needs a');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Lead & Inquiry Handling', 'Follow-Up After Customer Asked for More Details', 'More Details About [Service/Product Name]', 'Hi [Customer Name],

Thank you for requesting more information about [Service/Product
Name].

Here are the details you asked for:

[Detail Section 1]
[Detail Section 2]
[Detail Section 3]

If you have any questions or would like to discuss the next steps, you
can reply to this email and our team will assist you.

Best regards,
[Company Name]', NULL, 'Sent when the caller specifically asks GENIE to send more');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Property Inquiry Acknowledgment Email', 'Thank You for Your Property Inquiry', 'Hi [Customer Name],

Thank you for reaching out to [Company Name].

We have received your inquiry regarding [Property Name / Property Type
/ Location]. Our team will review your requirements and share the most
relevant details with you shortly.

Here is what we noted from your inquiry:

Property interest: [Property Name / Type]
Preferred location: [Location]
Budget range: [Budget]
Purpose: [Investment / Personal Use / Rental / Other]

A member of our team may contact you soon if we need any additional
information.

Best regards,
[Company Name]
[Phone Number]
[Website]', NULL, 'Sent when a caller asks about a property, project,');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Property Details Sharing Email', 'Property Details for [Property Name]', 'Hi [Customer Name],

Thank you for your interest in [Property Name].

As requested, here are the key details:

Property: [Property Name]
Location: [Location]
Property type: [Apartment / Villa / Plot / Commercial Unit]
Size: [Size]
Price: [Price]
Payment plan: [Payment Plan]
Availability: [Available / Limited Availability / Subject to
Confirmation]

Key highlights:

[Highlight 1]
[Highlight 2]
[Highlight 3]
[Highlight 4]

You can review the details and let us know if you would like to schedule
a viewing or speak with a property consultant.

Best regards,
[Company Name]
[Phone Number]
[Website]', NULL, 'Sent when the caller asks for more details about a specific');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Viewing Appointment Confirmation Email', 'Your Property Viewing Is Confirmed', 'Hi [Customer Name],

Your property viewing appointment has been confirmed.

Here are the details:

Property: [Property Name]
Location: [Property Address / Area]
Date: [Viewing Date]
Time: [Viewing Time]
Consultant: [Consultant Name]
Contact number: [Consultant Phone Number]

Please arrive a few minutes early so the viewing can begin on time.

If you need to update or reschedule your appointment, you can reply to
this email or contact us at [Phone Number].

Best regards,
[Company Name]', NULL, 'Sent when GENIE confirms a property viewing appointment.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Viewing Reminder Email', 'Reminder: Your Property Viewing Is Scheduled for [Date]', 'Hi [Customer Name],

This is a reminder that your property viewing is scheduled for:

Property: [Property Name]
Location: [Property Address / Area]
Date: [Viewing Date]
Time: [Viewing Time]

Your consultant, [Consultant Name], will assist you during the visit.

Please contact us at [Phone Number] if you need help with directions
or if your schedule changes.

Best regards,
[Company Name]', NULL, 'Sent before a scheduled property viewing.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Viewing Reschedule Email', 'Your Property Viewing Has Been Rescheduled', 'Hi [Customer Name],

Your property viewing appointment has been rescheduled successfully.

Updated viewing details:

Property: [Property Name]
Location: [Property Address / Area]
New date: [New Viewing Date]
New time: [New Viewing Time]
Consultant: [Consultant Name]

Your previous appointment for [Previous Date] at [Previous Time] has
been cancelled.

Please reply to this email or contact [Phone Number] if you need to
make any further changes.

Best regards,
[Company Name]', NULL, 'Sent when a caller reschedules an existing viewing');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Post-Viewing Follow-Up Email', 'Thank You for Visiting [Property Name]', 'Hi [Customer Name],

Thank you for taking the time to visit [Property Name].

We hope the viewing helped you understand the property, location, and
overall value more clearly.

If you would like, our team can help you with:

Payment plan details
Availability confirmation
Booking process
Similar property options
Investment return information

Please reply to this email or contact us at [Phone Number] if you
would like to move forward or discuss the next step.

Best regards,
[Company Name]', NULL, 'Sent after a customer has completed a property viewing.');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Investment Consultation Follow-Up Email', 'Your Real Estate Investment Inquiry', 'Hi [Customer Name],

Thank you for discussing your real estate investment interest with
[Company Name].

Based on your inquiry, we understand that you are looking for:

Preferred location: [Location]
Budget range: [Budget]
Investment goal: [Capital Growth / Rental Income / Long-Term Holding /
Short-Term Resale]
Property type: [Property Type]

Our team can guide you with suitable property options, expected market
potential, payment plans, and the next steps for booking.

A consultant will review your requirements and share relevant options
with you shortly.

Best regards,
[Company Name]
[Phone Number]', NULL, 'Sent after a caller shows investment interest or requests');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Similar Properties Suggestion Email', 'Similar Property Options for You', 'Hi [Customer Name],

Thank you for your interest in [Original Property Name / Location].

Based on your requirements, we have selected a few similar property
options that may suit your needs:

Option 1: [Property Name]
Location: [Location]
Price: [Price]
Key feature: [Key Feature]

Option 2: [Property Name]
Location: [Location]
Price: [Price]
Key feature: [Key Feature]

Option 3: [Property Name]
Location: [Location]
Price: [Price]
Key feature: [Key Feature]

These options match your interest in [Location / Budget / Property Type
/ Investment Purpose].

Please reply to this email if you would like full details, payment
plans, or a viewing appointment.

Best regards,
[Company Name]', NULL, 'Sent when the requested property is unavailable,');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Buyer Qualification Email', 'Help Us Find the Right Property for You', 'Hi [Customer Name],

Thank you for contacting [Company Name].

To help us recommend the most suitable property options, please share a
few details:

Preferred location:
Property type:
Budget range:
Purpose of purchase: Investment / Personal Use / Rental
Preferred payment option: Cash / Installments / Mortgage
Expected purchase timeline:
Any specific requirements:

Once we receive this information, our team can shortlist the most
relevant options for you.

Best regards,
[Company Name]
[Phone Number]', NULL, 'Sent when GENIE needs more details from a buyer before');
INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ('Real Estate', 'Realtor / Client Handoff Email', 'Your Property Consultant Has Been Assigned', 'Hi [Customer Name],

Thank you for speaking with [Company Name].

Your inquiry has been shared with our property consultant for further
assistance.

Assigned consultant: [Consultant Name]
Contact number: [Consultant Phone Number]
Email: [Consultant Email]

Your consultant will assist you with property details, availability,
payment plans, viewing appointments, and the next steps.

Here is a quick summary of your inquiry:

Property interest: [Property Name / Property Type]
Location: [Location]
Budget: [Budget]
Purpose: [Investment / Personal Use / Other]

You can expect further assistance from [Consultant Name] soon.

Best regards,
[Company Name]', NULL, 'Sent when a qualified lead needs to be handed over to a');