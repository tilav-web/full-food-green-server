import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ReportsService } from "./reports.service"
import { ReportsController } from "./reports.controller"
import { Order } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { Product } from "../../entities/product.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product])],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
