import { Router } from 'express'; // Import express Router
import {registerUser} from '../controllers/user.controllers.js'; // Import user controller

const router = Router(); // Create a new router

router.route('/register').post(registerUser); // Create a new route (.) Add a new route for POST requests


export default router; // Export the router