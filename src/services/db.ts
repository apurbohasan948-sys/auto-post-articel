/**
 * Axiom Persistent Database Engine
 * Powered by native SQLite (Node.js DatabaseSync) with file-based JSON synchronization.
 * Guarantees that AI Providers and Search Providers survive process restarts,
 * browser refreshes, and multi-tab access.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { AIProviderConfig, SearchProviderConfig } from '../types/agent.ts';

let DatabaseSyncClass: any = null;
try {
  const dynamicRequire =
    typeof require === 'function'
      ? require
      : createRequire(
          typeof import.meta !== 'undefined' && import.meta?.url
            ? import.meta.url
            : path.join(process.cwd(), 'dummy.js')
        );
  const sqlite = dynamicRequire('node:sqlite');
  DatabaseSyncClass = sqlite.DatabaseSync;
} catch {
  // SQLite native module not available; fallback will use durable file store
}

export class DatabaseEngine {
  private static instance: DatabaseEngine;
  private db: any = null;
  private dbPath: string;
  private dataDir: string;
  private isSqliteActive: boolean = false;

  private constructor() {
    const baseDir = process.env.STORAGE_DATA_DIR || path.join(process.cwd(), 'data');
    this.dataDir = baseDir;

    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      this.dbPath = path.join(this.dataDir, 'axiom.db');
    } catch {
      this.dataDir = '/tmp';
      this.dbPath = path.join('/tmp', 'axiom.db');
    }

    this.initDatabase();
  }

  public static getInstance(): DatabaseEngine {
    if (!DatabaseEngine.instance) {
      DatabaseEngine.instance = new DatabaseEngine();
    }
    return DatabaseEngine.instance;
  }

  private initDatabase(): void {
    if (!DatabaseSyncClass) {
      console.warn('[Database] Native node:sqlite not available, using JSON persistent store.');
      return;
    }

    try {
      this.db = new DatabaseSyncClass(this.dbPath);
      this.isSqliteActive = true;

      // Create ai_providers table matching schema.sql
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ai_providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider_type TEXT NOT NULL,
          base_url TEXT,
          api_key_encrypted TEXT,
          model_name TEXT NOT NULL,
          priority INTEGER DEFAULT 1,
          enabled INTEGER DEFAULT 1,
          timeout_ms INTEGER DEFAULT 60000,
          max_retries INTEGER DEFAULT 3,
          max_tokens INTEGER DEFAULT 4000,
          temperature REAL DEFAULT 0.7,
          capabilities_json TEXT,
          headers_json TEXT,
          last_tested_at TEXT,
          last_test_status TEXT DEFAULT 'NEVER_TESTED',
          last_error TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS search_providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider_type TEXT NOT NULL,
          base_url TEXT DEFAULT 'https://api.tavily.com',
          api_key_encrypted TEXT,
          priority INTEGER DEFAULT 1,
          enabled INTEGER DEFAULT 1,
          timeout_ms INTEGER DEFAULT 30000,
          max_retries INTEGER DEFAULT 3,
          search_depth TEXT DEFAULT 'basic',
          max_results INTEGER DEFAULT 5,
          include_domains_json TEXT,
          exclude_domains_json TEXT,
          last_tested_at TEXT,
          last_test_status TEXT DEFAULT 'NEVER_TESTED',
          last_error TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log(`[Database] SQLite initialized successfully at ${this.dbPath}`);
    } catch (err) {
      console.warn('[Database] SQLite initialization warning:', err);
      this.isSqliteActive = false;
    }
  }

  public getSqliteStatus(): { active: boolean; path: string } {
    return { active: this.isSqliteActive, path: this.dbPath };
  }

  // ==========================================
  // AI PROVIDERS SQLITE OPERATIONS
  // ==========================================

  public getAllAIProvidersSql(): AIProviderConfig[] | null {
    if (!this.isSqliteActive || !this.db) return null;

    try {
      const rows = this.db.prepare(`
        SELECT * FROM ai_providers ORDER BY priority ASC, created_at ASC
      `).all();

      return rows.map((r: any) => this.mapRowToAIProvider(r));
    } catch (err) {
      console.error('[Database] Failed to query ai_providers:', err);
      return null;
    }
  }

  public saveAIProviderSql(provider: AIProviderConfig): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_providers (
          id, name, provider_type, base_url, api_key_encrypted, model_name,
          priority, enabled, timeout_ms, max_retries, max_tokens, temperature,
          capabilities_json, headers_json, last_tested_at, last_test_status, last_error,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider_type = excluded.provider_type,
          base_url = excluded.base_url,
          api_key_encrypted = CASE WHEN excluded.api_key_encrypted != '' THEN excluded.api_key_encrypted ELSE ai_providers.api_key_encrypted END,
          model_name = excluded.model_name,
          priority = excluded.priority,
          enabled = excluded.enabled,
          timeout_ms = excluded.timeout_ms,
          max_retries = excluded.max_retries,
          max_tokens = excluded.max_tokens,
          temperature = excluded.temperature,
          capabilities_json = excluded.capabilities_json,
          headers_json = excluded.headers_json,
          last_tested_at = COALESCE(excluded.last_tested_at, ai_providers.last_tested_at),
          last_test_status = COALESCE(excluded.last_test_status, ai_providers.last_test_status),
          last_error = excluded.last_error,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        provider.id,
        provider.name,
        provider.type,
        provider.baseUrl || '',
        provider.apiKey || '',
        provider.modelName || provider.defaultModel || 'gpt-4o',
        provider.priority ?? 1,
        provider.enabled ? 1 : 0,
        provider.timeoutMs ?? 60000,
        provider.maxRetries ?? 3,
        provider.maxTokens ?? 4000,
        provider.temperature ?? 0.7,
        JSON.stringify(provider.capabilities || {}),
        JSON.stringify(provider.headers || {}),
        provider.lastTestedAt || null,
        provider.lastTestStatus || 'NEVER_TESTED',
        provider.lastError || null,
        new Date().toISOString()
      );

      return true;
    } catch (err) {
      console.error('[Database] Failed to save AI provider in SQLite:', err);
      return false;
    }
  }

  public deleteAIProviderSql(id: string): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      this.db.prepare('DELETE FROM ai_providers WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[Database] Failed to delete AI provider in SQLite:', err);
      return false;
    }
  }

  public toggleAIProviderSql(id: string, enabled: boolean): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      this.db.prepare(`
        UPDATE ai_providers SET enabled = ?, updated_at = ? WHERE id = ?
      `).run(enabled ? 1 : 0, new Date().toISOString(), id);
      return true;
    } catch (err) {
      console.error('[Database] Failed to toggle AI provider in SQLite:', err);
      return false;
    }
  }

  public updateAIProviderPrioritySql(id: string, priority: number): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      this.db.prepare(`
        UPDATE ai_providers SET priority = ?, updated_at = ? WHERE id = ?
      `).run(priority, new Date().toISOString(), id);
      return true;
    } catch (err) {
      console.error('[Database] Failed to update priority in SQLite:', err);
      return false;
    }
  }

  // ==========================================
  // SEARCH PROVIDERS SQLITE OPERATIONS
  // ==========================================

  public getAllSearchProvidersSql(): SearchProviderConfig[] | null {
    if (!this.isSqliteActive || !this.db) return null;

    try {
      const rows = this.db.prepare(`
        SELECT * FROM search_providers ORDER BY priority ASC, created_at ASC
      `).all();

      return rows.map((r: any) => this.mapRowToSearchProvider(r));
    } catch (err) {
      console.error('[Database] Failed to query search_providers:', err);
      return null;
    }
  }

  public saveSearchProviderSql(provider: SearchProviderConfig): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO search_providers (
          id, name, provider_type, base_url, api_key_encrypted,
          priority, enabled, timeout_ms, max_retries, search_depth, max_results,
          include_domains_json, exclude_domains_json, last_tested_at, last_test_status, last_error,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider_type = excluded.provider_type,
          base_url = excluded.base_url,
          api_key_encrypted = CASE WHEN excluded.api_key_encrypted != '' THEN excluded.api_key_encrypted ELSE search_providers.api_key_encrypted END,
          priority = excluded.priority,
          enabled = excluded.enabled,
          timeout_ms = excluded.timeout_ms,
          max_retries = excluded.max_retries,
          search_depth = excluded.search_depth,
          max_results = excluded.max_results,
          include_domains_json = excluded.include_domains_json,
          exclude_domains_json = excluded.exclude_domains_json,
          last_tested_at = COALESCE(excluded.last_tested_at, search_providers.last_tested_at),
          last_test_status = COALESCE(excluded.last_test_status, search_providers.last_test_status),
          last_error = excluded.last_error,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        provider.id,
        provider.name,
        provider.type,
        provider.baseUrl || 'https://api.tavily.com',
        provider.apiKey || '',
        provider.priority ?? 1,
        provider.enabled ? 1 : 0,
        provider.timeoutMs ?? 30000,
        provider.maxRetries ?? 3,
        provider.searchDepth || 'basic',
        provider.maxResults ?? 5,
        JSON.stringify(provider.includeDomains || []),
        JSON.stringify(provider.excludeDomains || []),
        provider.lastTestedAt || null,
        provider.lastTestStatus || 'NEVER_TESTED',
        provider.lastError || null,
        new Date().toISOString()
      );

      return true;
    } catch (err) {
      console.error('[Database] Failed to save search provider in SQLite:', err);
      return false;
    }
  }

  public deleteSearchProviderSql(id: string): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      this.db.prepare('DELETE FROM search_providers WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[Database] Failed to delete search provider in SQLite:', err);
      return false;
    }
  }

  public toggleSearchProviderSql(id: string, enabled: boolean): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      this.db.prepare(`
        UPDATE search_providers SET enabled = ?, updated_at = ? WHERE id = ?
      `).run(enabled ? 1 : 0, new Date().toISOString(), id);
      return true;
    } catch (err) {
      console.error('[Database] Failed to toggle search provider in SQLite:', err);
      return false;
    }
  }

  public updateSearchProviderPrioritySql(id: string, priority: number): boolean {
    if (!this.isSqliteActive || !this.db) return false;

    try {
      this.db.prepare(`
        UPDATE search_providers SET priority = ?, updated_at = ? WHERE id = ?
      `).run(priority, new Date().toISOString(), id);
      return true;
    } catch (err) {
      console.error('[Database] Failed to update search provider priority in SQLite:', err);
      return false;
    }
  }

  // ==========================================
  // HELPERS / MAPPERS
  // ==========================================

  private mapRowToAIProvider(row: any): AIProviderConfig {
    let capabilities = { jsonMode: true, toolCalling: false, webGrounding: false, vision: false };
    if (row.capabilities_json) {
      try {
        capabilities = JSON.parse(row.capabilities_json);
      } catch {
        // use default
      }
    }

    let headers: Record<string, string> = {};
    if (row.headers_json) {
      try {
        headers = JSON.parse(row.headers_json);
      } catch {
        // empty
      }
    }

    return {
      id: row.id,
      name: row.name,
      type: row.provider_type,
      baseUrl: row.base_url || '',
      apiKey: row.api_key_encrypted || '',
      modelName: row.model_name,
      defaultModel: row.model_name,
      priority: Number(row.priority) || 1,
      enabled: Boolean(row.enabled),
      timeoutMs: Number(row.timeout_ms) || 60000,
      maxRetries: Number(row.max_retries) || 3,
      maxTokens: Number(row.max_tokens) || 4000,
      temperature: Number(row.temperature) || 0.7,
      capabilities,
      headers,
      lastTestedAt: row.last_tested_at || undefined,
      lastTestStatus: row.last_test_status || 'NEVER_TESTED',
      lastError: row.last_error || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToSearchProvider(row: any): SearchProviderConfig {
    let includeDomains: string[] = [];
    if (row.include_domains_json) {
      try {
        includeDomains = JSON.parse(row.include_domains_json);
      } catch {
        // empty
      }
    }

    let excludeDomains: string[] = [];
    if (row.exclude_domains_json) {
      try {
        excludeDomains = JSON.parse(row.exclude_domains_json);
      } catch {
        // empty
      }
    }

    return {
      id: row.id,
      name: row.name,
      type: row.provider_type,
      baseUrl: row.base_url || 'https://api.tavily.com',
      apiKey: row.api_key_encrypted || '',
      priority: Number(row.priority) || 1,
      enabled: Boolean(row.enabled),
      timeoutMs: Number(row.timeout_ms) || 30000,
      maxRetries: Number(row.max_retries) || 3,
      searchDepth: row.search_depth || 'basic',
      maxResults: Number(row.max_results) || 5,
      includeDomains,
      excludeDomains,
      lastTestedAt: row.last_tested_at || undefined,
      lastTestStatus: row.last_test_status || 'NEVER_TESTED',
      lastError: row.last_error || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
