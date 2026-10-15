import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
	PANORAMA_MAX_BYTES,
	buildGpanoXmp,
	isEquirectangularSize,
	panoramaTargetSize,
	renderPanorama
} from './panorama';

describe('panorama processing', () => {
	it('recognizes 2:1 equirectangular dimensions', () => {
		expect(isEquirectangularSize(18_498, 9_249)).toBe(true);
		expect(isEquirectangularSize(6000, 4000)).toBe(false);
	});

	it('caps panoramas at 8192 × 4096 without enlarging', () => {
		expect(panoramaTargetSize(18_498, 9_249)).toEqual({ width: 8192, height: 4096 });
		expect(panoramaTargetSize(6000, 3000)).toEqual({ width: 6000, height: 3000 });
	});

	it('writes the required GPano fields', () => {
		const xmp = buildGpanoXmp({ width: 8192, height: 4096, headingDegrees: 182.5 });
		expect(xmp).toContain('GPano:ProjectionType="equirectangular"');
		expect(xmp).toContain('GPano:UsePanoramaViewer="True"');
		expect(xmp).toContain('GPano:FullPanoWidthPixels="8192"');
		expect(xmp).toContain('GPano:PoseHeadingDegrees="182.500"');
	});

	it('renders a bounded JPEG with embedded XMP', async () => {
		const source = await sharp({
			create: { width: 1000, height: 500, channels: 3, background: '#3478a5' }
		})
			.jpeg()
			.toBuffer();
		const result = await renderPanorama(source);
		const metadata = await sharp(result.buffer).metadata();
		expect(result.width).toBe(1000);
		expect(result.height).toBe(500);
		expect(result.fileSize).toBeLessThanOrEqual(PANORAMA_MAX_BYTES);
		expect(metadata.xmp?.toString()).toContain('equirectangular');
	});
});
