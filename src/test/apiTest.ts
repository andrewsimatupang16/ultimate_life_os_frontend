import api from "@/lib/axios";

export const testAPI = async () => {
  const res = await api.get("/");
  console.log("Backend response:", res.data);
};