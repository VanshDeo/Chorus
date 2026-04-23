// ── User Module Routes ──────────────────────────
import { Router } from 'express';
import { UserController } from './user.controller';

const router = Router();
const controller = new UserController();

router.get('/profile', controller.getProfile);
router.get('/skill-profile', controller.getSkillProfile);
router.get('/status', controller.getStatus);
router.post('/preferences', controller.savePreferences);

export { router as userRoutes };
