import { createClient } from '@supabase/supabase-js';
import { WorkDay } from '../types';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * SQL Schema recommendation for Supabase:
 * 
 * create table if not exists workdays (
 *   id text primary key, -- formatted as 'YYYY-MM-DD_Person Name'
 *   date text not null,
 *   person_name text not null,
 *   tasks jsonb not null default '[]'::jsonb,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Enable Row Level Security (RLS)
 * alter table workdays enable row level security;
 * 
 * -- Policies (Enable public access for anonymous users or adjust to authenticated users as needed)
 * create policy "Permitir lectura" on workdays for select using (true);
 * create policy "Permitir insercion" on workdays for insert with check (true);
 * create policy "Permitir actualizacion" on workdays for update using (true);
 * create policy "Permitir eliminacion" on workdays for delete using (true);
 */

// Helper to make the unique ID for each entry
export function getWorkDayId(date: string, personName: string): string {
  return `${date}_${personName.trim()}`;
}

// Fetch all workdays from Supabase
export async function fetchAllWorkDays(): Promise<WorkDay[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('workdays')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching workdays from Supabase:', error);
      throw error;
    }

    if (!data) return [];

    return data.map((item: any) => ({
      date: item.date,
      personName: item.person_name,
      tasks: typeof item.tasks === 'string' ? JSON.parse(item.tasks) : item.tasks,
    }));
  } catch (error) {
    console.error('Failed to fetch from Supabase, falling back to local.', error);
    throw error;
  }
}

// Upsert a workday to Supabase
export async function upsertWorkDay(workDay: WorkDay): Promise<void> {
  if (!supabase) return;

  const id = getWorkDayId(workDay.date, workDay.personName);
  
  try {
    const { error } = await supabase
      .from('workdays')
      .upsert({
        id,
        date: workDay.date,
        person_name: workDay.personName,
        tasks: workDay.tasks,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error upserting workday to Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to upsert to Supabase.', error);
    throw error;
  }
}

// Sync local data with Supabase
export async function syncLocalWithSupabase(localDays: WorkDay[]): Promise<WorkDay[]> {
  if (!supabase) return localDays;

  try {
    // 1. Fetch remote data from Supabase
    const remoteDays = await fetchAllWorkDays();
    
    // Create map of remote entries by ID
    const remoteMap = new Map<string, WorkDay>();
    remoteDays.forEach(day => {
      remoteMap.set(getWorkDayId(day.date, day.personName), day);
    });

    // Create map of local entries by ID
    const localMap = new Map<string, WorkDay>();
    localDays.forEach(day => {
      localMap.set(getWorkDayId(day.date, day.personName), day);
    });

    const mergedDays: WorkDay[] = [];
    const uploadQueue: WorkDay[] = [];

    // Check all unique IDs in both local and remote
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

    for (const id of allIds) {
      const local = localMap.get(id);
      const remote = remoteMap.get(id);

      if (local && !remote) {
        // Exists locally but not in Supabase -> Queue for upload
        uploadQueue.push(local);
        mergedDays.push(local);
      } else if (remote && !local) {
        // Exists in Supabase but not locally -> Keep remote
        mergedDays.push(remote);
      } else if (local && remote) {
        // Exists in both -> Let's check which has more tasks or resolve.
        // For a simple log, the one with more tasks or just merge tasks is safer.
        // Let's compare tasks length or use local as source of truth if we just edited.
        // Since we upsert on every edit, let's take the one with the maximum tasks count, 
        // or simply fallback to the Supabase one if they match, or local if it has more details.
        if (local.tasks.length >= remote.tasks.length) {
          if (local.tasks.length > remote.tasks.length) {
            uploadQueue.push(local);
          }
          mergedDays.push(local);
        } else {
          mergedDays.push(remote);
        }
      }
    }

    // Process uploads in background/sequential
    if (uploadQueue.length > 0) {
      console.log(`Syncing ${uploadQueue.length} local days to Supabase...`);
      await Promise.all(uploadQueue.map(day => upsertWorkDay(day)));
    }

    // Sort by date descending
    return mergedDays.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('Failed to sync. Returning local days.', error);
    return localDays;
  }
}
