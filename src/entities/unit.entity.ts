import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("units")
export class Unit {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  name: string // masalan: 'dona', 'pors', 'qoshiq', 'kg', 'gram', 'stakan', 'litr'

  @Column({ nullable: true })
  shortName: string // masalan: 'ta', 'pors', 'qsh', 'kg', 'g', 'st', 'l'

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
