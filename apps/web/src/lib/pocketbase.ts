import PocketBase from 'pocketbase';

const pocketBaseHost =
	typeof window === 'undefined'
		? '127.0.0.1:8090'
		: (window.__APP_CONFIG__?.POCKETBASE_HOST?.trim() ?? '');

if (!pocketBaseHost) {
	throw new Error(
		'POCKETBASE_HOST nao foi definido em /env.js. Verifique SERVICE_FQDN_POCKETBASE no container web.'
	);
}

const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
const pbUrl = `${protocol}//${pocketBaseHost}`;

export const pb = new PocketBase(pbUrl);
