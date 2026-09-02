import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Order, OrderStatus, OrderType, PaymentStatus } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { Product } from "../../entities/product.entity"
import { InventoryService } from "../inventory/inventory.service"
import { DeliveryService } from "../delivery/delivery.service"
import { BotService } from "../bot/bot.service"
import { UsersService } from "../users/users.service"
import { OrdersGateway } from "./orders.gateway"

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private inventoryService: InventoryService,
    private deliveryService: DeliveryService,
    private botService: BotService,
    private ordersGateway: OrdersGateway,
    private usersService: UsersService
  ) { }

  // Generate order number
  private async generateOrderNumber(): Promise<string> {
    const count = await this.orderRepo.count()
    return `FF-${1001 + count}`
  }

  // 1. Create Order (Online or POS)
  async createOrder(data: {
    userId?: string
    customerName: string
    customerPhone: string
    extraPhone?: string
    building?: string
    floor?: string
    apartment?: string
    type?: "ONLINE_DELIVERY" | "ONLINE_PICKUP" | "DINE_IN"
    paymentMethod?: "CARD_TRANSFER" | "CASH" | "TERMINAL" | "BALANCE"
    address?: string
    latitude?: number
    longitude?: number
    distanceKm?: number
    deliveryFee?: number
    packagingFee?: number
    notes?: string
    containersJson?: string
    items: Array<{
      productId?: string
      comboId?: string
      name: string
      quantity: number
      portionCount?: number
      unitPrice: number
      customPlateJson?: string
    }>
  }) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException("Buyurtmada hech qanday taom tanlanmagan")
    }

    const orderNumber = await this.generateOrderNumber()

    // Calculate totals
    let subtotal = 0
    const orderItems: OrderItem[] = []

    for (const item of data.items) {
      const quantity = item.quantity || 1
      const portionCount = item.portionCount || 1
      const unitPrice = item.unitPrice || 0
      const itemTotal = unitPrice * quantity

      subtotal += itemTotal

      let itemCostPrice = 0
      if (item.productId) {
        try {
          const product = await this.productRepo.findOne({ where: { id: item.productId } })
          if (product && product.costPrice) {
            itemCostPrice = Number(product.costPrice) || 0
          }
        } catch (_) {}
      }
      const itemTotalCost = itemCostPrice * quantity * portionCount

      const oi = this.itemRepo.create({
        productId: item.productId,
        comboId: item.comboId,
        name: item.name,
        quantity,
        portionCount,
        unitPrice,
        totalPrice: itemTotal,
        costPrice: itemCostPrice,
        totalCost: itemTotalCost,
        customPlateJson: item.customPlateJson,
      })
      orderItems.push(oi)

      // If item has a productId, decrement fixed inventory stock if applicable
      if (item.productId) {
        await this.inventoryService.decrementStock(item.productId, quantity, orderNumber)
      }
    }

    const deliveryFee = data.type === "ONLINE_DELIVERY" ? data.deliveryFee || 0 : 0
    const packagingFee = data.packagingFee || 0
    // User pays only for food + packaging. Delivery fee is paid directly to taxi driver
    const totalAmount = subtotal + packagingFee

    let isPaidFromBalance = false
    let paymentStatus: PaymentStatus = data.type === "DINE_IN" ? "PAID" : "UNPAID"
    let status: OrderStatus = data.type === "DINE_IN" ? "PREPARING" : "PENDING_PAYMENT"

    if (data.paymentMethod === "BALANCE") {
      if (!data.userId) {
        throw new BadRequestException("Balans orqali to'lov uchun mijoz tanlanishi shart")
      }
      const user = await this.usersService.findById(data.userId)
      const currentBal = Number(user.balance || 0)
      if (currentBal < totalAmount) {
        throw new BadRequestException(
          `Mijoz hisobida yetarli mablag' mavjud emas. Balans: ${currentBal.toLocaleString()} so'm, talab qilinadi: ${totalAmount.toLocaleString()} so'm`
        )
      }

      // If DINE_IN (POS order created directly by cashier), deduct immediately!
      if (data.type === "DINE_IN") {
        await this.usersService.adjustBalance(data.userId, {
          amount: -totalAmount,
          type: "ORDER_PAYMENT",
          orderId: orderNumber,
          note: `Zal POS buyurtma #${orderNumber} uchun to'lov`,
          performedBy: "Kassir",
        })
        isPaidFromBalance = true
        paymentStatus = "PAID"
        status = "PREPARING"
      } else {
        // Online order: created with UNPAID, cashier reviews and deducts upon confirmation
        isPaidFromBalance = false
        paymentStatus = "UNPAID"
        status = "PENDING_PAYMENT"
      }
    }

    const order = this.orderRepo.create({
      orderNumber,
      userId: data.userId,
      customerName: data.customerName || "Mijoz",
      customerPhone: data.customerPhone,
      extraPhone: data.extraPhone,
      building: data.building,
      floor: data.floor,
      apartment: data.apartment,
      type: data.type || "ONLINE_DELIVERY",
      status,
      subtotal,
      deliveryFee,
      packagingFee,
      totalAmount,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      distanceKm: data.distanceKm || 0,
      paymentMethod: data.paymentMethod || "CARD_TRANSFER",
      paymentStatus,
      isPaidFromBalance,
      notes: data.notes,
      containersJson: data.containersJson,
      items: orderItems,
    })

    const savedOrder = await this.orderRepo.save(order)

    // Notify Telegram channel asynchronously
    this.botService.sendOrderNotification(savedOrder)

    // Emit Real-Time WebSocket event to Cashier & Admin
    this.ordersGateway.emitNewOrder(savedOrder)

    return savedOrder
  }

  // 2. Upload Receipt for Payment (User flow)
  async uploadReceipt(orderId: string, receiptImageUrl: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ["items"] })
    if (!order) throw new NotFoundException("Buyurtma topilmadi")

    order.receiptImageUrl = receiptImageUrl
    order.status = "PAYMENT_REVIEW" as OrderStatus
    order.paymentStatus = "REVIEW" as PaymentStatus

    const savedOrder = await this.orderRepo.save(order)

    // Notify Telegram channel with receipt photo
    this.botService.sendReceiptNotification(savedOrder, receiptImageUrl)

    // Emit Real-Time WebSocket event
    this.ordersGateway.emitOrderUpdated(savedOrder)

    return savedOrder
  }

  // 3. Review Receipt (Cashier/Admin flow)
  async reviewReceipt(orderId: string, approved: boolean, rejectReason?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ["items"] })
    if (!order) throw new NotFoundException("Buyurtma topilmadi")

    if (approved) {
      order.status = "PREPARING"
      order.paymentStatus = "PAID"
      order.receiptRejectReason = null
    } else {
      order.status = "CANCELLED"
      order.paymentStatus = "REJECTED"
      order.receiptRejectReason = rejectReason || "Chek tasdiqlanmadi"
    }

    const savedOrder = await this.orderRepo.save(order)

    // Notify Telegram channel on review result
    this.botService.sendReceiptReviewedNotification(savedOrder, approved, rejectReason)

    // Emit Real-Time WebSocket event
    this.ordersGateway.emitOrderUpdated(savedOrder)

    return savedOrder
  }

  // 3.5 Confirm Balance Payment (Cashier flow)
  async confirmBalancePayment(orderId: string, performedBy?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ["items"] })
    if (!order) throw new NotFoundException("Buyurtma topilmadi")

    if (order.isPaidFromBalance) {
      throw new BadRequestException("Ushbu buyurtma uchun balansdan allaqachon to'langan")
    }

    let targetUserId = order.userId
    if (!targetUserId && order.customerPhone) {
      const u = await this.usersService.findAllPaginated({ search: order.customerPhone, limit: 1 })
      if (u.data && u.data.length > 0) {
        targetUserId = u.data[0].id
      }
    }

    if (!targetUserId) {
      throw new BadRequestException("Buyurtmachi foydalanuvchi hisobi topilmadi")
    }

    const user = await this.usersService.findById(targetUserId)
    const currentBalance = Number(user.balance || 0)
    if (currentBalance < order.totalAmount) {
      throw new BadRequestException(
        `Mijoz balansida yetarli mablag' mavjud emas. Balans: ${currentBalance.toLocaleString()} so'm, buyurtma: ${order.totalAmount.toLocaleString()} so'm`
      )
    }

    // Deduct from balance
    await this.usersService.adjustBalance(targetUserId, {
      amount: -order.totalAmount,
      type: "ORDER_PAYMENT",
      orderId: order.orderNumber,
      note: `Buyurtma #${order.orderNumber} uchun to'lov`,
      performedBy: performedBy || "Kassir",
    })

    order.userId = targetUserId
    order.isPaidFromBalance = true
    order.paymentMethod = "BALANCE"
    order.paymentStatus = "PAID"
    order.status = "PREPARING"

    const savedOrder = await this.orderRepo.save(order)

    // Notify Telegram bot channel
    this.botService.sendOrderNotification(savedOrder)

    // Emit Real-Time WebSocket event
    this.ordersGateway.emitOrderUpdated(savedOrder)

    return savedOrder
  }

  // 4. Update Status (Preparing -> Ready -> Delivering -> Completed)
  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ["items"] })
    if (!order) throw new NotFoundException("Buyurtma topilmadi")

    order.status = status
    const savedOrder = await this.orderRepo.save(order)

    // Emit Real-Time WebSocket event
    this.ordersGateway.emitOrderUpdated(savedOrder)

    return savedOrder
  }

  // 5. Dispatch Yandex Taxi with confirmation
  async dispatchYandexTaxi(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ["items"] })
    if (!order) throw new NotFoundException("Buyurtma topilmadi")

    const result = await this.deliveryService.dispatchYandexTaxi({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      latitude: order.latitude,
      longitude: order.longitude,
    })

    order.isYandexTaxiCalled = true
    order.yandexTaxiOrderId = result.yandexOrderId
    order.yandexTaxiStatus = result.status
    order.status = "DELIVERING"

    const savedOrder = await this.orderRepo.save(order)

    // Emit Real-Time WebSocket event
    this.ordersGateway.emitOrderUpdated(savedOrder)

    return { order: savedOrder, dispatchInfo: result }
  }

  async getOrders(query?: {
    status?: OrderStatus;
    type?: OrderType;
    userId?: string;
    phone?: string;
    search?: string;
    limit?: number;
    page?: number;
  }) {
    const qb = this.orderRepo
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.items", "items")

    if (query?.status) {
      qb.andWhere("order.status = :status", { status: query.status })
    }
    if (query?.type) {
      qb.andWhere("order.type = :type", { type: query.type })
    }
    if (query?.userId && query?.phone) {
      qb.andWhere("(order.userId = :userId OR order.customerPhone = :phone)", {
        userId: query.userId,
        phone: query.phone,
      })
    } else if (query?.userId) {
      qb.andWhere("order.userId = :userId", { userId: query.userId })
    } else if (query?.phone) {
      qb.andWhere("order.customerPhone = :phone", { phone: query.phone })
    }
    if (query?.search) {
      qb.andWhere(
        "(order.orderNumber LIKE :s OR order.customerPhone LIKE :s OR order.customerName LIKE :s)",
        { s: `%${query.search}%` }
      )
    }

    qb.orderBy("order.createdAt", "DESC")

    if (query?.limit) {
      const take = Number(query.limit)
      const page = Number(query.page) || 1
      const skip = (page - 1) * take
      qb.take(take).skip(skip)
    }

    const orders = await qb.getMany()

    const STATUS_PRIORITY: Record<string, number> = {
      PAYMENT_REVIEW: 1,
      PREPARING: 2,
      DELIVERING: 3,
      PENDING_PAYMENT: 4,
      COMPLETED: 5,
      CANCELLED: 6,
    }

    return orders.sort((a, b) => {
      const prioA = STATUS_PRIORITY[a.status] || 99
      const prioB = STATUS_PRIORITY[b.status] || 99
      if (prioA !== prioB) return prioA - prioB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  async getOrderById(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ["items"],
    })
    if (!order) throw new NotFoundException("Buyurtma topilmadi")
    return order
  }
}
