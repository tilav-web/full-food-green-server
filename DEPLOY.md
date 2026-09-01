# DEPLOY.md — Full Food Loyihasini Yangi Serverga Joylashtirish va Boshqarish Qo'llanmasi

> Oxirgi yangilangan sana: 2026-09-01.
> Ushbu hujjat yangi ishlab turgan server (`176.101.56.229`) va Vercel production muhitiga to'liq moslashtirilgan.

---

## 1. Server Ma'lumotlari

| Parametr | Qiymat |
|---|---|
| **Server IP** | `176.101.56.229` |
| **Hostname** | `vps06126.eskiz.uz` |
| **OS** | Ubuntu 24.04 LTS |
| **SSH User** | `root` |
| **SSH Parol** | `tilav7251` |
| **Backend papkasi** | `/home/full_food/server` |
| **Backend Port** | `5005` (ichki localhost) |
| **Systemd Servis** | `fullfood-server.service` |
| **API Domeni** | `https://api.full-food.hotel-familyhouse.uz` |
| **Frontend / WebApp** | `https://fullfood.vercel.app` (Vercel Production) |
| **Telegram Bot** | `@fullfoodbot` |
| **Telegram Kanal** | `@fool_food_group` (Buyurtmalar va to'lov cheklari) |

⚠️ **DIQQAT — Boshqa loyihalarga zarar yetkazmaslik:**
Serverda yana ikkita muhim loyiha ishlamoqda:
1. **Yaqin Market** (`/home/yaqin-market/server`) — alohida servis.
2. **Family House** (`/app`, Docker container port `5000` va domenlar).
Full Food loyihasida ishlaganda ushbu loyihalarga va ularning konfiguratsiyalariga mutlaqo tegilmaydi.

---

## 2. Restoran va Karta Sozlamalari (Baza)

Eski server (`185.191.141.213`) bazasidagi haqiqiy karta ma'lumotlari yangi server bazasiga (`/home/full_food/server/data/fullfood.sqlite`) ko'chirildi:

| Kalit (`key`) | Qiymat (`value`) | Tavsif |
|---|---|---|
| `card_number` | `9860 1001 2517 4530` | Mijozlar pul o'tkazadigan HUMO karta |
| `card_holder` | `SHAHRIZOD XALIMOV` | Karta egasi |
| `card_bank` | `HUMO` | Bank tizimi |
| `restaurant_address` | `Qarshi sh., Mustaqillik shoh ko'chasi` | Restoran manzili |
| `restaurant_lat` | `38.838250` | Lokatsiya (Kenglik) |
| `restaurant_lng` | `65.792222` | Lokatsiya (Uzunlik) |
| `delivery_base_fee` | `10000` | Boshlang'ich yetkazish narxi (so'm) |
| `delivery_per_km` | `3000` | Har bir km uchun narx (so'm) |

---

## 3. Loyiha Arxitekturasi

- **Frontend (Client):**
  - Texnologiyalar: React 18, Vite, TypeScript, Tailwind CSS, Zustand, TanStack React Query, Lucide Icons.
  - Xosting: **Vercel** (`https://fullfood.vercel.app`).
  - Git Repo: `https://github.com/tilav-web/full-food-green-client.git` (master branch).
  - Vercel avtomatik ravishda `git push origin master` bo'lganda deploy qiladi.
  - `client/vercel.json` fayli orqali SPA routing (`/* -> /index.html`) va `/uploads/*` so'rovlari backend VPS'ga proksilanadi.

- **Backend (Server):**
  - Texnologiyalar: NestJS, TypeORM, SQLite (WAL rejimida, 1GB RAM optimizatsiyasi).
  - Xosting: **Eskiz VPS** (`176.101.56.229`), port `5005`.
  - Git Repo: `https://github.com/tilav-web/full-food-green-server.git` (master branch).
  - Boshqaruv: Linux `systemd` servisi (`systemctl restart fullfood-server`).
  - Loglar: `/var/log/fullfood-server.log` va `/var/log/fullfood-server.error.log`.

- **Nginx (Reverse Proxy & SSL):**
  - `/etc/nginx/sites-available/full-food-api`
  - SSL Let's Encrypt sertifikati orqali `https://api.full-food.hotel-familyhouse.uz` manzilini ichki `http://127.0.0.1:5005` portiga yo'naltiradi.
  - `/uploads/` manzili to'g'ridan-to'g'ri `/home/full_food/server/uploads` papkasidan static tarzda yuqori tezlikda (30 kunlik kesh va CORS bilan) uzatiladi.

---

## 4. Backend'ni Yangilash va Deploy Qilish

### 1-usul: Avtomatlashtirilgan Python SFTP skripti orqali (Tavsiya etiladi)
Lokal mashinada turib:
```bash
python .gemini/antigravity-ide/brain/.../scratch/redeploy_backend.py
```
Ushbu skript:
1. `npm run build` orqali hosil bo'lgan `dist/` papkasini arxivlaydi;
2. Serverga SSH orqali yuklaydi va `/home/full_food/server/dist/` ga ochadi;
3. `systemctl restart fullfood-server` buyrug'ini bajarib servisni xavfsiz qayta ishga tushiradi.

### 2-usul: Serverga SSH orqali kirib qo'lda yangilash
```bash
ssh root@176.101.56.229
# Parol: tilav7251

cd /home/full_food/server
git pull origin master
npm install --omit=dev
npm run build

systemctl restart fullfood-server
systemctl status fullfood-server
```

Loglarni tekshirish:
```bash
tail -f /var/log/fullfood-server.log
```

---

## 5. Frontend'ni Yangilash va Deploy Qilish

Frontend Vercel bilan to'g'ridan-to'g'ri ulangan. O'zgarishlarni kiritgandan so'ng:

```bash
cd client
npm run build          # Xatolik yo'qligini tekshirish uchun
git add .
git commit -m "feat: yangi qulayliklar qo'shildi"
git push origin master
```

Vercel bir necha soniyada yangi versiyani `https://fullfood.vercel.app` manzilida e'lon qiladi.

---

## 6. Serverdagi `.env` Konfiguratsiyasi (`/home/full_food/server/.env`)

```env
PORT=5005
DATABASE_PATH=/home/full_food/server/data/fullfood.sqlite
UPLOADS_DIR=/home/full_food/server/uploads

JWT_SECRET=super_secret_full_food_jwt_2026_low_ram_secure_key
JWT_EXPIRES_IN=30d

TELEGRAM_BOT_TOKEN=7503405654:AAFwpZi_7SL9mMhXkJteXzuwgZ0UFt5ox4Q
TELEGRAM_ORDERS_CHANNEL_ID=@fool_food_group
WEB_APP_URL=https://fullfood.vercel.app

YANDEX_DELIVERY_ENABLED=false
YANDEX_TAXI_OAUTH_TOKEN=mock_oauth_token_fullfood
YANDEX_CLID=mock_clid_12345
```

---

## 7. Muhim Qoidalar (Gotchas)

1. **Telegram Bot Polling ziddiyati (409 Conflict):**
   Hech qachon lokal kompyuterda serverni production bot tokeni bilan fonda qoldirmang. Telegram bitta bot tokenidan faqat bitta jarayon `getUpdates` olishiga ruxsat beradi. Agar lokalda server yoniq qolsa, VPS'dagi bot javob bermay qoladi.
2. **Ma'lumotlar bazasi va Uploads xavfsizligi:**
   `/home/full_food/server/data/fullfood.sqlite` va `/home/full_food/server/uploads` ichidagi fayllarni hech qachon o'chirib yubormang. Ular barcha mijozlar, taomlar, rasmlar va to'lov cheklarini saqlaydi.
3. **RAM sarfini nazorat qilish (1GB RAM):**
   Server 1GB RAM ga mo'ljallangan. Node.js jarayoni `--max-old-space-size=256` parametri bilan ishlaydi va SQLite WAL rejimida 16MB kesh bilan chegaralangan.
