import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ServeStaticModule } from "@nestjs/serve-static"
import * as path from "path"
import { DatabaseModule } from "./database/database.module"
import { SeedModule } from "./modules/seed/seed.module"
import { AuthModule } from "./modules/auth/auth.module"
import { BotModule } from "./modules/bot/bot.module"
import { ProductsModule } from "./modules/products/products.module"
import { UnitsModule } from "./modules/units/units.module"
import { InventoryModule } from "./modules/inventory/inventory.module"
import { OrdersModule } from "./modules/orders/orders.module"
import { DeliveryModule } from "./modules/delivery/delivery.module"
import { SettingsModule } from "./modules/settings/settings.module"
import { ReportsModule } from "./modules/reports/reports.module"
import { UsersModule } from "./modules/users/users.module"
import { UploadsModule } from "./modules/uploads/uploads.module"
import { BannersModule } from "./modules/banners/banners.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, "../../.env"),
    }),
    DatabaseModule,
    SeedModule,
    AuthModule,
    BotModule,
    BannersModule,
    ProductsModule,
    UnitsModule,
    InventoryModule,
    OrdersModule,
    DeliveryModule,
    SettingsModule,
    ReportsModule,
    UsersModule,
    UploadsModule,
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),
  ],
})
export class AppModule {}
