import sharp from 'sharp';

export const PANORAMA_MAX_WIDTH = 8192;
export const PANORAMA_MAX_HEIGHT = 4096;
export const PANORAMA_MAX_BYTES = 45 * 1024 * 1024;

export type PanoramaDetectionSource = 'xmp' | 'aspect-ratio' | 'manual';

export type PanoramaRenderResult = {
	buffer: Buffer;
	width: number;
	height: number;
	quality: number;
	fileSize: number;
	xmp: string;
};

export function isEquirectangularSize(width: number, height: number, tolerance = 0.01) {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return false;
	}
	return Math.abs(width / height - 2) <= tolerance;
}

export function panoramaTargetSize(width: number, height: number) {
	if (!isEquirectangularSize(width, height)) {
		throw new Error('360°-Panoramen müssen ein Seitenverhältnis von 2:1 haben.');
	}

	const targetWidth = Math.min(width, PANORAMA_MAX_WIDTH);
	return {
		width: targetWidth,
		height: Math.min(height, Math.round(targetWidth / 2), PANORAMA_MAX_HEIGHT)
	};
}

function xmlEscape(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function buildGpanoXmp(args: {
	width: number;
	height: number;
	headingDegrees?: number | null;
	captureSoftware?: string | null;
}) {
	const heading = Number.isFinite(args.headingDegrees)
		? Math.max(0, Math.min(359.999, Number(args.headingDegrees)))
		: 0;
	const software = xmlEscape(args.captureSoftware?.trim() || 'Culoca 360° Upload');

	return `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
   xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"
   GPano:UsePanoramaViewer="True"
   GPano:ProjectionType="equirectangular"
   GPano:CaptureSoftware="${software}"
   GPano:StitchingSoftware="Culoca"
   GPano:PoseHeadingDegrees="${heading.toFixed(3)}"
   GPano:CroppedAreaImageWidthPixels="${args.width}"
   GPano:CroppedAreaImageHeightPixels="${args.height}"
   GPano:FullPanoWidthPixels="${args.width}"
   GPano:FullPanoHeightPixels="${args.height}"
   GPano:CroppedAreaLeftPixels="0"
   GPano:CroppedAreaTopPixels="0" />
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function renderPanorama(
	input: Buffer,
	options: { headingDegrees?: number | null; maxBytes?: number } = {}
): Promise<PanoramaRenderResult> {
	const metadata = await sharp(input, { limitInputPixels: 220_000_000 }).rotate().metadata();
	const sourceWidth = metadata.width || 0;
	const sourceHeight = metadata.height || 0;
	const target = panoramaTargetSize(sourceWidth, sourceHeight);
	const maxBytes = Math.min(options.maxBytes || PANORAMA_MAX_BYTES, PANORAMA_MAX_BYTES);
	const xmp = buildGpanoXmp({
		width: target.width,
		height: target.height,
		headingDegrees: options.headingDegrees
	});

	for (const quality of [90, 86, 82, 78, 74, 70, 66, 62, 58]) {
		const buffer = await sharp(input, { limitInputPixels: 220_000_000 })
			.rotate()
			.resize(target.width, target.height, {
				fit: 'fill',
				withoutEnlargement: true
			})
			.jpeg({
				quality,
				mozjpeg: true,
				progressive: true,
				chromaSubsampling: '4:2:0',
				optimizeScans: true
			})
			.withXmp(xmp)
			.toBuffer();

		if (buffer.byteLength <= maxBytes) {
			return {
				buffer,
				width: target.width,
				height: target.height,
				quality,
				fileSize: buffer.byteLength,
				xmp
			};
		}
	}

	throw new Error('Das 360°-Panorama konnte nicht unter 45 MB komprimiert werden.');
}

export function readPanoramaSettings(pageSettings: unknown): null | {
	enabled: true;
	path: string;
	width: number;
	height: number;
	fileSize?: number;
	headingDegrees?: number;
	detectionSource?: PanoramaDetectionSource;
} {
	if (!pageSettings || typeof pageSettings !== 'object') return null;
	const panorama = (pageSettings as Record<string, unknown>).panorama;
	if (!panorama || typeof panorama !== 'object') return null;
	const value = panorama as Record<string, unknown>;
	if (value.enabled !== true || typeof value.path !== 'string' || !value.path.trim()) return null;
	return {
		enabled: true,
		path: value.path,
		width: Number(value.width) || PANORAMA_MAX_WIDTH,
		height: Number(value.height) || PANORAMA_MAX_HEIGHT,
		...(Number.isFinite(Number(value.fileSize)) ? { fileSize: Number(value.fileSize) } : {}),
		...(Number.isFinite(Number(value.headingDegrees))
			? { headingDegrees: Number(value.headingDegrees) }
			: {}),
		...(value.detectionSource === 'xmp' ||
		value.detectionSource === 'aspect-ratio' ||
		value.detectionSource === 'manual'
			? { detectionSource: value.detectionSource }
			: {})
	};
}
