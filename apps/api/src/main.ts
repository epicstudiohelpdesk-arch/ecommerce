import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  const globalPrefix = process.env['API_PREFIX'] || 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  const allowedOrigins = (process.env['ALLOWED_ORIGINS'] || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = process.env['PORT'] || 4000;
  await app.listen(port);
}

if (process.env['NODE_ENV'] !== 'test') {
  bootstrap().catch((err) => {
    console.error('Fatal API bootstrap error:', err);
    process.exit(1);
  });
}
