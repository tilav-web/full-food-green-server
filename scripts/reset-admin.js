const sqlite3 = require("sqlite3").verbose()
const bcrypt = require("bcryptjs")
const path = require("path")
const fs = require("fs")

const newUsername = process.argv[2]
const newPassword = process.argv[3]

if (!newUsername || !newPassword) {
  console.error("Usage: node scripts/reset-admin.js <username> <password> [dbPath]")
  process.exit(1)
}

const dbPathCandidate =
  process.argv[4] ||
  process.env.DATABASE_PATH ||
  path.resolve(__dirname, "../data/fullfood.sqlite")

const dbPath = path.isAbsolute(dbPathCandidate)
  ? dbPathCandidate
  : path.resolve(__dirname, "..", dbPathCandidate)

if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at: ${dbPath}`)
  process.exit(1)
}

console.log(`Using database: ${dbPath}`)

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to database:", err)
    process.exit(1)
  }
})

const hashedPassword = bcrypt.hashSync(newPassword, 8)

db.get("SELECT id, username, fullName, role FROM users WHERE role = 'ADMIN' LIMIT 1", (err, row) => {
  if (err) {
    console.error("Error querying admin user:", err)
    db.close()
    process.exit(1)
  }

  if (row) {
    db.run(
      "UPDATE users SET username = ?, password = ?, updatedAt = datetime('now') WHERE id = ?",
      [newUsername, hashedPassword, row.id],
      function (updateErr) {
        if (updateErr) {
          console.error("Failed to update admin:", updateErr)
        } else {
          console.log("==========================================")
          console.log(" SUCCESS: Super Admin credentials updated!")
          console.log(` ID:       ${row.id}`)
          console.log(` Username: ${newUsername}`)
          console.log(` Password: ${newPassword}`)
          console.log("==========================================")
        }
        db.close()
      }
    )
  } else {
    // If no admin user exists, create one
    const newId = `admin_${Date.now()}`
    db.run(
      `INSERT INTO users (id, username, fullName, role, password, balance, isBotActive, createdAt, updatedAt)
       VALUES (?, ?, 'Super Admin', 'ADMIN', ?, 0, 1, datetime('now'), datetime('now'))`,
      [newId, newUsername, hashedPassword],
      function (insertErr) {
        if (insertErr) {
          console.error("Failed to insert admin:", insertErr)
        } else {
          console.log("==========================================")
          console.log(" SUCCESS: Super Admin user created!")
          console.log(` ID:       ${newId}`)
          console.log(` Username: ${newUsername}`)
          console.log(` Password: ${newPassword}`)
          console.log("==========================================")
        }
        db.close()
      }
    )
  }
})
