import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DeliveryService } from "./delivery.service"
import { DeliveryController } from "./delivery.controller"
import { Setting } from "../../entities/setting.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [DeliveryService],
})
export class DeliveryModule {}
