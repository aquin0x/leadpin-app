import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const getLists = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { data, error } = await supabase
      .from('lists')
      .select('*, items_count:list_items(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    console.log(`[getLists] Fetched ${data?.length || 0} lists for user: ${userId}`);
    if (data && data.length > 0) {
      console.log(`[getLists] First list structure sample:`, JSON.stringify(data[0], null, 2));
    }

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createList = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = (req as any).user.id;
    
    const { data, error } = await supabase
      .from('lists')
      .insert({ name, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addItemsToList = async (req: Request, res: Response) => {
  try {
    const { listId } = req.params;
    const { businessIds } = req.body;

    const items = businessIds.map((id: string) => ({
      list_id: listId,
      business_id: id
    }));

    const { error } = await supabase
      .from('list_items')
      .upsert(items, { onConflict: 'list_id,business_id' });

    if (error) throw error;
    res.json({ message: 'İşletmeler başarıyla listeye eklendi' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getListById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (listError) throw listError;
    if (!list) return res.status(404).json({ message: 'Liste bulunamadı' });

    const { data: items, error: itemsError } = await supabase
      .from('list_items')
      .select('business:businesses(*)')
      .eq('list_id', id);

    if (itemsError) throw itemsError;

    const businesses = (items || [])
      .map((item: any) => item.business)
      .filter(Boolean);

    res.json({ ...list, businesses });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const removeItemFromList = async (req: Request, res: Response) => {
  try {
    const { listId, businessId } = req.params;
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('business_id', businessId);

    if (error) throw error;
    res.json({ message: 'İşletme listeden çıkarıldı' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteList = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Liste silindi' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
