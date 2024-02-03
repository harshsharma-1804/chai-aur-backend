import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {User} from "../models/users.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";

const registerUser =   asyncHandler(async (req, res) => {
    const {fullName, email, username, password} = req.body;
    console.log("email: ", email);

    if( [fullName, email, username,password].some( field => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = User.findOne({
        or$: [{email},{username}]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path; 

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath);
    const coverImage = uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Cloudinary error");
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select( "-password -refresToken")
    if(!createdUser){throw new ApiError(500, "Something went wrong while creating the user")}

    return res.status(201).json(new ApiResponse(200, createdUser, "User created successfully"));
   
})

export {registerUser};