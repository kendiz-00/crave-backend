import { Router } from "express";
import { exec } from "child_process";

const router = Router();

router.post("/", async (req, res) => {
  const secret = req.headers["x-seed-secret"];

  if (secret !== process.env.SEED_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  exec("npm run seed", (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: stderr,
      });
    }

    res.json({
      success: true,
      output: stdout,
    });
  });
});

export default router;