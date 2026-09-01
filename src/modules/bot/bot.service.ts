import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { AuthService } from "../auth/auth.service"

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
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    this.token = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "7503405654:AAFwpZi_7SL9mMhXkJteXzuwgZ0UFt5ox4Q"
    this.botUsername = this.configService.get<string>("TELEGRAM_BOT_USERNAME") || "fullfoodbot"
    this.apiUrl = `https://api.telegram.org/bot${this.token}`
    this.webAppUrl = this.configService.get<string>("WEB_APP_URL") || "http://localhost:5173"
    this.ordersChannelId = this.configService.get<string>("TELEGRAM_ORDERS_CHANNEL_ID") || "@full_food_orders"
  }

  async onModuleInit() {
    this.startPolling()
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
      return await res.json()
    } catch (err) {
      this.logger.error(`Error calling Telegram API [${method}]: ${err}`)
      return null
    }
  }

  private async startPolling() {
    this.isRunning = true
    this.logger.log(`🤖 Telegram Bot @${this.botUsername} polling started...`)

    while (this.isRunning) {
      try {
        const response = await this.callApi("getUpdates", {
          offset: this.offset,
          timeout: 25,
        })

        if (response && response.ok && Array.isArray(response.result)) {
          for (const update of response.result) {
            this.offset = update.update_id + 1
            await this.handleUpdate(update)
          }
        }
      } catch (err) {
        this.logger.error(`Polling error: ${err}`)
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }

  private async handleUpdate(update: any) {
    if (!update.message) return
    const msg = update.message
    const chatId = msg.chat.id
    const text = msg.text || ""

    // 1. Handle /start [token]
    if (text.startsWith("/start")) {
      const parts = text.split(" ")
      const startParam = parts[1] || ""

      if (startParam.startsWith("auth_")) {
        this.userPendingSessions.set(chatId, startParam)
      }

      await this.callApi("sendMessage", {
        chat_id: chatId,
        text: `Assalomu alaykum, <b>${msg.from.first_name || "Mijoz"}</b>!\n\n🥗 <b>Full Food</b> — sog'lom va mazali taomlar yetkazib berish xizmatiga xush kelibsiz!\n\nBuyurtma berish va profilingizni tasdiqlash uchun iltimos, pastdagi <b>"📱 Telefon raqamimni yuborish"</b> tugmasini bosing:`,
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

      const telegramId = String(contact.user_id || msg.from.id)
      const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") || "Telegram Foydalanuvchi"
      const username = msg.from.username || undefined

      // Sync user with DB
      const authUser = await this.authService.syncTelegramUser({
        telegramId,
        phone,
        fullName,
        username,
      })

      // Check if user came from a Web session
      const pendingSessionToken = this.userPendingSessions.get(chatId)
      let webLoginUrl = ""

      if (pendingSessionToken) {
        try {
          const sessionResult = await this.authService.completeWebAuthSession(
            pendingSessionToken,
            { telegramId, phone, fullName, username }
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

      await this.callApi("sendMessage", {
        chat_id: chatId,
        text: `🎉 <b>Raqamingiz muvaffaqiyatli tasdiqlandi!</b>\n\n👤 <b>Mijoz:</b> ${fullName}\n📱 <b>Telefon:</b> ${phone}\n\nEndi bemalol o'zingiz yoqtirgan taomlarni buyurtma qilishingiz mumkin:`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: inlineButtons,
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

      const text = `🔔 <b>YANGI BUYURTMA #${order.orderNumber}</b>\n\n` +
        `👤 <b>Mijoz:</b> ${order.customerName || "Noma'lum"}\n` +
        `📞 <b>Asosiy tel:</b> ${order.customerPhone || "-"}\n` +
        (order.extraPhone ? `📱 <b>Qo'shimcha tel:</b> ${order.extraPhone}\n` : "") +
        (order.address ? `📍 <b>Manzil:</b> ${order.address}\n` : "") +
        (buildingInfo ? `${buildingInfo}\n` : "") +
        (order.notes ? `💬 <b>Izoh:</b> ${order.notes}\n` : "") +
        `\n📋 <b>Taomlar tarkibi:</b>\n${itemsText}\n` +
        (containersText ? `${containersText}\n` : "\n") +
        `💰 <b>Taomlar:</b> ${Number(order.subtotal || 0).toLocaleString()} so'm\n` +
        `🚗 <b>Yetkazish:</b> ${Number(order.deliveryFee || 0).toLocaleString()} so'm\n` +
        `💵 <b>JAMI SUMMA:</b> <b>${Number(order.totalAmount || 0).toLocaleString()} so'm</b>\n` +
        `💳 <b>To'lov usuli:</b> ${order.paymentMethod || "KARTA"}\n` +
        `⏱ <b>Holat:</b> ${order.status}`

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
        `💳 <b>To'lov turi:</b> ${order.paymentMethod}\n` +
        `\n<i>Kassir/Admin iltimos, to'lovni tekshirib tasdiqlang.</i>`

      if (receiptImageUrl && receiptImageUrl.startsWith("http")) {
        await this.callApi("sendPhoto", {
          chat_id: channel,
          photo: receiptImageUrl,
          caption,
          parse_mode: "HTML",
        })
      } else {
        await this.callApi("sendMessage", {
          chat_id: channel,
          text: `${caption}\n\n🖼 <b>Chek havolasi:</b> ${receiptImageUrl}`,
          parse_mode: "HTML",
        })
      }
    } catch (err) {
      this.logger.error(`Error sending receipt notification to channel: ${err}`)
    }
  }
}
