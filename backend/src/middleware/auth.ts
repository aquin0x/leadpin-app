import { Request, Response, NextFunction } from 'express';
import { supabase } from '../utils/supabase';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string;

  let token = authHeader ? authHeader.split(' ')[1] : queryToken;

  if (!token) {
    console.log('Auth Hatası: Token bulunamadı');
    return res.status(401).json({ message: 'Yetkilendirme tokenı bulunamadı' });
  }

  // Token'ı temizleyelim (boşluk vs. varsa)
  token = token.trim();

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Supabase Auth Hatası:', error?.message);
      return res.status(401).json({ message: 'Geçersiz oturum: ' + (error?.message || 'Kullanıcı bulunamadı') });
    }

    (req as any).user = user;
    next();
  } catch (err: any) {
    console.error('Middleware Try-Catch Hatası:', err.message);
    return res.status(401).json({ message: 'Yetkilendirme hatası: ' + err.message });
  }
};
