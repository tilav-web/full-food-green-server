import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrdersService } from "./orders.service"
import { OrdersController } from "./orders.controller"
import { Order } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { InventoryModule } from "../inventory/inventory.module"
import { DeliveryModule } from "../delivery/delivery.module"
import { BotModule } from "../bot/bot.module"

import { OrdersGateway } from "./orders.gateway"

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    InventoryModule,
    DeliveryModule,
    BotModule,
  ],
  providers: [OrdersService, OrdersGateway],
  controllers: [OrdersController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
