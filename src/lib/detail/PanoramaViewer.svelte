<script lang="ts">
	import { onMount } from 'svelte';

	export let panoramaUrl: string;
	export let posterUrl: string;
	export let alt = 'Interaktives 360°-Panorama';
	export let backHref = '/';
	export let headingDegrees = 0;

	type Projection = 'normal' | 'architectural' | 'little-planet' | 'fisheye';
	const projectionLabels: Record<Projection, string> = {
		normal: 'Normal',
		architectural: 'Architektonisch',
		'little-planet': 'Little Planet',
		fisheye: 'Fisheye'
	};

	let shell: HTMLElement;
	let canvas: HTMLCanvasElement;
	let ready = false;
	let failed = false;
	let dragging = false;
	let showGestureHint = false;
	let fullscreen = false;
	let projection: Projection = 'normal';
	let menuOpen = false;
	let menuX = 0;
	let menuY = 0;

	function toggleFullscreen() {
		if (document.fullscreenElement === shell) void document.exitFullscreen();
		else if (shell?.requestFullscreen) void shell.requestFullscreen();
	}

	function selectProjection(mode: string) {
		projection = mode as Projection;
		menuOpen = false;
	}

	onMount(() => {
		let frame = 0;
		let destroyed = false;
		let texture: WebGLTexture | null = null;
		let program: WebGLProgram | null = null;
		let vertexBuffer: WebGLBuffer | null = null;
		let lastFrame = performance.now();
		let yaw = (((Number.isFinite(headingDegrees) ? headingDegrees : 0) - 90) * Math.PI) / 180;
		let pitch = 0;
		let hfov = (94 * Math.PI) / 180;
		let tracking = false;
		let dragMode: '' | 'pending' | 'horizontal' | 'both' = '';
		let lastX = 0;
		let lastY = 0;
		let pointerId: number | null = null;
		let hintTimer: ReturnType<typeof setTimeout> | null = null;
		let longPressTimer: ReturnType<typeof setTimeout> | null = null;

		const gl = canvas.getContext('webgl', { antialias: true });
		if (!gl) {
			failed = true;
			return;
		}

		function compile(type: number, source: string) {
			const shader = gl!.createShader(type);
			if (!shader) throw new Error('WebGL-Shader konnte nicht erstellt werden.');
			gl!.shaderSource(shader, source);
			gl!.compileShader(shader);
			if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
				throw new Error(gl!.getShaderInfoLog(shader) || 'WebGL-Shaderfehler');
			}
			return shader;
		}

		function createProgram() {
			const vertex = compile(
				gl!.VERTEX_SHADER,
				`
				attribute vec2 aPosition;
				varying vec2 vPosition;
				void main(){ vPosition = aPosition; gl_Position = vec4(aPosition, 0.0, 1.0); }
			`
			);
			const fragment = compile(
				gl!.FRAGMENT_SHADER,
				`
				precision mediump float;
				varying vec2 vPosition;
				uniform sampler2D uTexture;
				uniform float uYaw;
				uniform float uPitch;
				uniform float uFov;
				uniform float uAspect;
				uniform int uProjection;
				const float PI = 3.141592653589793;
				void main(){
					float scale = tan(uFov * 0.5);
					vec2 p = vec2(vPosition.x * uAspect, vPosition.y);
					vec3 d;
					float viewPitch = uProjection == 1 ? uPitch + 1.57079632679 : uPitch;
					if (uProjection == 1) {
						float r2 = dot(p, p);
						d = normalize(vec3(1.0 - r2, 2.0 * p.y, 2.0 * p.x));
					} else if (uProjection == 3) {
						float r = max(length(p), 0.0001);
						float theta = min(r * uFov, PI);
						d = normalize(vec3(cos(theta), sin(theta) * p.y / r, sin(theta) * p.x / r));
					} else {
						float pitchFactor = uProjection == 2 ? 0.28 : 1.0;
						viewPitch = uPitch * pitchFactor;
						d = normalize(vec3(1.0, vPosition.y * scale, vPosition.x * scale * uAspect));
					}
					float cp = cos(viewPitch);
					float sp = sin(viewPitch);
					d = vec3(cp * d.x - sp * d.y, sp * d.x + cp * d.y, d.z);
					float cy = cos(uYaw);
					float sy = sin(uYaw);
					d = vec3(cy * d.x - sy * d.z, d.y, sy * d.x + cy * d.z);
					float u = 0.5 + atan(d.z, d.x) / (2.0 * PI);
					float v = clamp(0.5 - asin(d.y) / PI, 0.001, 0.999);
					gl_FragColor = texture2D(uTexture, vec2(u, v));
				}
			`
			);
			const nextProgram = gl!.createProgram();
			if (!nextProgram) throw new Error('WebGL-Programm konnte nicht erstellt werden.');
			gl!.attachShader(nextProgram, vertex);
			gl!.attachShader(nextProgram, fragment);
			gl!.linkProgram(nextProgram);
			gl!.deleteShader(vertex);
			gl!.deleteShader(fragment);
			if (!gl!.getProgramParameter(nextProgram, gl!.LINK_STATUS)) {
				throw new Error(gl!.getProgramInfoLog(nextProgram) || 'WebGL-Linkfehler');
			}
			return nextProgram;
		}

		function projectionId() {
			return ({ normal: 0, fisheye: 1, architectural: 2, 'little-planet': 3 } as const)[projection];
		}

		function resize() {
			const rect = shell.getBoundingClientRect();
			const ratio = Math.min(window.devicePixelRatio || 1, fullscreen ? 1.5 : 2);
			const maxViewport = gl!.getParameter(gl!.MAX_VIEWPORT_DIMS) as Int32Array;
			const width = Math.max(1, Math.min(maxViewport[0], Math.floor(rect.width * ratio)));
			const height = Math.max(1, Math.min(maxViewport[1], Math.floor(rect.height * ratio)));
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
			}
			gl!.viewport(0, 0, width, height);
		}

		function render() {
			if (!program || !texture || destroyed) return;
			gl!.viewport(0, 0, canvas.width, canvas.height);
			gl!.clearColor(0, 0, 0, 1);
			gl!.clear(gl!.COLOR_BUFFER_BIT);
			gl!.useProgram(program);
			gl!.bindBuffer(gl!.ARRAY_BUFFER, vertexBuffer);
			const position = gl!.getAttribLocation(program, 'aPosition');
			gl!.enableVertexAttribArray(position);
			gl!.vertexAttribPointer(position, 2, gl!.FLOAT, false, 0, 0);
			gl!.uniform1f(gl!.getUniformLocation(program, 'uYaw'), yaw);
			gl!.uniform1f(gl!.getUniformLocation(program, 'uPitch'), pitch);
			gl!.uniform1f(gl!.getUniformLocation(program, 'uFov'), hfov);
			gl!.uniform1f(gl!.getUniformLocation(program, 'uAspect'), canvas.width / canvas.height);
			gl!.uniform1i(gl!.getUniformLocation(program, 'uProjection'), projectionId());
			gl!.activeTexture(gl!.TEXTURE0);
			gl!.bindTexture(gl!.TEXTURE_2D, texture);
			gl!.uniform1i(gl!.getUniformLocation(program, 'uTexture'), 0);
			gl!.drawArrays(gl!.TRIANGLES, 0, 6);
		}

		function animate(now: number) {
			const elapsed = Math.min(50, now - lastFrame);
			lastFrame = now;
			if (
				!dragging &&
				!document.hidden &&
				!window.matchMedia('(prefers-reduced-motion: reduce)').matches
			) {
				yaw -= elapsed * 0.000035;
			}
			render();
			frame = requestAnimationFrame(animate);
		}

		function clampView() {
			hfov = Math.max(0.52, Math.min(2.44, hfov));
			pitch = Math.max(-1.569, Math.min(1.569, pitch));
		}

		function isCenter(clientX: number, clientY: number) {
			const rect = shell.getBoundingClientRect();
			const half = Math.min(rect.width * 0.17, 90);
			return (
				Math.abs(clientX - (rect.left + rect.width / 2)) <= half &&
				Math.abs(clientY - (rect.top + rect.height / 2)) <= half
			);
		}

		function isControl(target: EventTarget | null) {
			return (
				target instanceof Element &&
				!!target.closest('.panorama-back, .panorama-fullscreen, .panorama-projection-menu')
			);
		}

		function showMenu(clientX: number, clientY: number) {
			const rect = shell.getBoundingClientRect();
			menuX = Math.max(8, Math.min(rect.width - 190, clientX - rect.left));
			menuY = Math.max(8, Math.min(rect.height - 174, clientY - rect.top));
			menuOpen = true;
		}

		function showScrollHintNow() {
			showGestureHint = true;
			if (hintTimer) clearTimeout(hintTimer);
			hintTimer = setTimeout(() => (showGestureHint = false), 850);
		}

		function onContextMenu(event: MouseEvent) {
			if (isControl(event.target)) return;
			event.preventDefault();
			showMenu(event.clientX, event.clientY);
		}

		function onPointerDown(event: PointerEvent) {
			if (isControl(event.target)) return;
			menuOpen = false;
			if (longPressTimer) clearTimeout(longPressTimer);
			longPressTimer = setTimeout(() => {
				if (!dragging) showMenu(event.clientX, event.clientY);
			}, 650);
			tracking = true;
			dragging = false;
			dragMode = isCenter(event.clientX, event.clientY) ? 'both' : 'pending';
			lastX = event.clientX;
			lastY = event.clientY;
			pointerId = event.pointerId;
			if (dragMode === 'both') {
				event.preventDefault();
				dragging = true;
				shell.setPointerCapture(event.pointerId);
			}
		}

		function onPointerMove(event: PointerEvent) {
			if (!tracking) return;
			const dx = event.clientX - lastX;
			const dy = event.clientY - lastY;
			if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
				if (longPressTimer) clearTimeout(longPressTimer);
			}
			if (dragMode === 'pending') {
				if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
				if (Math.abs(dx) < Math.abs(dy)) {
					tracking = false;
					dragMode = '';
					showScrollHintNow();
					return;
				}
				dragMode = 'horizontal';
				dragging = true;
				shell.setPointerCapture(event.pointerId);
			}
			event.preventDefault();
			lastX = event.clientX;
			lastY = event.clientY;
			yaw -= dx * 0.004;
			if (dragMode === 'both') pitch += dy * 0.004;
			clampView();
		}

		function endPointer(event?: PointerEvent) {
			if (longPressTimer) clearTimeout(longPressTimer);
			tracking = false;
			dragging = false;
			dragMode = '';
			if (event && shell.hasPointerCapture(event.pointerId))
				shell.releasePointerCapture(event.pointerId);
			pointerId = null;
		}

		function onWheel(event: WheelEvent) {
			if (!isCenter(event.clientX, event.clientY)) return;
			event.preventDefault();
			hfov += event.deltaY * 0.001;
			clampView();
		}

		function onFullscreenChange() {
			fullscreen = document.fullscreenElement === shell;
			requestAnimationFrame(resize);
		}

		function onDocumentClick(event: MouseEvent) {
			if (!(event.target instanceof Element) || !event.target.closest('.panorama-projection-menu'))
				menuOpen = false;
		}

		try {
			program = createProgram();
			vertexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
				gl.STATIC_DRAW
			);

			const image = new Image();
			image.crossOrigin = 'anonymous';
			image.onload = () => {
				if (destroyed) return;
				const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
				let source: TexImageSource = image;
				if (image.naturalWidth > maxTextureSize || image.naturalHeight > maxTextureSize) {
					const scale = Math.min(
						maxTextureSize / image.naturalWidth,
						maxTextureSize / image.naturalHeight
					);
					const fallback = document.createElement('canvas');
					fallback.width = Math.max(1, Math.floor(image.naturalWidth * scale));
					fallback.height = Math.max(1, Math.floor(image.naturalHeight * scale));
					fallback.getContext('2d')?.drawImage(image, 0, 0, fallback.width, fallback.height);
					source = fallback;
				}
				texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
				resize();
				ready = true;
				frame = requestAnimationFrame(animate);
			};
			image.onerror = () => (failed = true);
			image.src = panoramaUrl;
		} catch (error) {
			console.error('[PanoramaViewer] Viewer konnte nicht gestartet werden:', error);
			failed = true;
		}

		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(shell);
		shell.addEventListener('contextmenu', onContextMenu);
		shell.addEventListener('pointerdown', onPointerDown);
		shell.addEventListener('pointermove', onPointerMove, { passive: false });
		shell.addEventListener('pointerup', endPointer);
		shell.addEventListener('pointercancel', endPointer);
		shell.addEventListener('wheel', onWheel, { passive: false });
		document.addEventListener('fullscreenchange', onFullscreenChange);
		document.addEventListener('click', onDocumentClick);

		return () => {
			destroyed = true;
			cancelAnimationFrame(frame);
			if (hintTimer) clearTimeout(hintTimer);
			if (longPressTimer) clearTimeout(longPressTimer);
			if (pointerId !== null && shell.hasPointerCapture(pointerId))
				shell.releasePointerCapture(pointerId);
			resizeObserver.disconnect();
			shell.removeEventListener('contextmenu', onContextMenu);
			shell.removeEventListener('pointerdown', onPointerDown);
			shell.removeEventListener('pointermove', onPointerMove);
			shell.removeEventListener('pointerup', endPointer);
			shell.removeEventListener('pointercancel', endPointer);
			shell.removeEventListener('wheel', onWheel);
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			document.removeEventListener('click', onDocumentClick);
			if (texture) gl.deleteTexture(texture);
			if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
			if (program) gl.deleteProgram(program);
		};
	});
</script>

<section
	bind:this={shell}
	class="panorama-shell"
	class:is-ready={ready && !failed}
	class:is-dragging={dragging}
	class:show-gesture-hint={showGestureHint}
	aria-label={alt}
>
	<img
		src={posterUrl}
		{alt}
		class="panorama-poster"
		loading="eager"
		decoding="async"
		fetchpriority="high"
	/>
	<canvas bind:this={canvas} class="panorama-canvas" aria-hidden="true"></canvas>
	<div class="panorama-gesture-pad" aria-hidden="true"><span></span></div>
	<a class="panorama-back" href={backHref || '/'} aria-label="Zur vorherigen Übersicht zurückkehren"
		><span aria-hidden="true">←</span> Zurück</a
	>
	<button
		type="button"
		class="panorama-fullscreen"
		on:click|stopPropagation={toggleFullscreen}
		aria-label={fullscreen ? 'Vollbild schließen' : 'Panorama im Vollbild anzeigen'}
		title={fullscreen ? 'Vollbild schließen' : 'Vollbild'}>{fullscreen ? '×' : '⛶'}</button
	>
	<div class="panorama-loading" class:is-hidden={ready || failed} aria-live="polite">
		360° wird geladen …
	</div>
	{#if failed}<div class="panorama-error" role="status">
			Die interaktive Ansicht konnte nicht geladen werden. Das Vorschaubild bleibt verfügbar.
		</div>{/if}
	<div
		class="panorama-projection-menu"
		class:is-open={menuOpen}
		style={`left:${menuX}px; top:${menuY}px;`}
		role="menu"
		aria-label="Panorama-Ansicht"
	>
		{#each Object.entries(projectionLabels) as [mode, label]}
			<button
				type="button"
				role="menuitem"
				class:is-active={projection === mode}
				on:click|stopPropagation={() => selectProjection(mode)}>{label}</button
			>
		{/each}
	</div>
</section>

<style>
	.panorama-shell {
		position: relative;
		width: min(100%, 1600px);
		max-height: 800px;
		aspect-ratio: 2/1;
		overflow: hidden;
		background: #111;
		border: 1px solid #fff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		touch-action: pan-y;
	}
	.panorama-poster,
	.panorama-canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}
	.panorama-poster {
		z-index: 1;
		object-fit: contain;
		transition: opacity 180ms ease;
	}
	.panorama-canvas {
		z-index: 2;
		opacity: 0;
		pointer-events: none;
		transition: opacity 180ms ease;
	}
	.is-ready .panorama-poster {
		opacity: 0;
	}
	.is-ready .panorama-canvas {
		opacity: 1;
	}
	.panorama-gesture-pad {
		position: absolute;
		z-index: 10;
		top: 50%;
		left: 50%;
		width: min(34%, 180px);
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: none;
		cursor: grab;
		opacity: 0;
		transition: opacity 160ms ease;
	}
	.panorama-gesture-pad span,
	.panorama-gesture-pad span::before,
	.panorama-gesture-pad span::after {
		position: absolute;
		display: block;
		content: '';
		background: rgba(255, 255, 255, 0.78);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
	}
	.panorama-gesture-pad span {
		width: 42px;
		height: 2px;
	}
	.panorama-gesture-pad span::before {
		left: 20px;
		top: -20px;
		width: 2px;
		height: 42px;
	}
	.panorama-gesture-pad span::after {
		left: 17px;
		top: -3px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.show-gesture-hint .panorama-gesture-pad {
		opacity: 0.72;
	}
	.is-dragging .panorama-gesture-pad {
		opacity: 0;
		cursor: grabbing;
	}
	.panorama-back,
	.panorama-fullscreen,
	.panorama-loading,
	.panorama-error {
		position: absolute;
		z-index: 30;
		background: rgba(0, 0, 0, 0.64);
		color: #fff;
		-webkit-backdrop-filter: blur(5px);
		backdrop-filter: blur(5px);
	}
	.panorama-back {
		top: 12px;
		left: 12px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 11px;
		border-radius: 999px;
		font-size: 0.88rem;
		font-weight: 700;
		text-decoration: none;
	}
	.panorama-fullscreen {
		top: 12px;
		right: 12px;
		width: 38px;
		height: 38px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		touch-action: manipulation;
	}
	.panorama-fullscreen:hover,
	.panorama-fullscreen:focus-visible {
		background: rgba(0, 0, 0, 0.82);
	}
	.panorama-loading {
		inset: auto auto 14px 50%;
		transform: translateX(-50%);
		padding: 7px 12px;
		border-radius: 999px;
		font-size: 0.85rem;
		transition: opacity 180ms ease;
	}
	.panorama-loading.is-hidden {
		opacity: 0;
		pointer-events: none;
	}
	.panorama-error {
		left: 12px;
		right: 12px;
		bottom: 12px;
		padding: 9px 12px;
		border-radius: 8px;
		font-size: 0.85rem;
		text-align: center;
	}
	.panorama-projection-menu {
		position: absolute;
		z-index: 40;
		display: none;
		min-width: 180px;
		padding: 6px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.82);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.32);
	}
	.panorama-projection-menu.is-open {
		display: grid;
		gap: 2px;
	}
	.panorama-projection-menu button {
		width: 100%;
		min-height: 34px;
		padding: 7px 10px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: #fff;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.panorama-projection-menu button:hover,
	.panorama-projection-menu button:focus-visible,
	.panorama-projection-menu button.is-active {
		background: rgba(255, 255, 255, 0.18);
	}
	.panorama-shell:fullscreen {
		width: 100vw;
		height: 100vh;
		max-height: none;
		aspect-ratio: auto;
		border: 0;
	}
	@media (max-width: 560px) {
		.panorama-back {
			top: 8px;
			left: 8px;
			padding: 6px 9px;
			font-size: 0.78rem;
		}
		.panorama-fullscreen {
			top: 8px;
			right: 8px;
			width: 34px;
			height: 34px;
		}
		.panorama-gesture-pad {
			width: min(38%, 130px);
		}
	}
</style>
