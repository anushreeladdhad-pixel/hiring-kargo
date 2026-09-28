/**
 * Loads data/jd_pm.txt and data/jd_spm.txt into role_context.
 * These are used ONLY to help write the "what to probe" line in interview
 * briefs — never as scoring input. Run once after migrating:
 *
 *   npm run seed:jds
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const roles: Array<{ role: 'PM' | 'SPM'; file: string }> = [
    { role: 'PM', file: 'jd_pm.txt' },
    { role: 'SPM', file: 'jd_spm.txt' },
  ];

  for (const { role, file } of roles) {
    const jd_text = readFileSync(join(__dirname, '..', 'data', file), 'utf-8');
    const { error } = await supabase
      .from('role_context')
      .upsert({ role, jd_text }, { onConflict: 'role' });
    if (error) throw error;
    console.log(`Seeded JD for ${role} (${jd_text.length} chars).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
