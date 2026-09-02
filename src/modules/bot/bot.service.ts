import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, Not, IsNull } from "typeorm"
import { AuthService } from "../auth/auth.service"
import { User } from "../../entities/user.entity"

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name)
  private readonly token: string
  private readonly botUsername: string
  private readonly apiUrl: string
  private readonly webAppUrl: string
  private readonly ordersChannelId: string

  private isRunning = false
  private offset = 0

  // Track pending auth tokens by telegram chat/user ID
  private userPendingSessions = new Map<number, string>()

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    this.token = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "7503405654:AAFwpZi_7SL9mMhXkJteXzuwgZ0UFt5ox4Q"
    this.botUsername = this.configService.get<string>("TELEGRAM_BOT_USERNAME") || "fullfoodbot"
    this.apiUrl = `https://api.telegram.org/bot${this.token}`
    this.webAppUrl = this.configService.get<string>("WEB_APP_URL") || this.configService.get<string>("WEBAPP_URL") || "https://fullfood.vercel.app"
    this.ordersChannelId = this.configService.get<string>("TELEGRAM_ORDERS_CHANNEL_ID") || "@fool_food_group"
  }

  async onModuleInit() {
    this.startPolling()
    try {
      await this.callApi("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "Full Food Menyu",
          web_app: { url: this.webAppUrl },
        },
      })
      this.logger.log(`📱 Telegram Chat Menu Button configured -> ${this.webAppUrl}`)
      this.logger.log(`📢 Telegram Orders Channel configured -> ${this.ordersChannelId}`)
    } catch (e) {
      this.logger.warn("Could not set chat menu button:", e)
    }
  }

  onModuleDestroy() {
    this.isRunning = false
  }

  private async callApi(method: string, data: any = {}) {
    try {
      const res = await fetch(`${this.apiUrl}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.ok) {
        this.logger.warn(`Telegram API [${method}] returned !ok: ${JSON.stringify(json)}`)
      }
      return json
    } catch (err) {
      this.logger.error(`Error calling Telegram API [${method}]: ${err}`)
      return null
    }
  }

  private escapeHtml(text: string): string {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  private async startPolling() {
    this.isRunning = true
    this.logger.log(`🤖 Telegram Bot @${this.botUsername} polling started...`)

    while (this.isRunning) {
      try {
        const response = await this.callApi("getUpdates", {
          offset: this.offset,
          timeout: 20,
          allowed_updates: ["message", "edited_message", "callback_query", "my_chat_member", "chat_member"],
        })

        if (response && response.ok && Array.isArray(response.result)) {
          for (const update of response.result) {
            this.offset = update.update_id + 1
            await this.handleUpdate(update)
          }
        } else {
          // Backoff slightly on errors or empty response
          await new Promise((r) => setTimeout(r, 2000))
        }
      } catch (err) {
        this.logger.error(`Polling error: ${err}`)
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }

  private async handleUpdate(update: any) {
    // 0. Handle my_chat_member (User blocks or unblocks bot)
    if (update.my_chat_member) {
      const chatMember = update.my_chat_member
      const tgId = String(chatMember.chat?.id || chatMember.from?.id)
      const newStatus = chatMember.new_chat_member?.status
      if (newStatus === "kicked") {
        this.logger.warn(`🚫 User ${tgId} blocked the bot (status: kicked)`)
        try {
          await this.userRepo.update({ telegramId: tgId }, { isBotActive: false, botBlockedAt: new Date() })
        } catch (_) {}
      } else if (newStatus === "member") {
        this.logger.log(`✅ User ${tgId} unblocked the bot (status: member)`)
        try {
          await this.userRepo.update({ telegramId: tgId }, { isBotActive: true, botBlockedAt: null, lastBotActivityAt: new Date() })
        } catch (_) {}
      }
      return
    }

    if (!update.message) return
    const msg = update.message
    const chatId = msg.chat?.id
    if (!chatId) return
    const text = msg.text || ""
    const senderTgId = String(msg.from?.id || chatId)

    // Mark user as active on any incoming message
    try {
      await this.userRepo.update(
        { telegramId: senderTgId },
        { isBotActive: true, botBlockedAt: null, lastBotActivityAt: new Date() }
      )
    } catch (_) {}

    // 1. Handle /start [token]
    if (text.startsWith("/start")) {
      const parts = text.split(" ")
      const startParam = parts[1] || ""

      if (startParam.startsWith("auth_")) {
        this.userPendingSessions.set(chatId, startParam)
      }

      this.logger.log(`👤 /start received from chatId: ${chatId} (${msg.from?.first_name || ""})`)

      const firstName = this.escapeHtml(msg.from?.first_name || "Mijoz")

      await this.callApi("sendMessage", {
        chat_id: chatId,
        text: `Assalomu alaykum, <b>${firstName}</b>!\n\n🥗 <b>Full Food</b> — sog'lom va mazali taomlar yetkazib berish xizmatiga xush kelibsiz!\n\nBuyurtma berish va profilingizni tasdiqlash uchun iltimos, pastdagi <b>"📱 Telefon raqamimni yuborish"</b> tugmasini bosing:`,
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [
              {
                text: "📱 Telefon raqamimni yuborish",
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      })
      return
    }

    // 2. Handle Contact sharing
    if (msg.contact) {
      const contact = msg.contact
      let phone = contact.phone_number
      if (!phone.startsWith("+")) {
        phone = "+" + phone
      }

      const telegramId = String(contact.user_id || msg.from?.id || chatId)
      const rawFullName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || contact.first_name || "Telegram Foydalanuvchi"
      const username = msg.from?.username || undefined

      this.logger.log(`📱 Contact shared from chatId: ${chatId}, phone: ${phone}, name: ${rawFullName}`)

      // Sync user with DB
      try {
        await this.authService.syncTelegramUser({
          telegramId,
          phone,
          fullName: rawFullName,
          username,
        })
        this.logger.log(`✅ User saved to DB: tgId=${telegramId}, phone=${phone}`)
      } catch (dbErr) {
        this.logger.error(`Error saving user to DB: ${dbErr}`)
      }

      // Check if user came from a Web session
      const pendingSessionToken = this.userPendingSessions.get(chatId)
      let webLoginUrl = ""

      if (pendingSessionToken) {
        try {
          const sessionResult = await this.authService.completeWebAuthSession(
            pendingSessionToken,
            { telegramId, phone, fullName: rawFullName, username }
          )
          webLoginUrl = sessionResult.webLoginUrl
          this.userPendingSessions.delete(chatId)
        } catch (e) {
          this.logger.warn(`Could not complete session for ${pendingSessionToken}`)
        }
      }

      const inlineButtons: any[] = [
        [
          {
            text: "🍽 Taomlar Menusini Ochish (Mini App)",
            web_app: { url: this.webAppUrl },
          },
        ],
      ]

      if (webLoginUrl) {
        inlineButtons.push([
          {
            text: "🌐 Saytda davom etish",
            url: webLoginUrl,
          },
        ])
      }

      const cleanName = this.escapeHtml(rawFullName)
      const cleanPhone = this.escapeHtml(phone)

      await this.callApi("sendMessage", {
        chat_id: chatId,
        text: `🎉 <b>Raqamingiz muvaffaqiyatli tasdiqlandi!</b>\n\n👤 <b>Mijoz:</b> ${cleanName}\n📱 <b>Telefon:</b> ${cleanPhone}\n\nEndi bemalol o'zingiz yoqtirgan taomlarni buyurtma qilishingiz mumkin:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: inlineButtons,
        },
      })
      return
    }

    // 3. Fallback for any other text messages
    if (text) {
      await this.callApi("sendMessage", {
        chat_id: chatId,
        text: `Assalomu alaykum! Buyurtma berish uchun quyidagi tugma orqali taomlar menyusini ochishingiz mumkin:`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🍽 Taomlar Menusini Ochish (Mini App)",
                web_app: { url: this.webAppUrl },
              },
            ],
          ],
        },
      })
    }
  }

  // Forward New Order details to Telegram Orders Channel
  async sendOrderNotification(order: any) {
    try {
      const channel = this.ordersChannelId
      if (!channel) return

      let itemsText = ""
      if (order.items && Array.isArray(order.items)) {
        itemsText = order.items
          .map(
            (it: any) =>
              `  • <b>${it.quantity}x</b> ${it.name} — <i>${(it.unitPrice * it.quantity).toLocaleString()} so'm</i>`
          )
          .join("\n")
      }

      let containersText = ""
      if (order.containersJson) {
        try {
          const containers = typeof order.containersJson === "string" ? JSON.parse(order.containersJson) : order.containersJson
          if (Array.isArray(containers) && containers.length > 0) {
            containersText = `\n🍱 <b>IDISHLARGA TAQSIMOT (${containers.length} ta boks):</b>\n` +
              containers
                .map((c: any, i: number) => {
                  const label = c.label ? ` (${c.label})` : ""
                  const cItems = (c.items || [])
                    .map((it: any) => `    ▫️ <b>${it.quantity}x</b> ${it.name}`)
                    .join("\n")
                  return `  📦 <b>${c.name || `${i + 1}-Idish`}${label}:</b>\n${cItems || "    (Bo'sh)"}`
                })
                .join("\n\n") + "\n"
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      const buildingInfo = [
        order.building ? `🏢 <b>Dom:</b> ${order.building}` : null,
        order.floor ? `<b>Qavat:</b> ${order.floor}` : null,
        order.apartment ? `<b>Xona:</b> ${order.apartment}` : null,
      ]
        .filter(Boolean)
        .join(" | ")

      const isDineIn = order.type === "DINE_IN"
      const isPickup = order.type === "ONLINE_PICKUP"

      const headerTitle = isDineIn
        ? `🍽 <b>YANGI ZAL (KASSA) BUYURTMASI #${order.orderNumber}</b>\n🛎 <b>Turi:</b> 🍽 Zalda iste'mol (Kassa POS)\n\n`
        : isPickup
        ? `🚶 <b>YANGI OLIB KETISH BUYURTMASI #${order.orderNumber}</b>\n🛎 <b>Turi:</b> 🚶 Olib ketish (Self-pickup)\n\n`
        : `🔔 <b>YANGI TELEGRAM BUYURTMASI #${order.orderNumber}</b>\n🛎 <b>Turi:</b> 🚗 Yetkazib berish (Telegram bot)\n\n`

      const formatPaymentMethod = (method?: string): string => {
        if (!method) return "Karta orqali o'tkazma"
        switch (method.toUpperCase()) {
          case "CARD_TRANSFER":
            return "Karta orqali o'tkazma"
          case "CASH":
            return "Naqd pul"
          case "TERMINAL":
            return "Karta orqali terminalda"
          default:
            return method
        }
      }

      const formatOrderStatus = (status?: string): string => {
        if (isDineIn) return "Oshxonada tayyorlanmoqda (Zal)"
        if (!status) return "Qabul qilindi"
        switch (status.toUpperCase()) {
          case "PENDING_PAYMENT":
            return "To'lov / Chek kutilmoqda"
          case "PAYMENT_REVIEW":
            return "Chek tekshirilmoqda"
          case "PREPARING":
            return "Oshxonada tayyorlanmoqda"
          case "READY_FOR_DELIVERY":
            return "Yetkazishga tayyor"
          case "DELIVERING":
            return "Yo'lda (Yetkazilmoqda)"
          case "COMPLETED":
            return "Yetkazildi (Yakunlandi)"
          case "CANCELLED":
            return "Bekor qilindi"
          default:
            return status
        }
      }

      const text = headerTitle +
        `👤 <b>Mijoz:</b> ${order.customerName || (isDineIn ? "Zal mijozi" : "Noma'lum")}\n` +
        (!isDineIn && order.customerPhone && order.customerPhone !== "+998 00 000 00 00" ? `📞 <b>Asosiy tel:</b> ${order.customerPhone}\n` : "") +
        (order.extraPhone ? `📱 <b>Qo'shimcha tel:</b> ${order.extraPhone}\n` : "") +
        (!isDineIn && order.address ? `📍 <b>Manzil:</b> ${order.address}\n` : "") +
        (!isDineIn && buildingInfo ? `${buildingInfo}\n` : "") +
        (order.notes ? `💬 <b>Izoh:</b> ${order.notes}\n` : "") +
        `\n📋 <b>Taomlar tarkibi:</b>\n${itemsText}\n` +
        (!isDineIn && containersText ? `${containersText}\n` : "\n") +
        `💰 <b>Taomlar:</b> ${Number(order.subtotal || 0).toLocaleString()} so'm\n` +
        (Number(order.packagingFee || 0) > 0 ? `📦 <b>Qadoqlash (idishlar):</b> ${Number(order.packagingFee || 0).toLocaleString()} so'm\n` : "") +
        (!isDineIn && Number(order.deliveryFee || 0) > 0 ? `🚗 <b>Taxminiy yetkazish (taksiga):</b> ~${Number(order.deliveryFee || 0).toLocaleString()} so'm (Alohida taksiga to'lanadi)\n` : "") +
        `💵 <b>JAMI RESTORAN TO'LOVI:</b> <b>${Number(order.totalAmount || 0).toLocaleString()} so'm</b>\n` +
        `💳 <b>To'lov usuli:</b> ${formatPaymentMethod(order.paymentMethod)}\n` +
        `⏱ <b>Holat:</b> ${formatOrderStatus(order.status)}`

      await this.callApi("sendMessage", {
        chat_id: channel,
        text,
        parse_mode: "HTML",
      })
    } catch (err) {
      this.logger.error(`Error sending order notification to channel: ${err}`)
    }
  }

  // Forward Uploaded Receipt Photo to Telegram Orders Channel
  async sendReceiptNotification(order: any, receiptImageUrl: string) {
    try {
      const channel = this.ordersChannelId
      if (!channel) return

      const caption = `🧾 <b>TO'LOV CHEKI YUKLANDI!</b>\n\n` +
        `📌 <b>Buyurtma:</b> #${order.orderNumber}\n` +
        `👤 <b>Mijoz:</b> ${order.customerName} (${order.customerPhone})\n` +
        (order.extraPhone ? `📱 <b>Qo'shimcha tel:</b> ${order.extraPhone}\n` : "") +
        `💵 <b>To'lov summasi:</b> <b>${Number(order.totalAmount || 0).toLocaleString()} so'm</b>\n` +
        `💳 <b>To'lov turi:</b> ${order.paymentMethod === "CARD_TRANSFER" ? "Karta orqali o'tkazma" : order.paymentMethod === "CASH" ? "Naqd pul" : order.paymentMethod === "TERMINAL" ? "Terminal" : order.paymentMethod || "Karta"}\n` +
        `\n<i>Kassir/Admin iltimos, to'lovni tekshirib tasdiqlang.</i>`

      const fullUrl = receiptImageUrl.startsWith("http")
        ? receiptImageUrl
        : `https://api.full-food.hotel-familyhouse.uz${receiptImageUrl.startsWith("/") ? "" : "/"}${receiptImageUrl}`

      if (receiptImageUrl.toLowerCase().endsWith(".pdf")) {
        await this.callApi("sendDocument", {
          chat_id: channel,
          document: fullUrl,
          caption,
          parse_mode: "HTML",
        })
      } else {
        const photoRes = await this.callApi("sendPhoto", {
          chat_id: channel,
          photo: fullUrl,
          caption,
          parse_mode: "HTML",
        })

        // If photo sending failed (e.g. invalid format), fallback to message with link
        if (!photoRes || !photoRes.ok) {
          await this.callApi("sendMessage", {
            chat_id: channel,
            text: `${caption}\n\n🖼 <b>Chek havolasi:</b> ${fullUrl}`,
            parse_mode: "HTML",
          })
        }
      }
    } catch (err) {
      this.logger.error(`Error sending receipt notification to channel: ${err}`)
    }
  }

  // Notify channel on receipt approval or rejection
  async sendReceiptReviewedNotification(order: any, approved: boolean, reason?: string) {
    try {
      const channel = this.ordersChannelId
      if (!channel) return

      const text = approved
        ? `✅ <b>TO'LOV TASDIQLANDI!</b>\n\n📌 <b>Buyurtma:</b> #${order.orderNumber}\n👤 <b>Mijoz:</b> ${order.customerName}\n💵 <b>Summa:</b> ${Number(order.totalAmount || 0).toLocaleString()} so'm\n\n👨‍🍳 <i>Buyurtma oshxonaga tayyorlash uchun yo'naltirildi!</i>`
        : `❌ <b>TO'LOV RAD ETILDI!</b>\n\n📌 <b>Buyurtma:</b> #${order.orderNumber}\n👤 <b>Mijoz:</b> ${order.customerName}\n⚠️ <b>Sabab:</b> ${reason || "Chek mos kelmadi"}\n\n<i>Buyurtma bekor qilindi.</i>`

      await this.callApi("sendMessage", {
        chat_id: channel,
        text,
        parse_mode: "HTML",
      })
    } catch (err) {
      this.logger.error(`Error sending receipt reviewed notification: ${err}`)
    }
  }

  // ---------------------------------------------------------------------------
  // BOT STATS & BROADCASTING
  // ---------------------------------------------------------------------------
  async getBotStats() {
    const totalUsers = await this.userRepo.count({
      where: { telegramId: Not(IsNull()) },
    })
    const activeBotUsers = await this.userRepo.count({
      where: { telegramId: Not(IsNull()), isBotActive: true },
    })
    const blockedBotUsers = await this.userRepo.count({
      where: { telegramId: Not(IsNull()), isBotActive: false },
    })

    return { totalUsers, activeBotUsers, blockedBotUsers }
  }

  async broadcastMessage(payload: {
    message: string
    imageUrl?: string
    buttonText?: string
    buttonUrl?: string
    targetType: "ALL" | "SELECTED"
    userIds?: string[]
  }) {
    let query = this.userRepo
      .createQueryBuilder("user")
      .where("user.telegramId IS NOT NULL AND user.telegramId != ''")

    if (payload.targetType === "SELECTED" && payload.userIds && payload.userIds.length > 0) {
      query = query.andWhere("user.id IN (:...ids)", { ids: payload.userIds })
    } else {
      query = query.andWhere("user.isBotActive = :active", { active: true })
    }

    const recipients = await query.getMany()
    const total = recipients.length
    let sent = 0
    let blocked = 0
    let failed = 0

    // Build inline button if provided
    let replyMarkup: any = undefined
    if (payload.buttonText && payload.buttonUrl) {
      const url = payload.buttonUrl.trim()
      const isWebApp = url.startsWith("http") && !url.includes("t.me")
      replyMarkup = {
        inline_keyboard: [
          [
            isWebApp
              ? { text: payload.buttonText.trim(), web_app: { url } }
              : { text: payload.buttonText.trim(), url },
          ],
        ],
      }
    }

    const fullImageUrl = payload.imageUrl
      ? payload.imageUrl.startsWith("http")
        ? payload.imageUrl
        : `https://api.full-food.hotel-familyhouse.uz${payload.imageUrl.startsWith("/") ? "" : "/"}${payload.imageUrl}`
      : null

    this.logger.log(`📢 Starting broadcast to ${total} recipients...`)

    // Send in batches of 25 with 1s delay to respect Telegram rate limits
    const batchSize = 25
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (user) => {
          try {
            let res: any
            if (fullImageUrl) {
              res = await this.callApi("sendPhoto", {
                chat_id: user.telegramId,
                photo: fullImageUrl,
                caption: payload.message,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              })
            } else {
              res = await this.callApi("sendMessage", {
                chat_id: user.telegramId,
                text: payload.message,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              })
            }

            if (res && res.ok) {
              sent++
            } else {
              const desc = (res?.description || "").toLowerCase()
              if (
                res?.error_code === 403 ||
                desc.includes("blocked") ||
                desc.includes("user is deactivated") ||
                desc.includes("chat not found")
              ) {
                blocked++
                await this.userRepo.update(
                  { id: user.id },
                  { isBotActive: false, botBlockedAt: new Date() }
                )
              } else {
                failed++
              }
            }
          } catch (e) {
            failed++
          }
        })
      )

      if (i + batchSize < recipients.length) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    this.logger.log(`📢 Broadcast complete: total=${total}, sent=${sent}, blocked=${blocked}, failed=${failed}`)
    return { total, sent, blocked, failed }
  }
}
