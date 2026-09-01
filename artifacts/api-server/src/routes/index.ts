import { Router, type IRouter } from "express";
import brcommunityProxyRouter from "./brcommunity-proxy";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brcommunityProxyRouter);

export default router;
