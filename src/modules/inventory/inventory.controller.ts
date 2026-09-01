import { Controller, Get, Post, Body, Query } from "@nestjs/common"
import { InventoryService } from "./inventory.service"

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post("kirim")
  async recordKirim(
    @Body()
    body: {
      productId: string
      quantity: number
      costPrice?: number
      supplier?: string
      note?: string
      createdBy?: string
    }
  ) {
    return this.inventoryService.recordKirim(body)
  }

  @Get("logs")
  async getLogs(@Query("limit") limit?: number) {
    return this.inventoryService.getLogs(limit ? Number(limit) : 50)
  }

  @Get("stock-status")
  async getStockStatus() {
    return this.inventoryService.getStockStatus()
  }

  @Get("portion-summary")
  async getPortionSalesSummary() {
    return this.inventoryService.getPortionSalesSummary()
  }
}
