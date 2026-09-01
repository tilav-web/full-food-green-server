import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Product } from "./product.entity"

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ unique: true })
  slug: string

  @Column({ default: "Utensils" })
  icon: string

  @Column({ nullable: true })
  imageUrl: string // Kategoriya rasmi

  @Column({ default: 0 })
  sortOrder: number

  @OneToMany(() => Product, (product) => product.category)
  products: Product[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
