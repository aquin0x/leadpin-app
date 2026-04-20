import { Request, Response } from 'express';
import {
  addLine,
  removeLine,
  logoutLine,
  initLine,
  listLines,
  getLineStatus,
  startCampaign,
  stopCampaign,
  getCampaign,
  sendSingleMessage,
} from '../services/whatsapp';

function userId(req: Request): string {
  return (req as any).user.id;
}

export const getLines = async (req: Request, res: Response) => {
  const uid = userId(req);
  return res.json({ lines: listLines(uid) });
};

export const createLine = async (req: Request, res: Response) => {
  const uid = userId(req);
  const { label } = req.body || {};
  const session = await addLine(uid, label);
  return res.status(201).json({
    id: session.lineId,
    label: session.label,
    status: session.status,
    qr: session.qrDataUrl ?? null,
  });
};

export const getLine = async (req: Request, res: Response) => {
  const uid = userId(req);
  const line = getLineStatus(uid, req.params.id);
  if (!line) return res.status(404).json({ message: 'Hat bulunamadı' });
  return res.json(line);
};

export const deleteLine = async (req: Request, res: Response) => {
  const uid = userId(req);
  const ok = await removeLine(uid, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Hat bulunamadı' });
  return res.json({ message: 'Hat silindi' });
};

export const reconnectLine = async (req: Request, res: Response) => {
  const uid = userId(req);
  const ok = await logoutLine(uid, req.params.id);
  if (!ok) return res.status(404).json({ message: 'Hat bulunamadı' });
  // Yeniden initialize et ki yeni QR çıksın
  const session = await initLine(uid, req.params.id);
  return res.json({ status: session?.status ?? 'disconnected' });
};

export const startWhatsAppCampaign = async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    const {
      listId,
      lineId,
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
      lineId,
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

export const sendSingle = async (req: Request, res: Response) => {
  try {
    const uid = userId(req);
    const { businessId, message, lineId, media } = req.body || {};
    if (!businessId || !message) {
      return res.status(400).json({ message: 'businessId ve message zorunlu' });
    }
    const result = await sendSingleMessage({ userId: uid, businessId, message, lineId, media });
    if (result.ok) return res.json(result);
    if (result.reason === 'not_ready' || result.reason === 'no_line') {
      return res.status(409).json({
        ok: false,
        reason: result.reason,
        ...('lines' in result ? { lines: result.lines } : {}),
        ...('hint' in result ? { hint: result.hint } : {}),
      });
    }
    return res.status(400).json(result);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

export const getCampaignStatus = async (req: Request, res: Response) => {
  const uid = userId(req);
  const campaign = getCampaign(uid);
  return res.json({ campaign });
};
