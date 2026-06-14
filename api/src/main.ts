import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup';

/**
 * Local development entry point: `npm run start:dev`.
 * On Vercel the app is bootstrapped by ../index.ts instead.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
