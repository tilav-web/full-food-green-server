import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Category } from "./category.entity"
import { Unit } from "./unit.entity"

export type ProductType = "FIXED_COUNT" | "PORTION_BASED"

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ nullable: true })
  slug: string

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true })
  categoryId: string

  @ManyToOne(() => Category, (category) => category.products, { onDelete: "SET NULL" })
  @JoinColumn({ name: "categoryId" })
  category: Category

  @Column({ nullable: true })
  unitId: string

  @ManyToOne(() => Unit, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "unitId" })
  unit: Unit

  @Column({ type: "text", default: "PORTION_BASED" })
  type: ProductType // FIXED_COUNT = sanoqli (somsa, manti), PORTION_BASED = porsiyali (guruch, go'sht)

  @Column({ type: "real", default: 0 })
  price: number // Joriy sotuv narxi

  @Column({ type: "real", default: 0 })
  costPrice: number // Taomning tannarxi (masalliq / kirim narxi)

  @Column({ type: "integer", default: 2 })
  packagingLevel: number // Qadoqlash darajasi (0 - 5 ball, bitta idish sig'imi 5 ball)

  @Column({ type: "real", nullable: true })
  oldPrice: number // Skitka/eski narxi (agar mavjud bo'lsa)

  @Column({ type: "integer", default: 0 })
  stockQuantity: number // Faqat FIXED_COUNT uchun dolzarb qoldiq

  // Kaloriya & KBDU (100g yoki 1 porsiya uchun)
  @Column({ type: "real", default: 0 })
  calories: number

  @Column({ type: "real", default: 0 })
  protein: number

  @Column({ type: "real", default: 0 })
  fat: number

  @Column({ type: "real", default: 0 })
  carbs: number

  @Column({ nullable: true })
  imageUrl: string

  @Column({ default: true })
  isActive: boolean

  @Column({ type: "text", default: "pors" }) // Birligi nomi: 'dona', 'pors', 'qoshiq', 'kg', 'gram'
  unitName: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
