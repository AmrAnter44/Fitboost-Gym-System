# 🔧 Database Management Scripts

## 📝 Quick Reference

### 🚀 Main Scripts

| Command | What it does | When to use |
|---------|-------------|-------------|
| `npm run db:setup` | Full database setup with migrations | First time, or complete setup |
| `npm run db:fix` | Quick fix for common issues | Database errors, after moving files |
| `npm run db:migrate <path>` | Migrate old database | Moving from old system |
| `npm run db:backup` | Create manual backup | Before important changes |
| `npm run db:validate` | Check database health | Regular maintenance |

---

## 📁 Script Files

### 1. setup-database.js
**Full automated database setup**

```bash
node scripts/setup-database.js

# Or with custom database:
node scripts/setup-database.js --db-path=/path/to/old.db
```

**Steps:**
1. ✅ Check environment (Node.js, Prisma)
2. ✅ Create automatic backup
3. ✅ Clear extended attributes (macOS)
4. ✅ Set file permissions
5. ✅ Copy external database (if provided)
6. ✅ Generate Prisma Client
7. ✅ Apply all migrations
8. ✅ Verify database integrity
9. ✅ Cleanup temporary files

**Time:** ~30-60 seconds

---

### 2. quick-fix-db.sh
**Fast fix for common database issues**

```bash
bash scripts/quick-fix-db.sh

# Or via npm:
npm run db:fix
```

**Fixes:**
- ❌ "Unable to open database file"
- ❌ "Database is locked"
- ❌ Permission errors
- ❌ Extended attributes issues

**Time:** ~5-10 seconds

---

### 3. migrate-old-db.sh
**Migrate an old database to the new system**

```bash
bash scripts/migrate-old-db.sh /path/to/old/gym.db

# Or via npm:
npm run db:migrate /path/to/old/gym.db
```

**Example:**
```bash
npm run db:migrate ~/Desktop/gym.db.backup
npm run db:migrate ./old-system/gym.db
```

**What it does:**
1. Validates old database file
2. Creates backup of current database
3. Copies old database to project
4. Applies all missing migrations
5. Verifies data integrity
6. Prepares system for use

**Time:** ~1-2 minutes

---

## 🆘 Common Error Solutions

### Error: "Unable to open database file"
```bash
npm run db:fix
```

### Error: "Database is locked"
```bash
# Stop server (Ctrl+C)
rm -f ./prisma/gym.db-wal
rm -f ./prisma/gym.db-shm
npm run dev
```

### Error: "Migration failed"
```bash
npm run db:setup
```

### Database is empty
```bash
npx prisma db push
```

---

## 💡 Usage Examples

### Example 1: First time setup
```bash
git clone [repository]
cd sys-Xgym
npm install
npm run db:setup
npm run dev
```

### Example 2: Moving project to new computer
```bash
# On old computer:
npm run db:backup
# Copy prisma/gym.db.backup.* to new computer

# On new computer:
git clone [repository]
cd sys-Xgym
npm install
npm run db:migrate ~/Desktop/gym.db.backup.20260220_120000
npm run dev
```

### Example 3: Import old database
```bash
# You have: ~/old-gym-system/database.db
npm run db:migrate ~/old-gym-system/database.db
npm run dev
```

### Example 4: Database corrupted
```bash
# Restore from backup:
npm run db:migrate prisma/gym.db.backup.20260220_120000
```

---

## 📋 Maintenance Checklist

### Daily
- [ ] Check logs for database errors

### Weekly
```bash
npm run db:optimize  # Optimize performance
npm run db:backup    # Manual backup
```

### Monthly
```bash
npm run db:validate  # Health check
sqlite3 prisma/gym.db "PRAGMA integrity_check;"  # Integrity check

# Clean old backups (>30 days)
find ./prisma -name "gym.db.backup.*" -mtime +30 -delete
```

---

## 🎯 Best Practices

✅ **DO:**
- Create backups before important changes
- Use migrations for schema changes
- Test on backup before applying to production
- Keep multiple backup copies

❌ **DON'T:**
- Delete migrations folder
- Edit database directly without migrations
- Run multiple servers on same database
- Use `db push` in production

---

## 🔐 Permissions

Scripts set these permissions:
- **Directories:** 755 (rwxr-xr-x)
- **Database files:** 644 (rw-r--r--)

If you get permission errors:
```bash
chmod -R 755 ./prisma/
chmod 644 ./prisma/*.db
```

---

## 📞 Help

For detailed documentation, see:
- [DATABASE_GUIDE.md](../DATABASE_GUIDE.md) - Complete guide in Arabic
- [Prisma Docs](https://www.prisma.io/docs)

---

**Last Updated:** February 2026
**Version:** 1.0.0
