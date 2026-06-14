import dotenv from 'dotenv';
dotenv.config();
import connectMongoDB from '../lib/mongodb';
import { triggerDailyExpansionNow } from '../cron/dailyDictionaryExpander';

async function test() {
  try {
    await connectMongoDB();
    await triggerDailyExpansionNow();
    process.exit(0);
  } catch (e) {
    console.error('FATAL:', e);
    process.exit(1);
  }
}
test();
