declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			token?: string;
			semiprivateToken?: string;
		}
	}
}

export {};
