import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, Between, MoreThanOrEqual } from "typeorm"
import { Order } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { Product } from "../../entities/product.entity"

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>
  ) {}

  async getDashboardSummary(period: string = "today", startDateStr?: string, endDateStr?: string) {
    const now = new Date()
    let start: Date
    let end: Date = new Date(now)
    end.setHours(23, 59, 59, 999)

    if (period === "today") {
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
    } else if (period === "yesterday") {
      start = new Date(now)
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)

      end = new Date(now)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
    } else if (period === "week") {
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    } else if (period === "custom" && startDateStr) {
      start = new Date(startDateStr)
      start.setHours(0, 0, 0, 0)
      if (endDateStr) {
        end = new Date(endDateStr)
        end.setHours(23, 59, 59, 999)
      }
    } else {
      // "all"
      start = new Date(2020, 0, 1)
    }

    // Fetch all orders for all-time stats & period orders
    const allOrders = await this.orderRepo.find({ order: { createdAt: "DESC" } })
    const periodOrders = allOrders.filter((o) => {
      const d = new Date(o.createdAt)
      return d >= start && d <= end
    })

    // Overall summary
    const allTimeRevenue = allOrders
      .filter((o) => o.paymentStatus === "PAID" || o.status === "COMPLETED")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    // Period specific summary
    const paidPeriodOrders = periodOrders.filter(
      (o) => o.paymentStatus === "PAID" || o.status === "COMPLETED"
    )
    const periodRevenue = paidPeriodOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const totalOrdersCount = periodOrders.length
    const completedOrdersCount = periodOrders.filter((o) => o.status === "COMPLETED").length
    const pendingOrdersCount = periodOrders.filter((o) =>
      ["PENDING_PAYMENT", "PAYMENT_REVIEW", "PREPARING", "READY_FOR_DELIVERY", "DELIVERING"].includes(o.status)
    ).length
    const cancelledOrdersCount = periodOrders.filter((o) => o.status === "CANCELLED").length

    const averageCheck = completedOrdersCount > 0 ? Math.round(periodRevenue / completedOrdersCount) : 0

    // Payment method breakdown
    const cardOrders = paidPeriodOrders.filter(
      (o) => o.paymentMethod === "CARD_TRANSFER" || o.paymentMethod === "TERMINAL"
    )
    const cashOrders = paidPeriodOrders.filter((o) => o.paymentMethod === "CASH")

    const cardRevenue = cardOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const cashRevenue = cashOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    // Order type breakdown
    const deliveryOrders = periodOrders.filter((o) => o.type === "ONLINE_DELIVERY")
    const pickupOrders = periodOrders.filter((o) => o.type === "ONLINE_PICKUP")
    const dineInOrders = periodOrders.filter((o) => o.type === "DINE_IN")

    const deliveryRevenue = deliveryOrders
      .filter((o) => o.paymentStatus === "PAID" || o.status === "COMPLETED")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const pickupRevenue = pickupOrders
      .filter((o) => o.paymentStatus === "PAID" || o.status === "COMPLETED")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const dineInRevenue = dineInOrders
      .filter((o) => o.paymentStatus === "PAID" || o.status === "COMPLETED")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    // Top selling items in this period
    const topItems = await this.itemRepo
      .createQueryBuilder("item")
      .innerJoin("item.order", "order")
      .where("order.createdAt BETWEEN :start AND :end", { start: start.toISOString(), end: end.toISOString() })
      .andWhere("order.status != :cancelled", { cancelled: "CANCELLED" })
      .select("item.name", "name")
      .addSelect("SUM(item.quantity)", "totalQuantity")
      .addSelect("SUM(item.totalPrice)", "revenue")
      .groupBy("item.name")
      .orderBy("totalQuantity", "DESC")
      .limit(8)
      .getRawMany()

    return {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      revenue: periodRevenue,
      totalRevenue: allTimeRevenue,
      totalOrders: totalOrdersCount,
      completedOrdersCount,
      pendingOrdersCount,
      cancelledOrdersCount,
      averageCheck,
      paymentBreakdown: {
        cardRevenue,
        cardCount: cardOrders.length,
        cashRevenue,
        cashCount: cashOrders.length,
        cardPercentage: periodRevenue > 0 ? Math.round((cardRevenue / periodRevenue) * 100) : 0,
        cashPercentage: periodRevenue > 0 ? Math.round((cashRevenue / periodRevenue) * 100) : 0,
      },
      channelBreakdown: {
        delivery: { count: deliveryOrders.length, revenue: deliveryRevenue },
        pickup: { count: pickupOrders.length, revenue: pickupRevenue },
        dineIn: { count: dineInOrders.length, revenue: dineInRevenue },
      },
      topItems: topItems.map((item) => ({
        name: item.name,
        totalQuantity: Number(item.totalQuantity || 0),
        revenue: Number(item.revenue || 0),
      })),
    }
  }
}
