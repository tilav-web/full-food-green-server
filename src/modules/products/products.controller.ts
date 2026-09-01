import { Controller, Get, Post, Put, Delete, Body, Param, Query } from "@nestjs/common"
import { ProductsService } from "./products.service"
import { ProductType } from "../../entities/product.entity"

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get("categories")
  async getCategories() {
    return this.productsService.getAllCategories()
  }

  @Put("categories/reorder")
  async reorderCategories(@Body() body: { items: { id: string; sortOrder: number }[] }) {
    return this.productsService.reorderCategories(body.items)
  }

  @Post("categories")
  async createCategory(@Body() body: any) {
    return this.productsService.createCategory(body)
  }

  @Put("categories/:id")
  async updateCategory(@Param("id") id: string, @Body() body: any) {
    return this.productsService.updateCategory(id, body)
  }

  @Delete("categories/:id")
  async deleteCategory(@Param("id") id: string) {
    return this.productsService.deleteCategory(id)
  }

  @Get("combos")
  async getCombos() {
    return this.productsService.getAllCombos()
  }

  @Get("combos/slug/:slug")
  async getComboBySlug(@Param("slug") slug: string) {
    return this.productsService.getComboBySlug(slug)
  }

  @Post("combos")
  async createCombo(@Body() body: any) {
    return this.productsService.createCombo(body)
  }

  @Put("combos/:id")
  async updateCombo(@Param("id") id: string, @Body() body: any) {
    return this.productsService.updateCombo(id, body)
  }

  @Delete("combos/:id")
  async deleteCombo(@Param("id") id: string) {
    return this.productsService.deleteCombo(id)
  }

  @Get("slug/:slug")
  async getProductBySlug(@Param("slug") slug: string) {
    return this.productsService.getProductBySlug(slug)
  }

  @Get()
  async getProducts(
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
    @Query("type") type?: ProductType
  ) {
    return this.productsService.getAllProducts({ categoryId, search, type })
  }

  @Get(":id")
  async getProduct(@Param("id") id: string) {
    return this.productsService.getProductById(id)
  }

  @Post()
  async createProduct(@Body() body: any) {
    return this.productsService.createProduct(body)
  }

  @Put(":id")
  async updateProduct(@Param("id") id: string, @Body() body: any) {
    return this.productsService.updateProduct(id, body)
  }

  @Delete(":id")
  async deleteProduct(@Param("id") id: string) {
    return this.productsService.deleteProduct(id)
  }
}
