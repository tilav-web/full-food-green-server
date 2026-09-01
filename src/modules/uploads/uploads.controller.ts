import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import * as path from "path"
import * as fs from "fs"

const uploadDir = path.resolve(__dirname, "../../../uploads")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

@Controller("uploads")
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || ".jpg"
          const uniqueName = `receipt_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`
          cb(null, uniqueName)
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    })
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuklanmadi")
    }
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    }
  }
}
