// Force declaration of variables
"use strict";


function getWebGLContext(canvas) {
	
	var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
	
	var gl = canvas.getContext('webgl2', params);
	var isWebGL2 = !!gl;
	if (!isWebGL2)
		{ gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params); }
	
	var halfFloat;
	var supportLinearFiltering;
	if (isWebGL2) {
		gl.getExtension('EXT_color_buffer_float');
		supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
	} else {
		halfFloat = gl.getExtension('OES_texture_half_float');
		supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
	}
	
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	
	var halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
	var formatRGBA;
	var formatRG;
	var formatR;
	
	if (isWebGL2)
	{
		formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
		formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
		formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
	}
	else
	{
		formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
		formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
		formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
	}
	
	ga('send', 'event', isWebGL2 ? 'webgl2' : 'webgl', formatRGBA == null ? 'not supported' : 'supported');
	
	return {
		gl: gl,
		ext: {
			formatRGBA: formatRGBA,
			formatRG: formatRG,
			formatR: formatR,
			halfFloatTexType: halfFloatTexType,
			supportLinearFiltering: supportLinearFiltering
		}
	};
	
}


function getSupportedFormat(gl, internalFormat, format, type) {
	if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
		switch (internalFormat) {
			case gl.R16F:
				return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
			case gl.RG16F:
				return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
			default:
				return null;
		}
	}
	
	return {
		internalFormat: internalFormat,
		format: format
	}
}


function supportRenderTextureFormat(gl, internalFormat, format, type) {
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
	
	var fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	
	var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	return status == gl.FRAMEBUFFER_COMPLETE;
}


function captureScreenshot() {
	var res = getResolution(config.CAPTURE_RESOLUTION);
	var target = createFBO(res.width, res.height, ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST);
	render(target);
	
	var texture = framebufferToTexture(target);
	texture = normalizeTexture(texture, target.width, target.height);
	
	var captureCanvas = textureToCanvas(texture, target.width, target.height);
	var datauri = captureCanvas.toDataURL();
	downloadURI('fluid.png', datauri);
	URL.revokeObjectURL(datauri);
}


function framebufferToTexture(target) {
	gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
	var length = target.width * target.height * 4;
	var texture = new Float32Array(length);
	gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.FLOAT, texture);
	return texture;
}


function normalizeTexture(texture, width, height) {
	var result = new Uint8Array(texture.length);
	var id = 0;
	for (var i = height - 1; i >= 0; i--) {
		for (var j = 0; j < width; j++) {
			var nid = i * width * 4 + j * 4;
			result[nid + 0] = clamp01(texture[id + 0]) * 255;
			result[nid + 1] = clamp01(texture[id + 1]) * 255;
			result[nid + 2] = clamp01(texture[id + 2]) * 255;
			result[nid + 3] = clamp01(texture[id + 3]) * 255;
			id += 4;
		}
	}
	return result;
}


function textureToCanvas(texture, width, height) {
	var captureCanvas = document.createElement('canvas');
	var ctx = captureCanvas.getContext('2d');
	captureCanvas.width = width;
	captureCanvas.height = height;
	
	var imageData = ctx.createImageData(width, height);
	imageData.data.set(texture);
	ctx.putImageData(imageData, 0, 0);
	
	return captureCanvas;
}


function downloadURI(filename, uri) {
	var link = document.createElement('a');
	link.download = filename;
	link.href = uri;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
