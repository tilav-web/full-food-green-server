import { Module, OnModuleInit } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DataSource } from "typeorm"
import * as path from "path"
import * as fs from "fs"
import { User } from "../entities/user.entity"
import { Category } from "../entities/category.entity"
import { Product } from "../entities/product.entity"
import { Combo } from "../entities/combo.entity"
import { Unit } from "../entities/unit.entity"
import { InventoryLog } from "../entities/inventory-log.entity"
import { Order } from "../entities/order.entity"
import { OrderItem } from "../entities/order-item.entity"
import { Setting } from "../entities/setting.entity"
import { Banner } from "../entities/banner.entity"

const dbDir = path.resolve(__dirname, "../../data")
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "sqlite",
      database: path.join(dbDir, "fullfood.sqlite"),
      entities: [User, Category, Product, Combo, Unit, InventoryLog, Order, OrderItem, Setting, Banner],
      synchronize: true, // Auto create tables in development
      logging: false, // Low memory: disable query logs
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Apply Low-RAM and High-Performance SQLite Pragmas
    try {
      await this.dataSource.query("PRAGMA journal_mode = WAL;")
      await this.dataSource.query("PRAGMA synchronous = NORMAL;")
      await this.dataSource.query("PRAGMA cache_size = -16000;") // 16MB cache limit
      await this.dataSource.query("PRAGMA temp_store = MEMORY;")
      await this.dataSource.query("PRAGMA busy_timeout = 5000;")
      console.log("⚡ SQLite Low-RAM optimizations (WAL, 16MB cache) applied successfully.")

      // Safe column additions for SQLite schema evolution
      try {
        await this.dataSource.query("ALTER TABLE products ADD COLUMN costPrice REAL DEFAULT 0;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE order_items ADD COLUMN costPrice REAL DEFAULT 0;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE order_items ADD COLUMN totalCost REAL DEFAULT 0;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE products ADD COLUMN packagingLevel INTEGER DEFAULT 2;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE orders ADD COLUMN packagingFee REAL DEFAULT 0;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE products ADD COLUMN isPopular BOOLEAN DEFAULT 0;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE products ADD COLUMN soldCount INTEGER DEFAULT 0;")
      } catch (_) {}
      try {
        await this.dataSource.query(`
          UPDATE products 
          SET packagingLevel = 0 
          WHERE categoryId IN (SELECT id FROM categories WHERE LOWER(name) LIKE '%ichimlik%' OR LOWER(slug) LIKE '%ichimlik%')
             OR LOWER(name) LIKE '%cappuccino%'
             OR LOWER(name) LIKE '%latte%'
             OR LOWER(name) LIKE '%americano%'
             OR LOWER(name) LIKE '%espresso%'
             OR LOWER(name) LIKE '%fanta%'
             OR LOWER(name) LIKE '%cola%'
             OR LOWER(name) LIKE '%sprite%'
             OR LOWER(name) LIKE '%adrenalin%'
             OR LOWER(name) LIKE '%flash%'
             OR LOWER(name) LIKE '%red bull%'
             OR LOWER(name) LIKE '%suv%'
             OR LOWER(name) LIKE '%choy%'
             OR LOWER(name) LIKE '%sharbat%'
             OR LOWER(name) LIKE '%sok%'
             OR LOWER(name) LIKE '%fuse tea%'
             OR LOWER(name) LIKE '%ayron%'
             OR LOWER(name) LIKE '%mojito%'
             OR LOWER(name) LIKE '%pepsi%';
        `)
      } catch (_) {}
      try {
        await this.dataSource.query(`
          UPDATE users 
          SET role = 'USER', password = NULL 
          WHERE phone LIKE '%331711117%' OR telegramId = '5252424789';
        `)
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE users ADD COLUMN isBotActive BOOLEAN DEFAULT 1;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE users ADD COLUMN botBlockedAt DATETIME;")
      } catch (_) {}
      try {
        await this.dataSource.query("ALTER TABLE users ADD COLUMN lastBotActivityAt DATETIME;")
      } catch (_) {}
    } catch (err) {
      console.warn("Could not apply SQLite pragmas or column updates:", err)
    }
  }
}
