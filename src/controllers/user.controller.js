import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError} from "../utils/ApiError.js";
import { User} from "../models/user.model.js"
import { uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


// Get user deatails to DB
const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend

    const {fullName, email, username, password} = req.body
    console.log(`email: ${email}`);

    // validation - not empty

    if ([fullName, email, username, password].some((field) =>{
        field?.trim() === ""
    }) ){
        throw new ApiError(400, "All fields are required.")
    }

    // check if user already exists: username, email

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if (existedUser){
        throw new ApiError(409, "User already exists.")
    }

    console.log(req.files);

    // check for images, check for avatar

    const avatarLocalPath =  req.files?.avatar[0]?.path
    //const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
        coverImageLocalPath = req.files.files?.coverImage[0].path
        

    if (!avatarLocalPath)
        throw new ApiError(400, "Avatar file is required.")

    // upload them to cloudinary, avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar)
        throw new ApiError(400, "Avatar file is required")

    // create user object - create entry in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    // remove password and refresh token field from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // check for user creation

    if(!createdUser)
        throw new ApiError(500, "Some went wrong while registering a user.")

    // return res

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

    

})


// User Login
const loginUser = asyncHandler(async(req, res) =>{

    // req body -> user data
    const {email, username, password} = req.body
    console.log(email);

    // username or email
    if (!email && !username)
        throw new ApiError(400, "username or email is Required")
    

    // find user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    if (!user)
        throw new ApiError(404, "User does not exist")

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid)
        throw new ApiError(401, "Invalid User Credentials")
    

    // generate access and refresh token
    const generateAccessandRefreshTokens = async(userId) => {
        try {
            const user = await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            user.refreshToken =  refreshToken
            user.save({validateBeforeSave: false})

            return {accessToken, refreshToken}
            
        } catch (error) {
            throw new ApiError(500, "Something went wrong while generating refresh and access token.")
        }
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)

    // send tokens through cookies

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
                        .cookie("accessToken", accessToken, options)
                        .cookie("refreshToken", refreshToken, options)
                        .json(new ApiResponse(200, {user:loggedInUser, accessToken, refreshToken},"User Logged in Succesfully"))
})

// User Logout
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {refreshToken: undefined}

        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
                .clearCookie("accessToken", options)
                .clearCookie("refreshToken", options)
                .json(new ApiResponse(200, {}, "User Logged Out Successfuly"))
})

const refreshAccessToken = asyncHandler(async (res, req) => {
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (incommingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
        if(!user)
            throw new ApiError(401, "invalid refresh token");
    
        if(incommingRefreshToken !== user?.refreshToken)
            throw new ApiError(401, "Refresh token is expired or used");
    
        const options = {
            httpOnly: true,
            secure: true,
        }
    
        const {accessToken, newRefreshToken} = await generateAccessToken(user._id)
        return res
                .status(200)
                .cookie("Access Token", accessToken, options)
                .cookie("Refresh Token", newRefreshToken, options)
                .json(
                    new ApiResponse(
                        200,
                        {accessToken, refreshToken: newRefreshToken},
                        "Access token refreshed successfully",
                    )
                )
    } catch (error) {
        console.error(error)
        throw new ApiError(500, error)
    }
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}