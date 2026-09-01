import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Unit } from "../../entities/unit.entity"

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>
  ) {}

  async findAll(): Promise<Unit[]> {
    return this.unitRepo.find({ order: { name: "ASC" } })
  }

  async findOne(id: string): Promise<Unit> {
    const unit = await this.unitRepo.findOne({ where: { id } })
    if (!unit) throw new NotFoundException("O'lchov birligi topilmadi")
    return unit
  }

  async create(dto: { name: string; shortName?: string }): Promise<Unit> {
    const existing = await this.unitRepo.findOne({ where: { name: dto.name } })
    if (existing) return existing

    const unit = this.unitRepo.create(dto)
    return this.unitRepo.save(unit)
  }

  async update(id: string, dto: { name?: string; shortName?: string }): Promise<Unit> {
    const unit = await this.findOne(id)
    Object.assign(unit, dto)
    return this.unitRepo.save(unit)
  }

  async remove(id: string): Promise<boolean> {
    const unit = await this.findOne(id)
    await this.unitRepo.remove(unit)
    return true
  }
}
