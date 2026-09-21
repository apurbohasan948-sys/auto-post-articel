-- Axiom Autonomous Content Agent - Database Schema
-- Compatible with PostgreSQL, SQLite, Supabase, Neon, or Cloud SQL

CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(64) PRIMARY KEY,
  niche VARCHAR(255) NOT NULL DEFAULT 'Artificial Intelligence & Future Tech',
  sub_niches TEXT, -- JSON array of subniches
  target_audience VARCHAR(255) DEFAULT 'Tech professionals, founders, and developers',
  language VARCHAR(32) DEFAULT 'English', -- 'English' | 'Bengali' | 'Banglish'
  country_region VARCHAR(64) DEFAULT 'Global',
  keywords TEXT, -- JSON array
  excluded_keywords TEXT, -- JSON array
  article_frequency_per_day INT DEFAULT 3,
  mode VARCHAR(32) DEFAULT 'AUTO', -- 'AUTO' | 'APPROVAL'
  status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE' | 'PAUSED' | 'STOPPED'
  quiet_hours_start INT DEFAULT 23,
  quiet_hours_end INT DEFAULT 6,
  timezone VARCHAR(64) DEFAULT 'UTC',
  active_days TEXT, -- JSON array ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  max_ai_calls_per_day INT DEFAULT 150,
  max_research_calls_per_day INT DEFAULT 50,
  max_tokens_per_article INT DEFAULT 4000,
  max_rewrite_attempts INT DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_providers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  provider_type VARCHAR(64) NOT NULL, -- 'openrouter' | 'openai' | 'gemini' | 'custom'
  base_url VARCHAR(512),
  api_key_encrypted TEXT,
  model_name VARCHAR(128) NOT NULL,
  priority INT DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  timeout_ms INT DEFAULT 60000,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_providers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  provider_type VARCHAR(64) NOT NULL, -- 'tavily' | 'serpapi' | 'custom'
  base_url VARCHAR(512) DEFAULT 'https://api.tavily.com',
  api_key_encrypted TEXT,
  priority INT DEFAULT 1,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(64) PRIMARY KEY,
  topic VARCHAR(512) NOT NULL,
  suggested_title VARCHAR(512),
  category VARCHAR(128),
  keywords TEXT, -- JSON array
  reason TEXT,
  freshness VARCHAR(64), -- 'Breaking' | 'Trending' | 'Evergreen'
  source_count INT DEFAULT 0,
  duplicate_risk VARCHAR(32), -- 'Low' | 'Medium' | 'High'
  content_gap VARCHAR(32), -- 'High' | 'Moderate' | 'Low'
  social_potential VARCHAR(32), -- 'Viral' | 'High' | 'Moderate'
  evergreen_potential VARCHAR(32), -- 'High' | 'Medium' | 'Low'
  monetization_relevance VARCHAR(32), -- 'High' | 'Medium' | 'Low'
  decision_status VARCHAR(32) DEFAULT 'DISCOVERED', -- 'DISCOVERED' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_RESEARCH'
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_packages (
  id VARCHAR(64) PRIMARY KEY,
  topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE CASCADE,
  topic VARCHAR(512) NOT NULL,
  summary TEXT,
  facts TEXT, -- JSON array of strings
  claims TEXT, -- JSON array of { claim: string, source: string, verified: boolean }
  sources TEXT, -- JSON array of { title, url, snippet, publishedDate, authorityScore }
  important_quotes TEXT, -- JSON array of { quote, speaker, sourceUrl }
  conflicts TEXT, -- JSON array of { statementA, statementB, analysis }
  research_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(64) PRIMARY KEY,
  topic_id VARCHAR(64) REFERENCES topics(id),
  title VARCHAR(512) NOT NULL,
  slug VARCHAR(512) NOT NULL,
  language VARCHAR(32) DEFAULT 'English',
  clean_content TEXT NOT NULL,
  blogger_html TEXT NOT NULL,
  meta_description VARCHAR(512),
  focus_keywords TEXT, -- JSON array
  secondary_keywords TEXT, -- JSON array
  h2_h3_structure TEXT, -- JSON array
  faq_items TEXT, -- JSON array of { question, answer }
  internal_links TEXT, -- JSON array
  external_references TEXT, -- JSON array
  featured_image_url TEXT,
  featured_image_alt TEXT,
  featured_image_prompt TEXT,
  lifecycle_state VARCHAR(64) DEFAULT 'DISCOVERED', -- 'DISCOVERED' | 'RESEARCHING' | 'PLANNED' | 'WRITING' | 'QUALITY_CHECK' | 'APPROVED' | 'PUBLISHED' | 'DISTRIBUTED' | 'FAILED' | 'ARCHIVED'
  rewrite_count INT DEFAULT 0,
  max_rewrites INT DEFAULT 3,
  blogger_post_id VARCHAR(128),
  blogger_url TEXT,
  idempotency_hash VARCHAR(128) UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quality_checks (
  id VARCHAR(64) PRIMARY KEY,
  article_id VARCHAR(64) REFERENCES articles(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL, -- 'PASS' | 'FAIL' | 'REWRITE'
  issues TEXT, -- JSON array
  corrections TEXT, -- JSON array
  unsupported_claims TEXT, -- JSON array
  score_breakdown TEXT, -- JSON object
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blogger_accounts (
  id VARCHAR(64) PRIMARY KEY,
  blog_id VARCHAR(128) NOT NULL,
  blog_name VARCHAR(255),
  blog_url TEXT,
  default_labels TEXT, -- JSON array
  publishing_mode VARCHAR(32) DEFAULT 'LIVE', -- 'DRAFT' | 'LIVE'
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS social_posts (
  id VARCHAR(64) PRIMARY KEY,
  article_id VARCHAR(64) REFERENCES articles(id) ON DELETE CASCADE,
  platform VARCHAR(64) NOT NULL, -- 'facebook' | 'x' | 'threads' | 'telegram' | 'linkedin'
  platform_post_id VARCHAR(255),
  content TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING' | 'PUBLISHED' | 'FAILED' | 'SKIPPED'
  published_url TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agent_jobs (
  id VARCHAR(64) PRIMARY KEY,
  job_number INT NOT NULL,
  status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED'
  current_step VARCHAR(64),
  article_id VARCHAR(64),
  topic_title VARCHAR(512),
  steps_completed TEXT, -- JSON array of { step, status, durationMs, error }
  logs TEXT, -- JSON array of { timestamp, level, agent, message }
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id VARCHAR(64) PRIMARY KEY,
  published_topics_summary TEXT, -- JSON array of recent topics and performance
  successful_patterns TEXT, -- JSON array
  failed_patterns TEXT, -- JSON array
  gap_keywords TEXT, -- JSON array
  total_articles_published INT DEFAULT 0,
  last_cycle_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_logs (
  id VARCHAR(64) PRIMARY KEY,
  job_id VARCHAR(64),
  agent_name VARCHAR(64) NOT NULL,
  level VARCHAR(32) DEFAULT 'INFO', -- 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
  message TEXT NOT NULL,
  metadata TEXT, -- JSON object
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
