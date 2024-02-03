import { Router } from 'express'; // Import express Router
import {registerUser} from '../controllers/user.controllers.js'; // Import user controller
import {upload} from "../middlewares/multer.middlewares.js";

const router = Router(); // Create a new router

// Create a new route (.) Add a new route for POST requests
router.route('/register').post(
    upload.fields([
        {name: "avatar", maxcount: 1},
        {name: "coverImage", maxcount: 1}
    ]),
    registerUser); 


export default router; // Export the router