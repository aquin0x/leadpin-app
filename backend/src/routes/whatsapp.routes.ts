import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getLines,
  createLine,
  getLine,
  deleteLine,
  reconnectLine,
  sendSingle,
  startWhatsAppCampaign,
  stopWhatsAppCampaign,
  getCampaignStatus,
} from '../controllers/whatsapp.controller';

const router = Router();

router.use(authMiddleware);

// Hat yönetimi
router.get('/lines', getLines);
router.post('/lines', createLine);
router.get('/lines/:id', getLine);
router.delete('/lines/:id', deleteLine);
router.post('/lines/:id/reconnect', reconnectLine);

// Mesaj gönderimi
router.post('/send-single', sendSingle);
router.post('/campaign/start', startWhatsAppCampaign);
router.post('/campaign/stop', stopWhatsAppCampaign);
router.get('/campaign', getCampaignStatus);

export default router;
