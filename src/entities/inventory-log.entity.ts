import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm"
import { Product } from "./product.entity"

export type InventoryLogType = "KIRIM" | "SOTUV" | "HISOBDAN_CHIQARISH" | "TUZATISH"

@Entity("inventory_logs")
export class InventoryLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  productId: string

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product: Product

  @Column({ type: "text" })
  type: InventoryLogType // KIRIM = yangi kelgan taomlar (masalan: 20 ta somsa, 40 ta manti)

  @Column({ type: "integer" })
  quantity: number

  @Column({ type: "integer", default: 0 })
  previousStock: number

  @Column({ type: "integer", default: 0 })
  newStock: number

  @Column({ type: "real", nullable: true })
  costPrice: number // Kelish tan narxi (ixtiyoriy)

  @Column({ nullable: true })
  supplier: string // Yetkazib beruvchi (masalan "Parhez Somsa Seh")

  @Column({ nullable: true })
  note: string

  @Column({ nullable: true })
  createdBy: string // Kassir yoki Admin ismi

  @CreateDateColumn()
  createdAt: Date
}
