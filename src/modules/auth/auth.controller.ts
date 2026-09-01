import { Controller, Post, Body, Get, Param, UseGuards, Request } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { AuthGuard } from "@nestjs/passport"

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: { username: string; pass: string; password?: string }) {
    const password = body.pass || body.password || ""
    return this.authService.login(body.username, password)
  }

  @Post("refresh")
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken)
  }

  @Post("telegram-sync")
  async syncTelegram(@Body() body: { telegramId: string; username?: string; fullName?: string; phone?: string }) {
    return this.authService.syncTelegramUser(body)
  }

  @Post("attach-phone")
  async attachPhone(@Body() body: { userId: string; phone: string }) {
    return this.authService.attachPhone(body.userId, body.phone)
  }

  @Post("create-web-session")
  async createWebSession() {
    return this.authService.createWebAuthSession()
  }

  @Get("web-session-status/:token")
  async getWebSessionStatus(@Param("token") token: string) {
    return this.authService.getWebAuthSession(token)
  }

  @Post("complete-web-session")
  async completeWebSession(
    @Body()
    body: {
      token: string
      telegramId: string
      phone: string
      fullName?: string
      username?: string
    }
  ) {
    return this.authService.completeWebAuthSession(body.token, {
      telegramId: body.telegramId,
      phone: body.phone,
      fullName: body.fullName,
      username: body.username,
    })
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("me")
  async getMe(@Request() req: any) {
    return this.authService.getProfile(req.user.id)
  }
}
