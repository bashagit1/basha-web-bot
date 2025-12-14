import { createClient } from '@supabase/supabase-js';
import { Resident, ActivityLog, WhatsAppGroup } from '../types';
import { BotStatusResponse } from './database';

// CONFIGURATION

// DYNAMIC URL DETECTION
const getBotServerUrl = () => {
    // 1. LocalStorage Override (Dynamic Access for Mobile)
    const localOverride = localStorage.getItem('custom_bot_url');
    if (localOverride) {
        console.log(`[Config] Using Local Storage URL: ${localOverride}`);
        return localOverride;
    }

    // 2. Check for manual override from Netlify Environment Variable
    const overrideUrl = (import.meta as any).env?.VITE_BOT_OVERRIDE_URL;
    if (overrideUrl) {
        console.log(`[Config] Using Override URL: ${overrideUrl}`);
        return overrideUrl;
    }

    // 3. Hardcoded Static Domain (User Provided)
    if (window.location.hostname.includes('netlify.app')) {
        console.log('[Config] Detected Netlify. Using Static Ngrok Tunnel.');
        return 'https://cyclic-zena-viscous.ngrok-free.dev';
    }

    const hostname = window.location.hostname;
    
    // 4. If running on Localhost or Local IP, look for local bot
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        return `http://${hostname}:3001`; 
    }
    
    // 5. Default Fallback
    return 'http://localhost:3001';
};

const BOT_SERVER_URL = getBotServerUrl();
console.log(`[Config] Bot Server URL set to: ${BOT_SERVER_URL}`);

if (window.location.hostname.includes('netlify.app') && BOT_SERVER_URL.includes('localhost') && !localStorage.getItem('custom_bot_url')) {
    console.warn("NOTICE: You are on Netlify but the Bot URL is Localhost.");
    console.warn("If you are on mobile, go to Admin > WhatsApp Bot and paste your Ngrok URL.");
}

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://zaiektkvhjfndfebolao.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphaWVrdGt2aGpmbmRmZWJvbGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3OTM3NTEsImV4cCI6MjA3OTM2OTc1MX0.34BB18goOvIpwPci2u25JLoC7l9PRfanpC9C4DS4RfQ';

// --- HELPER FUNCTIONS ---

const normalizeHeaders = (headersInit?: HeadersInit): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!headersInit) return headers;
    
    if (headersInit instanceof Headers) {
        headersInit.forEach((value, key) => {
            headers[key] = value;
        });
    } else if (Array.isArray(headersInit)) {
        headersInit.forEach(([key, value]) => {
            headers[key] = value;
        });
    } else if (typeof headersInit === 'object') {
        Object.assign(headers, headersInit);
    }
    return headers;
};

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 1000): Promise<Response> {
    try {
        const mergedHeaders = normalizeHeaders(options.headers);
        mergedHeaders['ngrok-skip-browser-warning'] = 'true';
        
        const response = await fetch(url, { ...options, headers: mergedHeaders });
        
        if (!response.ok && (response.status === 408 || response.status === 429 || response.status >= 500)) {
            const msg = `Server Error: ${response.status} ${response.statusText}`;
            console.warn(`[Network] ${msg}. Retrying...`);
            throw new Error(msg);
        }
        return response;
    } catch (error: any) {
        if (retries > 0) {
            const nextBackoff = backoff * 2;
            console.warn(`[Network] Fetch failed (${error.message}). Retrying in ${backoff}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, nextBackoff);
        }
        console.error("[Network] All retry attempts failed.");
        throw error;
    }
}

const supabaseFetch = (url: RequestInfo | URL, options?: RequestInit) => {
    return fetchWithRetry(url.toString(), options || {}, 5, 1000);
}

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
  
  getResidents: async (): Promise<Resident[]> => {
    const { data, error } = await supabase
      .from('residents')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Supabase Error fetching residents:', JSON.stringify(error, null, 2));
      throw new Error(error.message || "Failed to fetch residents. Check database connection.");
    }
    
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
    const { error: logsError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('resident_id', id);

    if (logsError) {
        console.error('Error deleting resident logs:', logsError);
        throw new Error("Failed to clean up resident logs.");
    }

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
    
    // PERFORMANCE FIX: Video handling
    // Video files (even 20s) are heavy (10MB+). Saving them to Supabase often causes "Payload Too Large"
    // or timeouts, blocking the WhatsApp send.
    // SOLUTION: We DO NOT save the video file to Supabase. We only save the metadata.
    // We send the actual video bytes ONLY to the WhatsApp Bot.
    
    let dbImageUrls = logData.imageUrls;
    let finalNotes = logData.notes;
    
    if (logData.category === 'Video Message') {
        console.log("Optimizing Video Upload: Skipping DB storage for video file to ensure speed.");
        dbImageUrls = []; // CLEAR IMAGES FOR DB
        finalNotes = (logData.notes || '') + ' [Video Sent to Family via WhatsApp]';
    }

    let newLog: any = null;

    try {
        const { data, error } = await supabase
        .from('activity_logs')
        .insert([{
            resident_id: logData.residentId,
            resident_name: logData.residentName,
            staff_name: logData.staffName,
            category: logData.category,
            notes: finalNotes,
            image_urls: dbImageUrls, // Optimized payload
            status: 'PENDING',
            ai_generated_message: logData.aiGeneratedMessage
        }])
        .select()
        .single();

        if (error) throw error;
        newLog = data;

    } catch (dbError: any) {
        console.error('DB Insert failed:', dbError);
        throw new Error("Database connection failed. Please check internet.");
    }

    // --- WHATSAPP SENDING ---
    // We fetch the group ID
    const { data: residentData } = await supabase
        .from('residents')
        .select('whatsapp_group_id')
        .eq('id', logData.residentId)
        .single();
        
    const residentGroupId = residentData?.whatsapp_group_id;
    let finalStatus = 'PENDING';
    
    const hasMessage = logData.aiGeneratedMessage && logData.aiGeneratedMessage.trim() !== '';
    // Use original logData.imageUrls (containing video) for WhatsApp
    const hasImages = logData.imageUrls && logData.imageUrls.length > 0;

    if (residentGroupId && (hasMessage || hasImages)) {
      try {
        console.log(`Sending to Bot: ${BOT_SERVER_URL}`);
        
        // IMPORTANT: We send the FULL video data to the bot here.
        // We set a longer timeout for the fetch itself.
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/send-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: residentGroupId,
            message: logData.aiGeneratedMessage || '', 
            imageUrls: logData.imageUrls 
          })
        }, 1, 1000); // Reduce retries to avoid duplicate video sends, rely on long timeout

        if (response.ok) {
            finalStatus = 'SENT';
        } else {
            console.warn(`Bot server error: ${response.statusText}`);
            finalStatus = 'FAILED';
        }
      } catch (err: any) {
        console.warn(`Bot server unreachable`, err);
        finalStatus = 'FAILED';
      }
    } else if (residentGroupId) {
         // No content to send, but log created
         finalStatus = 'SENT'; 
    }

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
    const { data: residentData } = await supabase
        .from('residents')
        .select('whatsapp_group_id, name')
        .eq('id', log.residentId)
        .single();
        
    const residentGroupId = residentData?.whatsapp_group_id;

    if (!residentGroupId) throw new Error("No WhatsApp Group linked.");

    try {
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/send-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            groupId: residentGroupId,
            message: log.aiGeneratedMessage || '',
            imageUrls: log.imageUrls // This might be empty if it was a video log retrieved from DB, but for retry of failed *video* log, we can't recover the video unless we stored it.
            // Limitation: If video wasn't stored in DB (our optimization), we can't retry sending the video if it failed the first time.
            })
        }, 3, 2000);

        if (!response.ok) throw new Error("Bot rejected request.");

        await supabase
            .from('activity_logs')
            .update({ status: 'SENT' })
            .eq('id', log.id);

    } catch (err: any) {
        throw err;
    }
  },

  getLogs: async (): Promise<ActivityLog[]> => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

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
    const { data: log, error: fetchError } = await supabase
      .from('activity_logs')
      .select('image_urls')
      .eq('id', logId)
      .single();

    if (fetchError || !log) throw new Error("Log not found to delete image");

    const currentUrls = log.image_urls || [];
    const newUrls = currentUrls.filter((url: string) => url !== imageUrl);

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
        }, 3, 1500); 
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Bot Server Error (${response.status}): ${errorText}`);
        }
        return await response.json();
    } catch (e: any) {
        console.warn(`Bot server unreachable at ${BOT_SERVER_URL}`, e);
        if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('Server Error'))) {
             console.log("Bot server offline.");
             return [];
        }
        throw new Error("Could not fetch groups. Check if the Bot is Online.");
    }
  },

  checkBotStatus: async (): Promise<BotStatusResponse> => {
    try {
        const response = await fetchWithRetry(`${BOT_SERVER_URL}/status`, { method: 'GET' }, 3, 1000); 
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