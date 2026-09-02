import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from "@nestjs/common"
import { UsersService } from "./users.service"

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
    @Query("role") role?: string,
    @Query("botStatus") botStatus?: "ALL" | "ACTIVE" | "BLOCKED"
  ) {
    return this.usersService.findAllPaginated({ page, limit, search, role, botStatus })
  }

  @Get("staff")
  async getStaff() {
    return this.usersService.getStaff()
  }

  @Post("cashier")
  async createCashier(
    @Body() body: { username: string; password: string; fullName: string; phone?: string }
  ) {
    return this.usersService.createCashier(body)
  }

  @Patch(":id/credentials")
  async updateStaffCredentials(
    @Param("id") id: string,
    @Body() body: { username?: string; password?: string; fullName?: string; phone?: string }
  ) {
    return this.usersService.updateStaffCredentials(id, body)
  }

  @Delete(":id")
  async deleteStaff(@Param("id") id: string) {
    return this.usersService.deleteStaff(id)
  }

  @Get(":id")
  async getUserById(@Param("id") id: string) {
    return this.usersService.findById(id)
  }

  @Post(":id/balance")
  async adjustBalance(
    @Param("id") id: string,
    @Body()
    body: {
      amount: number
      type?: any
      note?: string
      performedBy?: string
      orderId?: string
    }
  ) {
    return this.usersService.adjustBalance(id, {
      amount: body.amount,
      type: body.type || (body.amount >= 0 ? "DEPOSIT" : "MANUAL_ADJUSTMENT"),
      note: body.note,
      performedBy: body.performedBy || "Super Admin",
      orderId: body.orderId,
    })
  }

  @Get(":id/balance-history")
  async getBalanceHistory(@Param("id") id: string) {
    return this.usersService.getBalanceHistory(id)
  }
}
