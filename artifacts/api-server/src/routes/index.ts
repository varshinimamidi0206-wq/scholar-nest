import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentRouter from "./students";
import scholarshipRouter from "./scholarships";
import dashboardRouter from "./dashboard";
import workflowRouter from "./student-workflow";
import notificationRouter from "./notifications";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(studentRouter);
router.use(scholarshipRouter);
router.use(dashboardRouter);
router.use(workflowRouter);
router.use(notificationRouter);
router.use(aiRouter);

export default router;
