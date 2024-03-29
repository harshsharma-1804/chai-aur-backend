import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { deleteFile } from '../utils/deleteFile.js';
import jwt from "jsonwebtoken";

// ------------------------------------------------------------------------------------------------------

const generateAccessandRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    }
    catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}
// ------------------------------------------------------------------------------------------------------

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
// ------------------------------------------------------------------------------------------------------

const loginUser = asyncHandler(async (req,res) => {
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
    console.log("email: ", email);

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
    .json(new ApiResponse(200, {user: loggedInUser,accessToken,refreshToken}, "User logged in successfully"));
})
// ------------------------------------------------------------------------------------------------------

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {$set:{refreshToken: undefined}},{new:true})
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
// ------------------------------------------------------------------------------------------------------

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");
        if(!user){
            throw new ApiError(401,"Invalid refresh token");
        }
    
        if(user?.refreshToken !== incomingRefreshToken){
            throw new ApiError(401, "Refresh token expired or already used");
        }
        const options={
            httpOnly: true,
            secure: true,
        }
        const {accessToken, newRefreshToken} = await generateAccessandRefreshTokens(user._id);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(200, {user: accessToken, refreshToken: newRefreshToken}, "Token refreshed successfully"));
    }
    catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

})
// ------------------------------------------------------------------------------------------------------

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword, confPassword} = req.body;
    if(!(newPassword === confPassword)){
        throw new ApiError(400, "Confirm password does not match with new password")
    }


    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
})
// ------------------------------------------------------------------------------------------------------

const getCurrentUser = asyncHandler ((req,res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "User details fetched successfully"));
})
// ------------------------------------------------------------------------------------------------------

const updateUser = asyncHandler(async(req,res) => {
    
    const {fullName, username} = req.body;

    if(!(fullName || username)){
        throw new ApiError(400, "Full name or username is required");
    }

    const user = await User.findByIdAndUpdate(req.user._id, {$set: {fullName: fullName, username: username}}, {new: true}).select("-password -refreshToken");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"))

})
// ------------------------------------------------------------------------------------------------------

const updateAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const oldAvatarUrl = req.user.avatar;

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(500, "Error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(req.user._id,{$set:{avatar: avatar.url}},{new:true}).select("-password -refreshToken");
    
    deleteFile(oldAvatarUrl)

    return res
    .status(200)
    .json(new ApiResponse(200, user,"Avatar updated successfully"))
})
// ------------------------------------------------------------------------------------------------------

const updateCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is required")
    }

    const oldCoverImageUrl = req.user.coverImage

    const coverImage = await updateOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(500, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(req.user._id,{$set:{coverImage: coverImage.url}},{new:true}).select("-password -refreshToken")

    deleteFile(oldCoverImageUrl)

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover image updated successfully"))
})
// ------------------------------------------------------------------------------------------------------

const getUserChannelProfile = asyncHandler(async(req,res) => {
    const {username} = req.params;
    if(!username?.trim){
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        {
            $match: {username: username}
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "Subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "Subscribed"
            }
        },
        {
            $addFields:{
                subscriberCount: {$size: "$Subscribers"},
                subscribedCount: {$size: "$Subscribed"},
                isSubscribed: {
                    $cond:{
                        if: {$in: [req.user._id, "$Subscribed.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                username: 1,
                fullName: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                subscribedCount: 1,
                isSubscribed: 1
            }
        }

    ])

    if(!channel){
        throw new ApiError(404, "Channel not found");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"))

})

export{
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUser,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
};