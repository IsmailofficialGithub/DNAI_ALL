// Platform knowledge base content for AI assistant
// This file is auto-generated from platform-knowledge.md
// To update, edit platform-knowledge.md and regenerate this file

export const platformKnowledge = `# DNAI Platform Knowledge Base

## Platform Overview

DNAI is an AI-powered voice automation platform that enables businesses to create, manage, and deploy intelligent voice agents for inbound and outbound calling. The platform provides comprehensive tools for agent creation, call management, lead capture, and analytics.

## Core Features

### 1. Voice Agents
- **Purpose**: Create AI-powered voice agents that can handle customer calls automatically
- **Creation Process**: 
  - Navigate to Agents page
  - Click "Create Agent" or use the AI Prompt Generator to auto-fill agent details
  - Configure agent details, voice settings, and schedules
  - Assign a phone number to the agent
- **Agent Types**: Support, Booking, Billing, Complaint, or Mixed
- **Voice Configuration**: Choose from Premium Voices (Deepgram) or Classic Voices (Vapi)
- **Status**: Agents can be in Draft, Activating, Active, or Inactive states
- **Testing**: Use the "Talk" button to test agents before going live
- **Cost**: Creating an agent costs 5 credits

### 2. Phone Numbers (Inbound Numbers)
- **Purpose**: Import and manage phone numbers that receive calls
- **Providers Supported**: Telnyx, Vonage, Twilio
- **Import Process**:
  1. Select provider
  2. Enter phone number details
  3. Configure provider-specific credentials (SID, API keys, etc.)
- **Assignment**: Each number can be assigned to one agent at a time
- **Status**: Numbers can be Active, Activating, Suspended, Error, Pending, or Inactive
- **Call Forwarding**: Optional forwarding number can be configured

### 3. Knowledge Bases
- **Purpose**: Store FAQs and documents that agents can reference during calls
- **Creation**: 
  - Go to Knowledge Base page
  - Click "Create Knowledge Base"
  - Upload documents and add FAQs directly during creation
- **Usage**: Knowledge bases can be assigned to agents during agent creation
- **Content Types**: 
  - Documents (PDF, DOCX, TXT)
  - FAQs (Question-Answer pairs)

### 4. Call Schedules
- **Purpose**: Define when agents are available to receive calls
- **Features**:
  - Weekly availability settings
  - Holiday management
  - Schedule overrides
  - After-hours messages
- **Assignment**: Multiple schedules can be assigned to a single agent
- **Timezone Support**: Full timezone configuration per schedule

### 5. Leads Management
- **Purpose**: View and manage leads captured during calls
- **Data Captured**: Contact information, call details, transcripts, recordings
- **Filtering**: Filter by date range, agent, phone number
- **Export**: Leads can be exported for CRM integration

### 6. Call History
- **Purpose**: Track and analyze all calls made through the platform
- **Information Available**:
  - Call status (Answered, Missed, Forwarded, Completed)
  - Duration and cost
  - Transcripts and recordings
  - Contact information
- **Analytics**: View statistics and trends
- **Filtering**: Filter by date, status, agent, or phone number

### 7. Email Integration
- **Purpose**: Configure email accounts for sending and receiving emails
- **Features**:
  - SMTP configuration
  - Email templates
  - Compose and send emails
  - Email history

### 8. Billing & Credits
- **Credit System**: 
  - Purchase credits to use platform features
  - Credits are deducted for agent creation (5 credits)
  - Call costs are calculated per minute
- **Packages**: Subscription packages available with different tiers
- **Auto-topup**: Configure automatic credit top-up when balance is low
- **Invoices**: View and download invoices for purchases

## Technical Details

### Agent Creation Workflow
1. **Details Section**: Enter company information, agent purpose, goals, and context
2. **Voice Configuration**: Select voice, language, and configure welcome messages
3. **Settings**: Configure agent type, timezone, fallback numbers, knowledge base assignment
4. **Schedule Selection**: Assign one or more call schedules to the agent
5. **Phone Number Assignment**: Select an inbound number for the agent
6. **Save & Create**: Save as draft or create the agent (requires credits)

### Webhooks
- **Agent Creation**: \`REACT_APP_BOT_CREATION_WEBHOOK_URL\` - Called when creating new agents
- **Agent Update**: \`REACT_APP_EDIT_AGENT_WEBHOOK_URL\` - Called when updating existing agents
- **Number Import**: \`REACT_APP_IMPORT_NUMBER_WEBHOOK_URL\` - Called when importing phone numbers
- **Number Deletion**: \`REACT_APP_DELETE_NUMBER_WEBHOOK_URL\` - Called when deleting numbers
- **Bind/Unbind**: Webhooks for assigning/unassigning numbers to agents

### Status Flow
- **Agents**: Draft → Activating → Active/Inactive
- **Numbers**: Pending → Activating → Active/Inactive/Suspended/Error
- **Activation**: Handled by backend (n8n) - no client-side timers

### Credit Costs
- **Agent Creation**: 5 credits per agent
- **Calls**: Variable cost per minute (configured in credit rates)
- **Low Credit Threshold**: Configurable threshold for warnings

## Common Questions

### How do I create my first agent?
1. Go to Agents page
2. Click "Create Agent" or use "AI Autofill" for quick setup
3. Fill in required fields (Company Name, Agent Purpose, Call Type)
4. Configure voice and settings
5. Assign a phone number (import one if needed)
6. Create the agent (requires 5 credits)

### How do I import a phone number?
1. Go to Phone Numbers page
2. Click "Import Number"
3. Select provider (Telnyx, Vonage, or Twilio)
4. Enter phone number and provider credentials
5. Configure optional call forwarding
6. Import the number

### How do I test an agent?
1. Go to Agents page
2. Find your agent in the list
3. Click the menu (three dots) and select "Talk"
4. Grant microphone permissions
5. Start talking to test the agent

### What happens when I run out of credits?
- Services are paused when credits reach zero
- You'll receive low credit notifications
- Purchase more credits from the Billing page
- Configure auto-topup to prevent service interruption

### Can I assign multiple numbers to one agent?
- No, each number can only be assigned to one agent at a time
- If you assign a number to a new agent, it will be unassigned from the previous agent

### How do schedules work?
- Schedules define when agents are available
- Multiple schedules can be assigned to one agent
- Includes weekly availability, holidays, and overrides
- After-hours messages can be configured

### What is the AI Prompt Generator?
- Tool to automatically generate agent prompts using OpenAI
- Upload company documents for context
- Fill in company profile information
- Generate production-ready prompts
- Save prompts for reuse in agent creation

## Support & Troubleshooting

### Agent not activating?
- Check that the number is properly assigned
- Verify webhook configuration
- Check agent status in the database
- Ensure sufficient credits are available

### Calls not being received?
- Verify number status is "Active"
- Check schedule configuration
- Ensure agent is assigned to the number
- Verify provider credentials are correct

### Need help?
- Use this AI assistant for quick answers
- Check the Documentation page for detailed guides
- Contact support for technical issues

## Platform Updates & Best Practices

### Best Practices
- Always test agents before going live
- Configure schedules to match business hours
- Set up knowledge bases for better agent responses
- Monitor call history and analytics regularly
- Keep credits topped up to avoid service interruption

### Security
- API keys are stored securely
- User authentication required for all operations
- Session management for secure access

### Performance
- Agents process calls in real-time
- Transcripts and recordings are available post-call
- Analytics update in real-time
- Call history is searchable and filterable`;
