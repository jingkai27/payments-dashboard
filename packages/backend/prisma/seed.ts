import { PrismaClient, UserRole, Currency, ProviderStatus, PaymentMethodType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('Starting seed...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@payment-orchestration.com' },
    update: {},
    create: {
      email: 'admin@payment-orchestration.com',
      passwordHash: hashPassword('admin123!'),
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log(`Created admin user: ${adminUser.email}`);

  // Create operator user
  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@payment-orchestration.com' },
    update: {},
    create: {
      email: 'operator@payment-orchestration.com',
      passwordHash: hashPassword('operator123!'),
      firstName: 'Jane',
      lastName: 'Operator',
      role: UserRole.OPERATOR,
      isActive: true,
    },
  });
  console.log(`Created operator user: ${operatorUser.email}`);

  // Create payment providers
  const stripeProvider = await prisma.paymentProvider.upsert({
    where: { code: 'stripe' },
    update: {},
    create: {
      name: 'Stripe',
      code: 'stripe',
      status: ProviderStatus.ACTIVE,
      supportedCurrencies: [
        Currency.USD,
        Currency.EUR,
        Currency.GBP,
        Currency.SGD,
        Currency.JPY,
        Currency.AUD,
        Currency.CAD,
      ],
      supportedMethods: [
        PaymentMethodType.CARD,
        PaymentMethodType.BANK_TRANSFER,
        PaymentMethodType.DIGITAL_WALLET,
      ],
      baseUrl: 'https://api.stripe.com/v1',
      config: {
        apiVersion: '2023-10-16',
        webhookEndpoint: '/webhooks/stripe',
      },
      isActive: true,
    },
  });
  console.log(`Created provider: ${stripeProvider.name}`);

  const paypalProvider = await prisma.paymentProvider.upsert({
    where: { code: 'paypal' },
    update: {},
    create: {
      name: 'PayPal',
      code: 'paypal',
      status: ProviderStatus.ACTIVE,
      supportedCurrencies: [
        Currency.USD,
        Currency.EUR,
        Currency.GBP,
        Currency.AUD,
        Currency.CAD,
      ],
      supportedMethods: [
        PaymentMethodType.DIGITAL_WALLET,
        PaymentMethodType.BANK_TRANSFER,
      ],
      baseUrl: 'https://api.paypal.com/v2',
      config: {
        environment: 'sandbox',
        webhookEndpoint: '/webhooks/paypal',
      },
      isActive: true,
    },
  });
  console.log(`Created provider: ${paypalProvider.name}`);

  // Create sample merchant
  const demoMerchant = await prisma.merchant.upsert({
    where: { email: 'merchant@demo.com' },
    update: {},
    create: {
      name: 'Demo Store',
      legalName: 'Demo Store Inc.',
      email: 'merchant@demo.com',
      defaultCurrency: Currency.USD,
      settings: {
        autoCapture: true,
        webhookUrl: 'https://demo.com/webhooks',
        notificationEmail: 'notifications@demo.com',
      },
      metadata: {
        industry: 'e-commerce',
        website: 'https://demo.com',
      },
      isActive: true,
    },
  });
  console.log(`Created merchant: ${demoMerchant.name}`);

  // Create merchant provider configs
  await prisma.merchantProviderConfig.upsert({
    where: {
      merchantId_providerId: {
        merchantId: demoMerchant.id,
        providerId: stripeProvider.id,
      },
    },
    update: {},
    create: {
      merchantId: demoMerchant.id,
      providerId: stripeProvider.id,
      credentials: {
        // These would be encrypted in production
        secretKey: 'sk_test_demo',
        publishableKey: 'pk_test_demo',
      },
      settings: {
        statementDescriptor: 'DEMO STORE',
      },
      priority: 1,
      isActive: true,
    },
  });
  console.log(`Created Stripe config for ${demoMerchant.name}`);

  await prisma.merchantProviderConfig.upsert({
    where: {
      merchantId_providerId: {
        merchantId: demoMerchant.id,
        providerId: paypalProvider.id,
      },
    },
    update: {},
    create: {
      merchantId: demoMerchant.id,
      providerId: paypalProvider.id,
      credentials: {
        clientId: 'demo_client_id',
        clientSecret: 'demo_client_secret',
      },
      settings: {
        brandName: 'Demo Store',
      },
      priority: 2,
      isActive: true,
    },
  });
  console.log(`Created PayPal config for ${demoMerchant.name}`);

  // Create sample customer
  const demoCustomer = await prisma.customer.upsert({
    where: {
      merchantId_externalId: {
        merchantId: demoMerchant.id,
        externalId: 'cust_demo_001',
      },
    },
    update: {},
    create: {
      merchantId: demoMerchant.id,
      externalId: 'cust_demo_001',
      email: 'customer@example.com',
      name: 'John Doe',
      metadata: {
        signupDate: new Date().toISOString(),
        tier: 'premium',
      },
      isActive: true,
    },
  });
  console.log(`Created customer: ${demoCustomer.email}`);

  // Create sample FX rates
  const fxPairs: Array<{ source: Currency; target: Currency; rate: number }> = [
    { source: Currency.USD, target: Currency.EUR, rate: 0.92 },
    { source: Currency.USD, target: Currency.GBP, rate: 0.79 },
    { source: Currency.USD, target: Currency.SGD, rate: 1.34 },
    { source: Currency.USD, target: Currency.JPY, rate: 149.5 },
    { source: Currency.EUR, target: Currency.USD, rate: 1.09 },
    { source: Currency.GBP, target: Currency.USD, rate: 1.27 },
  ];

  for (const pair of fxPairs) {
    const spread = 0.005; // 0.5% spread
    const effectiveRate = pair.rate * (1 + spread);

    await prisma.fxRate.upsert({
      where: {
        sourceCurrency_targetCurrency_validFrom: {
          sourceCurrency: pair.source,
          targetCurrency: pair.target,
          validFrom: new Date('2024-01-01'),
        },
      },
      update: {
        rate: pair.rate,
        effectiveRate,
      },
      create: {
        sourceCurrency: pair.source,
        targetCurrency: pair.target,
        rate: pair.rate,
        spread,
        effectiveRate,
        source: 'seed',
        validFrom: new Date('2024-01-01'),
        isActive: true,
      },
    });
    console.log(`Created FX rate: ${pair.source}/${pair.target} = ${pair.rate}`);
  }

  // Create routing rules
  await prisma.routingRule.upsert({
    where: { id: 'rule_usd_stripe' },
    update: {},
    create: {
      id: 'rule_usd_stripe',
      merchantId: demoMerchant.id,
      name: 'USD transactions to Stripe',
      description: 'Route all USD transactions to Stripe for best rates',
      conditions: {
        currency: 'USD',
        amountMin: 0,
        amountMax: 1000000,
      },
      providerId: stripeProvider.id,
      priority: 1,
      isActive: true,
    },
  });
  console.log('Created routing rule: USD to Stripe');

  await prisma.routingRule.upsert({
    where: { id: 'rule_eur_stripe' },
    update: {},
    create: {
      id: 'rule_eur_stripe',
      merchantId: demoMerchant.id,
      name: 'EUR transactions to Stripe',
      description: 'Route all EUR transactions to Stripe',
      conditions: {
        currency: 'EUR',
      },
      providerId: stripeProvider.id,
      priority: 1,
      isActive: true,
    },
  });
  console.log('Created routing rule: EUR to Stripe');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
