import { Controller, Post, Get, Body } from "@nestjs/common"
import { BotService } from "./bot.service"

@Controller("bot")
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get("stats")
  async getBotStats() {
    return this.botService.getBotStats()
  }

  @Post("broadcast")
  async broadcastMessage(
    @Body()
    body: {
      message: string
      imageUrl?: string
      buttonText?: string
      buttonUrl?: string
      targetType: "ALL" | "SELECTED"
      userIds?: string[]
    }
  ) {
    return this.botService.broadcastMessage(body)
  }
}
