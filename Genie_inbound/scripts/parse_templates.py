import re
import os
import json

def parse_markdown():
    file_path = "e:\\coding\\DNAI_MAIN\\Genie_inbound\\Genie Email Templates  (3).md"
    if not os.path.exists(file_path):
        print(f"Error: File not found at {file_path}")
        return []
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Split content by lines
    lines = content.split("\n")
    
    current_category = "Booking & Reservation"
    templates = []
    current_template = None
    collecting_body = False
    body_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Check category transition
        if "Booking & Reservation" in line and "Templates" in line:
            current_category = "Booking & Reservation"
            continue
        elif "Appointment Email Templates" in line:
            current_category = "Appointment"
            continue
        elif "Callback & Follow-up" in line and "Templates" in line:
            current_category = "Callback & Follow-up"
            continue
        elif "Lead & Inquiry" in line and "Templates" in line:
            current_category = "Lead & Inquiry Handling"
            continue
        elif "Real Estate Email Templates" in line:
            current_category = "Real Estate"
            continue
            
        # Check new template header
        # Structure: ## **1. Booking Confirmation Email**
        match_header = re.match(r"^##\s+\*\*(\d+)\.\s+(.*?)\*\*?", stripped)
        if match_header:
            # If we had a template in progress, save it
            if current_template:
                current_template["body"] = "\n".join(body_lines).strip()
                templates.append(current_template)
            
            # Start new template
            num = match_header.group(1)
            name = match_header.group(2).strip()
            # Clean name (remove bold, brackets, etc.)
            name = re.sub(r"\*\*|\*", "", name).strip()
            name = name.replace("\\[", "[").replace("\\]", "]")
            
            current_template = {
                "category": current_category,
                "name": name,
                "purpose": "",
                "trigger": "",
                "subject": "",
                "body": ""
            }
            collecting_body = False
            body_lines = []
            continue
            
        if current_template:
            # Match Purpose / Use Case
            match_purpose = re.match(r"^\*\*(Purpose|Use Case):\*\*\s*(.*)", stripped)
            if match_purpose:
                val = stripped[stripped.find(":") + 1:].strip()
                val = re.sub(r"\*\*|\*", "", val).strip()
                val = val.replace("\\[", "[").replace("\\]", "]")
                val = val.rstrip("\\").strip()
                current_template["purpose"] = val
                continue
                
            # Match Trigger
            match_trigger = re.match(r"^\*\*Trigger:\*\*\s*(.*)", stripped)
            if match_trigger:
                val = stripped[stripped.find(":") + 1:].strip()
                val = re.sub(r"\*\*|\*", "", val).strip()
                val = val.replace("\\[", "[").replace("\\]", "]")
                val = val.rstrip("\\").strip()
                current_template["trigger"] = val
                continue
                
            # Match Subject
            match_subject = re.match(r"^\*\*(Subject|Use Case):\*\*\s*(.*)", stripped)
            # Support both **Subject:** and **Subject (or whatever):**
            if not match_subject and stripped.startswith("**Subject:"):
                match_subject = True
            
            if match_subject or re.match(r"^\*\*Subject:\*\*\s*(.*)", stripped):
                val = stripped[stripped.find(":") + 1:].strip()
                val = re.sub(r"\*\*|\*", "", val).strip()
                val = val.replace("\\[", "[").replace("\\]", "]")
                val = val.rstrip("\\").strip()
                current_template["subject"] = val
                # Start collecting body right after Subject
                collecting_body = True
                continue
                
            # Skip the email body label line if it occurs
            if stripped == "**Email Body:**" or stripped == "Email Body:":
                continue
                
            # Collect body lines
            if collecting_body:
                # Normalize line: replace escaped brackets and trailing backslashes
                cleaned_line = line.replace("\\[", "[").replace("\\]", "]")
                # Remove trailing backslash if it exists
                if cleaned_line.endswith("\\"):
                    cleaned_line = cleaned_line[:-1]
                body_lines.append(cleaned_line)
                
    # Add final template
    if current_template:
        current_template["body"] = "\n".join(body_lines).strip()
        templates.append(current_template)
        
    return templates

def escape_sql(val):
    if not val:
        return "NULL"
    # Escape single quotes for SQL
    escaped = val.replace("'", "''")
    return f"'{escaped}'"

def generate_sql(templates):
    sql_lines = []
    
    # Table creation SQL
    sql_lines.append("""-- Create predefined_email_templates table in inbound schema
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
""")
    
    # Insert templates
    sql_lines.append("-- Seed predefined templates")
    for t in templates:
        cat = escape_sql(t["category"])
        name = escape_sql(t["name"])
        subject = escape_sql(t["subject"])
        body = escape_sql(t["body"])
        purpose = escape_sql(t["purpose"])
        trigger = escape_sql(t["trigger"])
        
        sql_lines.append(f"""INSERT INTO inbound.predefined_email_templates (category, name, subject, body, description, trigger)
VALUES ({cat}, {name}, {subject}, {body}, {purpose}, {trigger});""")
        
    output_path = "e:\\coding\\DNAI_MAIN\\Genie_inbound\\migration\\05_predefined_templates.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))
    print(f"Successfully generated SQL file at {output_path} with {len(templates)} templates.")

if __name__ == "__main__":
    parsed = parse_markdown()
    print(f"Parsed {len(parsed)} templates.")
    # Log details of first parsed template to check accuracy
    if parsed:
        print("First template parsed:")
        print(json.dumps(parsed[0], indent=2))
        
        print("\nLead template sample:")
        lead_templates = [t for t in parsed if t["category"] == "Lead & Inquiry Handling"]
        if lead_templates:
            print(json.dumps(lead_templates[0], indent=2))
            
    generate_sql(parsed)
