/** Bun text imports (`with { type: "text" }`) resolve to the file's contents. */
declare module "*/jxa/bridge.js" {
	const source: string;
	export default source;
}

declare module "*.md" {
	const text: string;
	export default text;
}
