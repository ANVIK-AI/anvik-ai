import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
export default function Home() {
  const navigate=useNavigate()
  useEffect(()=>{
    navigate("/profile")

  },[])
  return (
    <div className="">
    </div>
  );
}
