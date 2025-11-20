import prisma from "../db/prismaClient.js";


const getProfile = async (req:any, res:any) => {
  try {
    console.log("getProfile function triggered!!")
    // console.log("req.user "+req.user);
    // console.log("user info, : ", req?.user);
    const userData =await prisma.user.findUnique({
      where: { id: req.user.id },
    })
    // const userData=await User.findById(req.user._id);
    // console.log("req.user.id "+req.user.id);
    // console.log("userData "+userData);
    res.status(200).json(userData);
  } catch (error) {
    console.log("error in getProfile ",error);
    // res.status(500).json({ error: error?.message });
    res.status(500).json({ error: (error as Error).message });
  }
};

export {getProfile};