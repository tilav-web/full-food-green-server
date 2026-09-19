import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ReportsService } from "./reports.service"
import { DailyReportService } from "./daily-report.service"
import { ReportsController } from "./reports.controller"
import { Order } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { Product } from "../../entities/product.entity"
import { BotModule } from "../bot/bot.module"

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product]), BotModule],
  providers: [ReportsService, DailyReportService],
  controllers: [ReportsController],
  exports: [ReportsService, DailyReportService],
})
export class ReportsModule {}
