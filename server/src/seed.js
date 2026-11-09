import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Election } from './models.js';
import { log } from './audit.js';

await mongoose.connect(process.env.MONGODB_URI);

const hash = (p) => bcrypt.hash(p, 10);
const adminId = (process.env.ADMIN_ID || 'admin').toLowerCase();

if (!(await User.exists({ voterId: adminId }))) {
  await User.create({
    voterId: adminId, name: 'Election Admin', role: 'admin',
    passwordHash: await hash(process.env.ADMIN_PASSWORD || 'Admin@12345'),
  });
  console.log(`Created admin "${adminId}"`);
}

for (const [i, name] of ['Asha Rao', 'Ravi Kumar'].entries()) {
  const voterId = `voter${i + 1}`;
  if (!(await User.exists({ voterId }))) {
    await User.create({ voterId, name, role: 'voter', passwordHash: await hash('Voter@12345') });
    console.log(`Created ${voterId}`);
  }
}

if (!(await Election.countDocuments())) {
  const now = Date.now();
  await Election.create({
    title: 'Student Council President',
    description: 'Choose one candidate for this year\'s council president.',
    kind: 'candidates',
    options: [
      { name: 'Meera Nair', description: 'Campus sustainability and study spaces' },
      { name: 'Karthik Reddy', description: 'Sports funding and club budgets' },
      { name: 'Farah Khan', description: 'Mental health support and open hours' },
    ],
    startsAt: new Date(now - 3600_000),
    endsAt: new Date(now + 7 * 86400_000),
  });
  console.log('Created sample election');
}

await log('SEED_COMPLETED', 'system');
await mongoose.disconnect();
