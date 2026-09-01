const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const srcDbPath = path.resolve(__dirname, '../data/server_backup.db');
const destDbPath = path.resolve(__dirname, '../data/fullfood.sqlite');

if (!fs.existsSync(srcDbPath)) {
  console.error('❌ Source database not found at:', srcDbPath);
  process.exit(1);
}

const srcDb = new sqlite3.Database(srcDbPath);
const destDb = new sqlite3.Database(destDbPath);

function query(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function cleanImageUrl(url) {
  if (!url) return null;
  if (url.includes('/uploads/')) {
    const filename = url.split('/uploads/').pop();
    return `/uploads/${filename}`;
  }
  return url;
}

const iconMap = {
  'salatlar': 'Salad',
  'ichimliklar': 'Coffee',
  'garnirlar': 'Soup',
  'combo-set': 'Sparkles',
  'combo': 'Sparkles',
  'nonlar': 'Sandwich',
  'asosiy-taomlar': 'Utensils',
  'desertlar': 'CakeSlice'
};

async function migrate() {
  console.log('🚀 Starting Database Migration from Server DB...');

  // 1. Fetch Source Data
  const srcUnits = await query(srcDb, 'SELECT * FROM Unit');
  const srcCategories = await query(srcDb, 'SELECT * FROM Category');
  const srcProducts = await query(srcDb, 'SELECT * FROM Product');
  const srcUsers = await query(srcDb, 'SELECT * FROM User');
  const srcSettings = await query(srcDb, 'SELECT * FROM Setting');

  console.log(`📦 Found: ${srcUnits.length} Units, ${srcCategories.length} Categories, ${srcProducts.length} Products, ${srcUsers.length} Users.`);

  // 2. Clear existing tables in destination
  await run(destDb, 'DELETE FROM order_items');
  await run(destDb, 'DELETE FROM orders');
  await run(destDb, 'DELETE FROM inventory_logs');
  await run(destDb, 'DELETE FROM combos');
  await run(destDb, 'DELETE FROM products');
  await run(destDb, 'DELETE FROM categories');
  await run(destDb, 'DELETE FROM units');
  await run(destDb, 'DELETE FROM users');

  // 3. Migrate Units
  console.log('🔄 Migrating Units...');
  const unitMap = new Map();
  for (const u of srcUnits) {
    const now = new Date(Number(u.createdAt) || Date.now()).toISOString();
    await run(
      destDb,
      `INSERT INTO units (id, name, shortName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      [u.id, u.name, u.symbol || u.name, now, now]
    );
    unitMap.set(u.id, u);
  }

  // 4. Migrate Categories
  console.log('🔄 Migrating Categories...');
  let catIndex = 1;
  const categoryMap = new Map();
  for (const c of srcCategories) {
    const slug = slugify(c.name);
    const icon = iconMap[slug] || 'Utensils';
    const imageUrl = cleanImageUrl(c.image);
    const now = new Date().toISOString();

    await run(
      destDb,
      `INSERT INTO categories (id, name, slug, icon, imageUrl, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, slug, icon, imageUrl, catIndex++, now, now]
    );
    categoryMap.set(c.id, { ...c, slug });
  }

  // 5. Migrate Products
  console.log('🔄 Migrating Products...');
  for (const p of srcProducts) {
    const cat = categoryMap.get(p.categoryId);
    const unit = unitMap.get(p.unitId);
    const baseSlug = slugify(p.name);
    const slug = `${baseSlug}-${p.id.slice(-4)}`;
    const imageUrl = cleanImageUrl(p.image);
    const unitSymbol = unit ? unit.symbol : 'pors';
    const isFixed = (cat && cat.slug === 'nonlar') || unitSymbol === 'ta' || p.name.toLowerCase().includes('non') || p.name.toLowerCase().includes('somsa') || p.name.toLowerCase().includes('suv');
    const type = isFixed ? 'FIXED_COUNT' : 'PORTION_BASED';

    // Approximate macros based on category
    let calories = 220;
    let protein = 14;
    let fat = 8;
    let carbs = 22;

    if (cat) {
      if (cat.slug === 'salatlar') { calories = 120; protein = 4; fat = 6; carbs = 10; }
      else if (cat.slug === 'ichimliklar') { calories = 45; protein = 0; fat = 0; carbs = 11; }
      else if (cat.slug === 'garnirlar') { calories = 190; protein = 6; fat = 3; carbs = 34; }
      else if (cat.slug === 'nonlar') { calories = 260; protein = 8; fat = 2; carbs = 52; }
      else if (cat.slug === 'asosiy-taomlar') { calories = 380; protein = 28; fat = 14; carbs = 26; }
      else if (cat.slug === 'desertlar') { calories = 290; protein = 5; fat = 12; carbs = 42; }
      else if (cat.slug.includes('combo')) { calories = 540; protein = 32; fat = 18; carbs = 60; }
    }

    const createdAt = new Date(Number(p.createdAt) || Date.now()).toISOString();
    const updatedAt = new Date(Number(p.updatedAt) || Date.now()).toISOString();

    await run(
      destDb,
      `INSERT INTO products (
        id, name, slug, description, categoryId, unitId, type, price, oldPrice,
        stockQuantity, calories, protein, fat, carbs, imageUrl, isActive, unitName, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name,
        slug,
        p.description || '',
        p.categoryId,
        p.unitId,
        type,
        Number(p.price) || 0,
        null,
        Number(p.stockQuantity) || 0,
        calories,
        protein,
        fat,
        carbs,
        imageUrl,
        p.isActive ? 1 : 0,
        unitSymbol,
        createdAt,
        updatedAt
      ]
    );

    // If combo set category, also register in combos table for combo deals
    if (cat && cat.slug.includes('combo')) {
      await run(
        destDb,
        `INSERT INTO combos (
          id, name, slug, description, price, oldPrice, calories, protein, fat, carbs,
          imageUrl, itemsJson, isActive, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          slug,
          p.description || '',
          Number(p.price) || 0,
          Math.round(Number(p.price) * 1.15),
          calories,
          protein,
          fat,
          carbs,
          imageUrl,
          JSON.stringify([{ name: p.name, quantity: 1 }]),
          p.isActive ? 1 : 0,
          createdAt,
          updatedAt
        ]
      );
    }
  }

  // 6. Migrate Users
  console.log('🔄 Migrating Users...');
  for (const u of srcUsers) {
    let fullName = [u.firstName, u.lastName].filter(x => x && x !== '-').join(' ').trim();
    if (!fullName) fullName = u.firstName && u.firstName !== '-' ? u.firstName : (u.telegramUsername || 'Foydalanuvchi');

    let role = 'USER';
    if (u.role === 'SUPER_ADMIN') role = 'ADMIN';
    else if (u.role === 'CASHIER') role = 'CASHIER';

    const createdAt = new Date(Number(u.createdAt) || Date.now()).toISOString();
    const updatedAt = new Date(Number(u.updatedAt) || Date.now()).toISOString();

    await run(
      destDb,
      `INSERT INTO users (
        id, telegramId, username, fullName, phone, role, password, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.id,
        u.telegramId || null,
        u.telegramUsername || null,
        fullName,
        u.phone || null,
        role,
        u.password || null,
        createdAt,
        updatedAt
      ]
    );
  }

  // 7. Migrate Settings
  if (srcSettings && srcSettings.length > 0) {
    console.log('🔄 Migrating Settings...');
    for (const s of srcSettings) {
      await run(
        destDb,
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [s.key, s.value]
      );
    }
  }

  console.log('✅ Migration finished successfully!');
  srcDb.close();
  destDb.close();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
