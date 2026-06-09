import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
    const { data, error } = await supabase
        .from('Bootcamp')
        .select('*')
        .limit(1);
    console.log(data, error);
}
main();
