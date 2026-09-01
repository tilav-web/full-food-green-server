import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { PassportModule } from "@nestjs/passport"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { JwtStrategy } from "./jwt.strategy"
import { User } from "../../entities/user.entity"

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: "FULLFOOD_SECRET_KEY_2026_LOWRAM",
      signOptions: { expiresIn: "30d" },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
