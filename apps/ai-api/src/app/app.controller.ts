// src/app.controller.ts
import { Controller, Post, Body, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller() // No need to specify the path here, globalPrefix will take care of '/api'
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post() // This now listens at '/api' due to the globalPrefix
  async handleQuery(@Body('query') query: string, @Res() res): Promise<any> {
    try {
      const responseText = await this.appService.processQuery(query);
      res.send({ message: responseText });
    } catch (error) {
      console.error(error);
      // Handle errors appropriately
      res.status(500).send({ error: 'Internal Server Error' });
    }
  }
}
