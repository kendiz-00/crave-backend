import { Router } from "express";
import { seedDatabase } from "@/utils/seedDatabase";

const router = Router();

router.post("/", async (req, res) => {
  try {
    if (req.headers["x-seed-secret"] !== process.env.SEED_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await seedDatabase();

    return res.json({
      success: true,
      message: "Database seeded successfully",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: String(err),
    });
  }
});

export default router;