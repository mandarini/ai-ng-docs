// src/app.controller.ts
import { Controller, Post, Body, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('/api')
  async handleQuery(@Body('query') query: string, @Res() res): Promise<any> {
    try {
      const responseText = await this.appService.processQuery(query);
      res.send({ message: responseText });
    } catch (error) {
      // Handle errors appropriately
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }
}
