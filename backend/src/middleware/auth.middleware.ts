export const isAuthenticated = (req: any, res: any, next: any) => {
  // Check if the user is authenticated
  // console.log(req?.user)
  const isAuthenticated: boolean = req.isAuthenticated();
  console.log('isAuthenticated: ', isAuthenticated); // Add this line for debugging

  if (isAuthenticated) {
    return next();
  }
  // res.redirect('/auth/google');
  res.status(401).json({ message: 'Unauthorized' });
};