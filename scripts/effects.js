// Force declaration of variables
"use strict";


function initFramebuffers() {
	var simRes = getResolution(config.SIM_RESOLUTION);
	var dyeRes = getResolution(config.DYE_RESOLUTION);
	
	var texType   = ext.halfFloatTexType;
	var rgba      = ext.formatRGBA;
	var rg        = ext.formatRG;
	var r         = ext.formatR;
	var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
	
	if (dye == null) {
		dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
	} else {
		dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
	}
	
	if (velocity == null) {
		velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
	} else {
		velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
	}
	
	divergence = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
	curl       = createFBO      (simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
	pressure   = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
	
	initBloomFramebuffers();
	initSunraysFramebuffers();
}


function initBloomFramebuffers() {
	var res = getResolution(config.BLOOM_RESOLUTION);
	
	var texType = ext.halfFloatTexType;
	var rgba = ext.formatRGBA;
	var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
	
	bloom = createFBO(res.width, res.height, rgba.internalFormat, rgba.format, texType, filtering);
	
	bloomFramebuffers.length = 0;
	for (var i = 0; i < config.BLOOM_ITERATIONS; i++) {
		var width = res.width >> (i + 1);
		var height = res.height >> (i + 1);
		
		if (width < 2 || height < 2) break;
		
		var fbo = createFBO(width, height, rgba.internalFormat, rgba.format, texType, filtering);
		bloomFramebuffers.push(fbo);
	}
}


function initSunraysFramebuffers() {
	var res = getResolution(config.SUNRAYS_RESOLUTION);
	var texType = ext.halfFloatTexType;
	var r = ext.formatR;
	var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
	sunrays     = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
	sunraysTemp = createFBO(res.width, res.height, r.internalFormat, r.format, texType, filtering);
}


function createFBO(w, h, internalFormat, format, type, param) {
	gl.activeTexture(gl.TEXTURE0);
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
	
	var fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.viewport(0, 0, w, h);
	gl.clear(gl.COLOR_BUFFER_BIT);
	
	var texelSizeX = 1.0 / w;
	var texelSizeY = 1.0 / h;
	
	return {
		texture: texture,
		fbo: fbo,
		width: w,
		height: h,
		texelSizeX: texelSizeX,
		texelSizeY: texelSizeY,
		attach: function attach(id) {
			gl.activeTexture(gl.TEXTURE0 + id);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			return id;
		}
	};
}



function createDoubleFBO(w, h, internalFormat, format, type, param) {
	var fbo1 = createFBO(w, h, internalFormat, format, type, param);
	var fbo2 = createFBO(w, h, internalFormat, format, type, param);
	
	return {
		width: w,
		height: h,
		texelSizeX: fbo1.texelSizeX,
		texelSizeY: fbo1.texelSizeY,
		get read () {
			return fbo1;
		},
		set read (value) {
			fbo1 = value;
		},
		get write () {
			return fbo2;
		},
		set write (value) {
			fbo2 = value;
		},
		swap: function swap() {
			var temp = fbo1;
			fbo1 = fbo2;
			fbo2 = temp;
		}
	}
}



function resizeFBO(target, w, h, internalFormat, format, type, param) {
	var newFBO = createFBO(w, h, internalFormat, format, type, param);
	copyProgram.bind();
	gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
	blit(newFBO.fbo);
	return newFBO;
}


function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
	if (target.width == w && target.height == h) return target;
	target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
	target.write = createFBO(w, h, internalFormat, format, type, param);
	target.width = w;
	target.height = h;
	target.texelSizeX = 1.0 / w;
	target.texelSizeY = 1.0 / h;
	return target;
}


function createTextureAsync(url) {
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));
	
	var obj = {
		texture: texture,
		width: 1,
		height: 1,
		attach: function attach(id) {
			gl.activeTexture(gl.TEXTURE0 + id);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			return id;
		}
	};
	
	var image = new Image();
	image.onload = function() {
		obj.width = image.width;
		obj.height = image.height;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
	};
	image.src = url;
	
	return obj;
}


function updateKeywords() {
	var displayKeywords = [];
	if (config.SHADING) displayKeywords.push("SHADING");
	if (config.BLOOM) displayKeywords.push("BLOOM");
	if (config.SUNRAYS) displayKeywords.push("SUNRAYS");
	displayMaterial.setKeywords(displayKeywords);
}
