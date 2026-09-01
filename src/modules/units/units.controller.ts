import { Controller, Get, Post, Put, Delete, Body, Param } from "@nestjs/common"
import { UnitsService } from "./units.service"

@Controller("units")
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  async findAll() {
    return this.unitsService.findAll()
  }

  @Post()
  async create(@Body() dto: { name: string; shortName?: string }) {
    return this.unitsService.create(dto)
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: { name?: string; shortName?: string }) {
    return this.unitsService.update(id, dto)
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.unitsService.remove(id)
  }
}
