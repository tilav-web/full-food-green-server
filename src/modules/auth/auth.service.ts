import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import * as bcrypt from "bcryptjs"
import { User, UserRole } from "../../entities/user.entity"

export interface WebAuthSession {
  token: string
  createdAt: number
  status: "PENDING" | "COMPLETED" | "EXPIRED"
  user?: any
  accessToken?: string
  refreshToken?: string
}

function getPhoneCandidates(phone?: string | null): string[] {
  if (!phone) return []
  const clean = phone.trim()
  const digits = clean.replace(/\D/g, "")
  const candidates = new Set<string>()

  if (clean) candidates.add(clean)
  if (clean.startsWith("+")) {
    candidates.add(clean.substring(1))
  } else {
    candidates.add(`+${clean}`)
  }
  if (digits) {
    candidates.add(digits)
    candidates.add(`+${digits}`)
    if (digits.length === 9) {
      candidates.add(`+998${digits}`)
      candidates.add(`998${digits}`)
    } else if (digits.length === 12 && digits.startsWith("998")) {
      candidates.add(digits.substring(3))
      candidates.add(`+${digits}`)
      candidates.add(digits)
    }
  }
  return Array.from(candidates).filter(Boolean)
}

@Injectable()
export class AuthService {
  // In-memory low-RAM session map (auto cleaned)
  private webSessions = new Map<string, WebAuthSession>()

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  private generateTokens(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role }
    const refreshPayload = { sub: user.id, type: "refresh" }

    const accessToken = this.jwtService.sign(payload, { expiresIn: "1d" })
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: "30d" })

    return { accessToken, refreshToken }
  }

  async validateUser(usernameOrPhone: string, pass: string): Promise<any> {
    const clean = (usernameOrPhone || "").trim()
    const user = await this.userRepo
      .createQueryBuilder("user")
      .addSelect("user.password")
      .where("user.username = :clean OR user.phone = :clean", { clean })
      .getOne()

    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user
      return result
    }
    return null
  }

  async login(username: string, pass: string) {
    const user = await this.validateUser(username, pass)
    if (!user) {
      throw new UnauthorizedException("Login yoki parol noto'g'ri")
    }

    const { accessToken, refreshToken } = this.generateTokens(user)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
    }
  }

  async refreshTokens(refreshTokenStr: string) {
    try {
      const decoded = this.jwtService.verify(refreshTokenStr)
      if (!decoded || decoded.type !== "refresh") {
        throw new UnauthorizedException("Yaroqsiz refresh token")
      }

      const user = await this.userRepo.findOne({ where: { id: decoded.sub } })
      if (!user) {
        throw new UnauthorizedException("Foydalanuvchi topilmadi")
      }

      const { accessToken, refreshToken } = this.generateTokens(user)
      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
        },
      }
    } catch (e) {
      throw new UnauthorizedException("Refresh token muddati o'tgan yoki yaroqsiz")
    }
  }

  async syncTelegramUser(telegramData: {
    telegramId: string
    username?: string
    fullName?: string
    phone?: string
    initData?: string
  }) {
    const tgIdStr = String(telegramData.telegramId)
    let user = await this.userRepo.findOne({
      where: { telegramId: tgIdStr },
    })

    // Telegram Bot & Mini App are strictly for customer experience (role: 'USER').
    // Staff roles (ADMIN, CASHIER) are strictly for browser login with username & password.
    // If a staff account was previously linked with this telegramId, detach it so the staff credentials remain intact for browser login.
    if (user && user.role !== "USER") {
      await this.userRepo.update(user.id, { telegramId: null as any })
      user = null
    }

    // 1. If user is not found by telegramId, but phone is provided:
    if (!user && telegramData.phone) {
      const candidates = getPhoneCandidates(telegramData.phone)
      if (candidates.length > 0) {
        user = await this.userRepo
          .createQueryBuilder("user")
          .where("user.phone IN (:...candidates) AND user.role = 'USER'", { candidates })
          .getOne()

        if (user) {
          user.telegramId = tgIdStr
          if (telegramData.username && !user.username) {
            user.username = telegramData.username
          }
          if (telegramData.fullName && (!user.fullName || user.fullName === "Telegram Mijoz")) {
            user.fullName = telegramData.fullName
          }
          await this.userRepo.save(user)
        }
      }
    }

    // 2. If still no user exists at all, create a new customer (USER)
    if (!user) {
      user = this.userRepo.create({
        telegramId: tgIdStr,
        username: telegramData.username || `tg_${tgIdStr}`,
        fullName: telegramData.fullName || "Telegram Mijoz",
        phone: telegramData.phone,
        role: "USER" as UserRole,
      })
      user = await this.userRepo.save(user)
    } else {
      let shouldUpdate = false
      if (telegramData.fullName && user.fullName !== telegramData.fullName) {
        user.fullName = telegramData.fullName
        shouldUpdate = true
      }
      if (telegramData.phone && (!user.phone || user.phone !== telegramData.phone)) {
        user.phone = telegramData.phone
        shouldUpdate = true
      }
      if (telegramData.username && (!user.username || user.username.startsWith("tg_"))) {
        user.username = telegramData.username
        shouldUpdate = true
      }
      if (shouldUpdate) {
        await this.userRepo.save(user)
      }
    }

    const { accessToken, refreshToken } = this.generateTokens(user)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        balance: user.balance,
      },
    }
  }

  async attachPhone(userId: string, phone: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi")
    }

    const cleanPhone = phone.trim()
    user.phone = cleanPhone
    await this.userRepo.save(user)

    const { accessToken, refreshToken } = this.generateTokens(user)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        balance: user.balance,
      },
    }
  }

  async quickPhoneLogin(phone: string, fullName?: string) {
    const cleanPhone = phone.trim()
    const candidates = getPhoneCandidates(cleanPhone)
    let user: User | null = null

    if (candidates.length > 0) {
      user = await this.userRepo
        .createQueryBuilder("user")
        .where("user.phone IN (:...candidates) AND user.role = 'USER'", { candidates })
        .getOne()
    }

    if (!user) {
      user = this.userRepo.create({
        phone: cleanPhone,
        fullName: fullName?.trim() || "Mijoz",
        username: `client_${Date.now().toString().slice(-6)}`,
        role: "USER" as UserRole,
      })
      user = await this.userRepo.save(user)
    } else if (fullName?.trim() && (!user.fullName || user.fullName === "Mijoz")) {
      user.fullName = fullName.trim()
      await this.userRepo.save(user)
    }

    const { accessToken, refreshToken } = this.generateTokens(user)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        balance: user.balance,
      },
    }
  }

  // Web Browser Auth Session creation
  createWebAuthSession() {
    this.cleanExpiredSessions()
    const token = `auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const session: WebAuthSession = {
      token,
      createdAt: Date.now(),
      status: "PENDING",
    }
    this.webSessions.set(token, session)
    const botUsername = this.configService.get<string>("TELEGRAM_BOT_USERNAME") || "fullfoodbot"
    return {
      token,
      botUrl: `https://t.me/${botUsername}?start=${token}`,
    }
  }

  // Check Web Browser Auth Session Status
  getWebAuthSession(token: string) {
    const session = this.webSessions.get(token)
    if (!session) {
      return { status: "EXPIRED" }
    }
    return session
  }

  // Complete Web Session (called when Bot receives contact from user)
  async completeWebAuthSession(
    token: string,
    telegramData: {
      telegramId: string
      phone: string
      fullName?: string
      username?: string
    }
  ) {
    const session = this.webSessions.get(token)
    if (!session) {
      throw new NotFoundException("Sessiya topilmadi yoki muddati o'tgan")
    }

    const syncRes = await this.syncTelegramUser(telegramData)

    session.status = "COMPLETED"
    session.user = syncRes.user
    session.accessToken = syncRes.accessToken
    session.refreshToken = syncRes.refreshToken
    this.webSessions.set(token, session)

    const webAppBaseUrl =
      this.configService.get<string>("WEB_APP_URL") ||
      this.configService.get<string>("WEBAPP_URL") ||
      "https://fullfood.vercel.app"
    const webLoginUrl = `${webAppBaseUrl}/?auth_token=${token}`

    return {
      success: true,
      user: syncRes.user,
      accessToken: syncRes.accessToken,
      refreshToken: syncRes.refreshToken,
      webLoginUrl,
    }
  }

  private cleanExpiredSessions() {
    const now = Date.now()
    const tenMinutes = 10 * 60 * 1000
    for (const [token, session] of this.webSessions.entries()) {
      if (now - session.createdAt > tenMinutes) {
        this.webSessions.delete(token)
      }
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi")
    }
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      telegramId: user.telegramId,
    }
  }
}
