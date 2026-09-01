import { Controller, Post, Body } from "@nestjs/common"
import { DeliveryService } from "./delivery.service"

@Controller("delivery")
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post("estimate")
  async estimate(@Body() body: { latitude: number; longitude: number }) {
    return this.deliveryService.estimateDeliveryFee(body.latitude, body.longitude)
  }

  @Post("dispatch-yandex")
  async dispatchYandex(
    @Body()
    body: {
      orderNumber: string
      customerName: string
      customerPhone: string
      address: string
      latitude?: number
      longitude?: number
    }
  ) {
    return this.deliveryService.dispatchYandexTaxi(body)
  }
}
