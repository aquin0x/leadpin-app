import { Router } from 'express';
import * as listController from '../controllers/list.controller';

const router = Router();

router.get('/', listController.getLists);
router.post('/', listController.createList);
router.post('/:listId/items', listController.addItemsToList);
router.delete('/:id', listController.deleteList);

export default router;
