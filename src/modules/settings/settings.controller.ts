import { Controller, Get, Post, Body } from "@nestjs/common"
import { SettingsService } from "./settings.service"

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getAll()
  }

  @Post()
  async updateSettings(@Body() body: Record<string, string>) {
    return this.settingsService.updateMultiple(body)
  }
}
