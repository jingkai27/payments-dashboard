"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
function hashPassword(password) {
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
            role: client_1.UserRole.ADMIN,
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
            role: client_1.UserRole.OPERATOR,
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
            status: client_1.ProviderStatus.ACTIVE,
            supportedCurrencies: [
                client_1.Currency.USD,
                client_1.Currency.EUR,
                client_1.Currency.GBP,
                client_1.Currency.SGD,
                client_1.Currency.JPY,
                client_1.Currency.AUD,
                client_1.Currency.CAD,
            ],
            supportedMethods: [
                client_1.PaymentMethodType.CARD,
                client_1.PaymentMethodType.BANK_TRANSFER,
                client_1.PaymentMethodType.DIGITAL_WALLET,
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
            status: client_1.ProviderStatus.ACTIVE,
            supportedCurrencies: [
                client_1.Currency.USD,
                client_1.Currency.EUR,
                client_1.Currency.GBP,
                client_1.Currency.AUD,
                client_1.Currency.CAD,
            ],
            supportedMethods: [
                client_1.PaymentMethodType.DIGITAL_WALLET,
                client_1.PaymentMethodType.BANK_TRANSFER,
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
            defaultCurrency: client_1.Currency.USD,
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
    const fxPairs = [
        { source: client_1.Currency.USD, target: client_1.Currency.EUR, rate: 0.92 },
        { source: client_1.Currency.USD, target: client_1.Currency.GBP, rate: 0.79 },
        { source: client_1.Currency.USD, target: client_1.Currency.SGD, rate: 1.34 },
        { source: client_1.Currency.USD, target: client_1.Currency.JPY, rate: 149.5 },
        { source: client_1.Currency.EUR, target: client_1.Currency.USD, rate: 1.09 },
        { source: client_1.Currency.GBP, target: client_1.Currency.USD, rate: 1.27 },
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
//# sourceMappingURL=seed.js.map