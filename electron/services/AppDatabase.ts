import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';

interface JsonConfig<T> {
  channels?: T[];
  shows?: T[];
  lastUpdated?: string;
}

interface StoredJsonRow {
  data_json: string;
}

interface MetadataRow {
  value: string;
}

export class AppDatabase {
  private static instance: AppDatabase | null = null;
  private readonly database: DatabaseSync;

  private constructor() {
    const databasePath = path.join(app.getPath('userData'), 'analog-replay-tv.sqlite');
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS channels (
        storage_key TEXT PRIMARY KEY,
        legacy_id TEXT,
        uuid TEXT,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_enabled INTEGER NOT NULL CHECK (is_enabled IN (0, 1)),
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS channels_uuid_uq
        ON channels(uuid) WHERE uuid IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS channels_number_uq ON channels(number);

      CREATE TABLE IF NOT EXISTS shows (
        storage_key TEXT PRIMARY KEY,
        legacy_id TEXT,
        uuid TEXT,
        name TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE UNIQUE INDEX IF NOT EXISTS shows_uuid_uq
        ON shows(uuid) WHERE uuid IS NOT NULL;

      CREATE TABLE IF NOT EXISTS schedule_config (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS schedule_months (
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        generated_at TEXT NOT NULL,
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        PRIMARY KEY (year, month)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS settings (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS commercial_config (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        data_json TEXT NOT NULL CHECK (json_valid(data_json))
      ) STRICT;

      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (1, datetime('now'));
    `);

    this.migrateLegacyCatalog();
  }

  public static getInstance(): AppDatabase {
    if (!this.instance) this.instance = new AppDatabase();
    return this.instance;
  }

  private transaction(action: () => void): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      action();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private getMetadata(key: string): string | null {
    const row = this.database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key) as MetadataRow | undefined;
    return row?.value ?? null;
  }

  private setMetadata(key: string, value: string): void {
    this.database.prepare(`
      INSERT INTO app_metadata(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  private migrateLegacyCatalog(): void {
    const configRoot = path.join(process.cwd(), 'src', 'config');
    const channelsPath = path.join(configRoot, 'channels', 'channels.config.json');
    const showsPath = path.join(configRoot, 'shows', 'shows.config.json');
    const commercialsPath = path.join(configRoot, 'commercials', 'commercials.config.json');

    if (this.countRows('channels') === 0 && fs.existsSync(channelsPath)) {
      const config = JSON.parse(fs.readFileSync(channelsPath, 'utf8')) as JsonConfig<Record<string, unknown>>;
      this.saveChannelsConfig(config);
      this.setMetadata('migration.channels.source', channelsPath);
    }

    if (this.countRows('shows') === 0 && fs.existsSync(showsPath)) {
      const config = JSON.parse(fs.readFileSync(showsPath, 'utf8')) as JsonConfig<Record<string, unknown>>;
      this.saveShowsConfig(config);
      this.setMetadata('migration.shows.source', showsPath);
    }

    if (!this.loadCommercialConfig() && fs.existsSync(commercialsPath)) {
      const config = JSON.parse(fs.readFileSync(commercialsPath, 'utf8')) as Record<string, unknown>;
      this.saveCommercialConfig(config);
      this.setMetadata('migration.commercials.source', commercialsPath);
    }
  }

  private countRows(table: 'channels' | 'shows' | 'schedule_months'): number {
    const row = this.database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return Number(row.count);
  }

  public saveChannelsConfig(config: JsonConfig<Record<string, unknown>>): void {
    const channels = Array.isArray(config.channels) ? config.channels : [];
    const insert = this.database.prepare(`
      INSERT INTO channels(storage_key, legacy_id, uuid, number, name, is_enabled, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.transaction(() => {
      this.database.exec('DELETE FROM channels');
      channels.forEach((channel, index) => {
        const id = channel.id == null ? null : String(channel.id);
        const uuid = typeof channel.uuid === 'string' && channel.uuid ? channel.uuid : null;
        const number = Number(channel.number);
        const name = String(channel.name ?? `Canal ${number}`);
        const key = uuid || id || `channel-${index + 1}`;
        insert.run(key, id, uuid, number, name, channel.isEnabled === false ? 0 : 1, JSON.stringify(channel));
      });
      this.setMetadata('channels.lastUpdated', config.lastUpdated || new Date().toISOString());
    });
  }

  public loadChannelsConfig(): { channels: Record<string, unknown>[]; lastUpdated: string } {
    const rows = this.database.prepare('SELECT data_json FROM channels ORDER BY number').all() as unknown as StoredJsonRow[];
    return {
      channels: rows.map(row => JSON.parse(row.data_json) as Record<string, unknown>),
      lastUpdated: this.getMetadata('channels.lastUpdated') || new Date().toISOString()
    };
  }

  public saveShowsConfig(config: JsonConfig<Record<string, unknown>>): void {
    const shows = Array.isArray(config.shows) ? config.shows : [];
    const insert = this.database.prepare(`
      INSERT INTO shows(storage_key, legacy_id, uuid, name, data_json)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.transaction(() => {
      this.database.exec('DELETE FROM shows');
      shows.forEach((show, index) => {
        const id = show.id == null ? null : String(show.id);
        const uuid = typeof show.uuid === 'string' && show.uuid ? show.uuid : null;
        const name = String(show.name ?? `Show ${index + 1}`);
        const key = uuid || id || `show-${index + 1}`;
        insert.run(key, id, uuid, name, JSON.stringify(show));
      });
      this.setMetadata('shows.lastUpdated', config.lastUpdated || new Date().toISOString());
    });
  }

  public loadShowsConfig(): { shows: Record<string, unknown>[]; lastUpdated: string } {
    const rows = this.database.prepare('SELECT data_json FROM shows ORDER BY rowid').all() as unknown as StoredJsonRow[];
    return {
      shows: rows.map(row => JSON.parse(row.data_json) as Record<string, unknown>),
      lastUpdated: this.getMetadata('shows.lastUpdated') || new Date().toISOString()
    };
  }

  public migrateLegacySchedules(configPath: string, schedulesPath: string): void {
    if (!this.loadScheduleConfig() && fs.existsSync(configPath)) {
      this.saveScheduleConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>);
      this.setMetadata('migration.scheduleConfig.source', configPath);
    }

    if (fs.existsSync(schedulesPath)) {
      // Los meses pueden ser muy grandes. Se migran bajo demanda al consultarlos
      // para no bloquear el proceso principal durante el arranque.
      this.setMetadata('migration.schedules.source', schedulesPath);
    }
  }

  public saveScheduleConfig(config: Record<string, unknown>): void {
    this.database.prepare(`
      INSERT INTO schedule_config(singleton, data_json) VALUES (1, ?)
      ON CONFLICT(singleton) DO UPDATE SET data_json = excluded.data_json
    `).run(JSON.stringify(config));
  }

  public loadScheduleConfig<T>(): T | null {
    const row = this.database.prepare('SELECT data_json FROM schedule_config WHERE singleton = 1').get() as StoredJsonRow | undefined;
    return row ? JSON.parse(row.data_json) as T : null;
  }

  private saveScheduleMonthUnsafe(year: number, month: number, schedule: Record<string, unknown>): void {
    const generatedAt = typeof schedule.generated === 'string' ? schedule.generated : new Date().toISOString();
    this.database.prepare(`
      INSERT INTO schedule_months(year, month, generated_at, data_json) VALUES (?, ?, ?, ?)
      ON CONFLICT(year, month) DO UPDATE SET
        generated_at = excluded.generated_at,
        data_json = excluded.data_json
    `).run(year, month, generatedAt, JSON.stringify(schedule));
  }

  public saveScheduleMonth(year: number, month: number, schedule: Record<string, unknown>): void {
    this.saveScheduleMonthUnsafe(year, month, schedule);
  }

  public replaceScheduleYear(
    year: number,
    schedules: Array<{ month: number; schedule: Record<string, unknown> }>
  ): void {
    this.transaction(() => {
      this.database.prepare('DELETE FROM schedule_months WHERE year = ?').run(year);
      schedules.forEach(({ month, schedule }) => {
        this.saveScheduleMonthUnsafe(year, month, schedule);
      });
    });
  }

  public loadScheduleMonth<T>(year: number, month: number): T | null {
    const row = this.database.prepare(
      'SELECT data_json FROM schedule_months WHERE year = ? AND month = ?'
    ).get(year, month) as StoredJsonRow | undefined;
    return row ? JSON.parse(row.data_json) as T : null;
  }

  public resetSchedules(): void {
    this.transaction(() => {
      this.database.exec('DELETE FROM schedule_months; DELETE FROM schedule_config;');
    });
  }

  public saveSettings(settings: Record<string, unknown>): void {
    this.database.prepare(`
      INSERT INTO settings(singleton, data_json, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `).run(JSON.stringify(settings), new Date().toISOString());
  }

  public loadSettings<T>(): T | null {
    const row = this.database.prepare('SELECT data_json FROM settings WHERE singleton = 1').get() as StoredJsonRow | undefined;
    return row ? JSON.parse(row.data_json) as T : null;
  }

  public importLegacySettings<T extends Record<string, unknown>>(settings: T): T {
    const stored = this.loadSettings<T>();
    if (stored) return stored;
    this.saveSettings(settings);
    this.setMetadata('migration.settings.source', 'renderer-localStorage');
    return settings;
  }

  public saveCommercialConfig(config: Record<string, unknown>): void {
    this.database.prepare(`
      INSERT INTO commercial_config(singleton, data_json) VALUES (1, ?)
      ON CONFLICT(singleton) DO UPDATE SET data_json = excluded.data_json
    `).run(JSON.stringify(config));
  }

  public loadCommercialConfig<T>(): T | null {
    const row = this.database.prepare('SELECT data_json FROM commercial_config WHERE singleton = 1').get() as StoredJsonRow | undefined;
    return row ? JSON.parse(row.data_json) as T : null;
  }

  public close(): void {
    this.database.close();
  }
}

export const appDatabase = AppDatabase.getInstance();
