import { redirect } from "next/navigation";

export default function DJIndexRedirect() {
  redirect("/dj/events");
}