import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { InventoryService } from "./inventory.service"
import { InventoryController } from "./inventory.controller"
import { InventoryLog } from "../../entities/inventory-log.entity"
import { Product } from "../../entities/product.entity"
import { OrderItem } from "../../entities/order-item.entity"

@Module({
  imports: [TypeOrmModule.forFeature([InventoryLog, Product, OrderItem])],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
