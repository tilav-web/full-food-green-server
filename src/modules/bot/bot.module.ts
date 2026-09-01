import { Module } from "@nestjs/common"
import { BotService } from "./bot.service"
import { AuthModule } from "../auth/auth.module"

@Module({
  imports: [AuthModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
