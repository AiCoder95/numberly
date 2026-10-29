const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export class DedupStore {
  constructor(sql) {
    this.sql = sql;
    sql.exec('CREATE TABLE IF NOT EXISTS updates (update_id INTEGER PRIMARY KEY, message_hash TEXT NOT NULL UNIQUE, received_at INTEGER NOT NULL)');
    sql.exec('CREATE INDEX IF NOT EXISTS updates_received_at ON updates(received_at)');
  }

  async fetch(request) {
    const {updateId, messageHash, reply} = await request.json();
    const now = Date.now();
    // Telegram retains undelivered updates for no longer than 24 hours.
    this.sql.exec('DELETE FROM updates WHERE received_at < ?', now - RETENTION_MS);
    const insert = this.sql.exec('INSERT OR IGNORE INTO updates (update_id, message_hash, received_at) VALUES (?, ?, ?)', updateId, messageHash, now);
    return insert.rowsWritten > 0 ? Response.json(reply) : new Response('OK');
  }
}
