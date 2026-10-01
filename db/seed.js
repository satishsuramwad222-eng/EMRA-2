require('dotenv').config();
const bcrypt = require('bcryptjs');
const { collection } = require('./store');
const config = require('../config/config');
const { generateProductId } = require('../utils/idGenerator');

const admins = collection('admins');
const products = collection('products');

async function seedAdmin() {
  const existing = admins.findOne((a) => a.email === config.adminEmail.toLowerCase());
  if (existing) {
    console.log(`[seed] Admin already exists: ${config.adminEmail}`);
    return;
  }
  const passwordHash = await bcrypt.hash(config.adminPassword, config.bcryptSaltRounds);
  admins.insert({
    id: 'ADM-000001',
    email: config.adminEmail.toLowerCase(),
    passwordHash,
    name: 'Store Admin',
    createdAt: new Date().toISOString(),
  });
  console.log(`[seed] Created admin ${config.adminEmail} (change the password after first login!)`);
}

function seedProducts() {
  if (products.readAll().length > 0) {
    console.log('[seed] Products already exist, skipping product seed.');
    return;
  }
  const now = new Date().toISOString();
  const sample = [
    {
      name: 'Traditional Wedding Invitation Card',
      category: 'Marriage Cards',
      price: 499,
      description: 'Elegant traditional wedding invitation card with gold foil detailing, customizable text, and premium cardstock.',
      image: '/img/placeholder-product.svg',
      stock: 10,
      gstPercent: 12,
      discountPercent: 0,
    },
    {
      name: 'Floral Theme Invitation Card',
      category: 'Invitation Cards',
      price: 349,
      description: 'Vibrant floral-themed invitation card suitable for birthdays, anniversaries and engagements.',
      image: '/img/placeholder-product.svg',
      stock: 25,
      gstPercent: 12,
      discountPercent: 10,
    },
    {
      name: 'Wireless Bluetooth Headphones',
      category: 'Electronics',
      price: 1999,
      description: 'Over-ear wireless headphones with 30-hour battery life, deep bass and a foldable design.',
      image: '/img/placeholder-product.svg',
      stock: 40,
      gstPercent: 18,
      discountPercent: 15,
    },
    {
      name: 'Smart Fitness Band',
      category: 'Electronics',
      price: 1499,
      description: 'Track steps, heart rate and sleep with a 7-day battery life and a vivid AMOLED display.',
      image: '/img/placeholder-product.svg',
      stock: 0,
      gstPercent: 18,
      discountPercent: 0,
    },
    {
      name: "Men's Cotton Casual Shirt",
      category: 'Clothes',
      price: 899,
      description: 'Breathable 100% cotton casual shirt, regular fit, available in multiple colors.',
      image: '/img/placeholder-product.svg',
      stock: 60,
      gstPercent: 5,
      discountPercent: 20,
    },
    {
      name: 'Running Shoes - Air Cushion',
      category: 'Shoes',
      price: 2499,
      description: 'Lightweight running shoes with breathable mesh upper and shock-absorbing sole.',
      image: '/img/placeholder-product.svg',
      stock: 18,
      gstPercent: 18,
      discountPercent: 0,
    },
    {
      name: 'Stainless Steel Kitchen Knife Set',
      category: 'Home & Kitchen',
      price: 1299,
      description: 'Set of 5 stainless steel kitchen knives with an ergonomic non-slip handle and wooden block.',
      image: '/img/placeholder-product.svg',
      stock: 30,
      gstPercent: 12,
      discountPercent: 0,
    },
    {
      name: 'Herbal Face Wash - 100ml',
      category: 'Beauty',
      price: 249,
      description: 'Gentle herbal face wash with neem and aloe vera extracts for daily use.',
      image: '/img/placeholder-product.svg',
      stock: 100,
      gstPercent: 18,
      discountPercent: 5,
    },
    {
      name: 'Premium Basmati Rice - 5kg',
      category: 'Grocery',
      price: 599,
      description: 'Long-grain aged basmati rice, aromatic and perfect for everyday meals and special occasions.',
      image: '/img/placeholder-product.svg',
      stock: 50,
      gstPercent: 5,
      discountPercent: 0,
    },
    {
      name: 'Leather Wallet for Men',
      category: 'Accessories',
      price: 799,
      description: 'Genuine leather bi-fold wallet with multiple card slots and a coin pocket.',
      image: '/img/placeholder-product.svg',
      stock: 45,
      gstPercent: 18,
      discountPercent: 0,
    },
  ];

  sample.forEach((p) => {
    products.insert({ id: generateProductId(), status: 'active', createdAt: now, ...p });
  });
  console.log(`[seed] Inserted ${sample.length} sample products.`);
}

async function main() {
  await seedAdmin();
  seedProducts();
  console.log('[seed] Done.');
}

main();
