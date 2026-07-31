import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

const WEAK_JWT_SECRETS = new Set([
  'fallback-secret-change-in-production',
  'dev-jwt-secret-change-in-production',
  '',
]);

function assertSecureStartup(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET || '';
  if (WEAK_JWT_SECRETS.has(secret) || secret.length < 32) {
    throw new Error(
      'Refusing to start in production: JWT_SECRET must be set to a strong ' +
        'random value (>= 32 chars). Generate one with: openssl rand -hex 32',
    );
  }
}

async function bootstrap() {
  // Fail fast before the app binds any port if a weak secret would ship.
  assertSecureStartup();

  const app = await NestFactory.create(AppModule);

  // Security headers (helmet was installed but never wired)
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'v',
    defaultVersion: '1',
  });

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('THULIR03 LIMS API')
    .setDescription('Laboratory Information Management System — REST API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addServer('/api')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Global prefix
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  const port = process.env.API_PORT || 3001;
  const host = process.env.API_HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`🚀 THULIR03 API running on http://${host}:${port}`);
  console.log(`📚 API docs at http://${host}:${port}/api/docs`);
}

void bootstrap();
