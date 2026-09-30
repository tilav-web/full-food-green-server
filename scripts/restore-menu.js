const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const fs = require("fs")

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, "../data/fullfood.sqlite")
console.log(`Connecting to database: ${dbPath}`)

const db = new sqlite3.Database(dbPath)

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

// 7 Original Clean Categories
const ORIGINAL_CATEGORIES = [
  {
    id: "cmp6y48gk00096o5e8046m3or",
    name: "Asosiy taomlar",
    slug: "asosiy-taomlar",
    icon: "Utensils",
    sortOrder: 1,
    imageUrl: "/uploads/cat_asosiy.jpg",
  },
  {
    id: "cmo9ujrmq00086o7u8z6qdp5z",
    name: "Garnirlar",
    slug: "garnirlar",
    icon: "Soup",
    sortOrder: 2,
    imageUrl: "/uploads/cat_garnirlar.jpg",
  },
  {
    id: "cmstafqgx006u6o3h710f5ze3",
    name: "Desertlar",
    slug: "desertlar",
    icon: "CakeSlice",
    sortOrder: 3,
    imageUrl: "/uploads/cat_desertlar.jpg",
  },
  {
    id: "cmo9zd55y00096o7uljhrb2kb",
    name: "Combo Set",
    slug: "combo-set",
    icon: "Sparkles",
    sortOrder: 4,
    imageUrl: "/uploads/cat_combo.jpg",
  },
  {
    id: "cmo887deo00046ot7nnjlqmth",
    name: "Salatlar",
    slug: "salatlar",
    icon: "Salad",
    sortOrder: 5,
    imageUrl: "/uploads/cat_salatlar.jpg",
  },
  {
    id: "cmo9trb0k00006o7ul4zh8r1h",
    name: "Ichimliklar",
    slug: "ichimliklar",
    icon: "Coffee",
    sortOrder: 6,
    imageUrl: "/uploads/cat_ichimliklar.jpg",
  },
  {
    id: "cmo9zetcp000a6o7uawa75b2p",
    name: "Nonlar",
    slug: "nonlar",
    icon: "Sandwich",
    sortOrder: 7,
    imageUrl: "/uploads/cat_nonlar.jpg",
  },
]

// Mapping from temporary categories (created on 2026-09-29) to original categories
const TEMP_TO_ORIGINAL = {
  "f5286a7d-27ab-45f9-be41-ec8943f154c0": "cmp6y48gk00096o5e8046m3or", // Asosiy Taom -> Asosiy taomlar
  "719f0809-8f5d-4d17-ab2a-be238c01fdff": "cmo9ujrmq00086o7u8z6qdp5z", // Garnirlar -> Garnirlar
  "cd31fe16-574f-4af9-b164-cd5377df92ac": "cmo9trb0k00006o7ul4zh8r1h", // Ichimliklar -> Ichimliklar
  "bd52b477-a1bb-4b01-b5ec-838a66199063": "cmo887deo00046ot7nnjlqmth", // Salatlar -> Salatlar
}

async function main() {
  console.log("=== 1. Rename Temporary Category Slugs to Avoid Unique Constraint Collisions ===")
  const tempIds = Object.keys(TEMP_TO_ORIGINAL)
  for (const tid of tempIds) {
    await run("UPDATE categories SET slug = 'temp_' || substr(id, 1, 8) WHERE id = ?", [tid])
  }

  console.log("\n=== 2. Ensuring 7 Original Categories Exist with Proper Slugs and Images ===")
  for (const cat of ORIGINAL_CATEGORIES) {
    const found = await query("SELECT id FROM categories WHERE id = ?", [cat.id])
    if (found.length === 0) {
      await run(
        `INSERT INTO categories (id, name, slug, icon, sortOrder, imageUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [cat.id, cat.name, cat.slug, cat.icon, cat.sortOrder, cat.imageUrl]
      )
      console.log(` + Inserted category: ${cat.name} (${cat.id})`)
    } else {
      await run(
        `UPDATE categories SET name = ?, slug = ?, icon = ?, sortOrder = ?, imageUrl = ?, updatedAt = datetime('now') WHERE id = ?`,
        [cat.name, cat.slug, cat.icon, cat.sortOrder, cat.imageUrl, cat.id]
      )
      console.log(` ~ Updated category: ${cat.name} (${cat.id})`)
    }
  }

  console.log("\n=== 3. Remapping Products from Temporary Categories to Original Categories ===")
  for (const [tempId, origId] of Object.entries(TEMP_TO_ORIGINAL)) {
    const res = await run("UPDATE products SET categoryId = ? WHERE categoryId = ?", [origId, tempId])
    console.log(` Remapped from temp ${tempId} to ${origId}: ${res.changes} products`)
  }

  console.log("\n=== 4. Remapping Products with NULL categoryId ===")
  const unlinked = await query(
    "SELECT id, name, price FROM products WHERE categoryId IS NULL OR categoryId NOT IN (SELECT id FROM categories)"
  )
  console.log(`Found ${unlinked.length} unlinked products. Remapping by name/keywords...`)

  let remappedCount = 0
  for (const p of unlinked) {
    const nameLower = (p.name || "").toLowerCase()
    let targetCatId = null

    // Heuristics based on name keywords
    if (nameLower.includes("salat") || nameLower.includes("svejiy") || nameLower.includes("achchiq")) {
      targetCatId = "cmo887deo00046ot7nnjlqmth" // Salatlar
    } else if (nameLower.includes("non") || nameLower.includes("patir") || nameLower.includes("lepyoshka")) {
      targetCatId = "cmo9zetcp000a6o7uawa75b2p" // Nonlar
    } else if (
      nameLower.includes("choy") || nameLower.includes("suv") || nameLower.includes("sharbat") ||
      nameLower.includes("sok") || nameLower.includes("cola") || nameLower.includes("fanta") ||
      nameLower.includes("pepsi") || nameLower.includes("kofe") || nameLower.includes("coffee") ||
      nameLower.includes("ayron") || nameLower.includes("kompot") || nameLower.includes("limonad") ||
      nameLower.includes("fuse tea") || nameLower.includes("kefir") || nameLower.includes("sprite")
    ) {
      targetCatId = "cmo9trb0k00006o7ul4zh8r1h" // Ichimliklar
    } else if (
      nameLower.includes("guruch") || nameLower.includes("grechka") || nameLower.includes("pyure") ||
      nameLower.includes("kartoshka") || nameLower.includes("fri") || nameLower.includes("makaron") ||
      nameLower.includes("ovush") || nameLower.includes("sabzavot")
    ) {
      targetCatId = "cmo9ujrmq00086o7u8z6qdp5z" // Garnirlar
    } else if (nameLower.includes("combo") || nameLower.includes("set") || nameLower.includes("kombo")) {
      targetCatId = "cmo9zd55y00096o7uljhrb2kb" // Combo Set
    } else if (
      nameLower.includes("tort") || nameLower.includes("shirinlik") || nameLower.includes("desert") ||
      nameLower.includes("piroshki") || nameLower.includes("trifle")
    ) {
      targetCatId = "cmstafqgx006u6o3h710f5ze3" // Desertlar
    } else {
      // Default to Asosiy taomlar for meat / general food dishes (moxora, sho'rva, tovuq, gosht, dolma, etc.)
      targetCatId = "cmp6y48gk00096o5e8046m3or" // Asosiy taomlar
    }

    await run("UPDATE products SET categoryId = ?, isActive = 1, isDeleted = 0 WHERE id = ?", [targetCatId, p.id])
    remappedCount++
  }
  console.log(` Successfully remapped ${remappedCount} unlinked products!`)

  // Ensure any trifle/dessert goes to Desertlar
  await run("UPDATE products SET categoryId = 'cmstafqgx006u6o3h710f5ze3' WHERE LOWER(name) LIKE '%trifle%'")

  console.log("\n=== 5. Deleting Temporary Categories ===")
  for (const tid of tempIds) {
    const delRes = await run("DELETE FROM categories WHERE id = ?", [tid])
    console.log(` Deleted temp category ${tid}: ${delRes.changes} removed`)
  }

  console.log("\n=== 6. Final Category & Product Summary ===")
  const finalCats = await query(
    "SELECT id, name, slug, sortOrder, (SELECT COUNT(*) FROM products WHERE categoryId = categories.id) as productCount FROM categories ORDER BY sortOrder"
  )
  console.log("Categories and Product Counts:")
  console.table(finalCats)

  const remainingNull = await query("SELECT COUNT(*) as count FROM products WHERE categoryId IS NULL")
  console.log(`Products without category: ${remainingNull[0].count}`)

  const totalOrders = await query("SELECT COUNT(*) as count FROM orders")
  console.log(`Total orders preserved: ${totalOrders[0].count}`)

  const totalUsers = await query("SELECT COUNT(*) as count FROM users")
  console.log(`Total users preserved: ${totalUsers[0].count}`)

  db.close()
  console.log("\n>>> MENU RESTORATION COMPLETED SUCCESSFULLY! <<<")
}

main().catch(err => {
  console.error("FATAL ERROR:", err)
  db.close()
  process.exit(1)
})
