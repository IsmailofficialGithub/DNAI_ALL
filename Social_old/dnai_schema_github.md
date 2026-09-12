
# DNAI Core Database Schema (Postgres) — GitHub‑Compatible ERD

> Updated: 2025-10-22  
> This version fixes the Mermaid `erDiagram` so it renders on GitHub.  
> **Why it broke:** Mermaid entity blocks cannot include arrows like `FK -> auth.users(id)`. Relationships must be declared on their own lines. Field lists should avoid inline FK arrows.

---

## Entity-Relationship Overview (Mermaid, GitHub-safe)

```mermaid
erDiagram
  AUTH_USERS ||--o{ BRANDS : owns
  AUTH_USERS ||--o{ PROFILES : has

  BRANDS ||--o{ ANALYSIS : has
  BRANDS ||--o{ CONTENT_CALENDAR : has
  BRANDS ||--o{ SOCIAL_ACCOUNTS : has
  BRANDS ||--o{ USER_SEARCH_QUERIES : has

  USER_SEARCH_QUERIES ||--o{ ANALYSIS : sources
  ANALYSIS ||--o{ CONTENT_CALENDAR : drives
  CONTENT_CALENDAR ||--o{ POST_IMAGES : attaches

  BRANDS {
    uuid id PK
    uuid owner_user_id FK
    text name
    text website_url
    text niche
    text target_market
    text timezone
    timestamptz created_at
    timestamptz updated_at
    text brand_colors
    text logo
  }

  ANALYSIS {
    uuid id PK
    text title
    text slug
    text html_content
    timestamptz created_at
    text execution_key
    uuid brand_id FK
    uuid query_id FK
    uuid created_by
  }

  USER_SEARCH_QUERIES {
    uuid id PK
    uuid brand_id FK
    text title
    text client_query
    jsonb payload
    timestamptz created_at
    jsonb my_company_fb_scraped
    jsonb competitors_fb_data
    jsonb my_company_ld_scraped
    jsonb my_company_ig_scraped
    jsonb my_company_tk_scraped
    jsonb competitors_ld_data
    jsonb competitors_ig_data
    jsonb competitors_tk_data
    text company_profile
  }

  CONTENT_CALENDAR {
    uuid id PK
    date date
    time time
    text platforms
    text topic
    text description
    text media_prompt
    text hashtags
    text notes
    text alt_text
    timestamptz created_at
    boolean status
    uuid calendar_id
    uuid brand_id FK
    text post_status
    text media_url
    uuid social_account_id
    timestamptz scheduled_at
    timestamptz published_at
    jsonb publish_response
    jsonb publish_error
    uuid analysis_id FK
    boolean isCarsoul
    smallint noMedia
  }

  POST_IMAGES {
    uuid id PK
    uuid post_id FK
    text url
    text alt_text
    int position
    timestamptz created_at
  }

  PROFILES {
    uuid user_id PK
    text full_name
    text avatar_url
    timestamptz created_at
    timestamptz updated_at
  }

  SOCIAL_ACCOUNTS {
    uuid id PK
    text provider
    text handle
    text external_id
    jsonb auth
    jsonb meta
    boolean is_active
    timestamptz created_at
    timestamptz updated_at
    uuid brand_id FK
    uuid created_by
  }

  STRATEGIC_CALENDARS {
    uuid id PK
    text title
    text scope
    date start_date
    timestamptz created_at
    uuid brand_id FK
    uuid analysis_id FK
    uuid created_by
    text platform
    text post_time
    text posting_idea
    text hashtags
    text strategy_name
    uuid calendar_id
  }
```
> **Note:** `AUTH_USERS` stands for `auth.users` (external to `public`).

---

## DDL & Notes

The full DDL remains the same as in the previous file. Keep using the existing SQL; only the diagram syntax changed for GitHub rendering.
