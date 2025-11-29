import { createClient } from '@supabase/supabase-js';
import { Resident, ActivityLog, WhatsAppGroup } from '../types';
import { BotStatusResponse } from './database';

// CONFIGURATION
// We directly access import.meta.env properties to ensure Vite replaces them statically at build time.
// If VITE_BOT_SERVER_URL is not set in Netlify, we fallback to the hardcoded Railway URL.
const RAW_BOT_URL = (import.meta as any).env?.VITE_BOT_SERVER_URL || 'https://elderly-care-ai-production.up.railway.app';
const BOT_SERVER_URL = RAW_BOT_URL.endsWith('/') ? RAW_BOT_URL.slice(0, -1) : RAW_BOT_URL;

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://zaiektkvhjfndfebolao.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphaWVrdGt2aGpmbmRmZWJvbGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTM3NTEsImV4cCI6MjA3OTM2OTc1MX0.34BB18goOvIpwPci2u25JLoC7l9PRfanpC9C4DS4RfQ';

// --- HELPER FUNCTIONS ---

// Helper function to retry fetches with Exponential Backoff
// Retries up to 10 times to handle Supabase "Cold Starts" and "Connection Timeouts"
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 10, backoff = 500): Promise<Response> {
    try {
        const response = await fetch(url, options);
        
        // Retry on Server Errors (5xx) or Timeouts (408, 429)
        // 502/503/504 are common when Supabase is under load or waking up
        if (!response.ok && (response.status === 408 || response.status === 429 || response.status >= 500)) {
            const msg = `Server Error: ${response.status} ${response.statusText}`;
            console.warn(`[Network] ${msg}. Retrying...`);
            throw new Error(msg);
        }
        return response;
    } catch (error: any) {
        if (retries > 0) {
            // Exponential backoff: 500ms, 1000ms, 2000ms, 4000ms...
            const nextBackoff = backoff * 2;
            console.warn(`[Network] Fetch failed (${error.message}). Retrying in ${backoff}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, nextBackoff);
        }
        console.error("[Network] All retry attempts failed.");
        throw error;
    }
}

// Custom Fetch Wrapper for Supabase SDK to enable retries
const supabaseFetch = (url: RequestInfo | URL, options?: RequestInit) => {
    return fetchWithRetry(url.toString(), options || {});
}

// Initialize Client with Global Retry Logic
// This helps prevent "Connection terminated" errors by retrying failed requests automatically.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    global: {
        fetch: supabaseFetch
    }
});

export const LiveDB = {
  
  // --- RESIDENTS ---
  
  getResidents: async (): Promise<Resident[]> => {
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase Error fetching residents:', JSON.stringify(error, null, 2));
      throw new Error(error.message || "Failed to fetch residents. Check database connection.");
    }
    
    // Map DB fields to frontend types
    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      roomNumber: r.room_number,
      whatsappGroupId: r.whatsapp_group_id,
      photoUrl: r.photo_url,
      notes: r.notes
    }));
  },

  addResident: async (resident: Omit<Resident, 'id'>): Promise<Resident> => {
    const { data, error } = await supabase
      .from('residents')
      .insert([{
        name: resident.name,
        room_number: resident.roomNumber,
        whatsapp_group_id: resident.whatsappGroupId,
        photo_url: resident.photoUrl,
        notes: resident.notes
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error adding resident:', error);
      throw new Error(error.message);
    }
    
    return {
      id: data.id,
      name: data.name,
      roomNumber: data.room_number,
      whatsappGroupId: data.whatsapp_group_id,
      photoUrl: data.photo_url
    };
  },

  updateResident: async (id: string, updates: Partial<Resident>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.roomNumber) dbUpdates.room_number = updates.roomNumber;
    if (updates.whatsappGroupId) dbUpdates.whatsapp_group_id = updates.whatsappGroupId;
    if (updates.photoUrl) dbUpdates.photo_url = updates.photoUrl;
    if (updates.notes) dbUpdates.notes = updates.notes;

    const { error } = await supabase
      .from('residents')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Supabase Error updating resident:', error);
      throw new Error(error.message);
    }
  },

  deleteResident: async (id: string): Promise<void> => {
    // 1. Delete logs first to handle foreign key constraints manually
    const { error: logsError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('resident_id', id);

    if (logsError) {
        console.error('Error deleting resident logs:', logsError);
        throw new Error("Failed to clean up resident logs.");
    }

    // 2. Delete the resident
    const { error } = await supabase
      .from('residents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase Error deleting resident:', error);
      throw new Error(error.message);
    }
  },

  // --- LOGS & WHATSAPP ---

  createLog: async (logData: Omit<ActivityLog, 'id' | 'timestamp' | 'status'>): Promise<ActivityLog> => {
    // 1. Save to Database
    const { data, error } = await supabase
      .from('activity_logs')
      .insert([{
        resident_id: logData.residentId,
        resident_name: logData.residentName,
        staff_name: logData.staffName,
        category: logData.category,
        notes: logData.notes,
        image_urls: logData.imageUrls,
        status: 'PENDING', // Initially pending
        ai_generated_message: logData.aiGeneratedMessage
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error creating log:', error);
      throw new Error(error.message);
    }

    const newLog = data;
    
    // Fetch resident group ID freshly to ensure accuracy
    const { data: residentData } = await supabase
        .from('residents')
        .select('whatsapp_group_id')
        .eq('id', logData.residentId)
        .single();
        
    const residentGroupId = residentData?.whatsapp_group_id;

    // 2. Trigger WhatsApp Bot (The "Agent")
    let finalStatus = 'PENDING';
    
    // Check if we have anything to send (Text OR Images)
    const hasMessage = logData.aiGeneratedMessage && logData.aiGeneratedMessage.trim() !== '';
    const hasImages = logData.imageUrls && logData.imageUrls.length > 0;

    if (residentGroupId && (hasMessage || hasImages)) {
      try {
        console.log(`Attempting to send update to: ${BOT_SERVER_URL}`);
        
        // Use Fetch with Retry to handle sleeping servers or flaky networks
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/send-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: residentGroupId,
            message: logData.aiGeneratedMessage || '', // Send empty string if null, bot handles it
            imageUrls: logData.imageUrls
          })
        });

        if (response.ok) {
            finalStatus = 'SENT';
        } else {
            console.warn(`Bot server responded with ${response.status}: ${response.statusText}`);
            finalStatus = 'FAILED';
        }
      } catch (err: any) {
        console.warn(`Bot server unreachable at ${BOT_SERVER_URL}. Is it running?`, err);
        // Specialized error for "Failed to fetch" often meaning backend is sleeping/offline
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('Server Error'))) {
             console.error(`CRITICAL: Backend Server at ${BOT_SERVER_URL} is offline or sleeping.`);
        }
        finalStatus = 'FAILED';
      }
    } else if (residentGroupId) {
         // Group exists, but no content to send? (Rare edge case)
         finalStatus = 'SENT'; 
    }

    // Update status in DB if changed
    if (finalStatus !== 'PENDING') {
        await supabase
            .from('activity_logs')
            .update({ status: finalStatus })
            .eq('id', newLog.id);
    }

    return {
        ...logData,
        id: newLog.id,
        timestamp: newLog.created_at,
        status: finalStatus as any
    };
  },

  retryLog: async (log: ActivityLog): Promise<void> => {
     // Fetch resident group ID
    const { data: residentData } = await supabase
        .from('residents')
        .select('whatsapp_group_id, name')
        .eq('id', log.residentId)
        .single();
        
    const residentGroupId = residentData?.whatsapp_group_id;
    const residentName = residentData?.name || "Unknown";

    if (!residentGroupId) {
        throw new Error(`Resident "${residentName}" has no WhatsApp Group linked. Please edit the resident and select a group.`);
    }

    try {
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/send-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            groupId: residentGroupId,
            message: log.aiGeneratedMessage || '',
            imageUrls: log.imageUrls
            })
        });

        if (!response.ok) {
            throw new Error("Retry failed. Bot rejected the request.");
        }

        // Update status to SENT
        await supabase
            .from('activity_logs')
            .update({ status: 'SENT' })
            .eq('id', log.id);

    } catch (err: any) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error(`Connection Refused: The Bot Server (${BOT_SERVER_URL}) seems to be offline or sleeping. Please wake it up.`);
        }
        throw err;
    }
  },

  getLogs: async (): Promise<ActivityLog[]> => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Error fetching logs:', error);
      throw new Error(error.message);
    }

    return data.map((l: any) => ({
        id: l.id,
        residentId: l.resident_id,
        residentName: l.resident_name,
        staffName: l.staff_name,
        category: l.category,
        timestamp: l.created_at,
        notes: l.notes,
        imageUrls: l.image_urls || [],
        status: l.status,
        aiGeneratedMessage: l.ai_generated_message
    }));
  },

  deleteImageFromLog: async (logId: string, imageUrl: string): Promise<void> => {
    // 1. Fetch current log
    const { data: log, error: fetchError } = await supabase
      .from('activity_logs')
      .select('image_urls')
      .eq('id', logId)
      .single();

    if (fetchError || !log) throw new Error("Log not found to delete image");

    // 2. Filter array
    const currentUrls = log.image_urls || [];
    const newUrls = currentUrls.filter((url: string) => url !== imageUrl);

    // 3. Update log
    const { error: updateError } = await supabase
      .from('activity_logs')
      .update({ image_urls: newUrls })
      .eq('id', logId);

    if (updateError) throw new Error("Failed to delete image from log");
  },

  // --- GROUP DISCOVERY & BOT STATUS ---

  getWhatsAppGroups: async (): Promise<WhatsAppGroup[]> => {
    try {
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/groups`, {
            method: 'GET'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Bot Server Error (${response.status}): ${errorText}`);
        }
        return await response.json();
    } catch (e: any) {
        console.warn(`Bot server unreachable at ${BOT_SERVER_URL}`, e);
        if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('Server Error'))) {
             // Return empty array instead of throwing to prevent blocking the UI
             console.log("Bot server sleeping/offline, returning empty group list.");
             return [];
        }
        throw new Error("Could not fetch groups. Check if the Bot is Online.");
    }
  },

  checkBotStatus: async (): Promise<BotStatusResponse> => {
    try {
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/status`, { method: 'GET' }, 1, 500); // Less retry for status
        if (!response.ok) throw new Error(`Status check failed with ${response.status}`);
        return await response.json();
    } catch (e) {
        return { status: 'offline' };
    }
  },

  getBotQR: async (): Promise<string | null> => {
    try {
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/qr`, { method: 'GET' });
        if (!response.ok) return null;
        const data = await response.json();
        return data.qr;
    } catch (e) {
        return null;
    }
  }
};