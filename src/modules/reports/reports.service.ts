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

    // Fetch all orders with items for financial & profit calculations
    const allOrders = await this.orderRepo.find({
      relations: ["items"],
      order: { createdAt: "DESC" },
    })

    const periodOrders = allOrders.filter((o) => {
      const d = new Date(o.createdAt)
      return d >= start && d <= end
    })

    // Pre-load all products to create fallback cost map for legacy orders
    const allProducts = await this.productRepo.find()
    const productCostMap = new Map<string, number>()
    for (const p of allProducts) {
      productCostMap.set(p.id, Number(p.costPrice) || 0)
    }

    const calcOrderItemCost = (item: OrderItem): number => {
      if (item.totalCost && Number(item.totalCost) > 0) {
        return Number(item.totalCost)
      }
      const unitCost =
        item.costPrice && Number(item.costPrice) > 0
          ? Number(item.costPrice)
          : item.productId
          ? productCostMap.get(item.productId) || 0
          : 0
      const qty = item.quantity || 1
      const portions = item.portionCount || 1
      return unitCost * qty * portions
    }

    const calcOrderTotalCost = (order: Order): number => {
      if (!order.items || order.items.length === 0) return 0
      return order.items.reduce((sum, it) => sum + calcOrderItemCost(it), 0)
    }

    // Overall all-time summary
    const paidAllOrders = allOrders.filter(
      (o) => o.paymentStatus === "PAID" || o.status === "COMPLETED"
    )
    const allTimeRevenue = paidAllOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const allTimeCost = paidAllOrders.reduce((sum, o) => sum + calcOrderTotalCost(o), 0)
    const allTimeProfit = allTimeRevenue - allTimeCost

    // Period specific summary
    const paidPeriodOrders = periodOrders.filter(
      (o) => o.paymentStatus === "PAID" || o.status === "COMPLETED"
    )
    const periodRevenue = paidPeriodOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const periodCost = paidPeriodOrders.reduce((sum, o) => sum + calcOrderTotalCost(o), 0)
    const netProfit = periodRevenue - periodCost
    const profitMargin = periodRevenue > 0 ? Math.round((netProfit / periodRevenue) * 100) : 0

    const totalOrdersCount = periodOrders.length
    const completedOrdersCount = periodOrders.filter((o) => o.status === "COMPLETED").length
    const pendingOrdersCount = periodOrders.filter((o) =>
      ["PENDING_PAYMENT", "PAYMENT_REVIEW", "PREPARING", "READY_FOR_DELIVERY", "DELIVERING"].includes(o.status)
    ).length
    const cancelledOrdersCount = periodOrders.filter((o) => o.status === "CANCELLED").length

    const averageCheck = completedOrdersCount > 0 ? Math.round(periodRevenue / completedOrdersCount) : 0
    const averageProfit = completedOrdersCount > 0 ? Math.round(netProfit / completedOrdersCount) : 0

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

    // Top selling items in this period with cost and profit analytics
    const topItemsRaw = await this.itemRepo
      .createQueryBuilder("item")
      .innerJoin("item.order", "order")
      .where("order.createdAt BETWEEN :start AND :end", { start: start.toISOString(), end: end.toISOString() })
      .andWhere("order.status != :cancelled", { cancelled: "CANCELLED" })
      .select("item.name", "name")
      .addSelect("item.productId", "productId")
      .addSelect("SUM(item.quantity)", "totalQuantity")
      .addSelect("SUM(item.totalPrice)", "revenue")
      .addSelect("SUM(CASE WHEN item.totalCost > 0 THEN item.totalCost ELSE 0 END)", "recordedCost")
      .groupBy("item.name")
      .addGroupBy("item.productId")
      .orderBy("totalQuantity", "DESC")
      .limit(10)
      .getRawMany()

    const topItems = topItemsRaw.map((item) => {
      const revenue = Number(item.revenue || 0)
      const qty = Number(item.totalQuantity || 0)
      let cost = Number(item.recordedCost || 0)
      if (cost <= 0 && item.productId) {
        const pCost = productCostMap.get(item.productId) || 0
        cost = pCost * qty
      }
      const profit = revenue - cost
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

      return {
        name: item.name,
        totalQuantity: qty,
        revenue,
        cost,
        profit,
        margin,
      }
    })

    return {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      revenue: periodRevenue,
      totalCost: periodCost,
      netProfit,
      profitMargin,
      totalOrders: totalOrdersCount,
      completedOrdersCount,
      pendingOrdersCount,
      cancelledOrdersCount,
      averageCheck,
      averageProfit,
      totalRevenue: allTimeRevenue,
      allTimeCost,
      allTimeProfit,
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
      topItems,
    }
  }
}
