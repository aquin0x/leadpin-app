import { Request, Response } from 'express';
import {
  initSession,
  getOrCreateSession,
  logoutSession,
  startCampaign,
  stopCampaign,
  getCampaign,
} from '../services/whatsapp';

function userId(req: Request): string {
  return (req as any).user.id;
}

export const getStatus = async (req: Request, res: Response) => {
  const uid = userId(req);
  const session = await getOrCreateSession(uid);
  return res.json({
    status: session.status,
    qr: session.qrDataUrl ?? null,
    lastError: session.lastError ?? null,
    campaign: session.campaign ?? null,
  });
};

export const initialize = async (req: Request, res: Response) => {
  const uid = userId(req);
  const session = await initSession(uid);
  return res.json({ status: session.status });
};

export const logout = async (req: Request, res: Response) => {
  const uid = userId(req);
  await logoutSession(uid);
  return res.json({ message: 'WhatsApp oturumu kapatıldı' });
};

export const startWhatsAppCampaign = async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    const {
      listId,
      messageTemplate,
      messageTemplateNoWebsite,
      minDelaySec,
      maxDelaySec,
      coffeeBreakEvery,
      coffeeBreakMinutes,
      media,
    } = req.body || {};

    if (!listId || !messageTemplate) {
      return res.status(400).json({ message: 'listId ve messageTemplate zorunlu' });
    }

    const campaign = await startCampaign({
      userId: uid,
      listId,
      messageTemplate,
      messageTemplateNoWebsite,
      minDelaySec,
      maxDelaySec,
      coffeeBreakEvery,
      coffeeBreakMinutes,
      media,
    });
    return res.status(201).json(campaign);
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
};

export const stopWhatsAppCampaign = async (req: Request, res: Response) => {
  const uid = userId(req);
  const campaign = stopCampaign(uid);
  if (!campaign) return res.status(404).json({ message: 'Çalışan kampanya yok' });
  return res.json({ message: 'Durdurma isteği alındı', campaign });
};

export const getCampaignStatus = async (req: Request, res: Response) => {
  const uid = userId(req);
  const campaign = getCampaign(uid);
  return res.json({ campaign });
};
