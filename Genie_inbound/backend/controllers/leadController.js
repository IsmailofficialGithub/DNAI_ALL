import { supabase } from '../utils/supabase.js';

export const getLeads = async (req, res, next) => {
    try {
        if (!supabase) throw new Error('Supabase not configured');

        const { user_id, limit = 50, offset = 0 } = req.query;

        let query = supabase.from('leads').select('*', { count: 'exact' });

        if (user_id) query = query.eq('user_id', user_id);

        const { data, error, count } = await query
            .order('last_call_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({ success: true, data, count });
    } catch (error) {
        next(error);
    }
};
