import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ProductsService } from "./products.service"
import { ProductsController } from "./products.controller"
import { Product } from "../../entities/product.entity"
import { Category } from "../../entities/category.entity"
import { Combo } from "../../entities/combo.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, Combo])],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
