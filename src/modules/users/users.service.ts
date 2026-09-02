import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import * as bcrypt from "bcryptjs"
import { User, UserRole } from "../../entities/user.entity"
import { BalanceTransaction, BalanceTransactionType } from "../../entities/balance-transaction.entity"

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(BalanceTransaction) private balanceTxRepo: Repository<BalanceTransaction>,
  ) {}

  async findAllPaginated(params: {
    page?: number
    limit?: number
    search?: string
    role?: string
    botStatus?: "ALL" | "ACTIVE" | "BLOCKED"
  }) {
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20))
    const skip = (page - 1) * limit

    const qb = this.userRepo.createQueryBuilder("user")

    if (params.role && params.role !== "ALL") {
      qb.andWhere("user.role = :role", { role: params.role })
    }

    if (params.botStatus === "ACTIVE") {
      qb.andWhere("user.telegramId IS NOT NULL AND user.isBotActive = :botActive", { botActive: true })
    } else if (params.botStatus === "BLOCKED") {
      qb.andWhere("user.telegramId IS NOT NULL AND user.isBotActive = :botActive", { botActive: false })
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
    const activeBot = await this.userRepo
      .createQueryBuilder("u")
      .where("u.telegramId IS NOT NULL AND u.isBotActive = 1")
      .getCount()
    const blockedBot = await this.userRepo
      .createQueryBuilder("u")
      .where("u.telegramId IS NOT NULL AND u.isBotActive = 0")
      .getCount()
    return { all, users, cashiers, admins, activeBot, blockedBot }
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

  async updateStaffCredentials(
    id: string,
    data: {
      username?: string
      fullName?: string
      phone?: string
      password?: string
    }
  ) {
    const user = await this.userRepo.findOne({ where: { id } })
    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi")
    }

    if (data.username && data.username.trim() && data.username.trim() !== user.username) {
      const existing = await this.userRepo.findOne({ where: { username: data.username.trim() } })
      if (existing && existing.id !== id) {
        throw new BadRequestException("Ushbu login band")
      }
      user.username = data.username.trim()
    }

    if (data.fullName && data.fullName.trim()) {
      user.fullName = data.fullName.trim()
    }

    if (data.phone !== undefined) {
      user.phone = data.phone?.trim() || null
    }

    if (data.password && data.password.trim()) {
      if (data.password.trim().length < 4) {
        throw new BadRequestException("Parol kamida 4 ta belgidan iborat bo'lishi kerak")
      }
      user.password = await bcrypt.hash(data.password.trim(), 8)
    }

    const saved = await this.userRepo.save(user)

    return {
      id: saved.id,
      username: saved.username,
      fullName: saved.fullName,
      phone: saved.phone,
      role: saved.role,
    }
  }

  async findById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } })
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi")
    return user
  }

  async adjustBalance(
    userId: string,
    dto: {
      amount: number
      type: BalanceTransactionType
      note?: string
      performedBy?: string
      orderId?: string
    }
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi")
    }

    const currentBalance = Number(user.balance || 0)
    const newBalance = Math.round((currentBalance + Number(dto.amount)) * 100) / 100

    if (newBalance < 0) {
      throw new BadRequestException(
        `Balansda yetarli mablag' mavjud emas. Joriy balans: ${currentBalance.toLocaleString()} so'm`
      )
    }

    user.balance = newBalance
    await this.userRepo.save(user)

    const tx = this.balanceTxRepo.create({
      userId,
      amount: Number(dto.amount),
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      type: dto.type,
      note: dto.note,
      performedBy: dto.performedBy || "Tizim",
      orderId: dto.orderId,
    })

    const savedTx = await this.balanceTxRepo.save(tx)

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        balance: user.balance,
      },
      transaction: savedTx,
    }
  }

  async getBalanceHistory(userId: string) {
    return this.balanceTxRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 50,
    })
  }
}

