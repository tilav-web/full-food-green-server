import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { SeedService } from "./seed.service"
import { User } from "../../entities/user.entity"
import { Category } from "../../entities/category.entity"
import { Product } from "../../entities/product.entity"
import { Combo } from "../../entities/combo.entity"
import { Unit } from "../../entities/unit.entity"
import { Setting } from "../../entities/setting.entity"
import { Banner } from "../../entities/banner.entity"

@Module({
  imports: [TypeOrmModule.forFeature([User, Category, Product, Combo, Unit, Setting, Banner])],
  providers: [SeedService],
})
export class SeedModule {}
