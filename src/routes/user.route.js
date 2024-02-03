import { Router } from 'express'; // Import express Router
import {registerUser, loginUser, logoutUser, refreshAccessToken} from '../controllers/user.controller.js'; // Import user controller
import {upload} from "../middlewares/multer.middleware.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";

const router = Router(); // Create a new router

// Create a new route (.) Add a new route for POST requests
router.route('/register').post(
    upload.fields([
        {name: "avatar", maxcount: 1},
        {name: "coverImage", maxcount: 1}
    ]),
    registerUser); 

router.route('/login').post(loginUser); // Add a new route for POST requests
// secured route
router.route('/logout').post(verifyJWT, logoutUser)
router.route('/refreshToken').post(refreshToken)


export default router; // Export the router