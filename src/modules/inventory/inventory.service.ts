import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { InventoryLog } from "../../entities/inventory-log.entity"
import { Product } from "../../entities/product.entity"
import { OrderItem } from "../../entities/order-item.entity"

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryLog) private logRepo: Repository<InventoryLog>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>
  ) {}

  // 1. Record incoming stock (Kirim qilish) - masalan har kuni ertalab 20 ta somsa, 40 ta manti
  async recordKirim(data: {
    productId: string
    quantity: number
    costPrice?: number
    supplier?: string
    note?: string
    createdBy?: string
  }) {
    if (data.quantity <= 0) {
      throw new BadRequestException("Miqdor 0 dan katta bo'lishi kerak")
    }

    const product = await this.productRepo.findOne({ where: { id: data.productId } })
    if (!product) {
      throw new NotFoundException("Mahsulot topilmadi")
    }

    const previousStock = product.stockQuantity || 0
    const newStock = previousStock + data.quantity

    // Update product stock
    product.stockQuantity = newStock
    await this.productRepo.save(product)

    // Save inventory log
    const log = this.logRepo.create({
      productId: data.productId,
      type: "KIRIM",
      quantity: data.quantity,
      previousStock,
      newStock,
      costPrice: data.costPrice,
      supplier: data.supplier || "Kundalik Ta'minotchi",
      note: data.note || `${data.quantity} dona kirim qilindi`,
      createdBy: data.createdBy || "Kassir",
    })

    return this.logRepo.save(log)
  }

  // 2. Decrement stock on sale (Avtomatik sotuvda kamaytirish)
  async decrementStock(productId: string, quantity: number, orderNumber: string) {
    const product = await this.productRepo.findOne({ where: { id: productId } })
    if (!product || product.type !== "FIXED_COUNT") return

    const previousStock = product.stockQuantity || 0
    const newStock = Math.max(0, previousStock - quantity)

    product.stockQuantity = newStock
    await this.productRepo.save(product)

    await this.logRepo.save({
      productId,
      type: "SOTUV",
      quantity,
      previousStock,
      newStock,
      note: `Buyurtma #${orderNumber} orqali sotildi`,
      createdBy: "Tizim (Sotuv)",
    })
  }

  // 3. Get all inventory logs
  async getLogs(limit = 50) {
    return this.logRepo.find({
      relations: ["product"],
      order: { createdAt: "DESC" },
      take: limit,
    })
  }

  // 4. Get Fixed-Count Items Stock Status
  async getStockStatus() {
    const fixedItems = await this.productRepo.find({
      where: { type: "FIXED_COUNT", isActive: true },
      relations: ["category"],
      order: { name: "ASC" },
    })

    return fixedItems.map((item) => ({
      id: item.id,
      name: item.name,
      stockQuantity: item.stockQuantity,
      unitName: item.unitName,
      price: item.price,
      isLowStock: item.stockQuantity < 5,
    }))
  }

  // 5. Portion sales summary (Sotilgan porsiyalar hisob-kitobi)
  async getPortionSalesSummary() {
    const items = await this.orderItemRepo
      .createQueryBuilder("item")
      .select("item.name", "name")
      .addSelect("SUM(item.quantity * item.portionCount)", "totalPortions")
      .addSelect("SUM(item.totalPrice)", "totalRevenue")
      .groupBy("item.name")
      .orderBy("totalPortions", "DESC")
      .getRawMany()

    return items
  }
}
