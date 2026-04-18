const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'prisma', 'gym.db');


try {
  const db = new Database(dbPath);


  // 1. Enable WAL mode (Write-Ahead Logging) - Much faster!
  db.pragma('journal_mode = WAL');

  // 2. Increase cache size
  db.pragma('cache_size = -32000'); // 32MB cache

  // 3. Set page size
  db.pragma('page_size = 4096');

  // 4. Enable memory-mapped I/O
  db.pragma('mmap_size = 268435456'); // 256MB

  // 5. Set temp store to memory
  db.pragma('temp_store = MEMORY');

  // 6. Set synchronous mode
  db.pragma('synchronous = NORMAL');

  // 7. Set locking mode
  db.pragma('locking_mode = NORMAL');

  // 8. Run VACUUM to optimize database
  db.exec('VACUUM');

  // Get current settings
  const journalMode = db.pragma('journal_mode', { simple: true });
  const cacheSize = db.pragma('cache_size', { simple: true });
  const pageSize = db.pragma('page_size', { simple: true });
  const mmapSize = db.pragma('mmap_size', { simple: true });
  const tempStore = db.pragma('temp_store', { simple: true });
  const synchronous = db.pragma('synchronous', { simple: true });
  const lockingMode = db.pragma('locking_mode', { simple: true });


  // Get database stats
  const fs = require('fs');
  const stats = fs.statSync(dbPath);
  const pageCount = db.pragma('page_count', { simple: true });


  // Get table counts
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name").all();

  tables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  });


  db.close();

} catch (error) {
  console.error('❌ Error optimizing database:', error.message);
  process.exit(1);
}
