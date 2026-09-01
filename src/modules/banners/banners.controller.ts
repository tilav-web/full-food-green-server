import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query } from "@nestjs/common"
import { BannersService } from "./banners.service"
import { Banner } from "../../entities/banner.entity"

@Controller("banners")
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get()
  async getAll(@Query("active") active?: string): Promise<Banner[]> {
    return this.bannersService.findAll(active === "true")
  }

  @Get(":id")
  async getOne(@Param("id") id: string): Promise<Banner> {
    return this.bannersService.findOne(id)
  }

  @Post()
  async create(@Body() data: Partial<Banner>): Promise<Banner> {
    return this.bannersService.create(data)
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() data: Partial<Banner>): Promise<Banner> {
    return this.bannersService.update(id, data)
  }

  @Patch(":id/toggle")
  async toggleActive(@Param("id") id: string): Promise<Banner> {
    return this.bannersService.toggleActive(id)
  }

  @Delete(":id")
  async delete(@Param("id") id: string): Promise<{ success: boolean }> {
    await this.bannersService.delete(id)
    return { success: true }
  }
}
