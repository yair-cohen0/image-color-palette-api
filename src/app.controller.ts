import {Body, Controller, Get, Param, Post} from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async getHello(@Body('imageURL') imageURL): Promise<any> {
    return await this.appService.main(imageURL);
  }
}
