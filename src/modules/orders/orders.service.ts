import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Order, OrderStatus, OrderType, PaymentStatus } from "../../entities/order.entity"
import { OrderItem } from "../../entities/order-item.entity"
import { InventoryService } from "../inventory/inventory.service"
import { DeliveryService } from "../delivery/delivery.service"
import { BotService } from "../bot/bot.service"
import { OrdersGateway } from "./orders.gateway"

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    private inventoryService: InventoryService,
    private deliveryService: DeliveryService,
    private botService: BotService,
    private ordersGateway: OrdersGateway
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
    paymentMethod?: "CARD_TRANSFER" | "CASH" | "TERMINAL"
    address?: string
    latitude?: number
    longitude?: number
    distanceKm?: number
    deliveryFee?: number
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

      const oi = this.itemRepo.create({
        productId: item.productId,
        comboId: item.comboId,
        name: item.name,
        quantity,
        portionCount,
        unitPrice,
        totalPrice: itemTotal,
        customPlateJson: item.customPlateJson,
      })
      orderItems.push(oi)

      // If item has a productId, decrement fixed inventory stock if applicable
      if (item.productId) {
        await this.inventoryService.decrementStock(item.productId, quantity, orderNumber)
      }
    }

    const deliveryFee = data.type === "ONLINE_DELIVERY" ? data.deliveryFee || 0 : 0
    const totalAmount = subtotal + deliveryFee

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
      status: data.type === "DINE_IN" ? "PREPARING" : "PENDING_PAYMENT",
      subtotal,
      deliveryFee,
      totalAmount,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      distanceKm: data.distanceKm || 0,
      paymentMethod: data.paymentMethod || "CARD_TRANSFER",
      paymentStatus: data.type === "DINE_IN" ? "PAID" : "UNPAID",
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
