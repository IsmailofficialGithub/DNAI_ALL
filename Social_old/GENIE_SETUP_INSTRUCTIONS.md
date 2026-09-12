# Genie Bots Setup Instructions

## Database Setup

### Step 1: Run SQL Migration in Supabase

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `GENIE_BOTS_MIGRATION.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the migration

The migration will:
- Create the `genie_bots` table with all required fields
- Set up indexes for performance
- Enable Row Level Security (RLS)
- Create RLS policies so users can only access their own bots
- Create a trigger to automatically update `updated_at` timestamp

### Step 2: Verify Table Creation

After running the migration, verify the table was created:

1. Go to **Table Editor** in Supabase
2. You should see `genie_bots` in the list of tables
3. Check that all columns are present and RLS is enabled

## Table Structure

The `genie_bots` table contains:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `owner_user_id` | UUID | Foreign key to auth.users |
| `name` | TEXT | Bot name (required) |
| `company_name` | TEXT | Company name (required) |
| `website_url` | TEXT | Company website (optional) |
| `phone_number` | TEXT | Phone number (required) |
| `goal` | TEXT | Bot goal/objective (optional) |
| `background` | TEXT | Background context (optional) |
| `welcome_message` | TEXT | Welcome message (optional) |
| `instruction_voice` | TEXT | Voice instructions (optional) |
| `script` | TEXT | Bot script (optional) |
| `voice` | TEXT | Selected voice (required) |
| `language` | TEXT | Language (optional) |
| `agent_type` | TEXT | Agent type (optional) |
| `tone` | TEXT | Communication tone (optional) |
| `model` | TEXT | AI model (required) |
| `background_noise` | TEXT | Background noise setting (optional) |
| `max_timeout` | TEXT | Max timeout in seconds (optional) |
| `created_at` | TIMESTAMPTZ | Creation timestamp (auto) |
| `updated_at` | TIMESTAMPTZ | Last update timestamp (auto) |

## Security

Row Level Security (RLS) is enabled with the following policies:

- **SELECT**: Users can only view their own bots
- **INSERT**: Users can only create bots for themselves
- **UPDATE**: Users can only update their own bots
- **DELETE**: Users can only delete their own bots

All policies use `auth.uid() = owner_user_id` to ensure data isolation.

## API Functions

The following functions are available in `src/lib/api.ts`:

- `listGenieBots()` - Get all bots for the current user
- `createGenieBot(bot)` - Create a new bot
- `updateGenieBot(id, bot)` - Update an existing bot
- `deleteGenieBot(id)` - Delete a bot
- `initiateCall(botId, contactName, contactPhone)` - Initiate a call using a bot

## Usage

1. **Create a Bot**: Navigate to `/genie` → Click "Create New Bot" → Fill the form → Save
2. **Edit a Bot**: Navigate to `/genie` → Click "Edit" on a bot card → Modify → Save
3. **Initiate a Call**: Navigate to `/genie/calls` → Select bot → Enter contact details → Initiate

## Troubleshooting

If you encounter errors:

1. **"relation genie_bots does not exist"**: Run the SQL migration
2. **"permission denied"**: Check that RLS policies are created correctly
3. **"foreign key constraint"**: Ensure `auth.users` table exists (it should by default)

