require('dotenv').config();
const db = require('../prismaClient');

async function main() {
  await db.$ping();
  console.log('MongoDB connection OK');
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error('MongoDB connection failed');
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
