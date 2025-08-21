/* filepath: backend/src/routes/auth.routes.ts */
import { Router } from "express";
import { register, login, getProfile } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// Use the individual functions
router.post("/register", register);
router.post("/login", login);
router.get("/profile", authenticateToken, getProfile);

// Debug route to check token
router.get("/debug-token", authenticateToken, (req: any, res: any) => {
  res.json({
    success: true,
    user: req.user,
    message: "Current token data",
  });
});

export default router;