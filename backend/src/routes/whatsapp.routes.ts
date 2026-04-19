import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getStatus,
  initialize,
  logout,
  startWhatsAppCampaign,
  stopWhatsAppCampaign,
  getCampaignStatus,
} from '../controllers/whatsapp.controller';

const router = Router();

router.use(authMiddleware);

router.get('/status', getStatus);
router.post('/init', initialize);
router.post('/logout', logout);
router.post('/campaign/start', startWhatsAppCampaign);
router.post('/campaign/stop', stopWhatsAppCampaign);
router.get('/campaign', getCampaignStatus);

export default router;
