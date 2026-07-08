import { Request, Response, NextFunction } from 'express';
import { supabase } from '../utils/supabase';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Token yalnızca Authorization header'dan okunur; query-string token'ları
  // log/proxy kayıtlarına sızdığı için desteklenmiyor (SSE için /api/sse-ticket kullanılır).
  const authHeader = req.headers.authorization;

  let token = authHeader ? authHeader.split(' ')[1] : undefined;

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
