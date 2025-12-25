import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { StatusCodes } from "http-status-codes";

export const load: PageServerLoad = () => {
  redirect(StatusCodes.PERMANENT_REDIRECT, "/habits");
}
