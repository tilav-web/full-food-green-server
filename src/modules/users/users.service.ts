import { Injectable, BadRequestException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import * as bcrypt from "bcryptjs"
import { User, UserRole } from "../../entities/user.entity"

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findAllPaginated(params: {
    page?: number
    limit?: number
    search?: string
    role?: string
  }) {
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20))
    const skip = (page - 1) * limit

    const qb = this.userRepo.createQueryBuilder("user")

    if (params.role && params.role !== "ALL") {
      qb.andWhere("user.role = :role", { role: params.role })
    }

    if (params.search && params.search.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`
      qb.andWhere(
        "(LOWER(user.fullName) LIKE :search OR LOWER(user.username) LIKE :search OR user.phone LIKE :search OR user.telegramId LIKE :search)",
        { search }
      )
    }

    qb.orderBy("user.createdAt", "DESC")
      .skip(skip)
      .take(limit)

    const [data, total] = await qb.getManyAndCount()
    const totalPages = Math.ceil(total / limit)
    const counts = await this.getUserCounts()

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      counts,
    }
  }

  async getUserCounts() {
    const all = await this.userRepo.count()
    const users = await this.userRepo.count({ where: { role: "USER" } })
    const cashiers = await this.userRepo.count({ where: { role: "CASHIER" } })
    const admins = await this.userRepo.count({ where: { role: "ADMIN" } })
    return { all, users, cashiers, admins }
  }

  async findAll() {
    return this.userRepo.find({
      order: { createdAt: "DESC" },
    })
  }

  async getStaff() {
    return this.userRepo.find({
      where: [{ role: "CASHIER" }, { role: "ADMIN" }],
      order: { createdAt: "DESC" },
    })
  }

  async createCashier(data: { username: string; password: string; fullName: string; phone?: string }) {
    const exists = await this.userRepo.findOne({ where: { username: data.username } })
    if (exists) {
      throw new BadRequestException("Ushbu login band")
    }

    const hashed = await bcrypt.hash(data.password, 8)
    const user = this.userRepo.create({
      username: data.username,
      fullName: data.fullName,
      phone: data.phone,
      password: hashed,
      role: "CASHIER" as UserRole,
    })

    return this.userRepo.save(user)
  }

  async deleteStaff(id: string) {
    return this.userRepo.delete(id)
  }
}
