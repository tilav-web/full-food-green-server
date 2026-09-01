import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { Logger } from "@nestjs/common"

async function bootstrap() {
  const logger = new Logger("FullFoodBootstrap")
  const app = await NestFactory.create(AppModule)

  // Global prefix
  app.setGlobalPrefix("api")

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  })

  const port = process.env.PORT || 5000
  await app.listen(port)
  logger.log(`🚀 Full Food NestJS Server is running on: http://localhost:${port}/api`)
}
bootstrap()
