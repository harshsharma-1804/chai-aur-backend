import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";

const generateAccessandRefreshTokens = async (userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    }
    catch(error){
        throw new ApiError(500, "Something went wrong while generating the tokens")
    }
}

const registerUser =   asyncHandler(async (req, res) => {
    const {fullName, email, username, password} = req.body;
    console.log("email: ", email);

    if( [fullName, email, username,password].some( field => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        or$: [{email},{username}]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists");
    }

    console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path; 
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

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

const loginUser = asyncHandler(async (re,res) => {
    /* 
    -> get user credentials like email/username and password  -- req.body->data --done
    -> check if the user exists --done
    -> validate the credentials --done
    -> generate jwt access token and refresh token --done
    -> send the tokens to the user in secure httpOnly cookies
    -> save the refresh token in the database --done
    -> if the user is logged in from another device, invalidate the previous refresh token
    -> grant access to the user
     */

    const {email, username, password} = req.body;

    if(!(email || username)){
        throw new ApiError(400, "Email or username is required");
    }

    const user= await User.findOne({
        $or: [{email}, {username}]
    })
    if(!user){
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Please enter a valid password");
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options ={
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {accessToken, user: loggedInUser,accessToken,refreshToken}, "User logged in successfully"));
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findById(req.user._id, {$set:{refreshToken: undefined}},{new:true})
    const options = {
        httpOnly: true,
        secure: true,
    }
    res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
})

export {registerUser, loginUser, logoutUser};