import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BotService } from "./bot.service"
import { BotController } from "./bot.controller"
import { AuthModule } from "../auth/auth.module"
import { User } from "../../entities/user.entity"

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
