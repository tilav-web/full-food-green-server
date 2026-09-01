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
    @Query("role") role?: string
  ) {
    return this.usersService.findAllPaginated({ page, limit, search, role })
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
}
