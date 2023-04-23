import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { AppService } from "./app.service";
import { Express } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import * as fs from "fs";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  home() {
    return "Palette API Home";
  }

  @Post('link')
  async imageByLink(@Body('image') image, @Body('size') paletteSize, @Body('variance') variance): Promise<any> {
    return await this.appService.main(image, paletteSize, variance);
  }

  @Post('file')
  @UseInterceptors(FileInterceptor('image', {
    dest: "./images"
  }))
  async imageByFile(@UploadedFile() image: Express.Multer.File, @Body('size') paletteSize, @Body('variance') variance) {
    if (!image?.path) return "No image Passed";
    const palettes = await this.appService.main(image.path, paletteSize, variance);
    await fs.unlinkSync(image.path);
    return palettes;
  }
}
