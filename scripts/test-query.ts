import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
    const { data, error } = await supabase
        .from('LessonFeedback')
        .select(`
            *,
            UserRole:userId (
                email
            )
        `);
    console.log(data, error);
}
main();
