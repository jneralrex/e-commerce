const { getAllUsers, getUserById, updateUser, updateProfilePhoto, rollBackImageWithErrors } = require("../controllers/user.controller");
const profileUpload = require("../utils/files/profileUpload");

const router = require("express").Router();

router.get("/getAllUsers", getAllUsers); // Get all users with pagination
router.get("/getUser/:id", getUserById); // Get user by ID
router.patch("/updateUser/:id", updateUser); // Update user by ID
router.post("/uploadprofilepic/:id", profileUpload.single("profilePics"), updateProfilePhoto);
router.post("/rollback", rollBackImageWithErrors); // Rollback image with errors

module.exports = router;
