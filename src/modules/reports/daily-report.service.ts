import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, Between } from "typeorm"
import { Order } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { BotService } from "../bot/bot.service"

interface TashkentDateInfo {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  dateStr: string
  displayDate: string
  dayName: string
  startOfDayUtc: Date
  endOfDayUtc: Date
}

@Injectable()
export class DailyReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyReportService.name)
  private schedulerTimer: NodeJS.Timeout | null = null
  private lastSentDateStr: string = ""

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly botService: BotService
  ) {}

  onModuleInit() {
    this.logger.log("🕒 DailyReportService ishga tushdi (Toshkent vaqti bilan har kuni 23:59 da hisobot)")
    // Har 30 soniyada tekshirib turadigan yengil taymer (1GB RAM ga to'liq mos)
    this.schedulerTimer = setInterval(() => {
      this.checkScheduledTrigger().catch((err) => {
        this.logger.error(`Xatolik checkScheduledTrigger: ${err}`)
      })
    }, 30000)
  }

  onModuleDestroy() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer)
      this.schedulerTimer = null
    }
  }

  /**
   * Toshkent vaqtini (UTC+5 / Asia/Tashkent) aniq hisoblovchi yordamchi funksiya
   */
  getTashkentDateInfo(date: Date = new Date()): TashkentDateInfo {
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })

    const parts = dtf.formatToParts(date)
    const mapping: Record<string, string> = {}
    parts.forEach((p) => {
      mapping[p.type] = p.value
    })

    const year = parseInt(mapping.year, 10)
    const month = parseInt(mapping.month, 10)
    const day = parseInt(mapping.day, 10)
    const hour = parseInt(mapping.hour, 10)
    const minute = parseInt(mapping.minute, 10)
    const second = parseInt(mapping.second, 10)

    const dateStr = `${mapping.year}-${mapping.month}-${mapping.day}`
    const displayDate = `${mapping.day}.${mapping.month}.${mapping.year}`

    // Toshkent 00:00:00 -> UTC 19:00:00 (oldingi kun)
    const startOfDayUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 5 * 3600 * 1000)
    const endOfDayUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - 5 * 3600 * 1000)

    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    const weekDays = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"]
    const dayName = weekDays[d.getUTCDay()]

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateStr,
      displayDate,
      dayName,
      startOfDayUtc,
      endOfDayUtc,
    }
  }

  /**
   * Har 30 soniyada soat 23:59 bo'lganini tekshirish
   */
  private async checkScheduledTrigger() {
    const info = this.getTashkentDateInfo()

    // Aynan 23:59 da va bugun hali yuborilmagan bo'lsa
    if (info.hour === 23 && info.minute === 59) {
      if (this.lastSentDateStr !== info.dateStr) {
        this.lastSentDateStr = info.dateStr
        this.logger.log(`⏰ Soat 23:59 (Toshkent vaqti) bo'ldi! Kunlik hisobot generatsiya qilinmoqda (${info.dateStr})...`)
        await this.generateAndSendDailyReport(info)
      }
    }
  }

  /**
   * Kunlik hisobotni shakllantirish va Telegram guruhga yuborish
   */
  async generateAndSendDailyReport(dateInfo?: TashkentDateInfo): Promise<{ ok: boolean; message: string }> {
    const info = dateInfo || this.getTashkentDateInfo()

    try {
      const orders = await this.orderRepo.find({
        where: {
          createdAt: Between(info.startOfDayUtc, info.endOfDayUtc),
        },
        relations: ["items"],
        order: { createdAt: "ASC" },
      })

      const reportHtml = this.formatDailyReportHtml(orders, info)
      await this.botService.sendDailyReportNotification(reportHtml)

      this.logger.log(`✅ ${info.displayDate} kunlik savdo hisoboti Telegram guruhga muvaffaqiyatli yuborildi!`)
      return { ok: true, message: `${info.displayDate} hisoboti guruhga yuborildi` }
    } catch (err) {
      this.logger.error(`❌ Kunlik hisobot yuborishda xatolik: ${err}`)
      return { ok: false, message: `Xatolik yuz berdi: ${err}` }
    }
  }

  /**
   * Savdo statistikasi matnini chiroyli HTML formatida tuzish
   */
  formatDailyReportHtml(orders: Order[], info: TashkentDateInfo): string {
    // 1. To'langan yoki yakunlangan haqiqiy savdo buyurtmalari
    const validOrders = orders.filter(
      (o) => o.paymentStatus === "PAID" || o.status === "COMPLETED"
    )

    // Bekor qilingan buyurtmalar
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED")

    // AGAR KUNDA SAVDO BO'LMAGAN BO'LSA:
    if (validOrders.length === 0) {
      return (
        `📊 <b>FULL FOOD — KUNLIK SAVDO HISOBOTI</b>\n` +
        `📅 <b>Sana:</b> ${info.displayDate} (${info.dayName})\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Bugun restoranda hech qanday savdo yoki buyurtma qayd etilmadi.\n` +
        (cancelledOrders.length > 0 ? `\n❌ <i>Bekor qilingan buyurtmalar: ${cancelledOrders.length} ta</i>\n` : "") +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Tizim avtomatik hisoboti • 23:59</i>`
      )
    }

    // 2. Jami tushum summasi
    const totalRevenue = validOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    const avgCheck = Math.round(totalRevenue / validOrders.length)

    // 3. To'lov usullari bo'yicha
    const cashOrders = validOrders.filter((o) => o.paymentMethod === "CASH")
    const cashSum = cashOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)

    const cardOrders = validOrders.filter(
      (o) => o.paymentMethod === "CARD_TRANSFER" || o.paymentMethod === "TERMINAL"
    )
    const cardSum = cardOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)

    const balanceOrders = validOrders.filter(
      (o) => o.paymentMethod === "BALANCE" || o.isPaidFromBalance
    )
    const balanceSum = balanceOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)

    // 4. Buyurtma turlari bo'yicha
    const dineInCount = validOrders.filter((o) => o.type === "DINE_IN").length
    const deliveryCount = validOrders.filter((o) => o.type === "ONLINE_DELIVERY").length
    const pickupCount = validOrders.filter((o) => o.type === "ONLINE_PICKUP").length

    // 5. Eng ko'p sotilgan Top-3 taomlar
    const dishMap = new Map<string, { name: string; count: number; unit?: string }>()
    for (const order of validOrders) {
      if (order.items && order.items.length > 0) {
        for (const it of order.items) {
          const dName = it.name || "Taom"
          const qty = it.quantity || 1
          const prev = dishMap.get(dName)
          if (prev) {
            prev.count += qty
          } else {
            dishMap.set(dName, { name: dName, count: qty })
          }
        }
      }
    }

    const sortedDishes = Array.from(dishMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    let topDishesText = "  <i>Ma'lumot yo'q</i>"
    if (sortedDishes.length > 0) {
      topDishesText = sortedDishes
        .map((d, i) => `  ${i + 1}. <b>${this.escapeHtml(d.name)}</b> — ${d.count} dona`)
        .join("\n")
    }

    // 6. Matnni yig'ish
    let report =
      `📊 <b>FULL FOOD — KUNLIK SAVDO HISOBOTI</b>\n` +
      `📅 <b>Sana:</b> ${info.displayDate} (${info.dayName})\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>Jami tushum:</b> <b>${totalRevenue.toLocaleString()} so'm</b>\n` +
      `📦 <b>Jami buyurtmalar:</b> <b>${validOrders.length} ta</b>\n` +
      `🧾 <b>O'rtacha chek:</b> <b>${avgCheck.toLocaleString()} so'm</b>\n\n` +
      `💳 <b>To'lov turlari:</b>\n` +
      `  • Naqd pul: ${cashSum.toLocaleString()} so'm (${cashOrders.length} ta)\n` +
      `  • Karta (HUMO/Uzcard): ${cardSum.toLocaleString()} so'm (${cardOrders.length} ta)\n`

    if (balanceOrders.length > 0) {
      report += `  • Hisobdan (Balance): ${balanceSum.toLocaleString()} so'm (${balanceOrders.length} ta)\n`
    }

    report +=
      `\n🛵 <b>Buyurtma turlari:</b>\n` +
      `  • Zalda (Kassa POS): ${dineInCount} ta\n` +
      `  • Yetkazib berish (Delivery): ${deliveryCount} ta\n` +
      `  • Olib ketish (Pickup): ${pickupCount} ta\n\n` +
      `🍽️ <b>Eng ko'p sotilgan taomlar (Top-3):</b>\n` +
      `${topDishesText}\n`

    if (cancelledOrders.length > 0) {
      report += `\n❌ <b>Bekor qilingan:</b> ${cancelledOrders.length} ta\n`
    }

    report +=
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Tizim avtomatik hisoboti • 23:59</i>`

    return report
  }

  private escapeHtml(text: string): string {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }
}
