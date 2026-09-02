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
    } catch (err) {
      console.warn("Could not apply SQLite pragmas or column updates:", err)
    }
  }
}
