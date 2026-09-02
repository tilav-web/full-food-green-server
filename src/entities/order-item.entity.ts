import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { Order } from "./order.entity"

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  orderId: string

  @ManyToOne(() => Order, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order: Order

  @Column({ nullable: true })
  productId: string

  @Column({ nullable: true })
  comboId: string

  @Column()
  name: string

  @Column({ type: "integer", default: 1 })
  quantity: number

  @Column({ type: "integer", default: 1 })
  portionCount: number // Agar porsiyali taom bo'lsa (masalan 2 qoshiq guruch)

  @Column({ type: "real", default: 0 })
  unitPrice: number

  @Column({ type: "real", default: 0 })
  totalPrice: number

  @Column({ type: "real", default: 0 })
  costPrice: number // 1 birlik tannarxi (sotuv paytidagi tannarx)

  @Column({ type: "real", default: 0 })
  totalCost: number // jami tannarx (quantity * portionCount * costPrice)

  @Column({ type: "text", nullable: true })
  customPlateJson: string // Agar bu Konstruktor orqali yig'ilgan tovoq bo'lsa
}
