// Generated by Wrangler by running `wrangler types --include-runtime=false` (hash: 2905fd8e181cd2f4083a615fa51f1913)
// After adding bindings to `wrangler.jsonc`, regenerate this interface via `npm run cf-typegen`
declare namespace Cloudflare {
	interface Env {
		// AI binding for Cloudflare Workers AI
		AI: any;
		// API Token for authentication
		API_TOKEN: string;
	}
}
interface Env extends Cloudflare.Env {}
