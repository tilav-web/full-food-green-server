import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, Between } from "typeorm"
import { Order } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { BotService } from "../bot/bot.service"

export interface ShiftInfo {
  baseDateStr: string // "2026-10-31" (smena ochilgan sana)
  displayShift: string // "31.10.2026 (05:00) — 01.11.2026 (05:00)"
  displayDate: string // "31.10.2026"
  dayName: string // "Shanba"
  startUtc: Date // Smena boshlanishi (UTC)
  endUtc: Date // Smena tugashi (UTC)
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
    this.logger.log("🕒 DailyReportService ishga tushdi (Toshkent vaqti bilan har kuni ertalab 05:00 da hisobot)")
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
  getTashkentCurrentInfo(date: Date = new Date()) {
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

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateStr,
      displayDate,
    }
  }

  /**
   * Yakunlangan 24-soatlik smena (05:00 dan 05:00 gacha) ma'lumotlarini olish
   * Ertalab soat 05:00 da hisobot chiqarilganda, kechagi kun 05:00 dan bugungi kun 05:00 gacha
   * bo'lgan smena hisoboti olinadi.
   */
  getCompletedShiftInfo(now: Date = new Date()): ShiftInfo {
    const cur = this.getTashkentCurrentInfo(now)

    // Agar hozir soat 05:00 yoki undan keyin bo'lsa, yakunlangan smena kechagi kunga tegishli (day - 1)
    // Agar hozir 05:00 dan oldin bo'lsa (masalan 04:30), yakunlangan smena undan oldingi kunga tegishli
    const shiftBase = new Date(Date.UTC(cur.year, cur.month - 1, cur.hour >= 5 ? cur.day - 1 : cur.day - 2))
    const bY = shiftBase.getUTCFullYear()
    const bM = shiftBase.getUTCMonth()
    const bD = shiftBase.getUTCDate()

    // Toshkentda 05:00:00 (UTC+5) = UTC da 00:00:00
    // Toshkentda ertasi kuni 04:59:59.999 (UTC+5) = UTC da 23:59:59.999
    const startUtc = new Date(Date.UTC(bY, bM, bD, 0, 0, 0))
    const endUtc = new Date(Date.UTC(bY, bM, bD, 23, 59, 59, 999))

    const nextDate = new Date(shiftBase.getTime() + 24 * 3600 * 1000)
    const pad = (n: number) => String(n).padStart(2, "0")

    const baseDateStr = `${bY}-${pad(bM + 1)}-${pad(bD)}`
    const displayDate = `${pad(bD)}.${pad(bM + 1)}.${bY}`
    const displayShift = `${pad(bD)}.${pad(bM + 1)}.${bY} (05:00) — ${pad(nextDate.getUTCDate())}.${pad(nextDate.getUTCMonth() + 1)}.${nextDate.getUTCFullYear()} (05:00)`

    const weekDays = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"]
    const dayName = weekDays[shiftBase.getUTCDay()]

    return {
      baseDateStr,
      displayShift,
      displayDate,
      dayName,
      startUtc,
      endUtc,
    }
  }

  /**
   * Har 30 soniyada soat 05:00 (Toshkent vaqti) bo'lganini tekshirish
   */
  private async checkScheduledTrigger() {
    const cur = this.getTashkentCurrentInfo()

    // Aynan 05:00 da (05:00 yoki 05:01 oralig'ida) va bugun hali yuborilmagan bo'lsa
    if (cur.hour === 5 && (cur.minute === 0 || cur.minute === 1)) {
      if (this.lastSentDateStr !== cur.dateStr) {
        this.lastSentDateStr = cur.dateStr
        this.logger.log(`⏰ Soat 05:00 (Toshkent vaqti) bo'ldi! Yakunlangan 24-soatlik smena hisoboti generatsiya qilinmoqda (${cur.dateStr})...`)
        await this.generateAndSendDailyReport()
      }
    }
  }

  /**
   * Kunlik smena hisobotini shakllantirish va Telegram guruhga yuborish
   */
  async generateAndSendDailyReport(customShift?: ShiftInfo): Promise<{ ok: boolean; message: string }> {
    const shift = customShift || this.getCompletedShiftInfo()

    try {
      const orders = await this.orderRepo.find({
        where: {
          createdAt: Between(shift.startUtc, shift.endUtc),
        },
        relations: ["items"],
        order: { createdAt: "ASC" },
      })

      const reportHtml = this.formatDailyReportHtml(orders, shift)
      await this.botService.sendDailyReportNotification(reportHtml)

      this.logger.log(`✅ ${shift.displayShift} kunlik savdo hisoboti Telegram guruhga muvaffaqiyatli yuborildi!`)
      return { ok: true, message: `${shift.displayShift} hisoboti guruhga yuborildi` }
    } catch (err) {
      this.logger.error(`❌ Kunlik hisobot yuborishda xatolik: ${err}`)
      return { ok: false, message: `Xatolik yuz berdi: ${err}` }
    }
  }

  /**
   * Savdo statistikasi matnini chiroyli HTML formatida tuzish (05:00 — 05:00 smena)
   */
  formatDailyReportHtml(orders: Order[], shift: ShiftInfo): string {
    // 1. To'langan yoki yakunlangan haqiqiy savdo buyurtmalari
    const validOrders = orders.filter(
      (o) => o.paymentStatus === "PAID" || o.status === "COMPLETED"
    )

    // Bekor qilingan buyurtmalar
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED")

    // AGAR SMENADA SAVDO BO'LMAGAN BO'LSA:
    if (validOrders.length === 0) {
      return (
        `📊 <b>FULL FOOD — KUNLIK SAVDO HISOBOTI</b>\n` +
        `📅 <b>Sana:</b> ${shift.displayShift}\n` +
        `⏰ <b>Smena:</b> ${shift.dayName} (05:00 — 05:00)\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `Ushbu smenada hech qanday savdo yoki buyurtma qayd etilmadi.\n` +
        (cancelledOrders.length > 0 ? `\n❌ <i>Bekor qilingan buyurtmalar: ${cancelledOrders.length} ta</i>\n` : "") +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Tizim avtomatik hisoboti • 05:00</i>`
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
      `📅 <b>Sana:</b> ${shift.displayShift}\n` +
      `⏰ <b>Smena:</b> ${shift.dayName} (05:00 — 05:00)\n` +
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
      `<i>Tizim avtomatik hisoboti • 05:00</i>`

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
