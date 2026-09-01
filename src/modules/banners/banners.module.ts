import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Banner } from "../../entities/banner.entity"
import { BannersService } from "./banners.service"
import { BannersController } from "./banners.controller"

@Module({
  imports: [TypeOrmModule.forFeature([Banner])],
  providers: [BannersService],
  controllers: [BannersController],
  exports: [BannersService],
})
export class BannersModule {}
