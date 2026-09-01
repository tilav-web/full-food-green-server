import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"
import { Logger } from "@nestjs/common"

async function bootstrap() {
  const logger = new Logger("FullFoodBootstrap")
  const app = await NestFactory.create(AppModule)

  // Global prefix
  app.setGlobalPrefix("api")

  // Enable Comprehensive CORS for WebApp, Vercel, and Localhost
  app.enableCors({
    origin: (origin, callback) => {
      // Allow Telegram WebApp webview (origin may be undefined) and any vercel/localhost domain
      if (!origin) return callback(null, true)
      if (
        origin.includes("vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("hotel-familyhouse.uz") ||
        origin.includes("fullfood.uz")
      ) {
        return callback(null, true)
      }
      return callback(null, true)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "X-Requested-With"],
  })

  const port = process.env.PORT || 5000
  await app.listen(port)
  logger.log(`🚀 Full Food NestJS Server is running on: http://localhost:${port}/api`)
}
bootstrap()
