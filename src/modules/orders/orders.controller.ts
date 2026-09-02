import { Controller, Get, Post, Patch, Body, Param, Query } from "@nestjs/common"
import { OrdersService } from "./orders.service"
import { OrderStatus } from "../../entities/order.entity"

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() body: any) {
    return this.ordersService.createOrder(body)
  }

  @Get()
  async getOrders(
    @Query("status") status?: OrderStatus,
    @Query("type") type?: any,
    @Query("userId") userId?: string,
    @Query("phone") phone?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: number,
    @Query("page") page?: number
  ) {
    return this.ordersService.getOrders({ status, type, userId, phone, search, limit, page })
  }

  @Get(":id")
  async getOrder(@Param("id") id: string) {
    return this.ordersService.getOrderById(id)
  }

  @Post(":id/upload-receipt")
  async uploadReceipt(@Param("id") id: string, @Body() body: { receiptImageUrl: string }) {
    return this.ordersService.uploadReceipt(id, body.receiptImageUrl)
  }

  @Post(":id/review-receipt")
  async reviewReceipt(
    @Param("id") id: string,
    @Body() body: { approved: boolean; rejectReason?: string }
  ) {
    return this.ordersService.reviewReceipt(id, body.approved, body.rejectReason)
  }

  @Post(":id/confirm-balance-payment")
  async confirmBalancePayment(
    @Param("id") id: string,
    @Body() body: { performedBy?: string }
  ) {
    return this.ordersService.confirmBalancePayment(id, body?.performedBy)
  }

  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Body() body: { status: OrderStatus }) {
    return this.ordersService.updateStatus(id, body.status)
  }

  @Post(":id/dispatch-yandex")
  async dispatchYandexTaxi(@Param("id") id: string) {
    return this.ordersService.dispatchYandexTaxi(id)
  }
}
