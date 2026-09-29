/* Seed akun admin default untuk NeighborCraft.
 * Cara pakai: node seed-admin.cjs
 * Env opsional: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME || 'Admin NeighborCraft';
  const email = process.env.ADMIN_EMAIL || 'admin@neighborcraft.id';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
      console.log(`User ${email} sudah ada, role diangkat menjadi ADMIN.`);
    } else {
      console.log(`Admin ${email} sudah ada, tidak ada perubahan.`);
    }
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { name, email, password: hashed, role: 'ADMIN' },
  });

  console.log('Admin default berhasil dibuat:');
  console.log(`- Nama : ${admin.name}`);
  console.log(`- Email: ${admin.email}`);
  console.log(`- Pass : ${password} (ganti setelah login pertama)`);
}

main()
  .catch((e) => {
    console.error('Seed admin gagal:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
