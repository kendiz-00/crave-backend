import { Router } from "express";
import { execSync } from "child_process";

const router = Router();

router.post("/", async (req, res) => {
  try {
    if (req.headers["x-seed-secret"] !== process.env.SEED_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    execSync("npm run seed", { stdio: "inherit" });

    return res.json({
      success: true,
      message: "Database seeded successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Seed failed",
    });
  }
});

export default router;