/**
 * Upserts data/rubric.json into the rubric_criteria table.
 * Run after applying supabase/migrations/0001_init.sql and whenever
 * data/rubric.json changes:
 *
 *   npm run seed:rubric
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import rubric from '../data/rubric.json';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'
  );
  process.exit(1);
}

const supabase = createClient(url, key);

type Criterion = {
  sort_order: number;
  name: string;
  weight: number;
  description: string;
  anchor_5: string;
  anchor_3: string;
  anchor_1: string;
};

async function seedRole(role: 'PM' | 'SPM', criteria: Criterion[]) {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight !== 100) {
    throw new Error(
      `${role} rubric weights sum to ${totalWeight}, not 100 — fix data/rubric.json`
    );
  }

  const rows = criteria.map((c) => ({ role, ...c }));
  const { error } = await supabase
    .from('rubric_criteria')
    .upsert(rows, { onConflict: 'role,name' });

  if (error) throw error;
  console.log(`Seeded ${criteria.length} ${role} criteria (weights sum to 100).`);
}

async function main() {
  await seedRole('PM', rubric.PM as Criterion[]);
  await seedRole('SPM', rubric.SPM as Criterion[]);
  console.log('Rubric seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
