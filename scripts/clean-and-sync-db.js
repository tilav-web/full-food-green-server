const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const srcDbPath = path.resolve(__dirname, '../data/server_backup.db');
const destDbPath = path.resolve(__dirname, '../data/fullfood.sqlite');

if (!fs.existsSync(srcDbPath)) {
  console.error('❌ Source server_backup.db not found at:', srcDbPath);
  process.exit(1);
}

const srcDb = new sqlite3.Database(srcDbPath);
const destDb = new sqlite3.Database(destDbPath);

function query(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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
  const charMap = {
    "o'": "o", "g'": "g", "sh": "sh", "ch": "ch", "yo": "yo", "yu": "yu", "ya": "ya",
    "oʻ": "o", "gʻ": "g", "o’": "o", "g’": "g", "o`": "o", "g`": "g",
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    "ў": "o", "қ": "q", "ғ": "g", "ҳ": "h"
  };

  let str = text.toLowerCase().trim();
  for (const [key, val] of Object.entries(charMap)) {
    str = str.split(key).join(val);
  }

  return str
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  'desertlar': 'CakeSlice',
  'goshtli-taomlar': 'Beef',
  'sabzavotlar': 'Carrot',
  'sanoqli': 'Cookie'
};

async function cleanAndSync() {
  console.log('🧹 [1/6] Tozalash: Barcha test buyurtmalar va jadvallar tozalanmoqda...');

  // 1. Clear test transactional data
  await run(destDb, 'DELETE FROM order_items');
  await run(destDb, 'DELETE FROM orders');
  await run(destDb, 'DELETE FROM inventory_logs');
  await run(destDb, 'DELETE FROM combos');
  await run(destDb, 'DELETE FROM products');
  await run(destDb, 'DELETE FROM categories');
  await run(destDb, 'DELETE FROM units');
  await run(destDb, 'DELETE FROM banners');
  await run(destDb, 'DELETE FROM users');

  console.log('📥 [2/6] Server bazasidan ma\'lumotlar olinmoqda...');
  const srcUnits = await query(srcDb, 'SELECT * FROM Unit');
  const srcCategories = await query(srcDb, 'SELECT * FROM Category');
  const srcProducts = await query(srcDb, 'SELECT * FROM Product');
  const srcUsers = await query(srcDb, 'SELECT * FROM User');
  const srcSettings = await query(srcDb, 'SELECT * FROM Setting');

  console.log(`📦 Server DB tarkibi: ${srcUnits.length} Units, ${srcCategories.length} Categories, ${srcProducts.length} Products, ${srcUsers.length} Users.`);

  // 2. Units
  console.log('🔄 [3/6] O\'lchov birliklari (Units) yuklanmoqda...');
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

  // Standard units if missing
  const defaultUnits = [
    { name: 'pors', shortName: 'pors' },
    { name: 'dona', shortName: 'dona' },
    { name: 'kg', shortName: 'kg' },
    { name: 'gram', shortName: 'g' },
    { name: 'litr', shortName: 'l' }
  ];
  for (const du of defaultUnits) {
    const exists = await query(destDb, 'SELECT id FROM units WHERE name = ?', [du.name]);
    if (!exists || exists.length === 0) {
      const now = new Date().toISOString();
      await run(destDb, `INSERT INTO units (id, name, shortName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`, [
        `unit_${du.name}`, du.name, du.shortName, now, now
      ]);
    }
  }

  // 3. Categories
  console.log('🔄 [4/6] Kategoriyalar (Categories) tartib bilan yuklanmoqda...');
  let catOrder = 1;
  const categoryMap = new Map();
  for (const c of srcCategories) {
    const slug = slugify(c.name) || `kategoriya-${catOrder}`;
    const icon = iconMap[slug] || 'Utensils';
    const imageUrl = cleanImageUrl(c.image);
    const now = new Date().toISOString();

    await run(
      destDb,
      `INSERT INTO categories (id, name, slug, icon, imageUrl, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, slug, icon, imageUrl, catOrder++, now, now]
    );
    categoryMap.set(c.id, { ...c, slug });
  }

  // 4. Products & Combos
  console.log('🔄 [5/6] 62 ta Taom va Kombolar (Products & Combos) SEO sluglari bilan yuklanmoqda...');
  const usedSlugs = new Set();

  for (const p of srcProducts) {
    const cat = categoryMap.get(p.categoryId);
    const unit = unitMap.get(p.unitId);
    let baseSlug = slugify(p.name);
    if (!baseSlug) baseSlug = `taom-${p.id.slice(-4)}`;

    let cleanSlug = baseSlug;
    if (usedSlugs.has(cleanSlug)) {
      cleanSlug = `${baseSlug}-${p.id.slice(-4)}`;
    }
    usedSlugs.add(cleanSlug);

    const imageUrl = cleanImageUrl(p.image);
    const unitSymbol = unit ? unit.symbol : 'pors';
    const isFixed = (cat && cat.slug === 'nonlar') || unitSymbol === 'ta' || p.name.toLowerCase().includes('non') || p.name.toLowerCase().includes('somsa') || p.name.toLowerCase().includes('suv') || p.name.toLowerCase().includes('donasi');
    const type = isFixed ? 'FIXED_COUNT' : 'PORTION_BASED';

    // Ozuqaviy qiymatlar (KBDU)
    let calories = 240;
    let protein = 16;
    let fat = 8;
    let carbs = 24;

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
        cleanSlug,
        p.description || '',
        p.categoryId,
        p.unitId,
        type,
        Number(p.price) || 0,
        null,
        Number(p.stockQuantity) || 50,
        calories,
        protein,
        fat,
        carbs,
        imageUrl,
        p.isActive !== 0 ? 1 : 0,
        unitSymbol,
        createdAt,
        updatedAt
      ]
    );

    // If combo set category, also register in combos table
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
          cleanSlug,
          p.description || '',
          Number(p.price) || 0,
          Math.round((Number(p.price) || 0) * 1.15),
          calories,
          protein,
          fat,
          carbs,
          imageUrl,
          JSON.stringify([{ name: p.name, quantity: 1 }]),
          p.isActive !== 0 ? 1 : 0,
          createdAt,
          updatedAt
        ]
      );
    }
  }

  // 5. Users (Server users + Admin/Cashier accounts)
  console.log('🔄 [6/6] Foydalanuvchilar (Users & Admins) sozlanmoqda...');
  const adminPass = await bcrypt.hash('admin123', 8);
  const cashierPass = await bcrypt.hash('kassir123', 8);

  for (const u of srcUsers) {
    let fullName = [u.firstName, u.lastName].filter(x => x && x !== '-').join(' ').trim();
    if (!fullName) fullName = u.firstName && u.firstName !== '-' ? u.firstName : (u.telegramUsername || 'Foydalanuvchi');

    let role = 'USER';
    if (u.role === 'SUPER_ADMIN') role = 'ADMIN';
    else if (u.role === 'CASHIER') role = 'CASHIER';

    let userPassword = u.password || null;
    if (role === 'ADMIN' && !userPassword) userPassword = adminPass;
    if (role === 'CASHIER' && !userPassword) userPassword = cashierPass;

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
        userPassword,
        createdAt,
        updatedAt
      ]
    );
  }

  // Ensure default super admin exists
  const hasAdmin = await query(destDb, "SELECT id FROM users WHERE username = 'admin' OR role = 'ADMIN'");
  if (!hasAdmin || hasAdmin.length === 0) {
    const now = new Date().toISOString();
    await run(
      destDb,
      `INSERT INTO users (id, username, fullName, phone, role, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['user_admin', 'admin', 'Super Admin', '+998901234567', 'ADMIN', adminPass, now, now]
    );
  }

  // Ensure default cashier exists
  const hasCashier = await query(destDb, "SELECT id FROM users WHERE username = 'kassir1' OR role = 'CASHIER'");
  if (!hasCashier || hasCashier.length === 0) {
    const now = new Date().toISOString();
    await run(
      destDb,
      `INSERT INTO users (id, username, fullName, phone, role, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['user_kassir1', 'kassir1', 'Malika Karimova (1-Kassa)', '+998909876543', 'CASHIER', cashierPass, now, now]
    );
  }

  // 6. Settings
  console.log('⚙️ Sozlamalar (Settings) saqlanmoqda...');
  const defaultSettings = [
    { key: 'card_number', value: '8600 4912 3456 7890' },
    { key: 'card_holder', value: 'FULL FOOD MCHJ' },
    { key: 'card_bank', value: 'Kapitalbank' },
    { key: 'restaurant_name', value: 'Full Food' },
    { key: 'restaurant_address', value: "Toshkent sh., Amir Temur shox ko'chasi 45" },
    { key: 'restaurant_phone', value: '+998 71 200 00 20' },
    { key: 'restaurant_lat', value: '41.311158' },
    { key: 'restaurant_lng', value: '69.279737' },
    { key: 'delivery_base_fee', value: '10000' },
    { key: 'delivery_per_km', value: '3000' },
    { key: 'min_order_amount', value: '30000' },
    { key: 'is_restaurant_open', value: 'true' }
  ];

  for (const s of defaultSettings) {
    await run(destDb, `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
  }

  if (srcSettings && srcSettings.length > 0) {
    for (const s of srcSettings) {
      await run(destDb, `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
    }
  }

  // 7. Seed Active Promo Banners with Attached Dishes
  console.log('🌟 Faol Reklama va Aksiya Bannerlari joylashtirilmoqda...');
  const now = new Date().toISOString();

  // Find sample products to attach to banners
  const allProds = await query(destDb, 'SELECT * FROM products LIMIT 15');

  const promoItems1 = allProds.slice(0, 3).map(p => ({
    id: `promo_${p.id}`,
    type: 'PRODUCT',
    referenceId: p.id,
    name: p.name,
    description: p.description || 'Sog\'lom va toza parhez taom',
    price: Math.round((p.price * 0.8) / 500) * 500,
    oldPrice: p.price,
    badge: '-20%',
    imageUrl: p.imageUrl,
    calories: p.calories,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    unitName: p.unitName,
    isActive: true
  }));

  const promoItems2 = allProds.slice(3, 6).map(p => ({
    id: `promo_${p.id}`,
    type: 'PRODUCT',
    referenceId: p.id,
    name: p.name,
    description: p.description || 'Yangi parhezbop to\'plam',
    price: Math.round((p.price * 0.85) / 500) * 500,
    oldPrice: p.price,
    badge: '-15%',
    imageUrl: p.imageUrl,
    calories: p.calories,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    unitName: p.unitName,
    isActive: true
  }));

  const promoItems3 = allProds.slice(6, 9).map(p => ({
    id: `promo_${p.id}`,
    type: 'COMBO',
    referenceId: p.id,
    name: `${p.name} + Ichimlik Set`,
    description: 'To\'yimli va muvozanatli tushlik to\'plami',
    price: Math.round((p.price * 0.75) / 500) * 500,
    oldPrice: p.price,
    badge: '-25%',
    imageUrl: p.imageUrl,
    calories: p.calories + 45,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs + 10,
    unitName: 'set',
    isActive: true
  }));

  const banners = [
    {
      id: 'banner_1',
      badge: "Trendda -20%",
      title: "O'z Tovog'ingizni Yig'ing",
      slug: "oz-tovogingizni-yiging",
      description: "Asosiy go'sht, garnir va sabzavotlarni alohida tanlab, o'z porsiyangizni yarating",
      gradient: "from-emerald-700 via-teal-800 to-emerald-950",
      imageUrl: "/images/dishes/tovuqli-file.jpg",
      actionType: "PROMO_PAGE",
      actionTarget: "",
      actionText: "Aksiyani ko'rish",
      sortOrder: 1,
      isActive: 1,
      itemsJson: JSON.stringify(promoItems1)
    },
    {
      id: 'banner_2',
      badge: "Yangi Menyuda",
      title: "Yangi Parhez Taomlar",
      slug: "yangi-parhez-taomlar",
      description: "Kam yog'li, toza oqsilga boy yangi mavsum taomlari to'plami",
      gradient: "from-teal-800 via-emerald-800 to-slate-900",
      imageUrl: "/images/dishes/chixambili.jpg",
      actionType: "PROMO_PAGE",
      actionTarget: "",
      actionText: "Taomlarni ko'rish",
      sortOrder: 2,
      isActive: 1,
      itemsJson: JSON.stringify(promoItems2)
    },
    {
      id: 'banner_3',
      badge: "Super Set -25%",
      title: "Mazali Tushlik Kombosi",
      slug: "mazali-tushlik-kombosi",
      description: "Asosiy taom, parhez salat va maxsus sous birgalikda arzonroq",
      gradient: "from-emerald-900 via-green-950 to-neutral-950",
      imageUrl: "/images/dishes/tovuqli-file.jpg",
      actionType: "PROMO_PAGE",
      actionTarget: "",
      actionText: "Kombolarni ko'rish",
      sortOrder: 3,
      isActive: 1,
      itemsJson: JSON.stringify(promoItems3)
    }
  ];

  for (const b of banners) {
    await run(
      destDb,
      `INSERT INTO banners (
        id, badge, title, slug, description, gradient, imageUrl, actionType, actionTarget, actionText,
        sortOrder, isActive, itemsJson, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id, b.badge, b.title, b.slug, b.description, b.gradient, b.imageUrl,
        b.actionType, b.actionTarget, b.actionText, b.sortOrder, b.isActive, b.itemsJson, now, now
      ]
    );
  }

  // Summary counts
  const finalCategories = await query(destDb, 'SELECT COUNT(*) as c FROM categories');
  const finalProducts = await query(destDb, 'SELECT COUNT(*) as c FROM products');
  const finalCombos = await query(destDb, 'SELECT COUNT(*) as c FROM combos');
  const finalUsers = await query(destDb, 'SELECT COUNT(*) as c FROM users');
  const finalOrders = await query(destDb, 'SELECT COUNT(*) as c FROM orders');
  const finalBanners = await query(destDb, 'SELECT COUNT(*) as c FROM banners');

  console.log('\n======================================================');
  console.log('✅ BAZA TO' + "'" + 'LIQ TOZALANDI VA SERVER MA' + "'" + 'LUMOTLARI BILAN TIKLANDI:');
  console.log(`📁 Kategoriyalar: ${finalCategories[0].c} ta`);
  console.log(`🍽 Taomlar: ${finalProducts[0].c} ta`);
  console.log(`✨ Kombolar: ${finalCombos[0].c} ta`);
  console.log(`👥 Foydalanuvchilar: ${finalUsers[0].c} ta`);
  console.log(`🌟 Aksiya Bannerlari: ${finalBanners[0].c} ta`);
  console.log(`📦 Buyurtmalar (Testlar tozalandi): ${finalOrders[0].c} ta`);
  console.log('======================================================\n');

  srcDb.close();
  destDb.close();
}

cleanAndSync().catch(err => {
  console.error('❌ Xatolik:', err);
  process.exit(1);
});
